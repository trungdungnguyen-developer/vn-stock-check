function updateMarketCell(valueTarget, changeTarget, quote, options = {}) {
  const price = toNumber(quote?.price);
  const changePercent = toNumber(quote?.changePercent);
  valueTarget.textContent = price === null ? "-" : `${formatMarketValue(price, options.digits ?? 2)}${options.suffix || ""}`;
  changeTarget.textContent = changePercent === null ? "-" : formatPercent(changePercent);
  changeTarget.classList.remove("positive", "negative", "neutral");
  const className = valueClass(changePercent);
  if (className) changeTarget.classList.add(className);
}

async function loadMarketStrip() {
  const loaders = [
    {
      valueTarget: fields.marketVni,
      changeTarget: fields.marketVniChange,
      options: { digits: 2 },
      load: async () => parseVciData(await requestVciData("VNINDEX", "1d"))?.quote
    },
    {
      valueTarget: fields.marketGold,
      changeTarget: fields.marketGoldChange,
      options: { digits: 2 },
      load: () => requestYahooQuote("GC=F")
    },
    {
      valueTarget: fields.marketBitcoin,
      changeTarget: fields.marketBitcoinChange,
      options: { digits: 2 },
      load: () => requestCryptoQuote("BTC-USDT")
    },
    {
      valueTarget: fields.marketOil,
      changeTarget: fields.marketOilChange,
      options: { digits: 2 },
      load: () => requestYahooQuote("CL=F")
    }
  ];

  await Promise.all(loaders.map(async (item) => {
    if (!item.valueTarget || !item.changeTarget) return;
    try {
      const quote = await item.load();
      updateMarketCell(item.valueTarget, item.changeTarget, quote, item.options);
    } catch {
      item.valueTarget.textContent = "-";
      item.changeTarget.textContent = "Không tải được";
      item.changeTarget.classList.remove("positive", "negative");
      item.changeTarget.classList.add("neutral");
    }
  }));
}

function getFirstRecord(data) {
  if (Array.isArray(data)) return data[0] || {};
  if (Array.isArray(data?.data)) return data.data[0] || {};
  return data || {};
}

function normalizeSymbolInput(symbol) {
  return safeText(symbol).trim().toUpperCase().replace(/\s+/g, "");
}

function toYahooCryptoSymbol(symbol) {
  const raw = normalizeSymbolInput(symbol);
  if (CRYPTO_ALIASES[raw]) return CRYPTO_ALIASES[raw];
  const normalized = normalizeSymbolInput(symbol)
    .replace("-USDT", "-USD")
    .replace("/USDT", "-USD")
    .replace("USDT", "-USD")
    .replace("/USD", "-USD");
  if (CRYPTO_ALIASES[normalized]) return CRYPTO_ALIASES[normalized];
  if (/^[A-Z0-9]+-USD$/.test(normalized)) return normalized;
  if (CRYPTO_SYMBOLS.has(normalized)) return `${normalized}-USD`;
  return "";
}

(function initNotificationCenter() {
  const STORAGE_KEY = "aiTradingTerminal.notifications.v1";
  const MAX_ITEMS = 80;
  const seenSession = new Set();

  const button = document.querySelector(".header-icon[aria-label='Notification']");
  if (!button) return;

  function readItems() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function writeItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  }

  function normalizeText(value) {
    return String(value || "").trim().replace(/\s+/g, " ");
  }

  function getCurrentSymbolForNotification() {
    return normalizeText(document.getElementById("ticker")?.textContent)
      || normalizeText(document.getElementById("symbol")?.value)
      || "Market";
  }

  function formatTime(timestamp) {
    return new Date(timestamp).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit"
    });
  }

  function createStyle() {
    if (document.getElementById("notificationCenterStyle")) return;
    const style = document.createElement("style");
    style.id = "notificationCenterStyle";
    style.textContent = `
      .notification-center {
        position: fixed;
        top: 78px;
        right: 24px;
        z-index: 1000;
        width: min(420px, calc(100vw - 32px));
        max-height: min(680px, calc(100vh - 110px));
        display: none;
        border: 1px solid #334155;
        border-radius: 16px;
        background: #0f172a;
        box-shadow: 0 24px 70px rgba(2, 6, 23, 0.45);
        overflow: hidden;
      }
      .notification-center.open { display: grid; }
      .notification-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #334155;
        padding: 16px;
      }
      .notification-head h3 {
        margin: 0;
        color: #f8fafc;
        font-size: 18px;
      }
      .notification-head div {
        display: flex;
        gap: 8px;
      }
      .notification-head button,
      .notification-clear {
        min-height: 32px;
        border: 1px solid #334155;
        border-radius: 9px;
        padding: 0 10px;
        background: #1e293b;
        color: #e2e8f0;
        cursor: pointer;
        font-weight: 700;
      }
      .notification-list {
        display: grid;
        gap: 10px;
        overflow: auto;
        padding: 14px;
      }
      .notification-item {
        display: grid;
        gap: 5px;
        border: 1px solid #334155;
        border-left-width: 4px;
        border-radius: 12px;
        padding: 12px;
        background: #111827;
      }
      .notification-item.alert { border-left-color: #38bdf8; }
      .notification-item.watchlist { border-left-color: #f59e0b; }
      .notification-item.scanner { border-left-color: #22c55e; }
      .notification-item.signal { border-left-color: #ef4444; }
      .notification-item strong {
        color: #f8fafc;
        font-size: 14px;
      }
      .notification-item p {
        margin: 0;
        color: #cbd5e1;
        font-size: 13px;
        line-height: 1.45;
      }
      .notification-item span {
        color: #64748b;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .notification-empty {
        border: 1px dashed #334155;
        border-radius: 12px;
        padding: 18px;
        color: #94a3b8;
        text-align: center;
      }
      .notification-badge-dot {
        position: absolute;
        transform: translate(7px, -7px);
        width: 9px;
        height: 9px;
        border-radius: 999px;
        background: #ef4444;
        box-shadow: 0 0 0 3px #0f172a;
      }
    `;
    document.head.appendChild(style);
  }

  function createPanel() {
    let panel = document.getElementById("notificationCenter");
    if (panel) return panel;
    panel = document.createElement("section");
    panel.id = "notificationCenter";
    panel.className = "notification-center";
    panel.innerHTML = `
      <div class="notification-head">
        <h3>Notification Center</h3>
        <div>
          <button type="button" data-notification-clear>Clear</button>
          <button type="button" data-notification-close>Close</button>
        </div>
      </div>
      <div class="notification-list" data-notification-list></div>
    `;
    document.body.appendChild(panel);
    panel.querySelector("[data-notification-close]")?.addEventListener("click", () => panel.classList.remove("open"));
    panel.querySelector("[data-notification-clear]")?.addEventListener("click", () => {
      writeItems([]);
      renderPanel();
      updateButtonState();
    });
    return panel;
  }

  function renderPanel() {
    const panel = createPanel();
    const list = panel.querySelector("[data-notification-list]");
    const items = readItems();
    if (!items.length) {
      list.innerHTML = `<div class="notification-empty">Chưa có thông báo nào.</div>`;
      return;
    }
    list.innerHTML = items.map((item) => `
      <article class="notification-item ${item.type}">
        <span>${item.typeLabel} · ${formatTime(item.createdAt)}</span>
        <strong>${item.title}</strong>
        <p>${item.message}</p>
      </article>
    `).join("");
  }

  function updateButtonState() {
    if (!button.querySelector(".notification-badge-dot") && readItems().length) {
      const dot = document.createElement("span");
      dot.className = "notification-badge-dot";
      button.appendChild(dot);
    }
    if (!readItems().length) {
      button.querySelector(".notification-badge-dot")?.remove();
    }
  }

  function pushNotification(type, title, message) {
    const cleanTitle = normalizeText(title);
    const cleanMessage = normalizeText(message);
    if (!cleanTitle || !cleanMessage) return;
    const key = `${type}:${cleanTitle}:${cleanMessage}`;
    if (seenSession.has(key)) return;
    seenSession.add(key);
    const typeLabel = {
      alert: "Alert",
      watchlist: "Watchlist Alert",
      scanner: "Scanner Alert",
      signal: "Signal Alert"
    }[type] || "Alert";
    writeItems([
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, type, typeLabel, title: cleanTitle, message: cleanMessage, createdAt: Date.now() },
      ...readItems()
    ]);
    renderPanel();
    updateButtonState();
  }

  function observeText(selector, type, titleBuilder, shouldNotify) {
    const target = document.querySelector(selector);
    if (!target) return;
    let previous = normalizeText(target.textContent);
    const observer = new MutationObserver(() => {
      const next = normalizeText(target.textContent);
      if (!next || next === previous) return;
      previous = next;
      if (shouldNotify && !shouldNotify(next, target)) return;
      pushNotification(type, titleBuilder(next, target), next);
    });
    observer.observe(target, { childList: true, characterData: true, subtree: true, attributes: true });
  }

  function observeWatchlist() {
    ["#favoriteWatchlist", "#recentWatchlist"].forEach((selector) => {
      const target = document.querySelector(selector);
      if (!target) return;
      let previous = normalizeText(target.textContent);
      new MutationObserver(() => {
        const next = normalizeText(target.textContent);
        if (!next || next === previous || next.includes("Chưa có dữ liệu")) return;
        previous = next;
        pushNotification("watchlist", selector.includes("favorite") ? "Favorite updated" : "Recently Viewed updated", next.slice(0, 120));
      }).observe(target, { childList: true, subtree: true, characterData: true });
    });
  }

  createStyle();
  createPanel();
  renderPanel();
  updateButtonState();

  button.addEventListener("click", () => {
    const panel = createPanel();
    panel.classList.toggle("open");
    renderPanel();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.getElementById("notificationCenter")?.classList.remove("open");
  });

  pushNotification("alert", "Notification Center sẵn sàng", "Alert, Watchlist Alert, Scanner Alert và Signal Alert sẽ được lưu trên trình duyệt.");
  observeText("#scannerBadge", "scanner", () => "Market Scanner cập nhật", (text) => !/^Đang|Chưa|Lỗi/i.test(text));
  observeText("#cryptoTradingBadge", "scanner", () => "Crypto Trading cập nhật", (text) => !/^Đang|Chưa|Lỗi/i.test(text));
  observeText("#tradeBadge", "signal", () => `Signal cho ${getCurrentSymbolForNotification()}`, (text) => !/^Đang|Chưa|Thiếu/i.test(text));
  observeText("#aiBadge", "signal", () => `AI Signal cho ${getCurrentSymbolForNotification()}`, (text) => !/^Đang|Chưa|Thiếu/i.test(text));
  observeText("#message", "alert", () => "Thông báo hệ thống", (text) => Boolean(text && !/^Đang tải/i.test(text)));
  observeWatchlist();
}());

(function initSkeletonLoadingMarkers() {
  const loadingTextPattern = /^(Đang|Dang)\b/i;

  function syncLoadingState(root = document) {
    root.querySelectorAll(".ai-analysis > article, .trade-analysis > article, .scanner-results > article, .crypto-trading-body > article, .news-list > article").forEach((article) => {
      const text = String(article.textContent || "").trim();
      article.classList.toggle("is-loading", loadingTextPattern.test(text));
    });
  }

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      const target = mutation.target.nodeType === Node.ELEMENT_NODE ? mutation.target : mutation.target.parentElement;
      if (target) syncLoadingState(target.closest(".tab-panel") || target);
    });
  });

  observer.observe(document.body, { childList: true, characterData: true, subtree: true });
  syncLoadingState();
}());

function isCryptoSymbol(symbol) {
  return Boolean(toCryptoPairSymbol(symbol) || toYahooCryptoSymbol(symbol));
}

function toCryptoPairSymbol(symbol) {
  const raw = normalizeSymbolInput(symbol);
  if (CRYPTO_EXCHANGE_ALIASES[raw]) return CRYPTO_EXCHANGE_ALIASES[raw];
  if (/^[A-Z0-9]+-USDT(-SWAP)?$/.test(raw)) return raw;
  const normalized = raw
    .replace("/USDT", "-USDT")
    .replace("USDT", "-USDT")
    .replace("/USD", "-USDT")
    .replace("-USD", "-USDT");
  if (CRYPTO_EXCHANGE_ALIASES[normalized]) return CRYPTO_EXCHANGE_ALIASES[normalized];
  if (/^[A-Z0-9]+-USDT(-SWAP)?$/.test(normalized)) return normalized;
  if (CRYPTO_SYMBOLS.has(normalized)) return `${normalized}-USDT`;
  return "";
}

function makeYahooCandidates(symbol) {
  const cryptoSymbol = toYahooCryptoSymbol(symbol);
  if (cryptoSymbol) return [cryptoSymbol];
  if (symbol.includes(".")) return [symbol];
  return [`${symbol}.VN`, `${symbol}.HM`, `${symbol}.HN`, symbol];
}

function parseYahooChart(rawData) {
  const result = rawData?.chart?.result?.[0];
  if (!result) return null;

  const meta = result.meta || {};
  const quoteData = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const bars = timestamps
    .map((timestamp, index) => ({
      timestamp: timestamp * 1000,
      time: new Date(timestamp * 1000).toLocaleDateString("vi-VN"),
      open: toNumber(quoteData.open?.[index]),
      high: toNumber(quoteData.high?.[index]),
      low: toNumber(quoteData.low?.[index]),
      close: toNumber(quoteData.close?.[index]),
      volume: toNumber(quoteData.volume?.[index])
    }))
    .filter((item) => item.close !== null);

  const latestBar = bars[bars.length - 1] || {};
  const previousClose = meta.previousClose ?? meta.chartPreviousClose;
  const price = meta.regularMarketPrice ?? latestBar.close;
  const isCrypto = meta.quoteType === "CRYPTOCURRENCY" || String(meta.symbol || "").endsWith("-USD");
  const change = toNumber(price) !== null && toNumber(previousClose) !== null
    ? toNumber(price) - toNumber(previousClose)
    : null;
  const changePercent = toNumber(change) !== null && toNumber(previousClose)
    ? (toNumber(change) / toNumber(previousClose)) * 100
    : null;

  return {
    source: "Yahoo Finance",
    quote: {
      ticker: meta.symbol,
      exchange: meta.fullExchangeName || meta.exchangeName,
      price,
      referencePrice: previousClose,
      ceilingPrice: null,
      floorPrice: null,
      highPrice: meta.regularMarketDayHigh ?? latestBar.high,
      lowPrice: meta.regularMarketDayLow ?? latestBar.low,
      volume: meta.regularMarketVolume ?? latestBar.volume,
      change,
      changePercent
    },
    overview: {
      ticker: meta.symbol,
      name: meta.longName || meta.shortName || meta.symbol,
      exchange: isCrypto ? "Crypto" : (meta.fullExchangeName || meta.exchangeName),
      industry: isCrypto ? "Tiền mã hóa" : "-",
      sector: isCrypto ? "Crypto" : "-",
      description: isCrypto
        ? `Dữ liệu giá coin lấy từ Yahoo Finance cho mã ${meta.symbol}. Tiền tệ: ${meta.currency || "USD"}.`
        : `Dữ liệu giá lấy từ Yahoo Finance cho mã ${meta.symbol}. Tiền tệ: ${meta.currency || "VND"}.`,
      marketCap: null,
      pe: null,
      pb: null,
      roe: null,
      eps: null,
      beta: null,
      currency: meta.currency,
      assetType: isCrypto ? "crypto" : "stock",
      fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: meta.fiftyTwoWeekLow
    },
    bars
  };
}

function boardName(value) {
  const text = safeText(value).toUpperCase();
  if (text === "HSX") return "HOSE";
  if (text === "HNX") return "HNX";
  if (text === "UPCOM") return "UPCOM";
  return text === "-" ? "" : text;
}

function parseVciData(rawData) {
  const chart = rawData?.chart?.[0];
  if (!chart || !Array.isArray(chart.c) || !chart.c.length) return null;

  const board = rawData?.board?.[0] || {};
  const listing = board.listingInfo || {};
  const match = board.matchPrice || {};
  const exchange = boardName(listing.board);
  const bars = chart.c.map((close, index) => {
    const timestamp = Number(chart.t[index]) * 1000;
    return {
      timestamp,
      time: new Date(timestamp).toLocaleDateString("vi-VN"),
      open: toNumber(chart.o?.[index]),
      high: toNumber(chart.h?.[index]),
      low: toNumber(chart.l?.[index]),
      close: toNumber(close),
      volume: toNumber(chart.v?.[index])
    };
  }).filter((item) => item.close !== null);

  const latestBar = bars[bars.length - 1] || {};
  const previousBar = bars[bars.length - 2] || {};
  const price = match.matchPrice || latestBar.close;
  const previousClose = match.referencePrice || previousBar.close;
  const change = toNumber(price) !== null && toNumber(previousClose) !== null
    ? toNumber(price) - toNumber(previousClose)
    : null;
  const changePercent = toNumber(change) !== null && toNumber(previousClose)
    ? (toNumber(change) / toNumber(previousClose)) * 100
    : null;
  const totalValue = toNumber(match.accumulatedValue) !== null ? match.accumulatedValue * 1_000_000 : null;

  return {
    source: "Vietcap/VCI",
    quote: {
      ticker: rawData.symbol || chart.symbol || listing.symbol,
      exchange,
      price,
      referencePrice: previousClose,
      ceilingPrice: listing.ceiling ?? match.ceilingPrice,
      floorPrice: listing.floor ?? match.floorPrice,
      highPrice: match.highest ?? latestBar.high,
      lowPrice: match.lowest ?? latestBar.low,
      volume: match.accumulatedVolume ?? latestBar.volume,
      change,
      changePercent,
      tradingDate: listing.tradingDate,
      foreignBuyValue: match.foreignBuyValue,
      foreignSellValue: match.foreignSellValue,
      totalValue
    },
    overview: {
      ticker: rawData.symbol || chart.symbol || listing.symbol,
      name: listing.enOrganName || listing.organName || listing.organShortName || listing.symbol,
      exchange,
      industry: "-",
      sector: "-",
      description: `Dữ liệu giá lấy từ Vietcap/VCI cho mã ${rawData.symbol || chart.symbol}. Sàn: ${exchange || "-"}.`,
      marketCap: null,
      pe: null,
      pb: null,
      roe: null,
      eps: null,
      beta: null,
      currency: "VND"
    },
    bars
  };
}

function yahooParamsForRange(rangeKey) {
  if (rangeKey === "5m") return { range: "30d", interval: "5m" };
  if (rangeKey === "30m") return { range: "60d", interval: "30m" };
  if (["1h", "2h", "4h"].includes(rangeKey)) return { range: "730d", interval: "60m" };
  return { range: "2y", interval: "1d" };
}

async function requestBarsForRange(symbol, rangeKey) {
  if (currentAssetType === "crypto") {
    try {
      const raw = await requestCryptoData(toCryptoPairSymbol(currentDataSymbol) || toCryptoPairSymbol(symbol) || currentDataSymbol || symbol, rangeKey);
      if (!raw?.bars?.length) throw new Error("Không có dữ liệu coin cho khung này.");
      return raw.bars;
    } catch (error) {
      const params = yahooParamsForRange(rangeKey);
      const raw = await requestYahooChartData(toYahooCryptoSymbol(currentDataSymbol) || toYahooCryptoSymbol(symbol), params.range, params.interval);
      const parsed = parseYahooChart(raw);
      if (!parsed?.bars?.length) throw error;
      return parsed.bars;
    }
  }

  const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
  const raw = await requestVciData(symbol, preset.sourceRange);
  const parsed = parseVciData(raw);
  if (!parsed?.bars?.length) throw new Error("Không có dữ liệu cho khung này.");
  return parsed.bars;
}

function syncCanvasSize(canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.round(rect.width || canvas.width));
  const height = Math.max(180, Math.round(rect.height || canvas.height));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { width, height };
}

