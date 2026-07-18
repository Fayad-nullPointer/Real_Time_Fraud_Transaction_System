/* ============================================================
   FraudShield – Admin Dashboard JavaScript
   Connects to FastAPI backend via REST + WebSocket
   ============================================================ */

const API    = "http://localhost:8008";
const WS_BASE = "ws://localhost:8008/api/dashboard/ws";

const MAX_LIVE_ROWS   = 50;
const MAX_FEED_EVENTS = 80;
const MAX_ALERTS      = 30;

let volumeChart, fraudTrendChart, scenariosChart, reasonsChart;
let fraudMap, fraudMapLayer;
let metricsCache = {};
let activeTab = "overview";
let alertsSeeded = false;
let customersLoaded = false;
let dashboardInitialized = false;

// ── Admin auth state ─────────────────────────────────────────────────────────
// The dashboard is admin-only. We hold the JWT from POST /api/auth/login in
// memory + localStorage; every REST call below sends it as a Bearer token,
// and the WebSocket sends it as a `?token=` query param (browsers can't set
// headers on a WS handshake).
let adminToken    = localStorage.getItem("admin_token") || null;
let adminIdentity = JSON.parse(localStorage.getItem("admin_identity") || "null");

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("admin-login-form");
  if (form) form.addEventListener("submit", handleAdminLogin);

  if (adminToken && adminIdentity) {
    enterDashboard();
  } else {
    showAdminAuth();
  }
});

function showAdminAuth() {
  document.getElementById("admin-auth-screen").classList.remove("hidden");
  document.getElementById("dashboard-root").classList.add("hidden");
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("admin-login-btn");
  const errEl = document.getElementById("admin-login-error");
  errEl.classList.remove("visible");

  const customerId = parseInt(document.getElementById("admin-login-id").value);
  const password    = document.getElementById("admin-login-pass").value;

  btn.disabled = true;
  btn.textContent = "Signing in…";

  try {
    const res = await fetch(API + "/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_id: customerId, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Invalid credentials.");

    if (data.role !== "admin") {
      throw new Error("Access denied — this account does not have dashboard access.");
    }

    adminToken    = data.token;
    adminIdentity = { customer_id: data.customer_id, full_name: data.full_name };
    localStorage.setItem("admin_token", adminToken);
    localStorage.setItem("admin_identity", JSON.stringify(adminIdentity));

    enterDashboard();
  } catch (err) {
    errEl.textContent = err.message || "Sign-in failed.";
    errEl.classList.add("visible");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign in";
  }
}

function handleAdminLogout() {
  adminToken = null;
  adminIdentity = null;
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_identity");
  location.reload();
}

function enterDashboard() {
  document.getElementById("admin-auth-screen").classList.add("hidden");
  document.getElementById("dashboard-root").classList.remove("hidden");

  const label = document.getElementById("admin-session-label");
  if (label && adminIdentity) {
    label.textContent = `Admin — ${adminIdentity.full_name || "#" + adminIdentity.customer_id}`;
  }

  if (dashboardInitialized) return;
  dashboardInitialized = true;

  initDashboard();
}

async function initDashboard() {
  startClock();
  initCharts();
  initFraudMap();
  connectWebSocket();
  await fetchAll();
  await loadCustomers();
  setInterval(fetchAll, 30_000);

  document.getElementById("btn-refresh").addEventListener("click", () => {
    fetchAll();
    loadCustomers();
  });
  setupNavTabs();
  setupLogFilters();
}

// ── Clock ─────────────────────────────────────────────────────────────────────
function startClock() {
  const el = document.getElementById("clock");
  const tick = () => { el.textContent = new Date().toLocaleTimeString(); };
  tick(); setInterval(tick, 1000);
}

// ── Nav Tab Routing ───────────────────────────────────────────────────────────
function setupNavTabs() {
  document.querySelectorAll(".nav-item").forEach(link => {
    link.addEventListener("click", e => {
      document.querySelectorAll(".nav-item").forEach(l => l.classList.remove("active"));
      link.classList.add("active");
    });
  });
}

// ── Fetch all data ────────────────────────────────────────────────────────────
async function fetchAll() {
  try {
    const [metrics, txList, system] = await Promise.all([
      apiFetch("/api/dashboard/metrics"),
      apiFetch("/api/dashboard/transactions?limit=50"),
      apiFetch("/api/dashboard/system"),
    ]);
    metricsCache = metrics;
    updateKPIs(metrics);
    updateCharts(metrics);
    updateFunnel(metrics.otp_funnel);
    const fraudTx = txList.filter(t => t.is_fraud);
    renderFraudTable(fraudTx.slice(0, 12));
    populateLiveTable(txList.slice(0, MAX_LIVE_ROWS));
    updateSystemHealth(system);
    document.getElementById("last-updated").textContent = "Last updated: " + new Date().toLocaleTimeString();

    // Seed the Alerts panel from already-recorded fraud transactions
    // (only once — live events take over from here via the WebSocket).
    if (!alertsSeeded) {
      seedAlertsFromHistory(fraudTx);
      alertsSeeded = true;
    }

    // Refresh fraud map data
    refreshFraudMap();
  } catch (e) {
    console.error("fetchAll error:", e);
  }
}

async function apiFetch(path) {
  const r = await fetch(API + path, {
    headers: adminToken ? { "Authorization": `Bearer ${adminToken}` } : {},
  });
  if (r.status === 401 || r.status === 403) {
    // Token missing/expired/not-admin — drop the session and show the login
    // screen again rather than silently failing every widget on the page.
    handleAdminLogout();
    throw new Error(`Admin session invalid (HTTP ${r.status}) for ${path}`);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
  return r.json();
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────
function updateKPIs(d) {
  set("val-total",     d.total_transactions?.toLocaleString() ?? "—");
  set("val-volume",    "$" + fmtMoney(d.transaction_volume));
  set("val-fraud",     d.fraud_detected?.toLocaleString() ?? "—");
  set("val-confirmed", d.confirmed_fraud?.toLocaleString() ?? "—");
  set("val-legit",     d.legitimate?.toLocaleString() ?? "—");
  set("val-fp",        d.false_positives_corrected?.toLocaleString() ?? "—");
  set("val-rate",      (d.fraud_rate ?? 0).toFixed(2) + "%");
  set("val-customers", d.active_customers?.toLocaleString() ?? "—");
  set("val-terminals", d.active_terminals?.toLocaleString() ?? "—");
  set("val-reg-customers", d.registered_customers?.toLocaleString() ?? "—");
  set("val-reg-terminals", d.registered_terminals?.toLocaleString() ?? "—");
}

function fmtMoney(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + "K";
  return (n ?? 0).toFixed(0);
}

// ── Charts (Responsive) ───────────────────────────────────────────────────────
function initCharts() {
  Chart.defaults.color = "#94a3b8";
  Chart.defaults.borderColor = "rgba(255,255,255,0.06)";

  const sharedLineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(10,13,20,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 10,
        titleColor: "#f1f5f9",
        bodyColor: "#94a3b8",
      },
    },
    scales: {
      x: {
        grid: { color: "rgba(255,255,255,0.04)" },
        ticks: { maxRotation: 0, font: { size: 11 } },
      },
      y: {
        grid: { color: "rgba(255,255,255,0.04)" },
        beginAtZero: true,
        ticks: { font: { size: 11 } },
      },
    },
    animation: { duration: 400 },
  };

  const sharedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: "y",
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "rgba(10,13,20,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        padding: 10,
        titleColor: "#f1f5f9",
        bodyColor: "#94a3b8",
      },
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.04)" }, beginAtZero: true, ticks: { font: { size: 11 } } },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
    animation: { duration: 400 },
  };

  volumeChart = new Chart(document.getElementById("chart-volume"), {
    type: "line",
    data: { labels: [], datasets: [] },
    options: JSON.parse(JSON.stringify(sharedLineOptions)),
  });

  fraudTrendChart = new Chart(document.getElementById("chart-fraud-trend"), {
    type: "bar",
    data: { labels: [], datasets: [] },
    options: JSON.parse(JSON.stringify(sharedLineOptions)),
  });

  scenariosChart = new Chart(document.getElementById("chart-scenarios"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: JSON.parse(JSON.stringify(sharedBarOptions)),
  });

  reasonsChart = new Chart(document.getElementById("chart-reasons"), {
    type: "bar",
    data: { labels: [], datasets: [{ data: [], backgroundColor: [] }] },
    options: JSON.parse(JSON.stringify(sharedBarOptions)),
  });

  // Redraw charts when the window is resized
  window.addEventListener("resize", () => {
    [volumeChart, fraudTrendChart, scenariosChart, reasonsChart].forEach(c => c?.resize());
  });
}

function updateCharts(d) {
  const hourly = d.hourly || [];
  const labels = hourly.map(h => `${String(h.hour).padStart(2,"0")}:00`);

  // Volume line
  volumeChart.data.labels = labels;
  volumeChart.data.datasets = [{
    label: "Transactions",
    data: hourly.map(h => h.tx_count),
    borderColor: "#6366f1",
    backgroundColor: "rgba(99,102,241,0.12)",
    borderWidth: 2,
    fill: true,
    tension: 0.4,
    pointRadius: 3,
    pointBackgroundColor: "#6366f1",
    pointHoverRadius: 5,
  }];
  volumeChart.update("none");

  // Fraud trend bar
  fraudTrendChart.data.labels = labels;
  fraudTrendChart.data.datasets = [{
    label: "Fraud Events",
    data: hourly.map(h => h.fraud_count),
    backgroundColor: hourly.map(h =>
      h.fraud_count > 0
        ? "rgba(239,68,68,0.7)"
        : "rgba(239,68,68,0.15)"
    ),
    borderColor: "#ef4444",
    borderWidth: 1,
    borderRadius: 4,
  }];
  fraudTrendChart.options.type = "bar";
  fraudTrendChart.update("none");

  // Scenarios
  const scenarios = d.scenarios || [];
  const scenColors = ["#ef4444","#f59e0b","#8b5cf6","#06b6d4","#22c55e"];
  scenariosChart.data.labels   = scenarios.map(s => s.scenario_name);
  scenariosChart.data.datasets[0].data            = scenarios.map(s => s.cnt);
  scenariosChart.data.datasets[0].backgroundColor = scenarios.map((_, i) => scenColors[i % scenColors.length]);
  scenariosChart.data.datasets[0].borderRadius    = 4;
  scenariosChart.update("none");

  // Top reasons
  const reasons = d.top_reasons || [];
  const reaColors = ["#6366f1","#8b5cf6","#3b82f6","#06b6d4","#22c55e"];
  reasonsChart.data.labels   = reasons.map(r => r.top_reason?.replace("num__","") ?? r.top_reason);
  reasonsChart.data.datasets[0].data            = reasons.map(r => r.cnt);
  reasonsChart.data.datasets[0].backgroundColor = reasons.map((_, i) => reaColors[i % reaColors.length]);
  reasonsChart.data.datasets[0].borderRadius    = 4;
  reasonsChart.update("none");
}

// ── OTP Funnel ────────────────────────────────────────────────────────────────
function updateFunnel(f) {
  if (!f) return;
  set("f-predictions", f.fraud_predictions);
  set("f-sent",        f.otp_sent);
  set("f-verified",    f.otp_verified);
  set("f-confirmed",   f.confirmed_fraud);

  const max = f.fraud_predictions || 1;
  const pct = v => Math.max(8, Math.round((v / max) * 100)) + "%";
  document.querySelector("#funnel-predictions .funnel-bar").style.width = "100%";
  document.querySelector("#funnel-sent      .funnel-bar").style.width = pct(f.otp_sent);
  document.querySelector("#funnel-verified  .funnel-bar").style.width = pct(f.otp_verified);
  document.querySelector("#funnel-confirmed .funnel-bar").style.width = pct(f.confirmed_fraud);
}

// ── Live Table ────────────────────────────────────────────────────────────────
function populateLiveTable(txList) {
  const tbody = document.getElementById("live-tbody");
  tbody.innerHTML = "";
  txList.forEach(tx => tbody.appendChild(buildLiveRow(tx, false)));
}

function prependLiveRow(tx) {
  const tbody = document.getElementById("live-tbody");
  const row = buildLiveRow(tx, true);
  tbody.prepend(row);
  while (tbody.children.length > MAX_LIVE_ROWS) tbody.removeChild(tbody.lastChild);
}

function buildLiveRow(tx, animate) {
  const tr = document.createElement("tr");
  if (animate) tr.classList.add("row-new");
  tr.classList.add("cust-row"); // reuse the existing clickable-row hover style
  const t = new Date(tx.tx_datetime || tx.timestamp);
  tr.innerHTML = `
    <td>${t.toLocaleTimeString()}</td>
    <td>#${tx.customer_id}</td>
    <td>${tx.terminal_id}</td>
    <td>$${parseFloat(tx.tx_amount ?? tx.amount ?? 0).toFixed(2)}</td>
    <td>${probBadge(tx.fraud_probability)}</td>
    <td>${statusBadge(tx.status)}</td>
  `;
  if (tx.transaction_id) {
    tr.addEventListener("click", () => openTransactionModal(tx.transaction_id));
  }
  return tr;
}

function probBadge(p) {
  const pct = ((p ?? 0) * 100).toFixed(1);
  const col = p > 0.7 ? "#ef4444" : p > 0.3 ? "#f59e0b" : "#22c55e";
  return `<span style="color:${col};font-weight:600">${pct}%</span>`;
}

function statusBadge(s) {
  const map = { APPROVED:"badge-approved", VERIFIED:"badge-verified", PENDING_OTP:"badge-otp", DECLINED:"badge-fraud", PENDING:"badge-pending" };
  const label = { APPROVED:"✅ Approved", VERIFIED:"🔵 Verified", PENDING_OTP:"🟡 OTP Pending", DECLINED:"🔴 Fraud", PENDING:"⏳ Pending" };
  return `<span class="badge ${map[s]||"badge-pending"}">${label[s]||s}</span>`;
}

// ── Event Feed ────────────────────────────────────────────────────────────────
function pushEvent(ev) {
  const feed = document.getElementById("event-feed");
  const div  = document.createElement("div");
  div.classList.add("event-item");

  const t = new Date(ev.timestamp || Date.now()).toLocaleTimeString();
  let icon = "📡", title = "Event", meta = "";

  if (ev.event === "TRANSACTION") {
    if (ev.is_fraud) {
      icon = "🚨"; title = "Fraud Detected";
      meta = `TX ${ev.transaction_id?.slice(0,8)} | ${ev.scenario_name || "—"} | ${((ev.fraud_probability ?? 0) * 100).toFixed(1)}%`;
      pushAlert(`🚨 Fraud detected: TX ${ev.transaction_id?.slice(0,8)} — ${ev.scenario_name || ""}`, "danger");
      if (ev.fraud_probability > 0.99) pushAlert("🚨 Fraud probability >99%", "danger");
    } else {
      icon = "✅"; title = "Transaction Approved";
      meta = `TX ${ev.transaction_id?.slice(0,8)} — $${parseFloat(ev.amount ?? 0).toFixed(2)}`;
    }
  } else if (ev.event === "OTP_RESULT") {
    if (ev.status === "VERIFIED") {
      icon = "✅"; title = "OTP Verified";
      meta = `TX ${ev.transaction_id?.slice(0,8)}`;
      pushAlert("✅ OTP verified", "success");
    } else {
      const reason = ev.reason === "OTP_TIMEOUT" ? "OTP Timed Out — Auto Declined" : "OTP Failed — Fraud Confirmed";
      icon = "🔴"; title = reason;
      meta = `TX ${ev.transaction_id?.slice(0,8)}`;
      pushAlert(`🔴 ${reason}: TX ${ev.transaction_id?.slice(0,8)}`, "danger");
    }
  } else if (ev.event === "OTP_PENDING") {
      icon = "⏸️"; title = "Customer Paused Verification";
      meta = `TX ${ev.transaction_id?.slice(0,8)} — still pending, not fraud`;
      pushAlert(`⏸️ Customer paused OTP entry: TX ${ev.transaction_id?.slice(0,8)} — awaiting retry`, "warning");
  }

  div.innerHTML = `
    <span class="event-time">${t}</span>
    <span class="event-icon">${icon}</span>
    <div class="event-body">
      <div class="event-title">${title}</div>
      ${meta ? `<div class="event-meta">${meta}</div>` : ""}
    </div>`;

  feed.prepend(div);
  while (feed.children.length > MAX_FEED_EVENTS) feed.removeChild(feed.lastChild);
}

// ── Alerts ────────────────────────────────────────────────────────────────────
let alertCount = 0;
function pushAlert(text, type = "warning") {
  const list = document.getElementById("alert-list");
  const div  = document.createElement("div");
  div.className = `alert-item alert-${type}`;
  const t = new Date().toLocaleTimeString();
  div.innerHTML = `<span class="alert-time">${t}</span><span class="alert-text">${text}</span>`;
  list.prepend(div);
  while (list.children.length > MAX_ALERTS) list.removeChild(list.lastChild);
  alertCount++;
  set("alert-count", alertCount);
}

// Populate the Alerts panel with fraudulent transactions that already exist
// in the database (e.g. from before this browser tab was opened), oldest
// first, so the panel reads top-to-bottom the same way live alerts would.
function seedAlertsFromHistory(fraudTxList) {
  const list = document.getElementById("alert-list");
  if (!list || !fraudTxList || !fraudTxList.length) return;

  const ordered = [...fraudTxList].sort(
    (a, b) => new Date(a.tx_datetime) - new Date(b.tx_datetime)
  );

  ordered.forEach(tx => {
    const t = new Date(tx.tx_datetime).toLocaleTimeString();
    const shortId = (tx.transaction_id || "").slice(0, 8);
    const pct = ((tx.fraud_probability ?? 0) * 100).toFixed(1);
    const type = tx.status === "DECLINED" ? "danger" : "warning";
    const text = `🚨 Fraud: TX ${shortId} — ${tx.scenario_name || "Unknown scenario"} (${pct}%) — ${tx.status}`;

    const div = document.createElement("div");
    div.className = `alert-item alert-${type}`;
    div.innerHTML = `<span class="alert-time">${t}</span><span class="alert-text">${text}</span>`;
    list.appendChild(div);
    alertCount++;
  });

  while (list.children.length > MAX_ALERTS) list.removeChild(list.firstChild);
  set("alert-count", alertCount);
}

// ── Fraud Table ───────────────────────────────────────────────────────────────
function renderFraudTable(rows) {
  const tbody = document.getElementById("fraud-tbody");
  tbody.innerHTML = rows.map(r => `
    <tr class="cust-row" onclick="openTransactionModal('${r.transaction_id}')">
      <td>${r.transaction_id?.slice(0,8)}…</td>
      <td>${r.scenario_name || "—"}</td>
      <td>${probBadge(r.fraud_probability)}</td>
      <td>${statusBadge(r.status)}</td>
    </tr>
  `).join("");
}

// ── Fraud Map (fraud-only) ────────────────────────────────────────────────────
function initFraudMap() {
  fraudMap = L.map("fraud-map", { zoomControl: true }).setView([30.0, 31.2], 10);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap",
    maxZoom: 19,
  }).addTo(fraudMap);

  // Custom dark-tinted tile using a filter overlay
  const darkOverlay = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "",
    maxZoom: 19,
    opacity: 0,
  }).addTo(fraudMap);

  fraudMapLayer = L.layerGroup().addTo(fraudMap);

  // Legend
  const legend = L.control({ position: "bottomright" });
  legend.onAdd = () => {
    const div = L.DomUtil.create("div", "map-legend");
    div.innerHTML = `
      <div class="legend-item"><span class="legend-dot" style="background:#ef4444"></span> Fraud Terminal</div>
      <div class="legend-item"><span class="legend-dot" style="background:#f59e0b"></span> Customer Location</div>
      <div class="legend-item"><span class="legend-dot legend-line"></span> Transaction Link</div>
    `;
    return div;
  };
  legend.addTo(fraudMap);
}

async function refreshFraudMap() {
  try {
    const data = await apiFetch("/api/dashboard/fraud-map");
    fraudMapLayer.clearLayers();

    if (!data.length) return;

    // Track unique terminals involved in fraud
    const terminalSeen = new Map();  // terminal_id -> {lat, lon, name, count, maxProb}

    data.forEach(tx => {
      // Customer marker (if lat/lon available)
      if (tx.customer_lat && tx.customer_lon) {
        const custMarker = L.circleMarker([tx.customer_lat, tx.customer_lon], {
          radius: 5,
          fillColor: "#f59e0b",
          color: "#fff",
          weight: 1,
          fillOpacity: 0.8,
        }).bindPopup(`
          <b>👤 Customer #${tx.customer_id}</b><br>
          Amount: $${parseFloat(tx.tx_amount).toFixed(2)}<br>
          Scenario: ${tx.scenario_name || "—"}<br>
          Prob: ${((tx.fraud_probability ?? 0) * 100).toFixed(1)}%<br>
          Status: ${tx.status}
        `);
        fraudMapLayer.addLayer(custMarker);

        // Draw line from customer to terminal
        if (tx.terminal_lat && tx.terminal_lon) {
          const line = L.polyline(
            [[tx.customer_lat, tx.customer_lon], [tx.terminal_lat, tx.terminal_lon]],
            {
              color: tx.status === "DECLINED" ? "#ef4444" : "#f59e0b",
              weight: 1.5,
              opacity: 0.45,
              dashArray: tx.status === "DECLINED" ? "4 4" : null,
            }
          );
          fraudMapLayer.addLayer(line);
        }
      }

      // Aggregate terminal data
      if (tx.terminal_lat && tx.terminal_lon) {
        if (!terminalSeen.has(tx.terminal_id)) {
          terminalSeen.set(tx.terminal_id, {
            lat: tx.terminal_lat, lon: tx.terminal_lon,
            name: tx.terminal_name, count: 0, maxProb: 0,
          });
        }
        const t = terminalSeen.get(tx.terminal_id);
        t.count++;
        t.maxProb = Math.max(t.maxProb, tx.fraud_probability ?? 0);
      }
    });

    // Render terminal markers — sized by fraud count, colored by max probability
    terminalSeen.forEach((info, tid) => {
      const radius = Math.min(20, 8 + info.count * 1.5);
      const fillColor = info.maxProb > 0.95 ? "#ef4444" : info.maxProb > 0.7 ? "#f97316" : "#f59e0b";
      const marker = L.circleMarker([info.lat, info.lon], {
        radius,
        fillColor,
        color: "#fff",
        weight: 1.5,
        fillOpacity: 0.85,
      }).bindPopup(`
        <b>🏧 ${info.name}</b><br>
        Terminal ID: ${tid}<br>
        Fraud Events: <strong>${info.count}</strong><br>
        Max Probability: ${(info.maxProb * 100).toFixed(1)}%
      `);
      fraudMapLayer.addLayer(marker);
    });

    // Zoom to fit all markers
    if (data.length) {
      const bounds = [];
      fraudMapLayer.eachLayer(l => {
        if (l.getLatLng) bounds.push(l.getLatLng());
        else if (l.getBounds) bounds.push(...l.getBounds().getSouthWest ? [l.getBounds().getSouthWest(), l.getBounds().getNorthEast()] : []);
      });
      if (bounds.length) {
        fraudMap.fitBounds(L.latLngBounds(bounds).pad(0.15));
      }
    }
  } catch (e) {
    console.warn("fraud-map fetch failed:", e);
  }
}

// Flash a terminal red when fraud arrives via WebSocket (visual feedback)
function flashFraudTerminal(terminalId) {
  fraudMapLayer.eachLayer(m => {
    if (!m.getLatLng) return;
    const popup = m._popup?._content || "";
    if (popup.includes(`Terminal ID: ${terminalId}`)) {
      const orig = m.options.fillColor;
      m.setStyle({ fillColor: "#ff0000", fillOpacity: 1, radius: m.options.radius + 4 });
      setTimeout(() => m.setStyle({ fillColor: orig, fillOpacity: 0.85, radius: m.options.radius - 4 }), 4000);
    }
  });
}

// ── Logs Tab ─────────────────────────────────────────────────────────────────
let logsLoaded = false;
let currentLogFilter = "";

function setupLogFilters() {
  document.querySelectorAll(".log-filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".log-filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentLogFilter = btn.dataset.level;
      loadLogs();
    });
  });

  const searchBox = document.getElementById("log-search");
  if (searchBox) {
    searchBox.addEventListener("input", () => filterLogDisplay(searchBox.value));
  }
}

async function loadLogs() {
  const container = document.getElementById("log-entries");
  if (!container) return;
  container.innerHTML = `<div class="log-loading">Loading logs…</div>`;

  try {
    const url = currentLogFilter
      ? `/api/dashboard/logs?limit=300&level=${currentLogFilter}`
      : "/api/dashboard/logs?limit=300";
    const data = await apiFetch(url);
    renderLogs(data);
    logsLoaded = true;
  } catch {
    container.innerHTML = `<div class="log-error">⚠ Could not load logs. Is the backend running?</div>`;
  }
}

function renderLogs(entries) {
  const container = document.getElementById("log-entries");
  if (!container) return;

  if (!entries.length) {
    container.innerHTML = `<div class="log-empty">No log entries found.</div>`;
    return;
  }

  set("log-count", entries.length);

  container.innerHTML = entries.map(e => {
    const level     = e.level?.toUpperCase() || "INFO";
    const levelCls  = { WARNING: "log-warn", ERROR: "log-error-lvl", INFO: "log-info", DEBUG: "log-debug" }[level] || "log-info";
    const eventType = e.event_type || "";
    const eventBadge = eventType
      ? `<span class="log-event-badge">${eventType}</span>`
      : "";
    const scenario = e.scenario ? `<span class="log-tag">${e.scenario}</span>` : "";
    const prob     = e.fraud_probability != null
      ? `<span class="log-tag log-prob">${(e.fraud_probability * 100).toFixed(1)}%</span>`
      : "";
    const topReasons = e.top_reasons
      ? `<div class="log-reasons">Top reasons: ${Object.entries(e.top_reasons).map(([k,v]) => `<code>${k.replace("num__","")}: ${v}</code>`).join(", ")}</div>`
      : "";
    return `
      <div class="log-entry ${levelCls}" data-search="${(e.message||"").toLowerCase()} ${eventType.toLowerCase()}">
        <div class="log-meta">
          <span class="log-time">${e.timestamp || ""}</span>
          <span class="log-level ${levelCls}">${level}</span>
          <span class="log-name">${e.name || ""}</span>
          ${eventBadge}${scenario}${prob}
        </div>
        <div class="log-msg">${escHtml(e.message || "")}</div>
        ${topReasons}
      </div>`;
  }).join("");
}

function filterLogDisplay(query) {
  const q = query.toLowerCase();
  document.querySelectorAll(".log-entry").forEach(el => {
    const match = !q || (el.dataset.search || "").includes(q) || el.textContent.toLowerCase().includes(q);
    el.style.display = match ? "" : "none";
  });
}

function escHtml(s) {
  return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// ── System Health ─────────────────────────────────────────────────────────────
function updateSystemHealth(s) {
  if (!s) return;
  set("sys-redis-hit", `Cache Hit: ${s.redis?.cache_hit_rate ?? "—"}%`);
  set("sys-model-inf", `Inference: ${s.ml_model?.inference_ms ?? "—"} ms`);
  set("sys-ws", `${s.websocket?.connected_clients ?? 0} clients`);
  set("model-inf-display", `${s.ml_model?.inference_ms ?? "—"} ms`);

  const r = s.resources || {};
  setBar("bar-cpu",  r.cpu  ?? 0); set("val-cpu",  `${(r.cpu  ?? 0).toFixed(0)}%`);
  setBar("bar-ram",  r.ram  ?? 0); set("val-ram",  `${(r.ram  ?? 0).toFixed(0)}%`);
  setBar("bar-disk", r.disk ?? 0); set("val-disk", `${(r.disk ?? 0).toFixed(0)}%`);

  if (r.ram > 80)  pushAlert("⚠ RAM usage above 80%", "warning");
  if (r.disk > 85) pushAlert("⚠ Disk usage above 85%", "warning");
}

function setBar(id, pct) {
  const el = document.getElementById(id);
  if (el) el.style.width = Math.min(100, pct) + "%";
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
function connectWebSocket() {
  const badge     = document.getElementById("ws-badge");
  const badgeText = document.getElementById("ws-status-text");
  const dot       = badge.querySelector(".dot");

  let ws;
  const connect = () => {
    // Browsers can't set an Authorization header on a WS handshake, so the
    // admin JWT rides along as a query param instead — see
    // routers/dashboard.py's dashboard_ws.
    const wsUrl = `${WS_BASE}?token=${encodeURIComponent(adminToken || "")}`;
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      dot.className  = "dot dot-green";
      badgeText.textContent = "Live";
    };

    ws.onmessage = ({ data }) => {
      const ev = JSON.parse(data);
      pushEvent(ev);
      if (ev.event === "TRANSACTION") {
        prependLiveRow({
          tx_datetime:       ev.timestamp,
          customer_id:       ev.customer_id,
          terminal_id:       ev.terminal_id,
          tx_amount:         ev.amount,
          fraud_probability: ev.fraud_probability,
          status:            ev.status,
          transaction_id:    ev.transaction_id,
        });
        if (ev.is_fraud) {
          flashFraudTerminal(ev.terminal_id);
          // Reload fraud map to include new point
          setTimeout(refreshFraudMap, 1500);
        }
      }
      if (ev.event === "OTP_RESULT") {
        // Reload map when a fraud is confirmed or OTP times out
        if (ev.status === "DECLINED") setTimeout(refreshFraudMap, 1500);
      }
    };

    ws.onclose = () => {
      dot.className  = "dot dot-yellow";
      badgeText.textContent = "Reconnecting…";
      setTimeout(connect, 3000);
    };

    ws.onerror = () => {
      dot.className  = "dot dot-red";
      badgeText.textContent = "Disconnected";
    };
  };

  connect();
}

// ── Customers Tab ─────────────────────────────────────────────────────────────
async function loadCustomers() {
  const tbody = document.getElementById("customers-tbody");
  if (!tbody) return;
  try {
    const customers = await apiFetch("/api/dashboard/customers?limit=200");
    renderCustomersTable(customers);
    customersLoaded = true;
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="5" class="log-error">⚠ Could not load customers.</td></tr>`;
    console.warn("loadCustomers error:", e);
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById("customers-tbody");
  if (!tbody) return;

  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="log-empty">No registered customers yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr class="cust-row" onclick="openCustomerModal(${c.customer_id})">
      <td>
        <div class="cust-name-cell">
          <span class="cust-name-id">#${c.customer_id}${c.full_name ? " · " + c.full_name : ""}</span>
          <span class="cust-name-phone">${c.phone_number ?? ""}</span>
        </div>
      </td>
      <td>${c.location || "Unknown"}</td>
      <td>${c.total_txns?.toLocaleString() ?? 0}</td>
      <td>$${(c.avg_amount ?? 0).toFixed(2)}</td>
      <td>${riskPill(c.risk_score)}</td>
    </tr>
  `).join("");
}

function riskPill(score) {
  const s = score ?? 0;
  const level = s >= 70 ? "high" : s >= 35 ? "medium" : "low";
  return `<span class="risk-pill risk-${level}"><span class="risk-dot"></span>${s}</span>`;
}

async function openCustomerModal(customerId) {
  const modal = document.getElementById("customer-modal");
  modal.classList.remove("hidden");
  document.getElementById("cm-id").textContent = `Customer #${customerId}`;
  document.getElementById("cm-meta").textContent = "Loading…";
  document.getElementById("cm-stats").innerHTML = "";
  document.getElementById("cm-recent-list").innerHTML = "";
  document.getElementById("cm-feature-state").innerHTML = "Loading…";

  try {
    const c = await apiFetch(`/api/dashboard/customers/${customerId}`);

    document.getElementById("cm-id").textContent =
      `Customer #${c.customer_id}${c.full_name ? " · " + c.full_name : ""}`;
    document.getElementById("cm-meta").textContent =
      `${c.phone_number ?? "—"} · ${c.location || "Unknown"}`;

    const riskLevel = c.risk_score >= 70 ? "high" : c.risk_score >= 35 ? "medium" : "low";
    document.getElementById("cm-stats").innerHTML = `
      <div class="cust-stat"><div class="cust-stat-label">Mean Amount</div><div class="cust-stat-value">$${c.mean_amount.toFixed(2)}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Std Deviation</div><div class="cust-stat-value">$${c.std_amount.toFixed(2)}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Txns / Day</div><div class="cust-stat-value">${c.txns_per_day}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Terminals Used</div><div class="cust-stat-value">${c.terminals_used}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Total Txns</div><div class="cust-stat-value">${c.total_txns.toLocaleString()}</div></div>
      <div class="cust-stat cust-stat-risk"><div class="cust-stat-label">Risk Score</div><div class="cust-stat-value risk-${riskLevel}">${c.risk_score}</div></div>
    `;

    const recentList = document.getElementById("cm-recent-list");
    if (!c.recent_transactions.length) {
      recentList.innerHTML = `<div class="log-empty">No transactions yet.</div>`;
      
    } else {
      recentList.innerHTML = c.recent_transactions.map(r => `
        <div class="cust-recent-item clickable ${r.is_fraud ? "is-fraud" : ""}"
             onclick="openTransactionModal('${r.transaction_id}')">
          <span class="cust-recent-id">TX-${(r.transaction_id || "").toString().slice(0, 6)}</span>
          <span class="cust-recent-amount">$${r.tx_amount.toFixed(2)}</span>
          <span class="cust-recent-time">${r.days_ago}d ago</span>
        </div>
      `).join("");
    }

    loadCustomerFeatureState(customerId);

  } catch (e) {
    document.getElementById("cm-meta").textContent = "Could not load this customer's profile.";
    console.warn("openCustomerModal error:", e);
  }
}

function closeCustomerModal() {
  document.getElementById("customer-modal").classList.add("hidden");
}

// ── Transaction Detail Modal (per-transaction SHAP explanation) ──────────────
// Opened by clicking a transaction row anywhere in the dashboard (Live
// table, Recent Fraud Cases, or a customer's Recent Transactions list).
// Fetches GET /api/dashboard/transactions/{id}, which returns the
// transaction plus its ranked shap_explanation — the features that
// contributed most to that transaction's fraud_probability.
async function openTransactionModal(transactionId) {
  if (!transactionId) return;
  const modal = document.getElementById("transaction-modal");
  modal.classList.remove("hidden");
  document.getElementById("tm-id").textContent = `TX-${transactionId.toString().slice(0, 8)}…`;
  document.getElementById("tm-meta").textContent = "Loading…";
  document.getElementById("tm-stats").innerHTML = "";
  document.getElementById("tm-shap-list").innerHTML = "";

  try {
    const tx = await apiFetch(`/api/dashboard/transactions/${transactionId}`);

    const dt = new Date(tx.tx_datetime).toLocaleString();
    document.getElementById("tm-meta").textContent =
      `Customer #${tx.customer_id} · Terminal ${tx.terminal_id} · ${dt}`;

    document.getElementById("tm-stats").innerHTML = `
      <div class="cust-stat"><div class="cust-stat-label">Amount</div><div class="cust-stat-value">$${parseFloat(tx.tx_amount).toFixed(2)}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Status</div><div class="cust-stat-value">${statusBadge(tx.status)}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Fraud Probability</div><div class="cust-stat-value">${probBadge(tx.fraud_probability)}</div></div>
      <div class="cust-stat"><div class="cust-stat-label">Scenario</div><div class="cust-stat-value" style="font-size:0.85rem">${tx.scenario_name || "—"}</div></div>
    `;

    renderShapList(tx.shap_explanation || []);
  } catch (e) {
    document.getElementById("tm-meta").textContent = "Could not load this transaction.";
    console.warn("openTransactionModal error:", e);
  }
}

function renderShapList(reasons) {
  const container = document.getElementById("tm-shap-list");
  if (!reasons.length) {
    container.innerHTML = `<div class="shap-empty">No SHAP explanation was recorded for this transaction (usually means it wasn't flagged as fraud, or the explainer wasn't loaded when it was scored).</div>`;
    return;
  }

  const numeric = reasons.filter(r => Number.isFinite(r.shap_value));
  const maxAbs = Math.max(...numeric.map(r => Math.abs(r.shap_value)), 1e-6);

  container.innerHTML = reasons.map(r => {
    const hasValue = Number.isFinite(r.shap_value);
    const isPos = hasValue ? r.shap_value >= 0 : true;
    const widthPct = hasValue ? Math.min(100, Math.round((Math.abs(r.shap_value) / maxAbs) * 50)) : 0;
    const valueLabel = hasValue
      ? `${isPos ? "+" : ""}${r.shap_value.toFixed(4)}`
      : (r.type === "otp" ? "Timed out" : "N/A");
    return `
      <div class="shap-row">
        <div class="shap-row-top">
          <span class="shap-feature">${escHtml(r.feature)}<span class="shap-type-tag">${escHtml(r.type)}</span></span>
          <span class="shap-value ${isPos ? "positive" : "negative"}">${valueLabel}</span>
        </div>
        <div class="shap-bar-track">
          <span class="shap-bar-mid"></span>
          <span class="shap-bar-fill ${isPos ? "positive" : "negative"}" style="width:${widthPct}%"></span>
        </div>
      </div>
    `;
  }).join("");
}


async function loadCustomerFeatureState(customerId) {
  const el = document.getElementById("cm-feature-state");
  el.textContent = "Loading…";
  try {
    const s = await apiFetch(`/api/dashboard/customers/${customerId}/state`);
    el.innerHTML = renderFeatureState(s);
  } catch (e) {
    el.innerHTML = `<div class="log-empty">Could not load live feature state.</div>`;
    console.warn("loadCustomerFeatureState error:", e);
  }
}

function renderFeatureState(s) {
  const rt = s.realtime || {};
  const p = s.profile || {};
  const lags = rt.last_amounts_chronological || [];

  const coldStartBanner = s.is_cold_start ? `
    <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);
                border-radius:8px;padding:8px 12px;margin-bottom:12px;font-size:0.78rem;color:#fbbf24;">
      🟡 This customer is still cold-starting — the model is scoring them against
      population-default stats, not their own history, until they complete
      ${5 - (rt.cold_start_running_n ?? 0)} more real transaction(s).
    </div>` : "";

  return `
    ${coldStartBanner}
    <div class="cust-modal-stats" style="margin-bottom:14px;">
      <div class="cust-stat">
        <div class="cust-stat-label">Cold Start</div>
        <div class="cust-stat-value" style="font-size:0.95rem">${s.is_cold_start ? "🟡 Yes" : "🟢 No"}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">Warm (has buffer)</div>
        <div class="cust-stat-value" style="font-size:0.95rem">${s.is_warm ? "🟢 Yes" : "🔴 No"}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">tx_count_1h (approx)</div>
        <div class="cust-stat-value">${rt.tx_count_1h_approx ?? 0}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">tx_count_4h (approx)</div>
        <div class="cust-stat-value">${rt.tx_count_4h_approx ?? 0}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">Stored mean_amount</div>
        <div class="cust-stat-value">${p.mean_amount != null ? "$" + p.mean_amount.toFixed(2) : "—"}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">Stored std_amount</div>
        <div class="cust-stat-value">${p.std_amount != null ? "$" + p.std_amount.toFixed(2) : "—"}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">Spending Tier</div>
        <div class="cust-stat-value" style="font-size:0.9rem">${s.spending_tier ?? "—"}</div>
      </div>
      <div class="cust-stat">
        <div class="cust-stat-label">nb_terminals</div>
        <div class="cust-stat-value">${p.nb_terminals ?? "—"}</div>
      </div>
    </div>
    <div class="cust-stat-label" style="margin-bottom:6px;">Lag buffer (most recent first)</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:4px;">
      ${lags.length
        ? [...lags].reverse().map((a, i) => `<span class="log-tag">lag${i + 1}: $${Number(a).toFixed(2)}</span>`).join("")
        : `<span class="log-empty" style="padding:0;">empty — no buffered transactions yet</span>`}
    </div>
  `;
}


function closeTransactionModal() {
  document.getElementById("transaction-modal").classList.add("hidden");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function set(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}