#!/usr/bin/env python3
import json, os, re, sys, unicodedata
from pathlib import Path
from difflib import SequenceMatcher
from datetime import datetime, timezone, timedelta
import requests

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

FOOTBALL_BASE='https://v3.football.api-sports.io'
BASKETBALL_BASE='https://v1.basketball.api-sports.io'
ROOT=Path(__file__).resolve().parent.parent
TIPS_FILE=ROOT/'tips.json'
ENV_FILE=ROOT/'.env'

if load_dotenv is not None:
    load_dotenv(ENV_FILE)

KEY=os.getenv('API_SPORTS_KEY') or os.getenv('API_FOOTBALL_KEY')
TZ=timezone(timedelta(hours=3))
S=requests.Session()

if not KEY:
    sys.exit('ERROR: set API_SPORTS_KEY in your environment or in a .env file. Never put your key directly in this script.')

def norm(x):
    x=unicodedata.normalize('NFKD',str(x)).encode('ascii','ignore').decode().lower()
    x=re.sub(r'\b(fc|cf|sc|afc|bc|bk)\b','',x)
    return re.sub(r'[^a-z0-9]+',' ',x).strip()

def sim(a,b):
    a,b=norm(a),norm(b)
    aliases={'rfs':'rigas fs'}
    a=aliases.get(a,a); b=aliases.get(b,b)
    if a==b or a.replace(' ','')==b.replace(' ',''): return 1.0
    at,bt=set(a.split()),set(b.split())
    if at & bt: return 0.9
    if ''.join(word[0] for word in b.split()) == a or ''.join(word[0] for word in a.split()) == b: return 0.9
    return SequenceMatcher(None,a,b).ratio()

def split_match(text):
    p=re.split(r'\s+(?:vs?\.?|v)\s+|\s+[–—-]\s+',str(text),maxsplit=1,flags=re.I)
    return (p[0].strip(),p[1].strip()) if len(p)==2 else (None,None)

def api(base,path,params):
    try:
        r=S.get(base+path,params=params,headers={'x-apisports-key':KEY,'Accept':'application/json'},timeout=20)
        if r.status_code == 401:
            raise RuntimeError('API key is invalid or rejected by the provider (401).')
        if r.status_code == 403:
            raise RuntimeError('API access is forbidden (403). Check that the key is active and has access to the requested endpoint.')
        r.raise_for_status()
        d=r.json()
        if d.get('errors'):
            raise RuntimeError(str(d['errors']))
        return d.get('response',[])
    except requests.RequestException as exc:
        raise RuntimeError(f'API request failed for {base}{path}: {exc}') from exc

def football_games(date): return api(FOOTBALL_BASE,'/fixtures',{'date':date,'timezone':'Africa/Nairobi'})
def basketball_games(date): return api(BASKETBALL_BASE,'/games',{'date':date})

def names(game,sport):
    return game.get('teams',{}).get('home',{}).get('name',''), game.get('teams',{}).get('away',{}).get('name','')

def find_game(m,games,sport):
    direct_id=m.get('apiId') or m.get('fixtureId') or m.get('gameId')
    for g in games:
        gid=g.get('fixture',{}).get('id') if sport.lower()=='football' else g.get('id')
        if direct_id and str(gid)==str(direct_id): return g,1.0
    h,a=split_match(m.get('match',''))
    if not h or not a:return None,0
    best,bestscore=None,0
    for g in games:
        gh,ga=names(g,sport)
        score=(sim(h,gh)+sim(a,ga))/2
        reverse=(sim(h,ga)+sim(a,gh))/2
        score=max(score,reverse)
        if score>bestscore:best,bestscore=g,score
    return (best,bestscore) if bestscore>=.84 else (None,bestscore)

def scores(game,sport):
    if sport.lower()=='football':
        return (game.get('fixture',{}).get('status',{}).get('short',''),game.get('goals',{}).get('home'),game.get('goals',{}).get('away'))
    sc=game.get('scores',{})
    return (str(game.get('status',{}).get('short','')),sc.get('home',{}).get('total'),sc.get('away',{}).get('total'))

def finished(status,sport):
    if sport.lower()=='football': return status in {'FT','AET','PEN'}
    return str(status).lower() in {'ft','finished','final','completed'} or 'finished' in str(status).lower()

def evaluate(pick,h,a,sport):
    if h is None or a is None:return None
    p=re.sub(r'\s+',' ',str(pick).lower().strip()); total=h+a
    # combined winner + total markets
    m=re.search(r'(home|away)\s*(?:win|to win)?\s*\+\s*(over|under)\s*(\d+(?:\.\d+)?)',p)
    if m:
        winner=(h>a) if m.group(1)=='home' else (a>h); line=float(m.group(3)); tot=(total>line) if m.group(2)=='over' else (total<line)
        return winner and tot
    m=re.search(r'\b(over|under)\s*(\d+(?:\.\d+)?)',p)
    if m:
        line=float(m.group(2)); return total>line if m.group(1)=='over' else total<line
    if sport.lower()=='football' and ('btts' in p or 'both teams to score' in p):
        yes=h>0 and a>0; return not yes if 'no' in p else yes
    if p in {'home','home win','1','home team','moneyline home','ml home','full time - 1','full time 1'} or 'home win' in p or 'moneyline home' in p:return h>a
    if p in {'away','away win','2','away team','moneyline away','ml away','full time - 2','full time 2'} or 'away win' in p or 'moneyline away' in p:return a>h
    if sport.lower()=='football' and p in {'yes','no'}:
        return (h>0 and a>0) if p=='yes' else not (h>0 and a>0)
    if sport.lower()=='football':
        if p in {'draw','x'}:return h==a
        if p in {'1x','home or draw'}:return h>=a
        if p in {'x2','draw or away'}:return a>=h
        if p in {'12','home or away','no draw'}:return h!=a
    return None

def update_acc(acc):
    st=[m.get('status','Pending') for m in acc.get('matches',[])]
    acc['legsWon']=st.count('Won'); acc['legsLost']=st.count('Lost'); acc['legsPending']=st.count('Pending'); acc['legsTotal']=len(st)
    acc['result']='Lost' if 'Lost' in st else ('Won' if st and all(x=='Won' for x in st) else 'Pending')

def main():
    data=json.loads(TIPS_FILE.read_text(encoding='utf-8'))
    cache={}
    for day in data.get('days',[]):
        date=day.get('date')
        for accs in day.get('odds',{}).values():
            for acc in accs or []:
                sport=acc.get('sport','Football')
                if any(m.get('status') not in {'Won','Lost','Cancelled'} for m in acc.get('matches',[])):
                    try:
                        cache[(date,sport)]=football_games(date) if sport.lower()=='football' else basketball_games(date)
                        print(f'{sport} {date}: {len(cache[(date,sport)])} games')
                    except Exception as e:
                        print(f'API error: {sport} {date} {e}')
                        print('Check that your API key is valid and active for this provider. The script will continue without updating results.')
    changed=False
    for day in data.get('days',[]):
        date=day.get('date')
        for accs in day.get('odds',{}).values():
            for acc in accs or []:
                sport=acc.get('sport','Football'); games=cache.get((date,sport),[])
                for m in acc.get('matches',[]):
                    if m.get('status') in {'Won','Lost','Cancelled'}:
                        m.pop('resultStatus',None)
                        continue
                    g,confidence=find_game(m,games,sport)
                    if not g:
                        m['matchLookup']='Not matched'; continue
                    gid=g.get('fixture',{}).get('id') if sport.lower()=='football' else g.get('id')
                    m['apiId']=gid; m['matchLookup']=f'Matched ({confidence:.0%})'
                    status,h,a=scores(g,sport)
                    if status in {'PST'}: m['status']='Postponed'; changed=True; continue
                    if status in {'CANC','ABD','AWD','WO'}: m['status']='Cancelled'; changed=True; continue
                    if not finished(status,sport):
                        m['status']='Pending'
                        if h is not None:m['homeScore']=h
                        if a is not None:m['awayScore']=a
                        continue
                    m['homeScore']=h; m['awayScore']=a; m['apiStatus']=status
                    out=evaluate(m.get('pick',''),h,a,sport)
                    if out is True:new='Won'
                    elif out is False:new='Lost'
                    else:new='Pending'; m['resultStatus']='Unsupported Market'
                    if out is not None: m.pop('resultStatus',None)
                    if m.get('status')!=new:changed=True
                    m['status']=new
                update_acc(acc)
    if changed:
        data['updatedAt']=datetime.now(TZ).strftime('%Y-%m-%d %H:%M:%S')
        tmp=TIPS_FILE.with_suffix('.tmp'); tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8'); tmp.replace(TIPS_FILE)
        print('tips.json updated.')
    else: print('No settled-result changes.')

if __name__=='__main__': main()
