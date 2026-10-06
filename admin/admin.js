// ============================================================
// STAKE N CHILL - ADMIN PANEL
// Static Admin Panel + Cloudflare Worker + GitHub
// ============================================================

// Your deployed Cloudflare Worker
const API_URL =
  "https://stake-n-chill-admin.stakeenchill.workers.dev/publish";

// Public tips file
const DATA = "../tips.json";

const TIP_FEEDS = [
  {
    group: "free",
    source: "Mchumwa",
    url: "https://mchumwasure.top/api/free-tips"
  },
  {
    group: "free",
    source: "Fasttrack",
    url: "https://fasttrack.smartwiseagencies.com/api/free-tips"
  },
  {
    group: "vip",
    source: "Mchumwa",
    url: "https://mchumwasure.top/api/vip-tips"
  },
  {
    group: "vip",
    source: "Fasttrack",
    url: "https://fasttrack.smartwiseagencies.com/api/vip-tips"
  }
];

const tipCategories = {
  free: ["sure", "kickstart", "over", "under", "gg", "free"],
  vip: ["htft", "quantum", "daily", "surestreak"]
};

// ============================================================
// GLOBAL STATE
// ============================================================

let tips = {
  updatedAt: "",
  days: []
};

let pw = "";
let date = "";
let odds = "2";
let apiTips = [];
let selectedApiTips = new Set();
let feedStatuses = {
  free: "Not loaded",
  vip: "Not loaded"
};

// ============================================================
// HELPERS
// ============================================================

const $ = id => document.getElementById(id);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const today = () => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

const validOddsTypes = ["2", "3", "5"];

function defaultFeatured() {
  return {
    title: "Tip of the Day",
    description: "",
    match: {
      match: "",
      pick: "",
      odds: 1,
      time: "",
      status: "Pending"
    }
  };
}

function ensureFeaturedStructure(featured) {
  const safeFeatured = featured && typeof featured === "object" ? featured : {};

  safeFeatured.title ??= "Tip of the Day";
  safeFeatured.description ??= "";
  safeFeatured.match ??= {};
  safeFeatured.match.match ??= "";
  safeFeatured.match.pick ??= "";
  safeFeatured.match.odds ??= 1;
  safeFeatured.match.time ??= "";
  safeFeatured.match.status ??= "Pending";

  return safeFeatured;
}

// ============================================================
// GET / CREATE SELECTED DAY
// ============================================================

function day() {
  let d = tips.days.find(x => x.date === date);

  if (!d) {
    d = {
      date,
      featured: defaultFeatured(),
      odds: {
        "2": [],
        "3": [],
        "5": []
      }
    };

    tips.days.push(d);
  }

  d.featured = ensureFeaturedStructure(d.featured);
  d.odds ??= {};

  for (const k of validOddsTypes) {
    d.odds[k] ??= [];
  }

  return d;
}

// ============================================================
// GET CURRENT ODDS LIST
// ============================================================

function list() {
  return day().odds[odds];
}

function normalizeApiTip(rawTip, feed) {
  if (!rawTip || typeof rawTip !== "object") return null;

  const category = String(rawTip.category || "").toLowerCase();
  const matchName = [rawTip.team_one, rawTip.team_two]
    .map(value => String(value || "").trim())
    .filter(Boolean)
    .join(" vs ");
  const tipOdds = Number.parseFloat(rawTip.odds_value);
  const tipId = String(rawTip.id ?? `${matchName}:${rawTip.tips_name || ""}`);

  if (
    !tipCategories[feed.group].includes(category) ||
    !matchName ||
    !String(rawTip.tips_name || "").trim() ||
    !Number.isFinite(tipOdds) ||
    tipOdds <= 1
  ) {
    return null;
  }

  return {
    key: `${feed.group}:${feed.source}:${tipId}`,
    group: feed.group,
    source: feed.source,
    category,
    league: String(rawTip.league_name || "Various"),
    match: matchName,
    pick: String(rawTip.tips_name).trim(),
    odds: tipOdds,
    time: String(rawTip.time || "").slice(0, 5),
    status: String(rawTip.status || "Pending"),
    id: tipId
  };
}

function renderTipFeeds() {
  for (const group of ["free", "vip"]) {
    const container = $(group === "free" ? "freeTipCategories" : "vipTipCategories");
    const status = $(group === "free" ? "freeFeedStatus" : "vipFeedStatus");

    if (status) status.textContent = feedStatuses[group];
    if (!container) continue;

    container.innerHTML = tipCategories[group].map(category => {
      const categoryTips = apiTips.filter(tip =>
        tip.group === group && tip.category === category
      );

      const rows = categoryTips.length
        ? categoryTips.map(tip => `
            <label class="api-tip ${selectedApiTips.has(tip.key) ? "is-selected" : ""}">
              <input
                type="checkbox"
                data-api-tip="${esc(tip.key)}"
                ${selectedApiTips.has(tip.key) ? "checked" : ""}
              >
              <span class="api-tip-content">
                <span class="api-tip-meta">
                  <span class="api-tip-source">${esc(tip.source)} API</span>
                  <span>${esc(tip.league)}</span>
                </span>
                <strong>${esc(tip.match)}</strong>
                <span>${esc(tip.pick)} · ${tip.odds.toFixed(2)} odds</span>
                <span class="small">${esc(tip.time || "Time not set")} · ${esc(tip.status)}</span>
              </span>
            </label>
          `).join("")
        : `<p class="category-empty">No ${esc(category)} tips from the loaded feeds.</p>`;

      return `
        <section class="tip-category">
          <h4>${esc(category)}</h4>
          <div class="api-tip-list">${rows}</div>
        </section>
      `;
    }).join("");
  }

  updateTipSelectionControls();
}

function updateTipSelectionControls() {
  const count = selectedApiTips.size;
  const countLabel = $("selectedTipCount");
  const addButton = $("addSelectedTips");

  if (countLabel) {
    countLabel.textContent = `${count} tip${count === 1 ? "" : "s"} selected`;
  }

  if (addButton) {
    addButton.textContent = `Add selected to ${odds} Odds`;
    addButton.disabled = count === 0;
  }
}

async function loadApiTips() {
  apiTips = [];
  selectedApiTips.clear();
  feedStatuses = { free: "Loading…", vip: "Loading…" };
  renderTipFeeds();

  const results = await Promise.allSettled(TIP_FEEDS.map(async feed => {
    const response = await fetch(feed.url, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`${feed.source} ${feed.group} tips returned HTTP ${response.status}`);
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) {
      throw new Error(`${feed.source} ${feed.group} tips returned an invalid response`);
    }

    const normalizedTips = payload.data
      .map(rawTip => normalizeApiTip(rawTip, feed))
      .filter(Boolean);

    return {
      group: feed.group,
      source: feed.source,
      tips: normalizedTips,
      invalidCount: payload.data.length - normalizedTips.length
    };
  }));

  const groupResults = { free: [], vip: [] };
  const groupErrors = { free: [], vip: [] };

  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      groupResults[result.value.group].push(result.value);
      apiTips.push(...result.value.tips);
    } else {
      const feed = TIP_FEEDS[index];
      const errorMessage = result.reason?.message || "Request failed";
      groupErrors[feed.group].push(`${feed.source}: ${errorMessage}`);
      console.error(`Could not load ${feed.source} ${feed.group} API tips:`, result.reason);
    }
  });

  for (const group of ["free", "vip"]) {
    const sources = groupResults[group];
    const tipsCount = sources.reduce((sum, source) => sum + source.tips.length, 0);
    const invalidCount = sources.reduce((sum, source) => sum + source.invalidCount, 0);
    const failedSources = 2 - sources.length;

    feedStatuses[group] = `${tipsCount} tips · ${sources.length}/2 APIs loaded`;
    if (failedSources) feedStatuses[group] += ` · ${groupErrors[group].join("; ")}`;
    if (invalidCount) feedStatuses[group] += ` · ${invalidCount} invalid tip${invalidCount === 1 ? "" : "s"} skipped`;
  }
  renderTipFeeds();
  renderTipFeeds();
}

function addSelectedApiTips() {
  const selectedTips = apiTips.filter(tip => selectedApiTips.has(tip.key));
  if (!selectedTips.length) return;

  const matches = selectedTips.map(tip => ({
    match: tip.match,
    pick: tip.pick,
    odds: tip.odds,
    time: tip.time,
    status: ["Pending", "Won", "Lost", "Void"].includes(tip.status)
      ? tip.status
      : "Pending",
    apiSource: tip.source,
    apiCategory: tip.category,
    apiTipId: tip.id
  }));

  const leagues = [...new Set(selectedTips.map(tip => tip.league))];
  list().push({
    sport: "Football",
    league: leagues.length === 1 ? leagues[0] : "Various",
    result: "Pending",
    combinedOdds: 0,
    matches
  });

  selectedApiTips.clear();
  renderTipFeeds();
  render();

  const message = $("msg");
  if (message) {
    message.textContent =
      `${matches.length} selected tip${matches.length === 1 ? "" : "s"} added to ${odds} Odds.`;
  }
}

// ============================================================
// CALCULATE COMBINED ODDS
// ============================================================

function total(accumulator) {
  if (!accumulator || !Array.isArray(accumulator.matches)) {
    return 0;
  }

  if (accumulator.matches.length === 0) {
    return 0;
  }

  return accumulator.matches.reduce((result, match) => {
    const value = parseFloat(match.odds);

    if (!Number.isFinite(value) || value <= 0) {
      return result;
    }

    return result * value;
  }, 1);
}

// ============================================================
// UPDATE COMBINED ODDS
// ============================================================

function updateCombinedOdds(accumulator) {
  accumulator.combinedOdds = Number(total(accumulator).toFixed(2));
}

// ============================================================
// UPDATE ALL COMBINED ODDS
// ============================================================

function updateAllCombinedOdds() {
  for (const d of tips.days || []) {
    for (const type of validOddsTypes) {
      const accumulators = d.odds?.[type] || [];

      accumulators.forEach(accumulator => {
        updateCombinedOdds(accumulator);
      });
    }
  }
}

// ============================================================
// RENDER ADMIN LIST
// ============================================================

function render() {
  const title = $("title");

  if (title) {
    title.textContent = odds + " Odds";
  }

  renderFeaturedEditor();

  const l = $("list");

  if (!l) return;

  l.innerHTML = "";

  const currentList = list();

  if (!currentList.length) {
    l.innerHTML = `
      <div class="empty">
        <p>No ${esc(odds)} odds tips for ${esc(date)}.</p>
        <p>Click <b>+ New Accumulator</b> to add one.</p>
      </div>
    `;

    preview();
    return;
  }

  currentList.forEach((accumulator, i) => {

    accumulator.matches ??= [];

    const combined = total(accumulator);

    const x = document.createElement("div");

    x.className = "acc";

    x.innerHTML = `
      <div class="acchead">

        <label>
          Sport

          <select
            data-a="${i}"
            data-f="sport"
          >
            <option value="Football"
              ${accumulator.sport === "Football" ? "selected" : ""}>
              Football
            </option>

            <option value="Basketball"
              ${accumulator.sport === "Basketball" ? "selected" : ""}>
              Basketball
            </option>
          </select>
        </label>

        <label>
          League

          <input
            data-a="${i}"
            data-f="league"
            value="${esc(accumulator.league || "")}"
            placeholder="League"
          >
        </label>

        <label>
          Result

          <select
            data-a="${i}"
            data-f="result"
          >
            <option value="Pending"
              ${accumulator.result === "Pending" || !accumulator.result ? "selected" : ""}>
              Pending
            </option>

            <option value="Won"
              ${accumulator.result === "Won" ? "selected" : ""}>
              Won
            </option>

            <option value="Lost"
              ${accumulator.result === "Lost" ? "selected" : ""}>
              Lost
            </option>

            <option value="Void"
              ${accumulator.result === "Void" ? "selected" : ""}>
              Void
            </option>
          </select>
        </label>

        <button
          type="button"
          data-del="${i}"
        >
          Delete
        </button>

      </div>

      <div class="oddsTotal">
        Combined odds:
        <strong>${combined.toFixed(2)}</strong>
      </div>

      <div class="matches"></div>

      <button
        type="button"
        data-add="${i}"
      >
        + Add Match
      </button>
    `;

    const mbox = x.querySelector(".matches");

    accumulator.matches.forEach((match, j) => {

      const r = document.createElement("div");

      r.className = "match";

      r.innerHTML = `
        <label>
          Match

          <input
            data-a="${i}"
            data-m="${j}"
            data-f="match"
            value="${esc(match.match || "")}"
            placeholder="Team A vs Team B"
          >
        </label>

        <label>
          Pick

          <input
            data-a="${i}"
            data-m="${j}"
            data-f="pick"
            value="${esc(match.pick || "")}"
            placeholder="Over 2.5"
          >
        </label>

        <label>
          Odds

          <input
            type="number"
            min="1.01"
            step="0.01"
            data-a="${i}"
            data-m="${j}"
            data-f="odds"
            value="${match.odds ?? 1}"
          >
        </label>

        <label>
          Time

          <input
            type="time"
            data-a="${i}"
            data-m="${j}"
            data-f="time"
            value="${esc(match.time || "")}"
          >
        </label>

        <label>
          Status

          <select
            data-a="${i}"
            data-m="${j}"
            data-f="status"
          >
            <option value="Pending"
              ${match.status === "Pending" || !match.status ? "selected" : ""}>
              Pending
            </option>

            <option value="Won"
              ${match.status === "Won" ? "selected" : ""}>
              Won
            </option>

            <option value="Lost"
              ${match.status === "Lost" ? "selected" : ""}>
              Lost
            </option>

            <option value="Void"
              ${match.status === "Void" ? "selected" : ""}>
              Void
            </option>
          </select>
        </label>

        <button
          type="button"
          data-delm="${i},${j}"
        >
          ×
        </button>
      `;

      mbox.appendChild(r);
    });

    l.appendChild(x);
  });

  preview();
}

// ============================================================
// PREVIEW
// ============================================================

function renderFeaturedEditor() {
  const featured = day().featured;

  const title = $("featuredTitle");
  const description = $("featuredDescription");
  const match = $("featuredMatch");
  const pick = $("featuredPick");
  const oddsInput = $("featuredOdds");
  const time = $("featuredTime");
  const status = $("featuredStatus");

  if (title) title.value = featured.title || "Tip of the Day";
  if (description) description.value = featured.description || "";
  if (match) match.value = featured.match?.match || "";
  if (pick) pick.value = featured.match?.pick || "";
  if (oddsInput) oddsInput.value = featured.match?.odds ?? 1;
  if (time) time.value = featured.match?.time || "";
  if (status) status.value = featured.match?.status || "Pending";
}

function preview() {

  const p = $("preview");

  if (!p) return;

  p.innerHTML = "";

  const featured = day().featured;

  const featuredPreview = document.createElement("div");

  featuredPreview.className = "preview feature-preview";

  featuredPreview.innerHTML = `
    <div class="small">Tip of the Day</div>

    <b>
      ${esc(featured.title || "Tip of the Day")}
    </b>

    <p>
      ${esc(featured.description || "Add a description for this featured tip.")}
    </p>

    <p>
      <b>
        ${esc(featured.match?.match || "Match")}
      </b>

      <br>

      ${esc(featured.match?.pick || "Pick")}
      @
      ${Number(featured.match?.odds || 0).toFixed(2)}

      <br>

      <span class="small">
        ${esc(featured.match?.time || "")}
        ·
        ${esc(featured.match?.status || "Pending")}
      </span>
    </p>
  `;

  p.appendChild(featuredPreview);

  const currentList = list();

  if (!currentList.length) {
    const empty = document.createElement("div");

    empty.className = "preview";
    empty.innerHTML = `<p>No tips available for this date.</p>`;

    p.appendChild(empty);

    return;
  }

  currentList.forEach(accumulator => {

    const combined = total(accumulator);

    const x = document.createElement("div");

    x.className = "preview";

    x.innerHTML = `
      <div class="small">
        ${esc(accumulator.sport || "Sport")}
        ·
        ${esc(accumulator.league || "Various")}
      </div>

      <b>
        ${esc(odds)} Odds · ${combined.toFixed(2)}
      </b>
    `;

    (accumulator.matches || []).forEach(match => {

      const status = match.status || "Pending";

      x.innerHTML += `
        <p>
          <b>
            ${esc(match.match || "Match")}
          </b>

          <br>

          ${esc(match.pick || "Pick")}
          @
          ${Number(match.odds || 0).toFixed(2)}

          <br>

          <span class="small">
            ${esc(match.time || "")}
            ·
            ${esc(status)}
          </span>
        </p>
      `;
    });

    p.appendChild(x);
  });
}

// ============================================================
// LOAD TIPS.JSON
// ============================================================

async function load() {

  const msg = $("msg");

  try {

    if (msg) {
      msg.textContent = "Loading tips…";
    }

    const response = await fetch(
      DATA + "?v=" + Date.now(),
      {
        cache: "no-store"
      }
    );

    if (!response.ok) {
      throw new Error(
        "tips.json returned HTTP " + response.status
      );
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.days)) {

      tips = {
        updatedAt: "",
        days: []
      };

    } else {

      tips = data;

    }

    updateAllCombinedOdds();

    if (msg) {
      msg.textContent = "Tips loaded.";
    }

  } catch (error) {

    console.error("Could not load tips.json:", error);

    tips = {
      updatedAt: "",
      days: []
    };

    if (msg) {
      msg.textContent =
        "Could not load tips.json. You can create new tips.";
    }
  }

  render();
}

// ============================================================
// LOGIN
// ============================================================

async function login() {

  const password = $("password");
  const loginButton = $("loginBtn");
  const loginErr = $("loginErr");

  if (!password) return;

  pw = password.value.trim();

  if (!pw) {
    if (loginErr) {
      loginErr.textContent =
        "Enter your password.";
    }

    return;
  }

  if (loginErr) {
    loginErr.textContent = "";
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Checking…";
  }

  try {
    const response = await fetch(
      API_URL.replace(/\/publish$/, "/auth"),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password: pw })
      }
    );

    if (!response.ok) {
      pw = "";

      if (loginErr) {
        loginErr.textContent =
          response.status === 401 ? "Wrong password." : "Login failed. Try again.";
      }

      return;
    }

    $("login").classList.add("hidden");
    $("app").classList.remove("hidden");

  } catch (error) {
    console.error("Could not verify admin password:", error);
    pw = "";

    if (loginErr) {
      loginErr.textContent =
        "Could not verify password. Check the Worker connection.";
    }

    return;

  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Continue";
    }
  }

  date = $("date").value = today();

  load();
  loadApiTips();
}

// ============================================================
// VALIDATE TIPS BEFORE PUBLISHING
// ============================================================

function validateTips() {

  if (!tips || !Array.isArray(tips.days)) {

    return {
      valid: false,
      message: "Invalid tips data."
    };
  }

  const selectedDay = tips.days.find(
    d => d.date === date
  );

  if (!selectedDay) {

    return {
      valid: false,
      message: "No tips exist for " + date + "."
    };
  }

  const currentList =
    selectedDay.odds?.[odds] || [];

  if (!currentList.length) {

    return {
      valid: false,
      message:
        "There are no " +
        odds +
        " odds accumulators for " +
        date +
        "."
    };
  }

  for (let i = 0; i < currentList.length; i++) {

    const accumulator = currentList[i];

    if (
      !accumulator.matches ||
      !Array.isArray(accumulator.matches) ||
      accumulator.matches.length === 0
    ) {

      return {
        valid: false,
        message:
          `${odds} odds accumulator #${i + 1} has no matches.`
      };
    }

    for (
      let j = 0;
      j < accumulator.matches.length;
      j++
    ) {

      const match = accumulator.matches[j];

      if (!match.match?.trim()) {

        return {
          valid: false,
          message:
            `Accumulator #${i + 1}, match #${j + 1} is missing the match name.`
        };
      }

      if (!match.pick?.trim()) {

        return {
          valid: false,
          message:
            `Accumulator #${i + 1}, match #${j + 1} is missing the pick.`
        };
      }

      const matchOdds =
        parseFloat(match.odds);

      if (
        !Number.isFinite(matchOdds) ||
        matchOdds <= 1
      ) {

        return {
          valid: false,
          message:
            `Accumulator #${i + 1}, match #${j + 1} has invalid odds.`
        };
      }
    }
  }

  return {
    valid: true,
    message: "OK"
  };
}

// ============================================================
// PUBLISH TO CLOUDFLARE WORKER
// ============================================================

async function publish() {

  const msg = $("msg");
  const publishButton = $("publish");

  if (!API_URL || API_URL.includes("YOUR-WORKER")) {

    if (msg) {
      msg.textContent =
        "Cloudflare Worker URL is not configured.";
    }

    return;
  }

  if (!pw) {

    if (msg) {
      msg.textContent =
        "Please log in first.";
    }

    return;
  }

  // Validate
  const validation = validateTips();

  if (!validation.valid) {

    if (msg) {
      msg.textContent =
        validation.message;
    }

    return;
  }

  // Update combined odds
  updateAllCombinedOdds();

  // Update timestamp
  tips.updatedAt =
    new Date()
      .toISOString()
      .replace("T", " ")
      .slice(0, 19);

  // Disable button
  if (publishButton) {
    publishButton.disabled = true;
    publishButton.textContent = "Publishing…";
  }

  if (msg) {
    msg.textContent =
      "Publishing tips to GitHub…";
  }

  try {

    const response = await fetch(
      API_URL,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + pw
        },

        body: JSON.stringify({
          data: tips
        })
      }
    );

    let result;

    try {

      result = await response.json();

    } catch {

      throw new Error(
        "Worker returned an invalid response."
      );
    }

    if (!response.ok) {

      throw new Error(
        result.error ||
        result.message ||
        "Publish failed."
      );
    }

    if (msg) {

      msg.textContent =
        "Published successfully. tips.json has been updated.";
    }

    console.log(
      "Stake ń Chill tips published:",
      result
    );

  } catch (error) {

    console.error(
      "Publishing error:",
      error
    );

    if (msg) {

      msg.textContent =
        error.message ||
        "Publishing failed.";
    }

  } finally {

    if (publishButton) {

      publishButton.disabled = false;
      publishButton.textContent = "Publish";
    }
  }
}

// ============================================================
// LOGIN EVENTS
// ============================================================

if ($("loginBtn")) {
  $("loginBtn").onclick = login;
}

if ($("password")) {

  $("password").onkeydown = event => {

    if (event.key === "Enter") {
      login();
    }

  };
}

// ============================================================
// DATE CHANGE
// ============================================================

if ($("date")) {

  $("date").onchange = event => {

    date = event.target.value;

    load();
  };

}

// ============================================================
// ODDS TYPE CHANGE
// ============================================================

if ($("odds")) {

  $("odds").onchange = event => {

    const selected = event.target.value;

    if (validOddsTypes.includes(selected)) {

      odds = selected;

    } else {

      odds = "2";

    }
    updateTipSelectionControls();
    render();
  };

}

// ============================================================
// NEW ACCUMULATOR
// ============================================================

if ($("newAcc")) {

  $("newAcc").onclick = () => {

    list().push({

      sport: "Football",

      league: "",

      result: "Pending",

      combinedOdds: 0,

      matches: []

    });

    render();
  };

}

if ($("refreshApiTips")) {
  $("refreshApiTips").onclick = loadApiTips;
}

if ($("addSelectedTips")) {
  $("addSelectedTips").onclick = addSelectedApiTips;
}

if ($("clearSelectedTips")) {
  $("clearSelectedTips").onclick = () => {
    selectedApiTips.clear();
    renderTipFeeds();
  };
}

for (const groupContainerId of ["freeTipCategories", "vipTipCategories"]) {
  const groupContainer = $(groupContainerId);

  if (groupContainer) {
    groupContainer.onchange = event => {
      const checkbox = event.target.closest("input[data-api-tip]");
      if (!checkbox) return;

      if (checkbox.checked) {
        selectedApiTips.add(checkbox.dataset.apiTip);
      } else {
        selectedApiTips.delete(checkbox.dataset.apiTip);
      }

      checkbox.closest(".api-tip").classList.toggle("is-selected", checkbox.checked);
      updateTipSelectionControls();
    };
  }
}

// ============================================================
// PUBLISH BUTTON
// ============================================================

if ($("publish")) {
  $("publish").onclick = publish;
}

// ============================================================
// BUTTON EVENTS INSIDE LIST
// ============================================================

if ($("list")) {

  $("list").onclick = event => {

    const button =
      event.target.closest("button");

    if (!button) return;

    // Delete accumulator
    if (button.dataset.del !== undefined) {

      const index =
        Number(button.dataset.del);

      if (
        confirm(
          "Delete this accumulator?"
        )
      ) {

        list().splice(index, 1);
      }

      render();

      return;
    }

    // Add match
    if (button.dataset.add !== undefined) {

      const index =
        Number(button.dataset.add);

      list()[index].matches ??= [];

      list()[index].matches.push({

        match: "",

        pick: "",

        odds: 1,

        time: "",

        status: "Pending"

      });

      render();

      return;
    }

    // Delete match
    if (button.dataset.delm) {

      const [accumulatorIndex, matchIndex] =
        button.dataset.delm
          .split(",")
          .map(Number);

      list()[accumulatorIndex]
        .matches
        .splice(matchIndex, 1);

      render();

      return;
    }

  };

}

// ============================================================
// INPUT / SELECT EVENTS
// ============================================================

if ($("featuredTitle")) {
  $("featuredTitle").oninput = event => {
    day().featured.title = event.target.value || "Tip of the Day";
    preview();
  };
}

if ($("featuredDescription")) {
  $("featuredDescription").oninput = event => {
    day().featured.description = event.target.value;
    preview();
  };
}

if ($("featuredMatch")) {
  $("featuredMatch").oninput = event => {
    day().featured.match.match = event.target.value;
    preview();
  };
}

if ($("featuredPick")) {
  $("featuredPick").oninput = event => {
    day().featured.match.pick = event.target.value;
    preview();
  };
}

if ($("featuredOdds")) {
  $("featuredOdds").oninput = event => {
    const value = parseFloat(event.target.value);
    day().featured.match.odds = Number.isFinite(value) ? value : 1;
    preview();
  };
}

if ($("featuredTime")) {
  $("featuredTime").oninput = event => {
    day().featured.match.time = event.target.value;
    preview();
  };
}

if ($("featuredStatus")) {
  $("featuredStatus").onchange = event => {
    day().featured.match.status = event.target.value;
    preview();
  };
}

if ($("list")) {

  $("list").oninput = event => {

    const target = event.target;

    if (!target.dataset.f) return;

    const accumulatorIndex =
      Number(target.dataset.a);

    const accumulator =
      list()[accumulatorIndex];

    if (!accumulator) return;

    // Accumulator-level field
    if (target.dataset.m === undefined) {

      accumulator[target.dataset.f] =
        target.value;

      updateCombinedOdds(accumulator);

      preview();

      return;
    }

    // Match-level field
    const matchIndex =
      Number(target.dataset.m);

    const match =
      accumulator.matches?.[matchIndex];

    if (!match) return;

    if (target.dataset.f === "odds") {

      const value =
        parseFloat(target.value);

      match.odds =
        Number.isFinite(value)
          ? value
          : 1;

    } else {

      match[target.dataset.f] =
        target.value;
    }

    updateCombinedOdds(accumulator);

    renderOddsTotalOnly(accumulatorIndex);

    preview();
  };

  // Handle SELECT changes
  $("list").onchange = event => {

    const target = event.target;

    if (!target.dataset.f) return;

    const accumulatorIndex =
      Number(target.dataset.a);

    const accumulator =
      list()[accumulatorIndex];

    if (!accumulator) return;

    // Accumulator-level select
    if (target.dataset.m === undefined) {

      accumulator[target.dataset.f] =
        target.value;

      preview();

      return;
    }

    // Match-level select
    const matchIndex =
      Number(target.dataset.m);

    const match =
      accumulator.matches?.[matchIndex];

    if (!match) return;

    match[target.dataset.f] =
      target.value;

    preview();
  };

}

// ============================================================
// UPDATE ONLY COMBINED ODDS DISPLAY
// ============================================================

function renderOddsTotalOnly(index) {

  const cards =
    document.querySelectorAll(".acc");

  const card = cards[index];

  if (!card) return;

  const accumulator =
    list()[index];

  if (!accumulator) return;

  const display =
    card.querySelector(".oddsTotal strong");

  if (display) {

    display.textContent =
      total(accumulator).toFixed(2);
  }
}

// ============================================================
// INITIAL STATE
// ============================================================

console.log(
  "Stake ń Chill Admin loaded."
);

console.log(
  "Cloudflare Worker:",
  API_URL
);