/* ============================================================
   FraudShield Pay – User Portal JavaScript
   Handles: auth flow, terminal map selection, transaction,
            OTP overlay, history
   ============================================================ */

const API = "http://localhost:8008";

// ── State ─────────────────────────────────────────────────────────────────────
let authToken       = localStorage.getItem("token") || null;
let currentCustomer = JSON.parse(localStorage.getItem("customer") || "null");
let selectedTerminal = null;
let pendingTxId      = null;
let otpTimer         = null;
let terminalMap      = null;
let terminalMarkers  = {};

// ── Boot ──────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (authToken && currentCustomer) {
    showPortal();
  } else {
    showAuth();
  }
  initOtpInputs();
  detectLocation();
});

// ── Location detection ────────────────────────────────────────────────────────
let detectedLat = null, detectedLon = null;

function detectLocation() {
  const notice = document.getElementById("loc-text");
  if (!navigator.geolocation) {
    notice.textContent = "GPS not available — location will be resolved from IP.";
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      detectedLat = pos.coords.latitude;
      detectedLon = pos.coords.longitude;
      notice.textContent = `📍 Location detected (${detectedLat.toFixed(4)}, ${detectedLon.toFixed(4)})`;
    },
    () => { notice.textContent = "Location will be resolved from your IP address."; }
  );
}

// ── Screen management ─────────────────────────────────────────────────────────
function showAuth() {
  document.getElementById("auth-screen").classList.remove("hidden");
  document.getElementById("portal-screen").classList.add("hidden");
}

function showPortal() {
  document.getElementById("auth-screen").classList.add("hidden");
  document.getElementById("portal-screen").classList.remove("hidden");

  // Populate profile
  if (currentCustomer) {
    const nav = document.getElementById("nav-card-num");
    if (nav) nav.textContent = `💳 ${currentCustomer.customer_id}`;
    document.getElementById("profile-name").textContent = currentCustomer.full_name || "Customer";
    document.getElementById("profile-id").textContent   = currentCustomer.customer_id;
    document.getElementById("profile-phone").textContent = currentCustomer.phone_number;
  }

  loadHistory();
  initTerminalMap();
}

// ── Tab switching ─────────────────────────────────────────────────────────────
function showTab(tab) {
  document.getElementById("tab-login").classList.toggle("active",    tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
  document.getElementById("login-form").classList.toggle("hidden",    tab !== "login");
  document.getElementById("register-form").classList.toggle("hidden", tab !== "register");
}

// ── Login ─────────────────────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-login");
  const errEl = document.getElementById("login-error");
  errEl.classList.remove("visible");

  const customerId = parseInt(document.getElementById("login-id").value);
  const password   = document.getElementById("login-pass").value;

  btn.disabled = true;
  btn.textContent = "Logging in…";

  try {
    const res = await apiFetch("/api/auth/login", "POST", { customer_id: customerId, password });
    saveSession(res);
    showPortal();
  } catch (err) {
    showError("login-error", err.message || "Invalid credentials.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Login";
  }
}

// ── Register ──────────────────────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("btn-register");
  const errEl = document.getElementById("register-error");
  errEl.classList.remove("visible");

  const body = {
    phone_number: document.getElementById("reg-phone").value,
    password:     document.getElementById("reg-pass").value,
    full_name:    document.getElementById("reg-name").value || null,
    lat: detectedLat,
    lon: detectedLon,
  };

  btn.disabled = true;
  btn.textContent = "Creating account…";

  try {
    const res = await apiFetch("/api/auth/register", "POST", body);
    saveSession(res);
    showPortal();
  } catch (err) {
    showError("register-error", err.message || "Registration failed.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

// ── Session ───────────────────────────────────────────────────────────────────
function saveSession(res) {
  authToken       = res.token;
  currentCustomer = { customer_id: res.customer_id, phone_number: res.phone_number, full_name: res.full_name };
  localStorage.setItem("token",    authToken);
  localStorage.setItem("customer", JSON.stringify(currentCustomer));
}

function handleLogout() {
  authToken = null;
  currentCustomer = null;
  selectedTerminal = null;
  localStorage.removeItem("token");
  localStorage.removeItem("customer");
  showAuth();
}

// ── Transaction History ───────────────────────────────────────────────────────
async function loadHistory() {
  const list = document.getElementById("tx-list");
  list.innerHTML = `<div class="empty-state">Loading…</div>`;
  try {
    const rows = await apiFetch("/api/transactions/history?limit=10", "GET", null, true);
    if (!rows.length) {
      list.innerHTML = `<div class="empty-state">No transactions yet.</div>`;
      return;
    }
    list.innerHTML = rows.map(r => txItem(r)).join("");
  } catch {
    list.innerHTML = `<div class="empty-state" style="color:#ef4444">Could not load history.</div>`;
  }
}

function txItem(r) {
  const statusIcon = { APPROVED: "✅", VERIFIED: "🔵", DECLINED: "🔴", PENDING_OTP: "🟡", PENDING: "⏳", REPORTED_FRAUD: "🚨" }[r.status] || "💳";
  const amtClass   = (r.is_fraud || r.status === "REPORTED_FRAUD") && r.status !== "APPROVED" && r.status !== "VERIFIED" ? "negative" : "positive";
  const date       = new Date(r.tx_datetime).toLocaleString();
  const isPending  = r.status === "PENDING_OTP";
  return `
    <div class="tx-item ${isPending ? "clickable" : ""}" ${isPending ? `onclick="resumeTransaction('${r.transaction_id}')"` : ""}>
      <div class="tx-item-icon">${statusIcon}</div>
      <div class="tx-item-body">
        <div class="tx-item-title">Terminal ${r.terminal_id} — ${r.status}</div>
        <div class="tx-item-meta">${date} ${r.scenario_name ? `| ${r.scenario_name}` : ""}</div>
        ${isPending ? `<div class="tx-pending-hint">⏳ Tap to finish verifying before it times out</div>` : ""}
      </div>
      <div class="tx-item-amount ${amtClass}">$${parseFloat(r.tx_amount).toFixed(2)}</div>
    </div>
  `;
}

// ── Terminal Map ──────────────────────────────────────────────────────────────
function initTerminalMap() {
  if (terminalMap) return; // already initialized

  terminalMap = L.map("terminal-map").setView([30.05, 31.23], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap", maxZoom: 18,
  }).addTo(terminalMap);

  // User location marker
  if (detectedLat) {
    L.circleMarker([detectedLat, detectedLon], {
      radius: 9, fillColor: "#22c55e", color: "#fff", weight: 2, fillOpacity: 0.9,
    }).bindPopup("<b>📍 Your location</b>").addTo(terminalMap);
    terminalMap.setView([detectedLat, detectedLon], 12);
  }

  // Load terminals
  fetch(API + "/api/terminals")
    .then(r => r.json())
    .then(terminals => {
      terminals.forEach(t => {
        const marker = L.circleMarker([t.latitude, t.longitude], {
          radius: 8,
          fillColor: "#6366f1",
          color: "#fff",
          weight: 1.5,
          fillOpacity: 0.8,
        });
        marker.bindPopup(`
          <div style="text-align:center;min-width:140px">
            <b>🏧 ${t.terminal_name}</b><br>
            <span style="color:#94a3b8;font-size:0.8em">ID: ${t.terminal_id}</span><br>
            <button onclick="selectTerminal(${t.terminal_id}, '${t.terminal_name}')"
              style="margin-top:8px;padding:6px 14px;background:#6366f1;border:none;border-radius:6px;color:white;cursor:pointer;font-size:0.8rem;font-weight:600;">
              Select Terminal
            </button>
          </div>
        `);
        marker.addTo(terminalMap);
        terminalMarkers[t.terminal_id] = marker;
      });
    })
    .catch(() => {
      document.getElementById("terminal-status").textContent = "⚠ Could not load terminals";
    });
}

function selectTerminal(id, name) {
  selectedTerminal = { terminal_id: id, terminal_name: name };

  // Update UI
  document.getElementById("sel-terminal-name").textContent = name;
  document.getElementById("sel-terminal-id").textContent   = id;
  document.getElementById("terminal-status").textContent   = "Terminal selected ✓";
  const box = document.getElementById("selected-terminal-box");
  box.classList.remove("hidden");

  // Highlight marker
  Object.values(terminalMarkers).forEach(m => m.setStyle({ fillColor: "#6366f1" }));
  if (terminalMarkers[id]) terminalMarkers[id].setStyle({ fillColor: "#f59e0b", fillOpacity: 1 });

  // Close popups
  terminalMap.closePopup();
}

function clearTerminal() {
  selectedTerminal = null;
  document.getElementById("selected-terminal-box").classList.add("hidden");
  document.getElementById("terminal-status").textContent = "Tap a terminal on the map";
  Object.values(terminalMarkers).forEach(m => m.setStyle({ fillColor: "#6366f1" }));
}

// ── Quick amount ──────────────────────────────────────────────────────────────
function setAmount(val) {
  document.getElementById("tx-amount").value = val;
}

// ── Submit Transaction ────────────────────────────────────────────────────────
async function handleTransaction() {
  const errEl = document.getElementById("tx-error");
  errEl.classList.remove("visible");

  if (!selectedTerminal) {
    showError("tx-error", "Please select a terminal from the map first.");
    return;
  }
  const amount = parseFloat(document.getElementById("tx-amount").value);
  if (!amount || amount <= 0) {
    showError("tx-error", "Please enter a valid transaction amount.");
    return;
  }

  const btn = document.getElementById("btn-pay");
  btn.disabled = true;
  btn.querySelector("span:last-child").textContent = "Processing…";

  // Get current GPS for the transaction
  let lat = detectedLat, lon = detectedLon;
  try {
    await new Promise(resolve => {
      navigator.geolocation?.getCurrentPosition(
        p => { lat = p.coords.latitude; lon = p.coords.longitude; resolve(); },
        () => resolve(),
        { timeout: 2000 }
      );
    });
  } catch {}

  try {
    const res = await apiFetch("/api/transactions/create", "POST", {
      terminal_id: selectedTerminal.terminal_id,
      tx_amount:   amount,
      lat, lon,
    }, true);

    if (res.status === "PENDING_OTP") {
      pendingTxId = res.transaction_id;
      showOtpOverlay(res);
    } else {
      showSuccess(`$${amount.toFixed(2)} sent to ${selectedTerminal.terminal_name} — Transaction ID: ${res.transaction_id}`);
      clearTerminal();
      document.getElementById("tx-amount").value = "";
      loadHistory();
    }
  } catch (err) {
    showError("tx-error", err.message || "Transaction failed. Please try again.");
  } finally {
    btn.disabled = false;
    btn.querySelector("span:last-child").textContent = "Initiate Secure Transaction";
  }
}

// ── OTP Overlay ───────────────────────────────────────────────────────────────
function showOtpOverlay(res) {
  const overlay = document.getElementById("otp-overlay");
  overlay.classList.remove("hidden");
  document.getElementById("otp-meta").textContent =
    `Transaction: ${res.transaction_id?.slice(0, 8)}… | ${res.scenario || "Suspicious Activity"} | ${((res.fraud_probability ?? 0) * 100).toFixed(1)}% confidence`;

  document.querySelectorAll(".otp-digit").forEach(d => d.value = "");
  document.querySelectorAll(".otp-digit")[0].focus();
  document.getElementById("otp-error").classList.remove("visible");

  startOtpTimer(res.otp_expires_in || 40);   // was hardcoded 300
}

function initOtpInputs() {
  const digits = document.querySelectorAll(".otp-digit");
  digits.forEach((d, i) => {
    d.addEventListener("input", () => {
      if (d.value.length === 1 && i < digits.length - 1) digits[i + 1].focus();
    });
    d.addEventListener("keydown", e => {
      if (e.key === "Backspace" && !d.value && i > 0) digits[i - 1].focus();
    });
    d.addEventListener("paste", e => {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
      [...txt].slice(0, 6).forEach((ch, j) => {
        if (digits[j]) digits[j].value = ch;
      });
      digits[Math.min(txt.length, 5)].focus();
    });
  });
}

function startOtpTimer(seconds) {
  clearInterval(otpTimer);
  const el = document.getElementById("otp-countdown");

  const tick = () => {
    const m = Math.floor(seconds / 60), s = seconds % 60;
    el.textContent = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

    // Add urgency styling in last 60 seconds
    el.style.color = seconds <= 60 ? "#ef4444" : "";

    if (seconds <= 0) {
      clearInterval(otpTimer);
      el.textContent = "Expired";
      autoDeclineOnTimeout();
      return;
    }
    seconds--;
  };

  tick();
  otpTimer = setInterval(tick, 1000);
}

async function autoDeclineOnTimeout() {
  if (!pendingTxId) return;

  // Disable verify button so user can't race
  const btn = document.getElementById("btn-verify-otp");
  if (btn) { btn.disabled = true; btn.textContent = "Timed Out"; }

  showError("otp-error", "⏰ Time expired! Sending OTP code timed out. Transaction declined as fraud.");

  try {
    await apiFetch("/api/transactions/decline", "POST", {
      transaction_id: pendingTxId,
      otp_code: "000000",   // placeholder — backend ignores this on /decline
    }, true);
  } catch {
    // Silently ignore — backend may already have resolved it
  }

  pendingTxId = null;

  // Auto-close overlay after a short delay so user can read the message
  setTimeout(() => {
    document.getElementById("otp-overlay").classList.add("hidden");
    showError("tx-error", "⏰ OTP verification timed out. Transaction was automatically declined and flagged as fraud.");
    loadHistory();
  }, 3000);
}


async function submitOtp() {
  const digits = [...document.querySelectorAll(".otp-digit")].map(d => d.value).join("");
  if (digits.length < 6) {
    showError("otp-error", "Please enter all 6 digits.");
    return;
  }

  const btn = document.getElementById("btn-verify-otp");
  btn.disabled = true;
  btn.textContent = "Verifying…";
  document.getElementById("otp-error").classList.remove("visible");

  try {
    await apiFetch("/api/transactions/verify", "POST", {
      transaction_id: pendingTxId,
      otp_code:       digits,
    }, true);

    clearInterval(otpTimer);
    document.getElementById("otp-overlay").classList.add("hidden");
    showSuccess("Transaction verified and approved! ✅");
    loadHistory();
  } catch (err) {
    showError("otp-error", "Invalid or expired OTP. Transaction declined.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Verify & Approve";
  }
}

function declineOtp() {
  clearInterval(otpTimer);
  const txId = pendingTxId;
  document.getElementById("otp-overlay").classList.add("hidden");
  showError("tx-error", "Verification cancelled — this is NOT recorded as fraud. Reopen this transaction from your history below to finish verifying.");
  pendingTxId = null;

  if (txId) {
    apiFetch("/api/transactions/otp-pending", "POST", { transaction_id: txId }, true).catch(() => {});
  }
  loadHistory();
}

async function resumeTransaction(transactionId) {
  try {
    const res = await apiFetch("/api/transactions/resume", "POST", { transaction_id: transactionId }, true);
    pendingTxId = res.transaction_id;
    showOtpOverlay(res);
  } catch (err) {
    showError("tx-error", err.message || "Could not resume this transaction — it may already be resolved.");
    loadHistory();
  }
}

// ── Success Overlay ───────────────────────────────────────────────────────────
function showSuccess(msg) {
  document.getElementById("success-msg").textContent = msg;
  document.getElementById("success-overlay").classList.remove("hidden");
}

function closeSuccess() {
  document.getElementById("success-overlay").classList.add("hidden");
}

// ── API helper ────────────────────────────────────────────────────────────────
async function apiFetch(path, method = "GET", body = null, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth && authToken) headers["Authorization"] = `Bearer ${authToken}`;

  const res = await fetch(API + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || `HTTP ${res.status}`);
  }
  return data;
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add("visible");
}
