const DATA_FILE = "tips.json";
const CONFIG_FILE = "config.json";

let tipsData = [];
let config = {};
let selectedDate = "";
let selectedOdds = "2";
let selectedSport = "all";

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

function localDateISO(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function prettyDate(iso) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });
}

function shortDate(iso) {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    month: "2-digit",
    day: "2-digit",
    year: "numeric"
  });
}

function relativeDateLabel(iso) {
  if (!iso) return "";

  const today = new Date();
  const todayIso = localDateISO(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = localDateISO(tomorrow);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = localDateISO(yesterday);

  if (iso === todayIso) return "Today";
  if (iso === tomorrowIso) return "Tomorrow";
  if (iso === yesterdayIso) return "Yesterday";

  return "";
}

function dateBadgeText(iso) {
  if (!iso) return "—";

  const relative = relativeDateLabel(iso);
  if (relative) return relative;

  return shortDate(iso);
}

function headingForSelectedDate(iso) {
  if (!iso) return "Tips";

  const today = new Date();
  const todayIso = localDateISO(today);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowIso = localDateISO(tomorrow);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayIso = localDateISO(yesterday);

  if (iso === todayIso) return "Today's Tips";
  if (iso === tomorrowIso) return "Tomorrow's Tips";
  if (iso === yesterdayIso) return "Yesterday's Tips";

  return `Tips for ${shortDate(iso)}`;
}

function safeUrl(value) {
  return value && value !== "#" ? value : "#";
}

function normalizeResult(value) {
  const text = String(value || "Pending").trim().toLowerCase();

  if (["won", "win", "winner", "success"].includes(text)) return "won";
  if (["lost", "loss", "lose", "failed"].includes(text)) return "lost";
  if (["postponed", "ppd", "postponement", "delay"].includes(text)) return "postponed";
  if (["pending", "not started", "upcoming", "in play", "in-play"].includes(text)) return "pending";

  return text || "pending";
}

function resultLabel(value) {
  const status = normalizeResult(value);
  const labels = {
    won: "Won",
    lost: "Lost",
    postponed: "Postponed",
    pending: "Pending"
  };

  return labels[status] || "Pending";
}

async function loadSite() {
  try {
    const [tipsResponse, configResponse] = await Promise.all([
      fetch(`${DATA_FILE}?v=${Date.now()}`),
      fetch(`${CONFIG_FILE}?v=${Date.now()}`)
    ]);

    if (!tipsResponse.ok || !configResponse.ok) {
      throw new Error("Could not load tips.json or config.json");
    }

    const rawTips = await tipsResponse.json();
    tipsData = Array.isArray(rawTips)
      ? rawTips
      : Array.isArray(rawTips.days)
        ? rawTips.days
        : [];

    config = await configResponse.json();

    applyConfig();
    setupSupportModal();
    initializeDate();
    render();
  } catch (error) {
    console.error(error);
    tipsData = [];
    applyConfig();
    setupSupportModal();
    initializeDate();
    render();
  }
}

function applyConfig() {
  const coffeeBtn = $("#coffeeTop");
  if (coffeeBtn) coffeeBtn.setAttribute("data-target", safeUrl(config.buyMeCoffee || config.telegram || "#"));

  $("#telegramBtn").href = safeUrl(config.telegram);
  $("#facebookBtn").href = safeUrl(config.facebook);
  $("#whatsappBtn").href = safeUrl(config.whatsapp);
  document.title = config.siteTitle || "Stake ń Chill | Free Sports Predictions";
  $("#year").textContent = new Date().getFullYear();
}

function setupSupportModal() {
  const modal = $("#supportModal");
  const closeBtn = $("#closeSupport");
  const coffeeBtn = $("#coffeeTop");

  if (!modal || !coffeeBtn) return;

  const openModal = () => {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  };

  const closeModal = () => {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
  };

  coffeeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    openModal();
  });

  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });
}

function initializeDate() {
  const today = localDateISO();
  const picker = $("#datePicker");

  picker.value = today;
  selectedDate = today;

  picker.addEventListener("change", () => {
    selectedDate = picker.value || today;
    render();
    $("#tips").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  $("#todayBtn").addEventListener("click", () => {
    selectedDate = today;
    picker.value = today;
    render();
  });

  $$(".odds-tab").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedOdds = btn.dataset.odds;
      $$(".odds-tab").forEach(x => x.classList.toggle("active", x === btn));
      render();
    });
  });

  $$(".filter").forEach(btn => {
    btn.addEventListener("click", () => {
      selectedSport = btn.dataset.sport;
      $$(".filter").forEach(x => x.classList.toggle("active", x === btn));
      render();
    });
  });
}

function renderEmptyState(message, detail = "Check back soon for the latest picks.") {
  const grid = $("#tipsGrid");
  const empty = $("#emptyState");
  const emptyTitle = empty.querySelector("h3");
  const emptyText = empty.querySelector("p");

  grid.innerHTML = "";
  emptyTitle.textContent = message;
  emptyText.textContent = detail;
  empty.classList.remove("hidden");
}

function render() {
  $("#selectedDateText").textContent = dateBadgeText(selectedDate);
  $("#tipsTitle").textContent = headingForSelectedDate(selectedDate);

  const relativeLabel = relativeDateLabel(selectedDate);
  $("#todayBtn").textContent = relativeLabel || "";
  $("#todayBtn").style.visibility = relativeLabel ? "visible" : "hidden";

  const day = tipsData.find(item => item.date === selectedDate);
  let picks = day?.odds?.[selectedOdds] || [];

  if (selectedSport !== "all") {
    picks = picks.filter(p => String(p.sport).toLowerCase() === selectedSport.toLowerCase());
  }

  $("#summary").textContent = day
    ? `${picks.length} pick${picks.length === 1 ? "" : "s"} shown • ${selectedOdds}-odds section`
    : "";

  const grid = $("#tipsGrid");
  const empty = $("#emptyState");

  if (!day || !picks.length) {
    if (selectedDate === localDateISO()) {
      renderEmptyState("No tips available for today yet.", "Check back soon for the latest predictions.");
    } else {
      renderEmptyState("No predictions available for this day.", "Try another date or check back later for new picks.");
    }
    return;
  }

  empty.classList.add("hidden");
  grid.innerHTML = picks.map(p => {
    const matches = Array.isArray(p.matches) && p.matches.length
      ? p.matches
      : [{
          match: p.match || "Match",
          pick: p.pick || "—",
          odds: p.odds ?? "—",
          time: p.time || "",
          status: p.status || p.result || "Pending"
        }];

    const status = resultLabel(p.result || p.status || matches[0].status || "Pending");
    const statusClass = normalizeResult(p.result || p.status || matches[0].status || "Pending");
    const combinedOdds = p.combinedOdds ?? matches.reduce((total, match) => {
      const oddsValue = Number(match.odds);
      return total * (Number.isFinite(oddsValue) && oddsValue > 0 ? oddsValue : 1);
    }, 1);

    return `
      <article class="tip-card slip-card">
        <div class="tip-top">
          <div class="tip-meta">
            <span class="tag">${escapeHtml(p.sport || "SPORT").toUpperCase()}</span>
            <span class="league">${escapeHtml(p.league || "")}</span>
          </div>
          <span class="result-badge result-${statusClass}">${escapeHtml(status)}</span>
        </div>

        <div class="slip-summary">
          <span class="slip-label">Slip odds</span>
          <strong>${escapeHtml(Number(combinedOdds).toFixed(2))}</strong>
        </div>

        <div class="pick-list">
          ${matches.map(match => `
            <div class="slip-match">
              <div class="match-main">
                <div class="match-name">${escapeHtml(match.match || "Match")}</div>
                <div class="match-time">${escapeHtml(match.time || "")}</div>
              </div>
              <div class="match-side">
                <div class="match-pick">${escapeHtml(match.pick || "—")}</div>
                <div class="match-odds">${escapeHtml(String(match.odds ?? "—"))}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}
  // Render featured tip (Tip of the Day) if present
  const featuredEl = document.getElementById('featured');
  if (day && day.featured && featuredEl) {
    const f = day.featured;
    const fm = f.match || {};
    featuredEl.classList.remove('hidden');
    featuredEl.setAttribute('aria-hidden', 'false');
    featuredEl.innerHTML = `
      <div class="featured-card">
        <div class="featured-head">
          <h3>${escapeHtml(f.title || 'Tip of the Day')}</h3>
          <p class="featured-desc">${escapeHtml(f.description || '')}</p>
        </div>
        <div class="featured-body">
          <div class="match-name">${escapeHtml(fm.match || '')}</div>
          <div class="match-pick">${escapeHtml(fm.pick || '')} <span class="match-odds">${escapeHtml(String(fm.odds ?? ''))}</span></div>
          <div class="match-time">${escapeHtml(fm.time || '')}</div>
        </div>
      </div>
    `;
  } else if (featuredEl) {
    featuredEl.classList.add('hidden');
    featuredEl.setAttribute('aria-hidden', 'true');
    featuredEl.innerHTML = '';
  }

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

loadSite();
