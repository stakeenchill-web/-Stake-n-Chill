# Stake ń Chill — Static Website

## Folder
- index.html — website
- style.css — design
- script.js — calendar/filter/tips logic
- tips.json — YOUR DAILY TIPS DATA
- config.json — YOUR SOCIAL LINKS
- assets/stake-n-chill-logo.png — supplied logo

## Important
The website reads `tips.json` and `config.json` in the same folder.

### Add social links
Open `config.json` and replace:
- YOUR_TELEGRAM_CHANNEL
- YOUR_FACEBOOK_PAGE
- YOUR_WHATSAPP_CHANNEL

The email is already set to stakeenchill@gmail.com.

### Add tips
`tips.json` is organized by date. Each slip is stored as one item inside the odds bucket for the selected day.

Use this format:

{
  "updatedAt": "2026-09-03",
  "days": [
    {
      "date": "2026-09-03",
      "odds": {
        "2": [
          {
            "sport": "Football",
            "league": "Premier League",
            "result": "Pending",
            "combinedOdds": 2.17,
            "matches": [
              {
                "match": "Palermo FC vs Mantova 1911",
                "pick": "Over 2.5",
                "odds": 1.76,
                "time": "19:00",
                "status": "Pending"
              },
              {
                "match": "RKS Rakow Czestochowa vs Gornik Zabrze",
                "pick": "Over 1.5",
                "odds": 1.23,
                "time": "19:00",
                "status": "Pending"
              }
            ]
          }
        ],
        "3": [],
        "5": []
      }
    }
  ]
}

How to update results:
- Use `result`: "Pending", "Won", "Lost", or "Postponed"
- You can also set each match's `status` to the same values
- If a slip has already finished, update the slip result manually
- The website can display the correct badge automatically based on that value

Important:
- This is not automatically pulled from a betting site or API.
- If you want the status to change to Won or Lost, you must update the JSON manually after the result is known.
- You can later connect this to an API if you want automatic updates in the future.

The supplied starter `tips.json` is intentionally empty so you can paste your own picks.

## Testing
Because browsers can restrict `fetch()` when a JSON file is opened directly with `file://`, test it through a local HTTP server or upload it to a static host.

GitHub Pages is a suitable option for this kind of static HTML/CSS/JS site.

## Repository upload notes

- **Do not commit your virtual environment or build artifacts.** Additions like `.venv/`, `venv/`, and `dist/` are ignored via the project's `.gitignore` file. Commit only the source files and dependency lists.
- **Local environment secrets:** keep API keys and secrets out of the repo. Use a `.env` file (ignored) or set environment variables when running `automation/update_results.py`.
- **Dependencies:** Python dependencies for the automation script are listed in `requirements.txt`. Install with:

```bash
pip install -r requirements.txt
```

- **If you must upload build artifacts:** use GitHub Releases (attach a ZIP) or the web UI to upload a single zip file. For files larger than 100 MB, use Git LFS or Releases — GitHub rejects pushes with files over 100 MB.

- **Uploading via GitHub web UI:** after logging in, go to your repository → `Add file` → `Upload files`, then drag the ZIP or files. For many files (like a venv) prefer zipping them first.
