(function initPortfolio() {
  const STORAGE_KEY = "aiTradingTerminal.portfolio.v1";
  const portfolioTab = document.getElementById("portfolioTab");
  const portfolioPanel = document.getElementById("portfolioPanel");
  const portfolioForm = document.getElementById("portfolioForm");
  if (!portfolioTab || !portfolioPanel || !portfolioForm) return;

  const tabs = document.querySelectorAll(".tab");
  const panels = document.querySelectorAll(".tab-panel");
  const fields = {
    badge: document.getElementById("portfolioBadge"),
    symbol: document.getElementById("portfolioSymbol"),
    holding: document.getElementById("portfolioHolding"),
    averagePrice: document.getElementById("portfolioAveragePrice"),
    currentPrice: document.getElementById("portfolioCurrentPrice"),
    status: document.getElementById("portfolioStatus"),
    totalHolding: document.getElementById("portfolioTotalHolding"),
    averageSummary: document.getElementById("portfolioAverageSummary"),
    currentSummary: document.getElementById("portfolioCurrentSummary"),
    pnl: document.getElementById("portfolioPnl"),
    winRate: document.getElementById("portfolioWinRate"),
    rows: document.getElementById("portfolioRows")
  };

  function readPortfolio() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function writePortfolio(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }

  function toNumber(value) {
    const number = Number(String(value || "").replace(",", "."));
    return Number.isFinite(number) ? number : null;
  }

  function normalizeSymbol(value) {
    return String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function formatNumber(value, digits = 2) {
    if (!Number.isFinite(value)) return "-";
    return value.toLocaleString("vi-VN", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits
    });
  }

  function formatPercent(value) {
    if (!Number.isFinite(value)) return "-";
    return `${value >= 0 ? "+" : ""}${formatNumber(value, 2)}%`;
  }

  function getPnl(item) {
    return (item.currentPrice - item.averagePrice) * item.holding;
  }

  function getPnlPercent(item) {
    const cost = item.averagePrice * item.holding;
    return cost ? (getPnl(item) / cost) * 100 : null;
  }

  function setActivePortfolioTab() {
    tabs.forEach((tab) => {
      const active = tab === portfolioTab;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      const active = panel === portfolioPanel;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });
  }

  function hidePortfolioWhenOtherTabOpens(event) {
    const tab = event.target.closest(".tab");
    if (!tab || tab === portfolioTab) return;
    portfolioPanel.hidden = true;
    portfolioPanel.classList.remove("active");
  }

  function summarize(items) {
    const totalHolding = items.reduce((sum, item) => sum + item.holding, 0);
    const totalCost = items.reduce((sum, item) => sum + item.averagePrice * item.holding, 0);
    const totalCurrent = items.reduce((sum, item) => sum + item.currentPrice * item.holding, 0);
    const pnl = totalCurrent - totalCost;
    const avgPrice = totalHolding ? totalCost / totalHolding : null;
    const currentPrice = totalHolding ? totalCurrent / totalHolding : null;
    const closed = items.filter((item) => item.status === "closed");
    const winBase = closed.length ? closed : items;
    const winners = winBase.filter((item) => getPnl(item) > 0).length;
    const winRate = winBase.length ? (winners / winBase.length) * 100 : null;
    return { totalHolding, avgPrice, currentPrice, pnl, winRate };
  }

  function renderPortfolio() {
    const items = readPortfolio();
    const summary = summarize(items);
    const pnlClass = summary.pnl > 0 ? "positive" : summary.pnl < 0 ? "negative" : "neutral";

    fields.badge.textContent = `${items.length} lệnh`;
    fields.badge.className = items.length ? "neutral" : "";
    fields.totalHolding.textContent = summary.totalHolding ? formatNumber(summary.totalHolding, 4) : "-";
    fields.averageSummary.textContent = summary.avgPrice === null ? "-" : formatNumber(summary.avgPrice, 4);
    fields.currentSummary.textContent = summary.currentPrice === null ? "-" : formatNumber(summary.currentPrice, 4);
    fields.pnl.textContent = summary.pnl ? formatNumber(summary.pnl, 2) : "-";
    fields.pnl.className = pnlClass;
    fields.winRate.textContent = summary.winRate === null ? "-" : formatNumber(summary.winRate, 2) + "%";

    if (!items.length) {
      fields.rows.innerHTML = `<tr><td colspan="7" class="portfolio-empty-row">Chưa có lệnh nào.</td></tr>`;
      return;
    }

    fields.rows.innerHTML = items.map((item) => {
      const pnl = getPnl(item);
      const pnlPercent = getPnlPercent(item);
      const className = pnl > 0 ? "positive" : pnl < 0 ? "negative" : "neutral";
      return `
        <tr>
          <td><strong>${item.symbol}</strong></td>
          <td>${formatNumber(item.holding, 4)}</td>
          <td>${formatNumber(item.averagePrice, 4)}</td>
          <td>${formatNumber(item.currentPrice, 4)}</td>
          <td class="${className}">${formatNumber(pnl, 2)} <em>${formatPercent(pnlPercent)}</em></td>
          <td><span class="portfolio-status ${item.status}">${item.status === "closed" ? "Closed" : "Open"}</span></td>
          <td>
            <button type="button" class="portfolio-action" data-edit="${item.id}">Sửa</button>
            <button type="button" class="portfolio-action danger" data-delete="${item.id}">Xóa</button>
          </td>
        </tr>
      `;
    }).join("");
  }

  function resetForm() {
    portfolioForm.reset();
    delete portfolioForm.dataset.editing;
    fields.symbol.focus();
  }

  function savePosition(event) {
    event.preventDefault();
    const symbol = normalizeSymbol(fields.symbol.value);
    const holding = toNumber(fields.holding.value);
    const averagePrice = toNumber(fields.averagePrice.value);
    const currentPrice = toNumber(fields.currentPrice.value);
    const status = fields.status.value === "closed" ? "closed" : "open";

    if (!symbol || !holding || !averagePrice || !currentPrice) {
      fields.badge.textContent = "Thiếu dữ liệu";
      fields.badge.className = "negative";
      return;
    }

    const items = readPortfolio();
    const editingId = portfolioForm.dataset.editing;
    const nextItem = {
      id: editingId || `${symbol}-${Date.now()}`,
      symbol,
      holding,
      averagePrice,
      currentPrice,
      status,
      updatedAt: Date.now()
    };
    const nextItems = editingId
      ? items.map((item) => item.id === editingId ? nextItem : item)
      : [nextItem, ...items];
    writePortfolio(nextItems);
    resetForm();
    renderPortfolio();
  }

  function editPosition(id) {
    const item = readPortfolio().find((entry) => entry.id === id);
    if (!item) return;
    portfolioForm.dataset.editing = item.id;
    fields.symbol.value = item.symbol;
    fields.holding.value = item.holding;
    fields.averagePrice.value = item.averagePrice;
    fields.currentPrice.value = item.currentPrice;
    fields.status.value = item.status;
    fields.symbol.focus();
  }

  function deletePosition(id) {
    writePortfolio(readPortfolio().filter((item) => item.id !== id));
    renderPortfolio();
  }

  portfolioTab.addEventListener("click", setActivePortfolioTab);
  document.addEventListener("click", hidePortfolioWhenOtherTabOpens);
  portfolioForm.addEventListener("submit", savePosition);
  fields.rows.addEventListener("click", (event) => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");
    if (editButton) editPosition(editButton.dataset.edit);
    if (deleteButton) deletePosition(deleteButton.dataset.delete);
  });

  renderPortfolio();
}());
