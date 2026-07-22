(function initWatchlist() {
  const STORAGE_KEY = "aiTradingTerminal.watchlist.v1";
  const MAX_RECENT = 24;
  const selectors = {
    form: "#stockForm",
    symbolInput: "#symbol",
    favoriteButton: "#favoriteToggle",
    favorite: "#favoriteWatchlist",
    recent: "#recentWatchlist",
    topVolume: "#topVolumeWatchlist",
    topGainer: "#topGainerWatchlist",
    topLoser: "#topLoserWatchlist",
    ticker: "#ticker",
    currentPrice: "#currentPrice",
    priceChange: "#priceChange",
    volume: "#volume"
  };

  const elements = Object.fromEntries(
    Object.entries(selectors).map(([key, selector]) => [key, document.querySelector(selector)])
  );

  if (!elements.form || !elements.symbolInput) return;

  function readState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        records: parsed.records && typeof parsed.records === "object" ? parsed.records : {}
      };
    } catch (error) {
      return { records: {} };
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeSymbol(symbol) {
    return String(symbol || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function parseLocaleNumber(text) {
    const raw = String(text || "").replace(/[^\d,.\-]/g, "");
    if (!raw || raw === "-") return null;
    const normalized = raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(/,/g, "");
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
  }

  function parsePercent(text) {
    const match = String(text || "").match(/[-+]?\d+(?:[,.]\d+)?(?=\s*%)/);
    return match ? parseLocaleNumber(match[0]) : null;
  }

  function formatCompact(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "-";
    if (Math.abs(number) >= 1_000_000_000) return `${(number / 1_000_000_000).toFixed(1)}B`;
    if (Math.abs(number) >= 1_000_000) return `${(number / 1_000_000).toFixed(1)}M`;
    if (Math.abs(number) >= 1_000) return `${(number / 1_000).toFixed(1)}K`;
    return number.toLocaleString("vi-VN");
  }

  function getCurrentSymbol() {
    return normalizeSymbol(elements.ticker?.textContent) || normalizeSymbol(elements.symbolInput.value);
  }

  function getCurrentSnapshot(symbol) {
    return {
      symbol,
      price: parseLocaleNumber(elements.currentPrice?.textContent),
      changePercent: parsePercent(elements.priceChange?.textContent),
      volume: parseLocaleNumber(elements.volume?.textContent),
      viewedAt: Date.now()
    };
  }

  function upsertRecord(symbol, patch = {}) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    const state = readState();
    const current = state.records[normalized] || { symbol: normalized, favorite: false };
    state.records[normalized] = {
      ...current,
      ...patch,
      symbol: normalized,
      viewedAt: patch.viewedAt || current.viewedAt || Date.now()
    };
    writeState(state);
    renderWatchlist();
  }

  function recordCurrentView() {
    const symbol = getCurrentSymbol();
    if (!symbol) return;
    upsertRecord(symbol, getCurrentSnapshot(symbol));
  }

  function toggleFavorite() {
    const symbol = getCurrentSymbol();
    if (!symbol) return;
    const state = readState();
    const current = state.records[symbol] || { symbol, viewedAt: Date.now() };
    state.records[symbol] = {
      ...current,
      ...getCurrentSnapshot(symbol),
      favorite: !current.favorite
    };
    writeState(state);
    renderWatchlist();
  }

  function sortedRecords() {
    return Object.values(readState().records)
      .filter((item) => item && item.symbol)
      .sort((a, b) => (b.viewedAt || 0) - (a.viewedAt || 0));
  }

  function renderList(container, items, type = "default") {
    if (!container) return;
    if (!items.length) {
      container.innerHTML = `<p class="watchlist-empty">Chưa có dữ liệu</p>`;
      return;
    }
    container.innerHTML = items.map((item) => {
      const changeClass = item.changePercent > 0 ? "positive" : item.changePercent < 0 ? "negative" : "neutral";
      const meta = type === "volume"
        ? `Vol ${formatCompact(item.volume)}`
        : item.changePercent === null || item.changePercent === undefined
          ? "Chưa có %"
          : `${item.changePercent > 0 ? "+" : ""}${item.changePercent.toFixed(2)}%`;
      return `
        <button type="button" class="watchlist-item" data-watch-symbol="${item.symbol}">
          <span>${item.symbol}</span>
          <em class="${changeClass}">${meta}</em>
        </button>
      `;
    }).join("");
  }

  function renderWatchlist() {
    const records = sortedRecords();
    const favorites = records.filter((item) => item.favorite);
    const recent = records.slice(0, MAX_RECENT);
    const withVolume = records.filter((item) => Number.isFinite(Number(item.volume)));
    const withChange = records.filter((item) => Number.isFinite(Number(item.changePercent)));

    renderList(elements.favorite, favorites.slice(0, 8));
    renderList(elements.recent, recent.slice(0, 8));
    renderList(elements.topVolume, [...withVolume].sort((a, b) => b.volume - a.volume).slice(0, 6), "volume");
    renderList(elements.topGainer, [...withChange].sort((a, b) => b.changePercent - a.changePercent).slice(0, 6));
    renderList(elements.topLoser, [...withChange].sort((a, b) => a.changePercent - b.changePercent).slice(0, 6));
    updateFavoriteButton();
  }

  function updateFavoriteButton() {
    if (!elements.favoriteButton) return;
    const symbol = getCurrentSymbol();
    const record = symbol ? readState().records[symbol] : null;
    const label = elements.favoriteButton.querySelector("span");
    if (label) label.textContent = record?.favorite ? "Favorited" : "Favorite";
    elements.favoriteButton.classList.toggle("is-favorite", Boolean(record?.favorite));
    elements.favoriteButton.setAttribute("aria-pressed", record?.favorite ? "true" : "false");
  }

  function openSymbol(symbol) {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    elements.symbolInput.value = normalized;
    elements.form.requestSubmit();
  }

  elements.form.addEventListener("submit", () => {
    const symbol = normalizeSymbol(elements.symbolInput.value);
    if (!symbol) return;
    upsertRecord(symbol, { viewedAt: Date.now() });
    window.setTimeout(recordCurrentView, 900);
    window.setTimeout(recordCurrentView, 1800);
  });

  elements.favoriteButton?.addEventListener("click", toggleFavorite);

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".watchlist-item[data-watch-symbol]");
    if (!button) return;
    openSymbol(button.dataset.watchSymbol);
  });

  const observerTargets = [elements.ticker, elements.currentPrice, elements.priceChange, elements.volume].filter(Boolean);
  const observer = new MutationObserver(() => {
    window.clearTimeout(observer.renderTimer);
    observer.renderTimer = window.setTimeout(recordCurrentView, 300);
  });
  observerTargets.forEach((target) => observer.observe(target, { childList: true, characterData: true, subtree: true }));

  renderWatchlist();
}());
