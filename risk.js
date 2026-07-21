(function initRiskCalculator() {
  const riskTab = document.getElementById("riskTab");
  const riskPanel = document.getElementById("riskPanel");
  const riskForm = document.getElementById("riskForm");
  if (!riskTab || !riskPanel || !riskForm) return;

  const tabs = document.querySelectorAll(".tab");
  const knownPanels = document.querySelectorAll(".tab-panel");
  const fields = {
    badge: document.getElementById("riskBadge"),
    capital: document.getElementById("riskCapital"),
    percent: document.getElementById("riskPercent"),
    entry: document.getElementById("riskEntry"),
    stoploss: document.getElementById("riskStoploss"),
    positionSize: document.getElementById("riskPositionSize"),
    loss: document.getElementById("riskLoss"),
    reward: document.getElementById("riskReward"),
    rr: document.getElementById("riskRr"),
    reset: document.getElementById("riskReset")
  };

  function toNumber(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function formatMoney(value) {
    if (!Number.isFinite(value)) return "-";
    return value.toLocaleString("vi-VN", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    });
  }

  function formatSize(value) {
    if (!Number.isFinite(value)) return "-";
    return value.toLocaleString("vi-VN", {
      maximumFractionDigits: 6,
      minimumFractionDigits: value < 1 ? 6 : 2
    });
  }

  function setRiskTabActive() {
    tabs.forEach((tab) => {
      const active = tab === riskTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    knownPanels.forEach((panel) => {
      const active = panel === riskPanel;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  }

  function hideRiskPanelWhenOtherTabOpens(event) {
    const tab = event.target.closest(".tab");
    if (!tab || tab === riskTab) return;
    riskPanel.hidden = true;
    riskPanel.classList.remove("active");
  }

  function setOutputs(positionSize = null, loss = null, reward = null, rr = null) {
    fields.positionSize.textContent = positionSize === null ? "-" : formatSize(positionSize);
    fields.loss.textContent = loss === null ? "-" : formatMoney(loss);
    fields.reward.textContent = reward === null ? "-" : formatMoney(reward);
    fields.rr.textContent = rr || "-";
  }

  function calculateRisk(event) {
    event.preventDefault();
    const capital = toNumber(fields.capital.value);
    const riskPercent = toNumber(fields.percent.value);
    const entry = toNumber(fields.entry.value);
    const stoploss = toNumber(fields.stoploss.value);

    if (!capital || !riskPercent || !entry || !stoploss || entry === stoploss) {
      setOutputs();
      fields.badge.textContent = "Thiếu dữ liệu";
      fields.badge.className = "negative";
      return;
    }

    const riskAmount = capital * (riskPercent / 100);
    const riskPerUnit = Math.abs(entry - stoploss);
    const positionSize = riskAmount / riskPerUnit;
    const reward = riskAmount * 2;

    setOutputs(positionSize, riskAmount, reward, "1 : 2");
    fields.badge.textContent = "Đã tính";
    fields.badge.className = riskPercent <= 1 ? "positive" : riskPercent <= 2 ? "neutral" : "negative";
  }

  function resetRisk() {
    riskForm.reset();
    setOutputs();
    fields.badge.textContent = "Chưa tính";
    fields.badge.className = "";
    fields.capital.focus();
  }

  riskTab.addEventListener("click", setRiskTabActive);
  document.addEventListener("click", hideRiskPanelWhenOtherTabOpens);
  riskForm.addEventListener("submit", calculateRisk);
  fields.reset?.addEventListener("click", resetRisk);
}());
