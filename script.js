const API_BASE = "https://query1.finance.yahoo.com";
const PROXY_BASE = "/.netlify/functions/vn-stock";
const CHART_COLORS = {
  text: "#6f5a6d",
  grid: "#ead6ea",
  price: "#880085",
  ma10: "#378dde",
  ma50: "#22bd3f",
  ma100: "#af2a01",
  ma200: "#e08c16",
  positive: "#22bd3f",
  negative: "#af2a01",
  neutral: "#e08c16"
};

const form = document.getElementById("stockForm");
const symbolInput = document.getElementById("symbol");
const message = document.getElementById("message");
const copyButton = document.getElementById("copyButton");
const chartCanvas = document.getElementById("priceChart");
const rsiCanvas = document.getElementById("rsiChart");
const macdCanvas = document.getElementById("macdChart");
const quickSymbols = document.querySelector(".quick-symbols");
const chartControls = document.querySelector(".chart-controls");
const historyControls = document.querySelector(".history-controls");
const chartSection = document.querySelector(".chart-section");
const chartWorkspace = document.getElementById("chartWorkspace");
const fullscreenChartButton = document.getElementById("fullscreenChart");
const refreshNewsButton = document.getElementById("refreshNewsButton");
const refreshAiButton = document.getElementById("refreshAiButton");
const refreshTradeButton = document.getElementById("refreshTradeButton");
const refreshScannerButton = document.getElementById("refreshScannerButton");
const scannerControls = document.querySelector(".scanner-controls");
const tabs = document.querySelectorAll(".tab");
const tabPanels = {
  overview: document.getElementById("overviewPanel"),
  score: document.getElementById("scorePanel"),
  news: document.getElementById("newsPanel"),
  ai: document.getElementById("aiPanel"),
  trade: document.getElementById("tradePanel"),
  scanner: document.getElementById("scannerPanel")
};

const fields = {
  lastUpdated: document.getElementById("lastUpdated"),
  exchange: document.getElementById("exchange"),
  companyName: document.getElementById("companyName"),
  companyDescription: document.getElementById("companyDescription"),
  currentPrice: document.getElementById("currentPrice"),
  priceChange: document.getElementById("priceChange"),
  marketVni: document.getElementById("marketVni"),
  marketVniChange: document.getElementById("marketVniChange"),
  marketGold: document.getElementById("marketGold"),
  marketGoldChange: document.getElementById("marketGoldChange"),
  marketBitcoin: document.getElementById("marketBitcoin"),
  marketBitcoinChange: document.getElementById("marketBitcoinChange"),
  marketOil: document.getElementById("marketOil"),
  marketOilChange: document.getElementById("marketOilChange"),
  referencePrice: document.getElementById("referencePrice"),
  ceilingPrice: document.getElementById("ceilingPrice"),
  floorPrice: document.getElementById("floorPrice"),
  highPrice: document.getElementById("highPrice"),
  lowPrice: document.getElementById("lowPrice"),
  volume: document.getElementById("volume"),
  ma10: document.getElementById("ma10"),
  ma50: document.getElementById("ma50"),
  ma100: document.getElementById("ma100"),
  ma200: document.getElementById("ma200"),
  chartRange: document.getElementById("chartRange"),
  ticker: document.getElementById("ticker"),
  listedExchange: document.getElementById("listedExchange"),
  industry: document.getElementById("industry"),
  sector: document.getElementById("sector"),
  marketCap: document.getElementById("marketCap"),
  peRatio: document.getElementById("peRatio"),
  pbRatio: document.getElementById("pbRatio"),
  roe: document.getElementById("roe"),
  eps: document.getElementById("eps"),
  beta: document.getElementById("beta"),
  rsiValue: document.getElementById("rsiValue"),
  macdValue: document.getElementById("macdValue"),
  change3: document.getElementById("change3"),
  change7: document.getElementById("change7"),
  change10: document.getElementById("change10"),
  change14: document.getElementById("change14"),
  change21: document.getElementById("change21"),
  change30: document.getElementById("change30"),
  foreignBuy: document.getElementById("foreignBuy"),
  foreignSell: document.getElementById("foreignSell"),
  foreignNet: document.getElementById("foreignNet"),
  domesticBuy: document.getElementById("domesticBuy"),
  domesticSell: document.getElementById("domesticSell"),
  domesticNet: document.getElementById("domesticNet"),
  flowStatus: document.getElementById("flowStatus"),
  historyCount: document.getElementById("historyCount"),
  historyBody: document.getElementById("historyBody"),
  scoreTotalBadge: document.getElementById("scoreTotalBadge"),
  scoreAnalysis: document.getElementById("scoreAnalysis"),
  newsBody: document.getElementById("newsBody"),
  aiBadge: document.getElementById("aiBadge"),
  aiAnalysisBody: document.getElementById("aiAnalysisBody"),
  tradeBadge: document.getElementById("tradeBadge"),
  tradeAnalysisBody: document.getElementById("tradeAnalysisBody"),
  scannerBadge: document.getElementById("scannerBadge"),
  scannerSummary: document.getElementById("scannerSummary"),
  scannerBody: document.getElementById("scannerBody"),
  fundamentalBadge: document.getElementById("fundamentalBadge"),
  fundamentalAnalysis: document.getElementById("fundamentalAnalysis"),
  recommendationBody: document.getElementById("recommendationBody"),
  rawData: document.getElementById("rawData")
};

const CHART_PRESETS = {
  "5m": { label: "5p", sourceRange: "5m", intervalMs: 5 * 60 * 1000, intraday: true },
  "30m": { label: "30p", sourceRange: "30m", intervalMs: 30 * 60 * 1000, intraday: true },
  "1h": { label: "1h", sourceRange: "1h", intervalMs: 60 * 60 * 1000, intraday: true },
  "2h": { label: "2h", sourceRange: "2h", intervalMs: 2 * 60 * 60 * 1000, intraday: true },
  "4h": { label: "4h", sourceRange: "4h", intervalMs: 4 * 60 * 60 * 1000, intraday: true },
  "1d": { label: "1 ngày", sourceRange: "2y", bucket: "1d" },
  "3d": { label: "3 ngày", sourceRange: "2y", bucket: "3d" },
  "5d": { label: "5 ngày", sourceRange: "2y", bucket: "5d" },
  "1w": { label: "1 tuần", sourceRange: "2y", bucket: "1w" },
  "1m": { label: "1 tháng", sourceRange: "2y", bucket: "1m" },
  "3m": { label: "3 tháng", sourceRange: "2y", bucket: "3m" }
};

const HISTORY_LIMITS = {
  "7": { label: "7 ngày", rows: 7 },
  "15": { label: "15 ngày", rows: 15 },
  "30": { label: "30 ngày", rows: 30 },
  "60": { label: "60 ngày", rows: 60 }
};

const CRYPTO_SYMBOLS = new Set([
  "BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "TON", "DOT",
  "LINK", "LTC", "BCH", "AVAX", "SHIB", "UNI", "AAVE", "ETC", "ATOM", "NEAR",
  "APT", "ARB", "OP", "FIL", "ICP", "XLM", "HBAR", "PEPE", "SUI", "MATIC",
  "USDC", "WLD", "TAO", "INJ", "SEI", "TIA", "FET", "ENA", "JUP", "BONK"
]);

const CRYPTO_ALIASES = {
  PI: "PI35697-USD",
  PIUSDT: "PI35697-USD",
  "PI/USDT": "PI35697-USD",
  "PI-USD": "PI35697-USD",
  "PI/USD": "PI35697-USD",
  PINETWORK: "PI35697-USD"
};

const CRYPTO_EXCHANGE_ALIASES = {
  PI: "PI-USDT",
  PIUSDT: "PI-USDT",
  "PI/USDT": "PI-USDT",
  "PI-USD": "PI-USDT",
  "PI/USD": "PI-USDT",
  "PI35697-USD": "PI-USDT",
  PINETWORK: "PI-USDT"
};

const SCANNER_CRYPTO_SYMBOLS = [
  "BTC", "ETH", "SOL", "BNB", "XRP", "DOGE", "SUI", "LINK", "AVAX", "INJ",
  "ARB", "OP", "APT", "NEAR", "DOT", "ADA", "LTC", "BCH", "TON", "PEPE",
  "WLD", "SEI", "TIA", "FET", "ENA", "JUP", "BONK", "PI"
];

const SCANNER_STOCK_SYMBOLS = [
  "FPT", "HPG", "SSI", "VND", "VCI", "HCM", "MBS", "VCB", "BID", "CTG",
  "TCB", "MBB", "VPB", "ACB", "VIB", "STB", "VIC", "VHM", "VRE", "KDH",
  "DIG", "DXG", "NVL", "MWG", "FRT", "DGW", "VNM", "MSN", "GAS", "PVD",
  "PVS", "PLX", "DGC", "GVR", "HSG", "NKG", "VIX", "SHB", "EIB", "POW"
];

let activeScannerType = "all";
let latestScannerResults = [];

let latestPayload = null;
let currentSymbol = "";
let currentAssetType = "stock";
let currentDataSymbol = "";
let currentDailyBars = [];
let currentChartSourceBars = [];
let activeChartRange = "1d";
let activeHistoryLimit = 30;
let chartRequestId = 0;
let latestNewsItems = [];
let latestMarketStrength = null;

function setMessage(text) {
  message.textContent = text;
}

function setActiveTab(name) {
  tabs.forEach((tab) => {
    const isActive = tab.dataset.tab === name;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });

  Object.entries(tabPanels).forEach(([panelName, panel]) => {
    panel.hidden = panelName !== name;
    panel.classList.toggle("active", panelName === name);
  });
}

function safeText(value) {
  if (value === undefined || value === null || value === "" || value === "N/A") return "-";
  return String(value);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 2) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatInteger(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatPrice(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function detectVietnamExchange(exchangeText) {
  const text = safeText(exchangeText).toUpperCase();
  if (text.includes("UPCOM")) return "UPCOM";
  if (text.includes("HNX") || text.includes("HANOI")) return "HNX";
  return "HOSE";
}

function priceStep(price) {
  const value = toNumber(price);
  if (value === null) return 100;
  if (value < 10000) return 10;
  if (value < 50000) return 50;
  return 100;
}

function roundToStep(value, step, mode) {
  if (mode === "ceil") return Math.ceil(value / step) * step;
  return Math.floor(value / step) * step;
}

function calculateCeilingFloor(referencePrice, exchangeText) {
  const reference = toNumber(referencePrice);
  if (reference === null) return { ceiling: null, floor: null, exchange: detectVietnamExchange(exchangeText) };

  const exchange = detectVietnamExchange(exchangeText);
  const limit = exchange === "UPCOM" ? 0.15 : exchange === "HNX" ? 0.10 : 0.07;
  const ceilingRaw = reference * (1 + limit);
  const floorRaw = reference * (1 - limit);

  return {
    ceiling: roundToStep(ceilingRaw, priceStep(ceilingRaw), "floor"),
    floor: roundToStep(floorRaw, priceStep(floorRaw), "ceil"),
    exchange
  };
}

function formatPercent(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return `${number > 0 ? "+" : ""}${number.toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}%`;
}

function valueClass(value) {
  const number = toNumber(value);
  if (number === null) return "";
  if (number === 0) return "neutral";
  return number > 0 ? "positive" : "negative";
}

function formatLargeNumber(value) {
  const number = toNumber(value);
  if (number === null) return "-";

  if (Math.abs(number) >= 1_000_000_000_000) {
    return `${formatNumber(number / 1_000_000_000_000, 2)} nghìn tỷ`;
  }
  if (Math.abs(number) >= 1_000_000_000) {
    return `${formatNumber(number / 1_000_000_000, 2)} tỷ`;
  }
  if (Math.abs(number) >= 1_000_000) {
    return `${formatNumber(number / 1_000_000, 2)} triệu`;
  }
  return formatInteger(number);
}

function formatOptional(value, digits = 2) {
  return toNumber(value) === null ? "-" : formatNumber(value, digits);
}

function formatFundamentalNumber(value, digits = 2) {
  const number = toNumber(value);
  if (number === null || number === 0) return "-";
  return formatNumber(number, digits);
}

function technicalPriceDivisor(bars) {
  const closes = bars
    .map((bar) => toNumber(bar.close))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  if (!closes.length) return 1;
  const median = closes[Math.floor(closes.length / 2)];
  return median >= 1000 ? 1000 : 1;
}

function normalizeTechnicalBars(bars) {
  const divisor = technicalPriceDivisor(bars);
  if (divisor === 1) return bars;
  const normalize = (value) => {
    const number = toNumber(value);
    return number === null ? null : number / divisor;
  };

  return bars.map((bar) => ({
    ...bar,
    open: normalize(bar.open),
    high: normalize(bar.high),
    low: normalize(bar.low),
    close: normalize(bar.close)
  }));
}

async function requestJson(path) {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const url = `${PROXY_BASE}?path=${encodeURIComponent(path)}`;

  let response;
  try {
    response = await fetch(url, { headers: { accept: "application/json" } });
  } catch (error) {
    throw new Error("Không kết nối được đến proxy dữ liệu. Hãy kiểm tra website đã deploy kèm Netlify Function chưa.");
  }

  if (!response.ok) {
    throw new Error(`Không tải được dữ liệu. HTTP ${response.status}`);
  }

  return response.json();
}

async function requestVciData(symbol, range = "2y") {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const response = await fetch(`${PROXY_BASE}?source=vci&symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`VCI không tải được dữ liệu. HTTP ${response.status}`);
  }
  return response.json();
}

async function requestYahooChartData(symbol, range = "2y", interval = "1d") {
  return requestJson(`/v8/finance/chart/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`);
}

async function requestCryptoData(symbol, range = "2y") {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const response = await fetch(`${PROXY_BASE}?source=crypto&symbol=${encodeURIComponent(symbol)}&range=${encodeURIComponent(range)}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Không tải được dữ liệu coin. HTTP ${response.status}`);
  }
  return response.json();
}

async function requestNewsData() {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const response = await fetch(`${PROXY_BASE}?source=news`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Không tải được tin tức. HTTP ${response.status}`);
  }
  return response.json();
}

async function requestFundamentalsData(symbol) {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const response = await fetch(`${PROXY_BASE}?source=fundamentals&symbol=${encodeURIComponent(symbol)}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(`Không tải được chỉ số cơ bản. HTTP ${response.status}`);
  }
  return response.json();
}

async function requestYahooQuote(symbol) {
  const raw = await requestYahooChartData(symbol, "1d", "5m");
  const parsed = parseYahooChart(raw);
  if (!parsed?.quote) throw new Error(`Không có dữ liệu ${symbol}`);
  return parsed.quote;
}

async function requestCryptoQuote(symbol) {
  const raw = await requestCryptoData(symbol, "1d");
  if (!raw?.quote) throw new Error(`Không có dữ liệu ${symbol}`);
  return raw.quote;
}

function formatMarketValue(value, digits = 2) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

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
      options: { digits: 0 },
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
    .replace("/USDT", "-USD")
    .replace("USDT", "-USD")
    .replace("/USD", "-USD");
  if (CRYPTO_ALIASES[normalized]) return CRYPTO_ALIASES[normalized];
  if (/^[A-Z0-9]+-USD$/.test(normalized)) return normalized;
  if (CRYPTO_SYMBOLS.has(normalized)) return `${normalized}-USD`;
  return "";
}

function isCryptoSymbol(symbol) {
  return Boolean(toCryptoPairSymbol(symbol) || toYahooCryptoSymbol(symbol));
}

function toCryptoPairSymbol(symbol) {
  const raw = normalizeSymbolInput(symbol);
  if (CRYPTO_EXCHANGE_ALIASES[raw]) return CRYPTO_EXCHANGE_ALIASES[raw];
  const normalized = raw
    .replace("/USDT", "-USDT")
    .replace("USDT", "-USDT")
    .replace("/USD", "-USDT")
    .replace("-USD", "-USDT");
  if (CRYPTO_EXCHANGE_ALIASES[normalized]) return CRYPTO_EXCHANGE_ALIASES[normalized];
  if (/^[A-Z0-9]+-USDT$/.test(normalized)) return normalized;
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

function drawChart(points, movingAverages = null) {
  const canvas = chartCanvas;
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  if (!points.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "18px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa có dữ liệu biểu đồ.", 24, 48);
    return;
  }

  const padding = 44;
  const volumeHeight = 74;
  const gap = 16;
  const plotTop = padding;
  const plotBottom = height - padding - volumeHeight - gap;
  const volumeTop = plotBottom + gap;
  const plotHeight = plotBottom - plotTop;
  const priceValues = points.flatMap((point) => [
    toNumber(point.high) ?? toNumber(point.close),
    toNumber(point.low) ?? toNumber(point.close),
    toNumber(point.open),
    toNumber(point.close)
  ]).filter((value) => value !== null);
  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);
  const span = max - min || 1;
  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const candleWidth = Math.max(3, Math.min(14, xStep * 0.58));
  const maxVolume = Math.max(...points.map((point) => toNumber(point.volume) || 0), 1);
  const xFor = (index) => padding + xStep * index;
  const yFor = (value) => plotBottom - ((value - min) / span) * plotHeight;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index < 5; index += 1) {
    const y = plotTop + (plotHeight / 4) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  points.forEach((point, index) => {
    const open = toNumber(point.open) ?? point.close;
    const close = toNumber(point.close);
    const high = toNumber(point.high) ?? Math.max(open, close);
    const low = toNumber(point.low) ?? Math.min(open, close);
    if (close === null || open === null) return;

    const x = xFor(index);
    const color = close >= open ? CHART_COLORS.positive : CHART_COLORS.negative;
    const openY = yFor(open);
    const closeY = yFor(close);
    const highY = yFor(high);
    const lowY = yFor(low);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
    const volume = toNumber(point.volume) || 0;
    const volumeBarHeight = (volume / maxVolume) * volumeHeight;

    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, highY);
    context.lineTo(x, lowY);
    context.stroke();

    context.fillStyle = color;
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

    context.globalAlpha = 0.42;
    context.fillRect(x - candleWidth / 2, height - padding - volumeBarHeight, candleWidth, volumeBarHeight);
    context.globalAlpha = 1;
  });

  const chartMovingAverages = movingAverages || calculateMovingAverages(points);
  [
    { values: chartMovingAverages.ma10, color: CHART_COLORS.ma10 },
    { values: chartMovingAverages.ma50, color: CHART_COLORS.ma50 },
    { values: chartMovingAverages.ma100, color: CHART_COLORS.ma100 },
    { values: chartMovingAverages.ma200, color: CHART_COLORS.ma200 }
  ].forEach((series) => {
    context.beginPath();
    let started = false;
    series.values.forEach((value, index) => {
      if (value === null) return;
      const x = xFor(index);
      const y = yFor(value);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    context.strokeStyle = series.color;
    context.lineWidth = 2;
    context.stroke();
  });

  context.fillStyle = CHART_COLORS.text;
  context.font = "13px 'Be Vietnam Pro', Arial";
  context.fillText(formatPrice(max), 8, padding + 4);
  context.fillText(formatPrice(min), 8, plotBottom + 4);
  context.fillText("Vol", 8, volumeTop + 14);
  context.fillText(safeText(points[0].time), padding, height - 12);
  context.fillText(safeText(points[points.length - 1].time), width - padding - 110, height - 12);
}

function calculateRsi(points, period = 14) {
  const values = points.map((point) => point.close);
  const rsi = Array(values.length).fill(null);
  if (values.length <= period) return rsi;

  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) gains += change;
    else losses += Math.abs(change);
  }

  let averageGain = gains / period;
  let averageLoss = losses / period;
  rsi[period] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);

  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    averageGain = (averageGain * (period - 1) + gain) / period;
    averageLoss = (averageLoss * (period - 1) + loss) / period;
    rsi[index] = averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  }

  return rsi;
}

function calculateSma(points, period) {
  const values = points.map((point) => point.close);
  const sma = Array(values.length).fill(null);
  let sum = 0;

  values.forEach((value, index) => {
    sum += value;
    if (index >= period) {
      sum -= values[index - period];
    }
    if (index >= period - 1) {
      sma[index] = sum / period;
    }
  });

  return sma;
}

function calculateMovingAverages(points) {
  return {
    ma10: calculateSma(points, 20),
    ma50: calculateSma(points, 50),
    ma100: calculateSma(points, 100),
    ma200: calculateSma(points, 200)
  };
}

function calculateEma(values, period) {
  const ema = Array(values.length).fill(null);
  if (values.length < period) return ema;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let index = 0; index < period; index += 1) {
    sum += values[index];
  }
  ema[period - 1] = sum / period;

  for (let index = period; index < values.length; index += 1) {
    ema[index] = (values[index] - ema[index - 1]) * multiplier + ema[index - 1];
  }

  return ema;
}

function calculateMacd(points) {
  const closes = points.map((point) => point.close);
  const ema12 = calculateEma(closes, 12);
  const ema26 = calculateEma(closes, 26);
  const macd = closes.map((_, index) => {
    if (ema12[index] === null || ema26[index] === null) return null;
    return ema12[index] - ema26[index];
  });

  const signal = Array(macd.length).fill(null);
  const validMacd = macd.filter((value) => value !== null);
  const signalValues = calculateEma(validMacd, 9);
  let validIndex = 0;
  macd.forEach((value, index) => {
    if (value === null) return;
    signal[index] = signalValues[validIndex];
    validIndex += 1;
  });

  const histogram = macd.map((value, index) => {
    if (value === null || signal[index] === null) return null;
    return value - signal[index];
  });

  return { macd, signal, histogram };
}

function drawLineCanvas(canvas, values, options = {}) {
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  const numericValues = values.filter((value) => value !== null);
  if (!numericValues.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "16px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa đủ dữ liệu.", 18, 38);
    return;
  }

  const padding = 34;
  const min = options.min ?? Math.min(...numericValues);
  const max = options.max ?? Math.max(...numericValues);
  const span = max - min || 1;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding + ((height - padding * 2) / 3) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  (options.guides || []).forEach((guide) => {
    const y = height - padding - ((guide.value - min) / span) * (height - padding * 2);
    context.strokeStyle = guide.color;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = guide.color;
    context.font = "12px 'Be Vietnam Pro', Arial";
    context.fillText(guide.label, width - padding - 28, y - 4);
  });

  context.beginPath();
  values.forEach((value, index) => {
    if (value === null) return;
    const x = padding + ((width - padding * 2) / Math.max(values.length - 1, 1)) * index;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    if (index === values.findIndex((item) => item !== null)) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = options.color || CHART_COLORS.price;
  context.lineWidth = 2.5;
  context.stroke();
}

function drawMacdCanvas(canvas, macdData) {
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  const allValues = [...macdData.macd, ...macdData.signal, ...macdData.histogram].filter((value) => value !== null);
  if (!allValues.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "16px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa đủ dữ liệu.", 18, 38);
    return;
  }

  const padding = 34;
  const maxAbs = Math.max(...allValues.map((value) => Math.abs(value))) || 1;
  const min = -maxAbs;
  const max = maxAbs;
  const span = max - min;

  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);
  const xFor = (index) => padding + ((width - padding * 2) / Math.max(macdData.macd.length - 1, 1)) * index;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  [min, 0, max].forEach((value) => {
    const y = yFor(value);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  });

  macdData.histogram.forEach((value, index) => {
    if (value === null) return;
    const x = xFor(index);
    const zeroY = yFor(0);
    const y = yFor(value);
    context.strokeStyle = value > 0 ? CHART_COLORS.positive : value < 0 ? CHART_COLORS.negative : CHART_COLORS.neutral;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, zeroY);
    context.lineTo(x, y);
    context.stroke();
  });

  [
    { values: macdData.macd, color: CHART_COLORS.price },
    { values: macdData.signal, color: CHART_COLORS.ma10 }
  ].forEach((line) => {
    context.beginPath();
    let started = false;
    line.values.forEach((value, index) => {
      if (value === null) return;
      const x = xFor(index);
      const y = yFor(value);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    context.strokeStyle = line.color;
    context.lineWidth = 2;
    context.stroke();
  });
}

function renderIndicators(bars, indicators = null) {
  const rsi = indicators?.rsi || calculateRsi(bars);
  const macd = indicators?.macd || calculateMacd(bars);
  const latestRsi = [...rsi].reverse().find((value) => value !== null);
  const latestMacd = [...macd.macd].reverse().find((value) => value !== null);
  const latestSignal = [...macd.signal].reverse().find((value) => value !== null);
  const latestHistogram = [...macd.histogram].reverse().find((value) => value !== null);

  fields.rsiValue.textContent = latestRsi === undefined ? "-" : formatNumber(latestRsi, 2);
  fields.macdValue.textContent = latestMacd === undefined
    ? "-"
    : `${formatNumber(latestMacd, 2)} / Signal ${formatOptional(latestSignal, 2)} / Hist ${formatOptional(latestHistogram, 2)}`;

  drawLineCanvas(rsiCanvas, rsi, {
    min: 0,
    max: 100,
    color: CHART_COLORS.price,
    guides: [
      { value: 70, color: CHART_COLORS.negative, label: "70" },
      { value: 30, color: CHART_COLORS.positive, label: "30" }
    ]
  });
  drawMacdCanvas(macdCanvas, macd);

  return { rsi, macd };
}

function renderInvestorFlow(quote) {
  const foreignBuy = toNumber(quote.foreignBuyValue);
  const foreignSell = toNumber(quote.foreignSellValue);
  const totalValue = toNumber(quote.totalValue);
  const foreignNet = foreignBuy !== null && foreignSell !== null ? foreignBuy - foreignSell : null;
  const domesticBuy = totalValue !== null && foreignBuy !== null ? totalValue - foreignBuy : null;
  const domesticSell = totalValue !== null && foreignSell !== null ? totalValue - foreignSell : null;
  const domesticNet = foreignNet !== null ? -foreignNet : null;

  fields.foreignBuy.textContent = formatLargeNumber(foreignBuy);
  fields.foreignSell.textContent = formatLargeNumber(foreignSell);
  fields.foreignNet.textContent = formatLargeNumber(foreignNet);
  fields.domesticBuy.textContent = formatLargeNumber(domesticBuy);
  fields.domesticSell.textContent = formatLargeNumber(domesticSell);
  fields.domesticNet.textContent = formatLargeNumber(domesticNet);
  fields.foreignNet.classList.remove("positive", "negative", "neutral");
  fields.domesticNet.classList.remove("positive", "negative", "neutral");
  const foreignClass = valueClass(foreignNet);
  const domesticClass = valueClass(domesticNet);
  if (foreignClass) fields.foreignNet.classList.add(foreignClass);
  if (domesticClass) fields.domesticNet.classList.add(domesticClass);
  fields.flowStatus.textContent = foreignBuy !== null ? "Dữ liệu từ Vietcap/VCI" : "Chưa có dữ liệu";
}

function renderHistory(bars, limit = activeHistoryLimit) {
  const rows = bars
    .map((bar, index) => {
      const previousClose = index > 0 ? bars[index - 1].close : null;
      const changePercent = previousClose ? ((bar.close - previousClose) / previousClose) * 100 : null;
      return { ...bar, changePercent };
    })
    .slice(-limit)
    .reverse();

  const limitInfo = HISTORY_LIMITS[String(limit)] || { label: `${limit} ngày` };
  fields.historyCount.textContent = `${rows.length} phiên gần nhất (${limitInfo.label})`;
  fields.historyBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${safeText(row.time)}</td>
      <td>${formatPrice(row.open)}</td>
      <td>${formatPrice(row.high)}</td>
      <td>${formatPrice(row.low)}</td>
      <td class="${valueClass(row.changePercent)}">${formatPrice(row.close)}</td>
      <td class="${valueClass(row.changePercent)}">${formatPercent(row.changePercent)}</td>
      <td>${formatInteger(row.volume)}</td>
    </tr>
  `).join("");
}

function renderPriceChanges(bars) {
  const latest = bars[bars.length - 1]?.close;
  const periods = [3, 7, 10, 14, 21, 30];

  periods.forEach((period) => {
    const target = fields[`change${period}`];
    const compare = bars[bars.length - 1 - period]?.close;
    const change = latest && compare ? ((latest - compare) / compare) * 100 : null;
    target.textContent = formatPercent(change);
    target.classList.remove("positive", "negative", "neutral");
    const className = valueClass(change);
    if (className) target.classList.add(className);
  });
}

function classifyPe(pe) {
  const value = toNumber(pe);
  if (value === null || value <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có P/E hợp lệ để đánh giá định giá theo lợi nhuận." };
  if (value < 8) return { label: "Rẻ tương đối", className: "positive", score: 2, text: "P/E thấp, có thể đang rẻ nếu lợi nhuận không suy giảm mạnh." };
  if (value <= 15) return { label: "Hợp lý", className: "positive", score: 2, text: "P/E nằm trong vùng dễ chấp nhận với nhiều cổ phiếu Việt Nam." };
  if (value <= 25) return { label: "Cao vừa", className: "neutral", score: 1, text: "P/E không rẻ, cần doanh nghiệp có tăng trưởng tốt để hấp dẫn." };
  return { label: "Đắt", className: "negative", score: -1, text: "P/E cao, biên an toàn định giá thấp hơn nếu tăng trưởng không đủ mạnh." };
}

function classifyPb(pb, roe) {
  const pbValue = toNumber(pb);
  const roeValue = toNumber(roe);
  if (pbValue === null || pbValue <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có P/B hợp lệ để đánh giá giá trị sổ sách." };
  if (pbValue < 1) return { label: "Dưới giá trị sổ sách", className: "positive", score: 2, text: "P/B dưới 1, cần kiểm tra chất lượng tài sản và triển vọng ngành." };
  if (pbValue <= 2) return { label: "Hợp lý", className: "positive", score: 1, text: "P/B ở vùng vừa phải, phù hợp hơn nếu ROE tốt." };
  if (pbValue <= 4 && roeValue !== null && roeValue >= 18) return { label: "Cao nhưng có ROE hỗ trợ", className: "neutral", score: 1, text: "P/B cao hơn trung bình nhưng ROE tốt giúp định giá dễ chấp nhận hơn." };
  if (pbValue <= 4) return { label: "Cao", className: "neutral", score: 0, text: "P/B cao, cần xem tăng trưởng và lợi thế cạnh tranh." };
  return { label: "Rất cao", className: "negative", score: -1, text: "P/B rất cao, rủi ro định giá lớn nếu ROE/growth không nổi bật." };
}

function classifyRoe(roe) {
  const value = toNumber(roe);
  if (value === null) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có ROE để đánh giá hiệu quả sinh lời." };
  if (value >= 20) return { label: "Sinh lời mạnh", className: "positive", score: 2, text: "ROE cao, doanh nghiệp đang tạo lợi nhuận tốt trên vốn chủ." };
  if (value >= 12) return { label: "Sinh lời ổn", className: "positive", score: 1, text: "ROE ở mức khá, có thể chấp nhận nếu xu hướng lợi nhuận ổn định." };
  if (value >= 5) return { label: "Trung bình", className: "neutral", score: 0, text: "ROE chưa nổi bật, cần thêm yếu tố tăng trưởng hoặc định giá rẻ." };
  return { label: "Yếu", className: "negative", score: -1, text: "ROE thấp, chất lượng sinh lời chưa hấp dẫn." };
}

function classifyBeta(beta) {
  const value = toNumber(beta);
  if (value === null || value <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có Beta để đánh giá độ biến động." };
  if (value < 0.8) return { label: "Biến động thấp", className: "positive", score: 1, text: "Beta thấp hơn thị trường, phù hợp hơn với phong cách thận trọng." };
  if (value <= 1.2) return { label: "Biến động vừa", className: "neutral", score: 1, text: "Beta gần thị trường, rủi ro biến động ở mức vừa phải." };
  return { label: "Biến động cao", className: "negative", score: -1, text: "Beta cao, cần quản trị vị thế và điểm cắt lỗ chặt hơn." };
}

function renderFundamentalAnalysis(overview, score) {
  if (!fields.fundamentalAnalysis) return null;

  const pe = classifyPe(overview.pe);
  const pb = classifyPb(overview.pb, overview.roe);
  const roe = classifyRoe(overview.roe);
  const beta = classifyBeta(overview.beta);
  const eps = toNumber(overview.eps);
  const marketCap = toNumber(overview.marketCap);
  const total = pe.score + pb.score + roe.score + beta.score + (eps !== null && eps > 0 ? 1 : eps !== null && eps < 0 ? -1 : 0);
  const valuationLabel = total >= 5
    ? { text: "Cơ bản hấp dẫn", className: "positive" }
    : total >= 2
      ? { text: "Cơ bản tương đối ổn", className: "positive" }
      : total >= 0
        ? { text: "Trung tính", className: "neutral" }
        : { text: "Cần thận trọng", className: "negative" };
  const investText = score?.total >= 65 && total >= 2
    ? "Có thể đưa vào danh sách theo dõi mua từng phần khi kỹ thuật xác nhận."
    : score?.total >= 50 && total >= 0
      ? "Chưa nên mua vội, phù hợp để theo dõi thêm tín hiệu giá và dòng tiền."
      : "Chưa nên ưu tiên giải ngân nếu chưa có thêm tín hiệu cải thiện rõ.";

  fields.fundamentalBadge.textContent = valuationLabel.text;
  fields.fundamentalBadge.classList.remove("positive", "negative", "neutral");
  fields.fundamentalBadge.classList.add(valuationLabel.className);
  fields.fundamentalAnalysis.innerHTML = `
    <article>
      <span>Định giá P/E, P/B</span>
      <strong class="${pe.className}">${pe.label}</strong>
      <p>P/E ${formatFundamentalNumber(overview.pe, 2)}. P/B ${formatFundamentalNumber(overview.pb, 2)}. ${pe.text} ${pb.text}</p>
    </article>
    <article>
      <span>Chất lượng lợi nhuận</span>
      <strong class="${roe.className}">${roe.label}</strong>
      <p>ROE ${toNumber(overview.roe) ? formatPercent(overview.roe) : "-"}, EPS ${formatFundamentalNumber(overview.eps, 2)}. ${roe.text}</p>
    </article>
    <article>
      <span>Rủi ro và kết luận</span>
      <strong class="${valuationLabel.className}">${valuationLabel.text}</strong>
      <p>Beta ${formatFundamentalNumber(overview.beta, 2)}, vốn hóa ${marketCap ? formatLargeNumber(marketCap) : "-"}. ${beta.text} ${investText}</p>
    </article>
  `;

  return { valuationLabel, total, pe, pb, roe, beta };
}

function scoreTimeframeSignals(bars) {
  const technicalBars = normalizeTechnicalBars(bars);
  const movingAverages = calculateMovingAverages(technicalBars);
  const rsi = calculateRsi(technicalBars);
  const macd = calculateMacd(technicalBars);
  const latest = technicalBars[technicalBars.length - 1] || {};
  const previous = technicalBars[technicalBars.length - 2] || {};
  const ma20 = latestNonNull(movingAverages.ma10);
  const ma50 = latestNonNull(movingAverages.ma50);
  const ma100 = latestNonNull(movingAverages.ma100);
  const latestRsi = latestNonNull(rsi);
  const latestMacd = latestNonNull(macd.macd);
  const latestSignal = latestNonNull(macd.signal);
  const latestHistogram = latestNonNull(macd.histogram);
  const volumes = bars.map((bar) => bar.volume);
  const latestVolume = bars[bars.length - 1]?.volume;
  const avgVolume20 = average(volumes.slice(-20));
  const change = previous.close ? ((latest.close - previous.close) / previous.close) * 100 : null;
  const change20 = percentChangeBetween(bars, Math.min(20, Math.max(1, bars.length - 2)));

  let score = 0;
  const good = [];
  const bad = [];
  const neutral = [];

  if (latest.close > ma20) {
    score += 1;
    good.push(`Giá đang trên MA20 (${formatOptional(ma20, 2)})`);
  } else if (toNumber(ma20) !== null) {
    score -= 1;
    bad.push(`Giá nằm dưới MA20 (${formatOptional(ma20, 2)}), xu hướng ngắn hạn yếu`);
  }

  if (latest.close > ma50) {
    score += 1;
    good.push(`Giá trên MA50 (${formatOptional(ma50, 2)})`);
  } else if (toNumber(ma50) !== null) {
    score -= 1;
    bad.push(`Giá dưới MA50 (${formatOptional(ma50, 2)}), lực hồi chưa thuyết phục`);
  }

  if (ma20 > ma50 && ma50 > ma100) {
    score += 1;
    good.push("Cấu trúc MA20 > MA50 > MA100 ủng hộ xu hướng tăng");
  } else if (toNumber(ma20) !== null && toNumber(ma50) !== null && toNumber(ma100) !== null) {
    bad.push("Các đường MA chưa xếp thành cấu trúc tăng rõ ràng");
  }

  if (latestMacd > latestSignal && latestHistogram > 0) {
    score += 2;
    good.push(`MACD đang trên Signal, histogram ${formatOptional(latestHistogram, 2)} tích cực`);
  } else if (latestMacd < latestSignal && latestHistogram < 0) {
    score -= 2;
    bad.push(`MACD dưới Signal, histogram ${formatOptional(latestHistogram, 2)} còn xấu`);
  } else {
    neutral.push("MACD chưa cho tín hiệu rõ");
  }

  if (latestRsi >= 50 && latestRsi <= 65) {
    score += 1;
    good.push(`RSI ${formatOptional(latestRsi, 2)} khỏe nhưng chưa quá nóng`);
  } else if (latestRsi > 70) {
    score -= 1;
    bad.push(`RSI ${formatOptional(latestRsi, 2)} cao, dễ rung lắc`);
  } else if (latestRsi < 40) {
    score -= 1;
    bad.push(`RSI ${formatOptional(latestRsi, 2)} yếu, lực cầu chưa tốt`);
  } else if (toNumber(latestRsi) !== null) {
    neutral.push(`RSI ${formatOptional(latestRsi, 2)} trung tính`);
  }

  if (latestVolume && avgVolume20 && latestVolume > avgVolume20 * 1.2 && toNumber(change) !== null && change > 0) {
    score += 1;
    good.push("Giá tăng kèm volume cao hơn trung bình 20 nến");
  } else if (latestVolume && avgVolume20 && latestVolume > avgVolume20 * 1.2 && toNumber(change) !== null && change < 0) {
    score -= 1;
    bad.push("Giá giảm với volume cao, cần cẩn thận áp lực bán");
  } else if (latestVolume && avgVolume20) {
    neutral.push(`Volume hiện tại ${formatInteger(latestVolume)}, TB20 ${formatInteger(avgVolume20)}`);
  }

  const verdict = score >= 4
    ? { text: "Tích cực", className: "positive" }
    : score >= 1
      ? { text: "Nghiêng tích cực", className: "positive" }
      : score >= -1
        ? { text: "Trung tính", className: "neutral" }
        : { text: "Tiêu cực", className: "negative" };

  return {
    score,
    verdict,
    latestClose: latest.close,
    change,
    change20,
    ma20,
    ma50,
    latestRsi,
    latestMacd,
    latestSignal,
    latestHistogram,
    good,
    bad,
    neutral
  };
}

function renderAiCards(symbol, analyses) {
  const validAnalyses = analyses.filter((item) => item && item.data);
  if (!validAnalyses.length) {
    fields.aiBadge.textContent = "Thiếu dữ liệu";
    fields.aiBadge.className = "neutral";
    fields.aiAnalysisBody.innerHTML = `
      <article>
        <span>Không đủ dữ liệu</span>
        <h3>Chưa phân tích được ${escapeHtml(symbol)}.</h3>
        <p>Hãy kiểm tra lại mã cổ phiếu hoặc nguồn dữ liệu intraday/ngày.</p>
      </article>
    `;
    return;
  }

  const totalScore = validAnalyses.reduce((sum, item) => sum + item.data.score, 0);
  const overall = totalScore >= 8
    ? { text: "Tổng quan tích cực nhưng vẫn cần điểm mua", className: "positive" }
    : totalScore >= 3
      ? { text: "Có tín hiệu tốt, chưa đủ để hưng phấn", className: "positive" }
      : totalScore >= -2
        ? { text: "Tổng quan lẫn lộn, nên kiên nhẫn", className: "neutral" }
        : { text: "Tổng quan yếu, không nên cố mua", className: "negative" };

  fields.aiBadge.textContent = overall.text;
  fields.aiBadge.className = overall.className;
  fields.aiAnalysisBody.innerHTML = `
    <article class="summary">
      <span>Tổng hợp AI cho ${escapeHtml(symbol)}</span>
      <h3 class="${overall.className}">${overall.text}</h3>
      <p>Phân tích này dựa trên MA20/50/100, RSI 14, MACD 12-26-9, volume và biến động giá ở các khung 1h, 4h, 1 ngày, 1 tuần, 1 tháng. Đây là nhận định kỹ thuật tự động, không phải cam kết lợi nhuận.</p>
    </article>
    ${validAnalyses.map(({ label, data }) => `
      <article>
        <span>Khung ${label}</span>
        <h3 class="${data.verdict.className}">${data.verdict.text}</h3>
        <p>Giá: ${formatOptional(data.latestClose, 2)}. Biến động nến gần nhất: ${formatPercent(data.change)}. Biến động khoảng 20 nến: ${formatPercent(data.change20)}.</p>
        <p>RSI ${formatOptional(data.latestRsi, 2)}. MACD ${formatOptional(data.latestMacd, 2)} / Signal ${formatOptional(data.latestSignal, 2)} / Hist ${formatOptional(data.latestHistogram, 2)}.</p>
        <ul class="ai-points">
          ${data.good.slice(0, 3).map((item) => `<li class="positive">${escapeHtml(item)}</li>`).join("")}
          ${data.bad.slice(0, 3).map((item) => `<li class="negative">${escapeHtml(item)}</li>`).join("")}
          ${data.neutral.slice(0, 2).map((item) => `<li class="neutral">${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    `).join("")}
  `;
}

async function loadAiAnalysis() {
  if (!currentSymbol || !currentDailyBars.length) {
    fields.aiBadge.textContent = "Chưa có dữ liệu";
    fields.aiBadge.className = "neutral";
    fields.aiAnalysisBody.innerHTML = `
      <article>
        <span>Chưa có dữ liệu</span>
        <h3>Hãy tra cứu một mã cổ phiếu trước.</h3>
        <p>AI cần dữ liệu giá để phân tích các khung 1h, 4h, 1 ngày, 1 tuần và 1 tháng.</p>
      </article>
    `;
    return;
  }

  fields.aiBadge.textContent = "Đang phân tích...";
  fields.aiBadge.className = "neutral";
  fields.aiAnalysisBody.innerHTML = `
    <article>
      <span>Đang phân tích</span>
      <h3>Đang tải dữ liệu đa khung cho ${escapeHtml(currentSymbol)}...</h3>
      <p>Khung 1h và 4h cần gọi thêm dữ liệu intraday từ VCI.</p>
    </article>
  `;

  const [oneHourResult, fourHourResult] = await Promise.allSettled([
    requestBarsForRange(currentSymbol, "1h"),
    requestBarsForRange(currentSymbol, "4h")
  ]);

  const analyses = [];
  if (oneHourResult.status === "fulfilled") {
    const bars = aggregateBarsForPreset(oneHourResult.value, CHART_PRESETS["1h"]);
    if (bars.length) analyses.push({ label: "1h", data: scoreTimeframeSignals(bars) });
  }
  if (fourHourResult.status === "fulfilled") {
    const bars = aggregateBarsForPreset(fourHourResult.value, CHART_PRESETS["4h"]);
    if (bars.length) analyses.push({ label: "4h", data: scoreTimeframeSignals(bars) });
  }

  [
    ["1 ngày", "1d"],
    ["1 tuần", "1w"],
    ["1 tháng", "1m"]
  ].forEach(([label, key]) => {
    const bars = aggregateBarsForPreset(currentDailyBars, CHART_PRESETS[key]);
    if (bars.length) analyses.push({ label, data: scoreTimeframeSignals(bars) });
  });

  renderAiCards(currentSymbol, analyses);
}

function calculateEmaForBars(bars, period) {
  return calculateEma(bars.map((bar) => bar.close), period);
}

function latestBarSnapshot(bars) {
  const ema9 = calculateEmaForBars(bars, 9);
  const ema21 = calculateEmaForBars(bars, 21);
  const rsi = calculateRsi(bars);
  const latest = bars[bars.length - 1] || {};
  const previous = bars[bars.length - 2] || {};
  const volumes = bars.map((bar) => bar.volume);
  return {
    latest,
    previous,
    ema9,
    ema21,
    rsi,
    latestEma9: latestNonNull(ema9),
    previousEma9: ema9[ema9.length - 2],
    latestEma21: latestNonNull(ema21),
    latestRsi: latestNonNull(rsi),
    previousRsi: rsi[rsi.length - 2],
    latestVolume: latest.volume,
    avgVolume20: average(volumes.slice(-20))
  };
}

function passIcon(pass) {
  return pass ? "✓" : "×";
}

function pctDistance(price, base) {
  if (!toNumber(price) || !toNumber(base)) return null;
  return Math.abs((price - base) / base) * 100;
}

function isVolumeDeclining(bars) {
  const last = bars.slice(-4).map((bar) => toNumber(bar.volume)).filter((value) => value !== null);
  return last.length >= 4 && last[3] < last[2] && last[2] < last[1];
}

function isNearEma(price, ema9, ema21, maxDistance = 0.8) {
  const distance9 = pctDistance(price, ema9);
  const distance21 = pctDistance(price, ema21);
  return {
    pass: (distance9 !== null && distance9 <= maxDistance) || (distance21 !== null && distance21 <= maxDistance),
    distance9,
    distance21
  };
}

function isStrongGreenCandle(bars) {
  const latest = bars[bars.length - 1] || {};
  const previous = bars[bars.length - 2] || {};
  const open = toNumber(latest.open);
  const close = toNumber(latest.close);
  const high = toNumber(latest.high);
  const low = toNumber(latest.low);
  if (open === null || close === null || high === null || low === null || close <= open) return false;
  const range = high - low || 1;
  const bodyRatio = (close - open) / range;
  const engulfing = previous.open && previous.close && open <= previous.close && close >= previous.open;
  return bodyRatio >= 0.62 || engulfing;
}

function hasHigherLow(bars) {
  if (bars.length < 12) return false;
  const recentLow = Math.min(...bars.slice(-5).map((bar) => toNumber(bar.low)).filter((value) => value !== null));
  const previousLow = Math.min(...bars.slice(-12, -5).map((bar) => toNumber(bar.low)).filter((value) => value !== null));
  return Number.isFinite(recentLow) && Number.isFinite(previousLow) && recentLow > previousLow;
}

function classifyOneHourTrend(bars) {
  const data = latestBarSnapshot(bars);
  const buyChecks = [
    { label: "Giá trên EMA9", pass: data.latest.close > data.latestEma9 },
    { label: "EMA9 > EMA21", pass: data.latestEma9 > data.latestEma21 },
    { label: "RSI14 > 50", pass: data.latestRsi > 50 }
  ];
  const sellChecks = [
    { label: "Giá dưới EMA9", pass: data.latest.close < data.latestEma9 },
    { label: "EMA9 < EMA21", pass: data.latestEma9 < data.latestEma21 },
    { label: "RSI14 < 50", pass: data.latestRsi < 50 }
  ];
  const buyPass = buyChecks.every((item) => item.pass);
  const sellPass = sellChecks.every((item) => item.pass);
  const direction = buyPass ? "BUY" : sellPass ? "SELL" : "NO_TRADE";
  return { ...data, direction, buyChecks, sellChecks };
}

function evaluateThirtyMinuteSetup(bars, direction) {
  const data = latestBarSnapshot(bars);
  const near = isNearEma(data.latest.close, data.latestEma9, data.latestEma21);
  const volumeEasing = isVolumeDeclining(bars) || (data.latestVolume && data.avgVolume20 && data.latestVolume < data.avgVolume20);
  const checks = direction === "BUY"
    ? [
      { label: "Giá điều chỉnh về EMA9 hoặc EMA21", pass: near.pass },
      { label: "RSI 30m nằm trong vùng 35-50", pass: data.latestRsi >= 35 && data.latestRsi <= 50 },
      { label: "Volume giảm dần hoặc dưới TB20", pass: volumeEasing }
    ]
    : direction === "SELL"
      ? [
        { label: "Giá hồi về EMA9 hoặc EMA21", pass: near.pass },
        { label: "RSI 30m nằm trong vùng 50-65", pass: data.latestRsi >= 50 && data.latestRsi <= 65 },
        { label: "Volume hồi giảm dần hoặc dưới TB20", pass: volumeEasing }
      ]
      : [
        { label: "Chưa xét setup vì khung 1H lẫn lộn", pass: false }
      ];
  return { ...data, near, checks, pass: checks.every((item) => item.pass) };
}

function evaluateFiveMinuteEntry(bars, direction) {
  const data = latestBarSnapshot(bars);
  const recentLow = Math.min(...bars.slice(-8).map((bar) => toNumber(bar.low)).filter((value) => value !== null));
  const volumeDeclining = isVolumeDeclining(bars);
  const rsiCross45 = data.latestRsi > 45 && (data.previousRsi === null || data.previousRsi <= 45 || data.latestRsi <= 55);
  const volumeBreakout = data.latestVolume && data.avgVolume20 && data.latestVolume >= data.avgVolume20 * 1.5;
  const greenCandle = isStrongGreenCandle(bars);
  const higherLow = hasHigherLow(bars);
  const priceOverEma9 = data.latest.close > data.latestEma9 && (data.previous.close <= data.previousEma9 || data.latest.close > data.latestEma9);
  const checks = direction === "BUY"
    ? [
      { label: "Giá vượt EMA9", pass: priceOverEma9 },
      { label: "RSI 5m vượt 45", pass: rsiCross45 },
      { label: "Volume >= 1.5 x Volume TB20", pass: volumeBreakout },
      { label: "Có nến xanh mạnh hoặc engulfing", pass: greenCandle },
      { label: "Đáy sau cao hơn đáy trước", pass: higherLow }
    ]
    : direction === "SELL"
      ? [
        { label: "Giá thủng EMA9", pass: data.latest.close < data.latestEma9 },
        { label: "RSI 5m dưới 55", pass: data.latestRsi < 55 },
        { label: "Volume >= 1.5 x Volume TB20", pass: volumeBreakout },
        { label: "Có nến đỏ mạnh", pass: data.latest.close < data.latest.open },
        { label: "Đỉnh sau thấp hơn đỉnh trước", pass: !higherLow }
      ]
      : [
        { label: "Chưa xét entry vì khung lớn chưa đạt", pass: false }
      ];
  const passed = checks.filter((item) => item.pass).length;
  return { ...data, checks, passed, pass: passed >= 4, recentLow, volumeDeclining };
}

function buildNoTradeFilters(oneHour, thirtyMinute, fiveMinute) {
  const latest = fiveMinute.latest || {};
  const candleChange = latest.open ? ((latest.close - latest.open) / latest.open) * 100 : null;
  const farFromEma9 = pctDistance(latest.close, fiveMinute.latestEma9);
  return [
    { label: "RSI 5m > 70", active: fiveMinute.latestRsi > 70 },
    { label: "RSI 30m > 70", active: thirtyMinute.latestRsi > 70 },
    { label: "Volume 5m giảm liên tục", active: fiveMinute.volumeDeclining },
    { label: "Giá quá xa EMA9 5m (>1,5%)", active: farFromEma9 !== null && farFromEma9 > 1.5 },
    { label: "Nến 5m tăng >4%", active: candleChange !== null && candleChange > 4 }
  ];
}

function buildTradePlan(fiveMinute) {
  const entry = fiveMinute.latest.close;
  const stopByPercent = entry * 0.992;
  const stopLoss = Math.max(fiveMinute.recentLow || stopByPercent, stopByPercent);
  const riskPercent = ((entry - stopLoss) / entry) * 100;
  return {
    entry,
    stopLoss,
    riskPercent,
    tp1: entry * 1.01,
    tp2: entry * 1.02,
    tp3: entry * 1.04,
    rr: riskPercent > 0 ? 2 / riskPercent : null
  };
}

function renderTradeDecision(symbol, oneHour, thirtyMinute, fiveMinute, filters) {
  const blockers = filters.filter((item) => item.active);
  const plan = buildTradePlan(fiveMinute);
  const canBuy = oneHour.direction === "BUY" && thirtyMinute.pass && fiveMinute.pass && !blockers.length;
  const canSell = oneHour.direction === "SELL" && thirtyMinute.pass && fiveMinute.pass && !blockers.length;
  const decision = canBuy
    ? { text: "Có điểm BUY", className: "positive", detail: "Khung 1H, 30m và 5m đang đồng thuận. Vẫn cần đặt stop loss ngay khi vào lệnh." }
    : canSell
      ? { text: "Có điểm SELL", className: "negative", detail: "Chỉ phù hợp nếu sàn/tài khoản hỗ trợ bán xuống. Nếu không, coi đây là tín hiệu tránh mua." }
      : { text: "Không giao dịch", className: "neutral", detail: "Chưa đủ đồng thuận hoặc có bộ lọc rủi ro kích hoạt. Không nên ép lệnh." };

  fields.tradeBadge.textContent = decision.text;
  fields.tradeBadge.className = decision.className;
  fields.tradeAnalysisBody.innerHTML = `
    <article class="trade-summary">
      <span>Kết luận cho ${escapeHtml(symbol)}</span>
      <h3 class="${decision.className}">${decision.text}</h3>
      <p>${decision.detail}</p>
      <p>Entry tham chiếu: ${formatOptional(plan.entry, 2)}. Stop loss: ${formatOptional(plan.stopLoss, 2)} (${formatPercent(-plan.riskPercent)}). RR tới TP2: ${plan.rr ? formatNumber(plan.rr, 2) + " : 1" : "-"}.</p>
    </article>

    <div class="trade-grid">
      <article>
        <span>Bước 1 - Xu hướng 1H</span>
        <h3 class="${oneHour.direction === "BUY" ? "positive" : oneHour.direction === "SELL" ? "negative" : "neutral"}">${oneHour.direction === "BUY" ? "Chỉ tìm BUY" : oneHour.direction === "SELL" ? "Chỉ tìm SELL" : "Không giao dịch"}</h3>
        <p>Giá ${formatOptional(oneHour.latest.close, 2)}, EMA9 ${formatOptional(oneHour.latestEma9, 2)}, EMA21 ${formatOptional(oneHour.latestEma21, 2)}, RSI ${formatOptional(oneHour.latestRsi, 2)}.</p>
        <ul class="trade-checklist">
          ${oneHour.buyChecks.map((item) => `<li class="${item.pass ? "positive" : "negative"}"><b>${passIcon(item.pass)}</b>${escapeHtml(item.label)}</li>`).join("")}
        </ul>
      </article>
      <article>
        <span>Bước 2 - Setup 30 phút</span>
        <h3 class="${thirtyMinute.pass ? "positive" : "neutral"}">${thirtyMinute.pass ? "Setup đẹp" : "Chưa có setup"}</h3>
        <p>RSI ${formatOptional(thirtyMinute.latestRsi, 2)}, Volume ${formatInteger(thirtyMinute.latestVolume)}, TB20 ${formatInteger(thirtyMinute.avgVolume20)}.</p>
        <ul class="trade-checklist">
          ${thirtyMinute.checks.map((item) => `<li class="${item.pass ? "positive" : "negative"}"><b>${passIcon(item.pass)}</b>${escapeHtml(item.label)}</li>`).join("")}
        </ul>
      </article>
      <article>
        <span>Bước 3 - Vào lệnh 5 phút</span>
        <h3 class="${fiveMinute.pass ? "positive" : "neutral"}">${fiveMinute.passed}/5 điều kiện</h3>
        <p>Cần đạt ít nhất 4/5. RSI ${formatOptional(fiveMinute.latestRsi, 2)}, Volume ${formatInteger(fiveMinute.latestVolume)}, TB20 ${formatInteger(fiveMinute.avgVolume20)}.</p>
        <ul class="trade-checklist">
          ${fiveMinute.checks.map((item) => `<li class="${item.pass ? "positive" : "negative"}"><b>${passIcon(item.pass)}</b>${escapeHtml(item.label)}</li>`).join("")}
        </ul>
      </article>
    </div>

    <div class="trade-plan">
      <article>
        <span>Take Profit</span>
        <h3>Kế hoạch chốt lời</h3>
        <p>TP1 ${formatOptional(plan.tp1, 2)}: bán 50%. TP2 ${formatOptional(plan.tp2, 2)}: bán 30%. TP3 ${formatOptional(plan.tp3, 2)}: giữ 20% nếu giá chạy khỏe.</p>
      </article>
      <article>
        <span>Điều kiện hủy</span>
        <h3>${blockers.length ? "Có rủi ro cần né" : "Chưa kích hoạt"}</h3>
        <ul class="trade-checklist">
          ${filters.map((item) => `<li class="${item.active ? "negative" : "positive"}"><b>${item.active ? "!" : "✓"}</b>${escapeHtml(item.label)}</li>`).join("")}
        </ul>
      </article>
      <article>
        <span>Checklist 30 giây</span>
        <h3>Trước khi bấm BUY</h3>
        <ul class="trade-checklist">
          ${[
            ["1H đang tăng", oneHour.direction === "BUY"],
            ["Giá trên EMA9", oneHour.latest.close > oneHour.latestEma9],
            ["EMA9 trên EMA21", oneHour.latestEma9 > oneHour.latestEma21],
            ["RSI 1H > 50", oneHour.latestRsi > 50],
            ["RSI 30m từ 35 đến 50", thirtyMinute.latestRsi >= 35 && thirtyMinute.latestRsi <= 50],
            ["Volume 5m đủ mạnh", fiveMinute.latestVolume >= fiveMinute.avgVolume20 * 1.5],
            ["5m vượt EMA9", fiveMinute.checks[0]?.pass],
            ["Có nến xác nhận", fiveMinute.checks[3]?.pass],
            ["RR >= 1:2", plan.rr >= 2]
          ].map(([label, pass]) => `<li class="${pass ? "positive" : "negative"}"><b>${passIcon(pass)}</b>${escapeHtml(label)}</li>`).join("")}
        </ul>
      </article>
    </div>
  `;
}

async function loadTradeAnalysis() {
  if (!currentSymbol) {
    fields.tradeBadge.textContent = "Chưa có dữ liệu";
    fields.tradeBadge.className = "neutral";
    fields.tradeAnalysisBody.innerHTML = `
      <article>
        <span>Chưa có dữ liệu</span>
        <h3>Hãy tra cứu một mã cổ phiếu trước.</h3>
        <p>Hệ thống cần dữ liệu 1H, 30 phút và 5 phút để tìm điểm mua/bán.</p>
      </article>
    `;
    return;
  }

  fields.tradeBadge.textContent = "Đang quét...";
  fields.tradeBadge.className = "neutral";
  fields.tradeAnalysisBody.innerHTML = `
    <article>
      <span>Đang quét tín hiệu</span>
      <h3>Đang tải dữ liệu 1H, 30 phút và 5 phút cho ${escapeHtml(currentSymbol)}...</h3>
      <p>Nếu dữ liệu intraday không khả dụng, hệ thống sẽ báo thiếu dữ liệu thay vì tự đoán.</p>
    </article>
  `;

  try {
    const [oneHourRaw, thirtyRaw, fiveRaw] = await Promise.all([
      requestBarsForRange(currentSymbol, "1h"),
      requestBarsForRange(currentSymbol, "30m"),
      requestBarsForRange(currentSymbol, "5m")
    ]);
    const oneHourBars = aggregateBarsForPreset(oneHourRaw, CHART_PRESETS["1h"]);
    const thirtyBars = aggregateBarsForPreset(thirtyRaw, CHART_PRESETS["30m"]);
    const fiveBars = aggregateBarsForPreset(fiveRaw, CHART_PRESETS["5m"]);

    if (oneHourBars.length < 30 || thirtyBars.length < 30 || fiveBars.length < 30) {
      throw new Error("Không đủ dữ liệu intraday để quét điểm mua/bán.");
    }

    const oneHour = classifyOneHourTrend(oneHourBars);
    const thirtyMinute = evaluateThirtyMinuteSetup(thirtyBars, oneHour.direction);
    const fiveMinute = evaluateFiveMinuteEntry(fiveBars, oneHour.direction);
    const filters = buildNoTradeFilters(oneHour, thirtyMinute, fiveMinute);
    renderTradeDecision(currentSymbol, oneHour, thirtyMinute, fiveMinute, filters);
  } catch (error) {
    fields.tradeBadge.textContent = "Thiếu dữ liệu";
    fields.tradeBadge.className = "negative";
    fields.tradeAnalysisBody.innerHTML = `
      <article>
        <span>Lỗi dữ liệu</span>
        <h3>${escapeHtml(error.message || "Không quét được tín hiệu.")}</h3>
        <p>Hãy kiểm tra lại local server hoặc Netlify Function đã upload bản mới có hỗ trợ khung 5 phút.</p>
      </article>
    `;
  }
}

function calculateAtr(points, period = 14) {
  const atr = Array(points.length).fill(null);
  if (points.length <= period) return atr;
  const trueRanges = points.map((point, index) => {
    if (index === 0) return (point.high || 0) - (point.low || 0);
    const previousClose = points[index - 1].close;
    return Math.max(
      (point.high || 0) - (point.low || 0),
      Math.abs((point.high || 0) - previousClose),
      Math.abs((point.low || 0) - previousClose)
    );
  });

  let sum = 0;
  for (let index = 1; index <= period; index += 1) {
    sum += trueRanges[index] || 0;
  }
  atr[period] = sum / period;

  for (let index = period + 1; index < points.length; index += 1) {
    atr[index] = ((atr[index - 1] || 0) * (period - 1) + (trueRanges[index] || 0)) / period;
  }
  return atr;
}

function scannerPercentChange(bars, periods) {
  if (!bars?.length || bars.length <= periods) return null;
  const latest = toNumber(bars[bars.length - 1].close);
  const previous = toNumber(bars[bars.length - 1 - periods].close);
  if (latest === null || previous === null || !previous) return null;
  return ((latest - previous) / previous) * 100;
}

function scannerTrendLabel(dailyBars, fourHourBars) {
  const dailyClose = dailyBars[dailyBars.length - 1]?.close;
  const dailyEma20 = latestNonNull(calculateEmaForBars(dailyBars, 20));
  const dailyEma50 = latestNonNull(calculateEmaForBars(dailyBars, 50));
  const dailyEma200 = latestNonNull(calculateEmaForBars(dailyBars, 200));
  const fourHourClose = fourHourBars[fourHourBars.length - 1]?.close;
  const fourHourEma20 = latestNonNull(calculateEmaForBars(fourHourBars, 20));
  const rsi = latestNonNull(calculateRsi(dailyBars));

  const uptrend = dailyClose > dailyEma20 && dailyEma20 > dailyEma50 && dailyEma50 > dailyEma200 && fourHourClose > fourHourEma20;
  const reversal = dailyClose > dailyEma20 && dailyEma20 > dailyEma50 && rsi >= 45 && rsi <= 62;
  const weak = dailyClose < dailyEma50 && dailyEma20 < dailyEma50;

  return {
    text: uptrend ? "Uptrend" : reversal ? "Chuẩn bị đảo chiều" : weak ? "Yếu" : "Trung tính",
    className: uptrend || reversal ? "positive" : weak ? "negative" : "neutral",
    score: uptrend ? 25 : reversal ? 19 : weak ? 5 : 12,
    dailyClose,
    dailyEma20,
    dailyEma50,
    dailyEma200,
    fourHourEma20,
    rsi
  };
}

function scannerLiquidityScore(type, quote, latestBar) {
  const price = toNumber(quote?.price ?? latestBar?.close);
  const volume = toNumber(quote?.quoteVolume) ?? (toNumber(quote?.volume ?? latestBar?.volume) * (price || 0));
  const spread = toNumber(quote?.spreadPercent);

  if (type === "crypto") {
    let score = volume >= 50_000_000 ? 25 : volume >= 10_000_000 ? 20 : volume >= 3_000_000 ? 12 : 4;
    if (spread !== null && spread > 0.25) score -= 5;
    return { score: Math.max(0, score), value: volume, spread };
  }

  const value = toNumber(latestBar?.volume) * (price || 0);
  const score = value >= 100_000_000_000 ? 25 : value >= 20_000_000_000 ? 20 : value >= 5_000_000_000 ? 12 : 4;
  return { score, value, spread: null };
}

function analyzeScannerCandidate(input) {
  const { symbol, type, source, quote, dailyBars, fourHourBars, baseDailyBars } = input;
  const latestBar = dailyBars[dailyBars.length - 1] || {};
  const trend = scannerTrendLabel(dailyBars, fourHourBars.length ? fourHourBars : dailyBars);
  const liquidity = scannerLiquidityScore(type, quote, latestBar);
  const atr = latestNonNull(calculateAtr(dailyBars));
  const atrPercent = atr && latestBar.close ? (atr / latestBar.close) * 100 : null;
  const change24h = toNumber(quote?.changePercent) ?? scannerPercentChange(dailyBars, 1);
  const change20 = scannerPercentChange(dailyBars, 20);
  const baseChange20 = scannerPercentChange(baseDailyBars, 20);
  const relativeStrength = change20 !== null && baseChange20 !== null ? change20 - baseChange20 : null;
  const avgVolume20 = average(dailyBars.slice(-20).map((bar) => bar.volume));
  const volumeRatio = avgVolume20 ? (latestBar.volume || 0) / avgVolume20 : null;

  const volatilityScore = atrPercent === null
    ? 5
    : atrPercent >= 4 && atrPercent <= 12
      ? 15
      : atrPercent >= 2 && atrPercent < 4
        ? 9
        : atrPercent > 12 && atrPercent <= 20
          ? 10
          : 5;
  const relativeScore = relativeStrength === null ? 6 : relativeStrength >= 10 ? 15 : relativeStrength >= 4 ? 12 : relativeStrength >= 0 ? 8 : 3;
  const volumeScore = volumeRatio === null ? 5 : volumeRatio >= 3 ? 15 : volumeRatio >= 1.5 ? 12 : volumeRatio >= 1 ? 7 : 3;
  const newsScore = latestNewsItems.some((item) => normalizeSearchText(`${item.title} ${item.description}`).includes(normalizeSearchText(symbol))) ? 5 : 2;
  const score = Math.round(liquidity.score + volatilityScore + trend.score + relativeScore + volumeScore + newsScore);

  const tags = [
    liquidity.score >= 20 ? "Thanh khoản tốt" : "Thanh khoản cần kiểm tra",
    atrPercent !== null && atrPercent >= 4 && atrPercent <= 12 ? "Biến động vừa trade" : atrPercent > 12 ? "Biến động mạnh" : "Biến động thấp",
    trend.text,
    relativeStrength !== null && relativeStrength > 0 ? "Mạnh hơn thị trường" : "Yếu hơn thị trường",
    volumeRatio !== null && volumeRatio >= 1.5 ? `Volume x${formatNumber(volumeRatio, 1)}` : "Volume chưa nổi bật"
  ];

  return {
    symbol,
    type,
    source,
    price: quote?.price ?? latestBar.close,
    score,
    tags,
    trend,
    liquidity,
    atrPercent,
    change24h,
    relativeStrength,
    volumeRatio
  };
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    try {
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    } catch (error) {
      results[currentIndex] = { error, item: items[currentIndex] };
    }
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

async function loadScannerCandidate(symbol, type, baseDailyBars) {
  if (type === "crypto") {
    const [daily, fourHour] = await Promise.all([
      requestCryptoData(symbol, "2y"),
      requestCryptoData(symbol, "4h")
    ]);
    return analyzeScannerCandidate({
      symbol,
      type,
      source: daily.source,
      quote: daily.quote,
      dailyBars: daily.bars,
      fourHourBars: fourHour.bars,
      baseDailyBars
    });
  }

  const [dailyRaw, fourHourRaw] = await Promise.allSettled([
    requestVciData(symbol, "2y"),
    requestVciData(symbol, "4h")
  ]);
  if (dailyRaw.status !== "fulfilled") throw dailyRaw.reason;
  const daily = parseVciData(dailyRaw.value);
  const fourHour = fourHourRaw.status === "fulfilled" ? parseVciData(fourHourRaw.value) : null;
  if (!daily?.bars?.length) throw new Error(`Không có dữ liệu ${symbol}`);
  return analyzeScannerCandidate({
    symbol,
    type,
    source: daily.source,
    quote: daily.quote,
    dailyBars: daily.bars,
    fourHourBars: fourHour?.bars?.length ? fourHour.bars : daily.bars,
    baseDailyBars
  });
}

function renderScannerResults(results, errors = []) {
  latestScannerResults = results;
  const display = results
    .filter((item) => item.score >= 50)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
  const fallback = results.sort((a, b) => b.score - a.score).slice(0, 10);
  const items = display.length ? display : fallback;

  fields.scannerBadge.textContent = `${items.length} mã đáng xem`;
  fields.scannerBadge.className = items.length ? "positive" : "neutral";
  fields.scannerSummary.innerHTML = `
    <article>
      <span>Kết quả quét</span>
      <strong>${items.length}/${results.length} mã qua lọc</strong>
      <p>Bỏ qua ${errors.length} mã thiếu dữ liệu. Điểm cao nghĩa là đáng đưa vào watchlist để phân tích tiếp, không phải tín hiệu mua ngay.</p>
    </article>
    <article>
      <span>Tiêu chí chính</span>
      <strong>Liquidity + Trend + RS</strong>
      <p>Ưu tiên mã thanh khoản tốt, biến động đủ lớn, xu hướng 1D/4H ổn, mạnh hơn BTC/VNINDEX và volume tăng bất thường.</p>
    </article>
  `;

  if (!items.length) {
    fields.scannerBody.innerHTML = `
      <article>
        <span>Không có mã phù hợp</span>
        <h3>Scanner chưa tìm được mã đáng xem.</h3>
        <p>Thị trường có thể đang yếu, thiếu thanh khoản hoặc nguồn dữ liệu tạm thời không phản hồi.</p>
      </article>
    `;
    return;
  }

  fields.scannerBody.innerHTML = `
    <div class="scanner-card-grid">
      ${items.slice(0, 6).map((item) => `
        <article class="scanner-card">
          <span>${item.type === "crypto" ? "Coin" : "Cổ phiếu"} · ${escapeHtml(item.source || "-")}</span>
          <div>
            <h3>${escapeHtml(item.symbol)}</h3>
            <strong>${item.score}/100</strong>
          </div>
          <p>Giá ${formatOptional(item.price, item.type === "crypto" ? 4 : 2)} · 24h ${formatPercent(item.change24h)} · RS ${formatPercent(item.relativeStrength)}</p>
          <div class="scanner-tags">
            ${item.tags.map((tag) => `<em>${escapeHtml(tag)}</em>`).join("")}
          </div>
        </article>
      `).join("")}
    </div>
    <div class="table-wrap scanner-table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã</th>
            <th>Loại</th>
            <th>Điểm</th>
            <th>Giá</th>
            <th>Thanh khoản</th>
            <th>ATR%</th>
            <th>RS</th>
            <th>Volume spike</th>
            <th>Xu hướng</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td><strong>${escapeHtml(item.symbol)}</strong></td>
              <td>${item.type === "crypto" ? "Coin" : "CK Việt Nam"}</td>
              <td><strong class="${item.score >= 70 ? "positive" : item.score >= 55 ? "neutral" : "negative"}">${item.score}</strong></td>
              <td>${formatOptional(item.price, item.type === "crypto" ? 4 : 2)}</td>
              <td>${item.type === "crypto" ? `${formatLargeNumber(item.liquidity.value)} USD` : `${formatLargeNumber(item.liquidity.value)} VND`}</td>
              <td>${formatPercent(item.atrPercent)}</td>
              <td class="${valueClass(item.relativeStrength)}">${formatPercent(item.relativeStrength)}</td>
              <td>${item.volumeRatio ? `x${formatNumber(item.volumeRatio, 2)}` : "-"}</td>
              <td><span class="${item.trend.className}">${escapeHtml(item.trend.text)}</span></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function loadMarketScanner() {
  if (!fields.scannerBadge || !fields.scannerBody) return;
  fields.scannerBadge.textContent = "Đang quét...";
  fields.scannerBadge.className = "neutral";
  fields.scannerBody.innerHTML = `
    <article>
      <span>Đang quét thị trường</span>
      <h3>Đang lọc thanh khoản, biến động, xu hướng và relative strength...</h3>
      <p>Scanner chạy theo nhóm nhỏ để tránh quá tải nguồn dữ liệu.</p>
    </article>
  `;

  try {
    const tasks = [];
    const includeCrypto = activeScannerType === "all" || activeScannerType === "crypto";
    const includeStock = activeScannerType === "all" || activeScannerType === "stock";
    const [btcBase, vnBase] = await Promise.allSettled([
      includeCrypto ? requestCryptoData("BTC", "2y") : Promise.resolve(null),
      includeStock ? requestVciData("VNINDEX", "2y") : Promise.resolve(null)
    ]);
    const btcBars = btcBase.status === "fulfilled" ? btcBase.value?.bars || [] : [];
    const vnParsed = vnBase.status === "fulfilled" ? parseVciData(vnBase.value) : null;
    const vnBars = vnParsed?.bars || [];

    if (includeCrypto) {
      SCANNER_CRYPTO_SYMBOLS.forEach((symbol) => tasks.push({ symbol, type: "crypto", base: btcBars }));
    }
    if (includeStock) {
      SCANNER_STOCK_SYMBOLS.forEach((symbol) => tasks.push({ symbol, type: "stock", base: vnBars }));
    }

    const rawResults = await runWithConcurrency(tasks, 4, (item) => loadScannerCandidate(item.symbol, item.type, item.base));
    const results = rawResults.filter((item) => item && !item.error);
    const errors = rawResults.filter((item) => item?.error);
    renderScannerResults(results, errors);
  } catch (error) {
    fields.scannerBadge.textContent = "Lỗi dữ liệu";
    fields.scannerBadge.className = "negative";
    fields.scannerBody.innerHTML = `
      <article>
        <span>Lỗi scanner</span>
        <h3>${escapeHtml(error.message || "Không quét được thị trường.")}</h3>
        <p>Hãy kiểm tra lại local server hoặc Netlify Function rồi quét lại.</p>
      </article>
    `;
  }
}

function updatePriceColor(price, reference, target) {
  target.classList.remove("positive", "negative", "neutral", "ceiling", "floor");
  const current = toNumber(price);
  const ref = toNumber(reference);
  if (current === null || ref === null) return;
  if (current > ref) target.classList.add("positive");
  if (current < ref) target.classList.add("negative");
  if (current === ref) target.classList.add("neutral");
}

function renderMovingAverages(bars, movingAverages = null) {
  const maValues = movingAverages || calculateMovingAverages(bars);
  const latestValue = (series) => [...series].reverse().find((value) => value !== null);
  const currentPrice = bars[bars.length - 1]?.close;
  const renderMa = (target, value) => {
    target.textContent = formatOptional(value, 2);
    target.classList.remove("positive", "negative", "neutral");
    if (toNumber(value) === null || toNumber(currentPrice) === null) return;
    if (currentPrice > value) target.classList.add("positive");
    if (currentPrice < value) target.classList.add("negative");
    if (currentPrice === value) target.classList.add("neutral");
  };

  renderMa(fields.ma10, latestValue(maValues.ma10));
  renderMa(fields.ma50, latestValue(maValues.ma50));
  renderMa(fields.ma100, latestValue(maValues.ma100));
  renderMa(fields.ma200, latestValue(maValues.ma200));

  return maValues;
}

function setActiveChartButton(rangeKey) {
  chartControls?.querySelectorAll("button[data-chart-range]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartRange === rangeKey);
  });
}

function setActiveHistoryButton(limit) {
  historyControls?.querySelectorAll("button[data-history-limit]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.historyLimit) === Number(limit));
  });
}

function formatChartPointTime(bar, preset) {
  const timestamp = toNumber(bar.timestamp);
  if (timestamp === null) return safeText(bar.time);
  const date = new Date(timestamp);
  if (preset.intraday) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("vi-VN");
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getCalendarBucket(timestamp, preset) {
  const date = new Date(timestamp);

  if (preset.intervalMs) {
    return Math.floor(timestamp / preset.intervalMs) * preset.intervalMs;
  }

  if (preset.bucket === "1d") {
    return startOfLocalDay(date);
  }

  if (preset.bucket === "3d" || preset.bucket === "5d") {
    const size = preset.bucket === "3d" ? 3 : 5;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const dayIndex = Math.floor((dayStart - yearStart) / 86400000);
    return new Date(date.getFullYear(), 0, 1 + Math.floor(dayIndex / size) * size).getTime();
  }

  if (preset.bucket === "1w") {
    const day = date.getDay() || 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1).getTime();
  }

  if (preset.bucket === "1m") {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }

  if (preset.bucket === "3m") {
    return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
  }

  return startOfLocalDay(date);
}

function aggregateBarsForPreset(bars, preset) {
  if (!bars.length) return [];
  const buckets = new Map();

  bars.forEach((bar) => {
    const timestamp = toNumber(bar.timestamp);
    const close = toNumber(bar.close);
    if (timestamp === null || close === null) return;

    const bucket = getCalendarBucket(timestamp, preset);
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, {
        timestamp: bucket,
        time: bar.time,
        open: toNumber(bar.open) ?? close,
        high: toNumber(bar.high) ?? close,
        low: toNumber(bar.low) ?? close,
        close,
        volume: toNumber(bar.volume) ?? 0
      });
      return;
    }

    current.high = Math.max(current.high, toNumber(bar.high) ?? close);
    current.low = Math.min(current.low, toNumber(bar.low) ?? close);
    current.close = close;
    current.volume += toNumber(bar.volume) ?? 0;
  });

  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-260);
}

function renderSelectedChart(bars, rangeKey = activeChartRange) {
  const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
  currentChartSourceBars = bars;
  const timeframeBars = normalizeTechnicalBars(aggregateBarsForPreset(bars, preset));
  const fullMovingAverages = calculateMovingAverages(timeframeBars);
  const fullIndicators = {
    rsi: calculateRsi(timeframeBars),
    macd: calculateMacd(timeframeBars)
  };
  const displayBars = timeframeBars.map((bar) => ({
    ...bar,
    time: formatChartPointTime(bar, preset)
  }));

  drawChart(displayBars, fullMovingAverages);
  renderMovingAverages(timeframeBars, fullMovingAverages);
  renderIndicators(timeframeBars, fullIndicators);
  fields.chartRange.textContent = `${preset.label} - ${displayBars.length} nến`;

  if (latestPayload) {
    latestPayload.activeTimeframe = preset.label;
    latestPayload.indicators = {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    };
    fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  }

  return { bars: displayBars, movingAverages: fullMovingAverages, indicators: fullIndicators };
}

async function applyChartRange(rangeKey) {
  if (!currentSymbol) {
    setMessage("Hãy nhập mã chứng khoán trước khi chọn khung biểu đồ.");
    return;
  }

  const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
  activeChartRange = rangeKey;
  setActiveChartButton(rangeKey);

  if (!preset.intraday) {
    renderSelectedChart(currentDailyBars, rangeKey);
    setMessage("");
    return;
  }

  const requestId = chartRequestId + 1;
  chartRequestId = requestId;
  fields.chartRange.textContent = `Đang tải biểu đồ ${preset.label}...`;

  try {
    const bars = await requestBarsForRange(currentSymbol, rangeKey);
    if (requestId !== chartRequestId) return;
    renderSelectedChart(bars, rangeKey);
    setMessage("");
  } catch (error) {
    renderSelectedChart(currentDailyBars, "1d");
    setActiveChartButton("1d");
    activeChartRange = "1d";
    setMessage(error.message || "Không tải được dữ liệu biểu đồ.");
  }
}

function latestNonNull(series) {
  return [...series].reverse().find((value) => value !== null);
}

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNewsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function percentChangeBetween(bars, periods) {
  if (!bars.length || bars.length <= periods) return null;
  const latest = bars[bars.length - 1]?.close;
  const previous = bars[bars.length - 1 - periods]?.close;
  if (!toNumber(latest) || !toNumber(previous)) return null;
  return ((latest - previous) / previous) * 100;
}

function normalizeSearchText(value) {
  return safeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function isRelatedNews(item, symbol, companyName) {
  const text = normalizeSearchText(`${item.title} ${item.description}`);
  const ticker = normalizeSearchText(symbol);
  const company = normalizeSearchText(companyName)
    .replace(/\bctcp\b|\bcong ty\b|\btap doan\b|\bcorporation\b|\bgroup\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const companyWords = company.split(" ").filter((word) => word.length >= 4).slice(0, 3);

  if (ticker && new RegExp(`(^|[^a-z0-9])${ticker}([^a-z0-9]|$)`).test(text)) return true;
  return companyWords.length >= 2 && companyWords.some((word) => text.includes(word));
}

function renderNews(items, symbol = currentSymbol, companyName = fields.companyName.textContent) {
  if (!fields.newsBody) return;

  const marketKeywords = /vn-?index|chứng khoán|co phieu|cổ phiếu|khối ngoại|thanh khoản|dòng tiền|nâng hạng|thị trường/i;
  const related = items.filter((item) => isRelatedNews(item, symbol, companyName));
  const market = items.filter((item) => !related.includes(item) && marketKeywords.test(`${item.title} ${item.description}`));
  const displayItems = [...related.slice(0, 8), ...market.slice(0, 16)].slice(0, 20);

  if (!displayItems.length) {
    fields.newsBody.innerHTML = `
      <article>
        <span>Chưa có tin phù hợp</span>
        <h3>Chưa tìm thấy tin mới từ nguồn RSS hiện tại.</h3>
        <p>Hãy bấm Cập nhật tin sau hoặc kiểm tra lại khi nguồn CafeF/VnExpress có bài mới.</p>
      </article>
    `;
    return;
  }

  fields.newsBody.innerHTML = `
    ${displayItems.map((item) => {
      const relatedClass = related.includes(item) ? " related" : "";
      const label = related.includes(item) ? `Liên quan ${escapeHtml(symbol || "mã đang xem")}` : "Tin thị trường";
      const thumbnail = item.thumbnail
        ? `<img class="news-thumb" src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}" loading="lazy">`
        : `<div class="news-thumb" aria-hidden="true"></div>`;
      return `
        <article class="${relatedClass.trim()}">
          ${thumbnail}
          <div class="news-content">
            <span>${escapeHtml(item.source)} · ${formatNewsDate(item.pubDate)} · ${label}</span>
            <h3><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
            <p>${escapeHtml(item.description || "Bấm để xem chi tiết bài viết từ nguồn gốc.")}</p>
          </div>
        </article>
      `;
    }).join("")}
    <p class="news-source-note">Nguồn: RSS CafeF và VnExpress. Tin được tải lại khi mở tab Tin tức hoặc bấm Cập nhật tin.</p>
  `;
}

async function loadNews(symbol = currentSymbol, options = {}) {
  if (fields.newsBody && !options.silent) {
    fields.newsBody.innerHTML = `
      <article>
        <span>Đang cập nhật</span>
        <h3>Đang tải tin tức thị trường...</h3>
        <p>Nguồn RSS có thể mất vài giây để phản hồi.</p>
      </article>
    `;
  }

  try {
    const data = await requestNewsData();
    latestNewsItems = Array.isArray(data.items) ? data.items : [];
    renderNews(latestNewsItems, symbol, fields.companyName.textContent);
    return latestNewsItems;
  } catch (error) {
    if (!options.silent && fields.newsBody) {
      fields.newsBody.innerHTML = `
        <article>
          <span>Lỗi dữ liệu</span>
          <h3>${escapeHtml(error.message || "Không tải được tin tức.")}</h3>
          <p>Hãy kiểm tra local server hoặc Netlify Function đã được upload cùng website.</p>
        </article>
      `;
    }
    latestNewsItems = [];
    return [];
  }
}

function calculateMarketStrength(stockBars, indexBars) {
  const stock20 = percentChangeBetween(stockBars, 20);
  const stock60 = percentChangeBetween(stockBars, 60);
  const index20 = percentChangeBetween(indexBars, 20);
  const index60 = percentChangeBetween(indexBars, 60);

  return {
    stock20,
    stock60,
    index20,
    index60,
    relative20: toNumber(stock20) !== null && toNumber(index20) !== null ? stock20 - index20 : null,
    relative60: toNumber(stock60) !== null && toNumber(index60) !== null ? stock60 - index60 : null
  };
}

function hasUsefulValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "-" && value !== 0;
}

function mergeOverviewWithFundamentals(overview, fundamentals) {
  const extra = fundamentals?.overview || {};
  return {
    ...overview,
    ticker: extra.ticker || overview.ticker,
    name: hasUsefulValue(extra.name) ? extra.name : overview.name,
    exchange: hasUsefulValue(extra.exchange) ? boardName(extra.exchange) : overview.exchange,
    industry: hasUsefulValue(extra.industry) ? extra.industry : overview.industry,
    sector: hasUsefulValue(extra.sector) ? extra.sector : overview.sector,
    marketCap: hasUsefulValue(extra.marketCap) ? extra.marketCap : overview.marketCap,
    pe: hasUsefulValue(extra.pe) ? extra.pe : overview.pe,
    pb: hasUsefulValue(extra.pb) ? extra.pb : overview.pb,
    roe: hasUsefulValue(extra.roe) ? extra.roe : overview.roe,
    eps: hasUsefulValue(extra.eps) ? extra.eps : overview.eps,
    beta: hasUsefulValue(extra.beta) ? extra.beta : overview.beta,
    fundamentalsSource: fundamentals?.found ? fundamentals.source : overview.fundamentalsSource
  };
}

function average(values) {
  const filtered = values.filter((value) => toNumber(value) !== null);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function findSupportResistance(bars, currentPrice) {
  const recent = bars.slice(-80);
  const supports = recent
    .map((bar) => bar.low)
    .filter((value) => toNumber(value) !== null && value < currentPrice)
    .sort((a, b) => b - a);
  const resistances = recent
    .map((bar) => bar.high)
    .filter((value) => toNumber(value) !== null && value > currentPrice)
    .sort((a, b) => a - b);

  return {
    support1: supports[0] ?? null,
    support2: supports[Math.min(9, supports.length - 1)] ?? null,
    resistance1: resistances[0] ?? null,
    resistance2: resistances[Math.min(9, resistances.length - 1)] ?? null
  };
}

function scoreStock(symbol, quote, overview, bars, movingAverages, indicators) {
  const latestBar = bars[bars.length - 1] || {};
  const currentPrice = quote.price ?? latestBar.close;
  const ma50 = latestNonNull(movingAverages.ma50);
  const ma100 = latestNonNull(movingAverages.ma100);
  const ma200 = latestNonNull(movingAverages.ma200);
  const latestRsi = latestNonNull(indicators.rsi);
  const latestMacd = latestNonNull(indicators.macd.macd);
  const latestSignal = latestNonNull(indicators.macd.signal);
  const latestHistogram = latestNonNull(indicators.macd.histogram);
  const change30 = bars.length > 31 ? ((currentPrice - bars[bars.length - 31].close) / bars[bars.length - 31].close) * 100 : null;
  const volumes = bars.map((bar) => bar.volume);
  const avgVolume20 = average(volumes.slice(-20));
  const avgVolume60 = average(volumes.slice(-60));
  const latestVolume = latestBar.volume;
  const levels = findSupportResistance(bars, currentPrice);
  const stopPrice = levels.support1 ? levels.support1 * 0.98 : currentPrice * 0.95;
  const targetPrice = levels.resistance1 || currentPrice * 1.15;
  const riskPercent = ((currentPrice - stopPrice) / currentPrice) * 100;
  const rewardPercent = ((targetPrice - currentPrice) / currentPrice) * 100;
  const riskReward = riskPercent > 0 ? rewardPercent / riskPercent : null;

  let trendScore = 0;
  if (currentPrice > ma50) trendScore += 6;
  if (currentPrice > ma200) trendScore += 5;
  if (ma50 > ma100) trendScore += 5;
  if (ma100 > ma200) trendScore += 5;
  if (toNumber(change30) !== null && change30 > 0) trendScore += 4;
  trendScore = Math.min(trendScore, 25);

  let volumeScore = 4;
  if (latestVolume && avgVolume20 && latestVolume >= avgVolume20) volumeScore += 6;
  if (avgVolume20 && avgVolume60 && avgVolume20 >= avgVolume60) volumeScore += 5;
  if (toNumber(change30) !== null && change30 > 0) volumeScore += 3;
  if (latestVolume) volumeScore += 2;
  volumeScore = Math.min(volumeScore, 20);

  let rsiScore = 5;
  if (latestRsi >= 50 && latestRsi <= 65) rsiScore = 10;
  else if (latestRsi > 65 && latestRsi <= 75) rsiScore = 8;
  else if (latestRsi >= 40 && latestRsi < 50) rsiScore = 7;
  else if (latestRsi >= 30 && latestRsi < 40) rsiScore = 6;
  else if (latestRsi > 75) rsiScore = 5;
  else if (latestRsi < 30) rsiScore = 4;

  let macdScore = 3;
  if (latestMacd > latestSignal) macdScore += 4;
  if (latestHistogram > 0) macdScore += 2;
  if (latestMacd > 0) macdScore += 1;
  macdScore = Math.min(macdScore, 10);

  const distanceToSupport = levels.support1 ? ((currentPrice - levels.support1) / currentPrice) * 100 : null;
  let srScore = 4;
  if (distanceToSupport !== null && distanceToSupport <= 5) srScore += 3;
  if (riskReward !== null && riskReward >= 2) srScore += 2;
  if (levels.resistance1) srScore += 1;
  srScore = Math.min(srScore, 10);

  const relatedNews = latestNewsItems.filter((item) => isRelatedNews(item, symbol, overview.name || symbol));
  let fundamentalScore = overview.name && overview.name !== symbol ? 5 : 4;
  if (relatedNews.length >= 1) fundamentalScore += 1;
  if (relatedNews.length >= 3) fundamentalScore += 1;
  if (overview.industry && overview.industry !== "-") fundamentalScore += 1;
  if (overview.pe || overview.pb || overview.roe || overview.eps) fundamentalScore += 1;
  fundamentalScore = Math.min(fundamentalScore, 10);

  let industryScore = overview.exchange ? 5 : 4;
  if (latestMarketStrength?.relative20 !== null && latestMarketStrength.relative20 > 0) industryScore += 2;
  if (latestMarketStrength?.relative60 !== null && latestMarketStrength.relative60 > 0) industryScore += 2;
  if (latestMarketStrength?.stock20 !== null && latestMarketStrength.stock20 > 0) industryScore += 1;
  industryScore = Math.min(industryScore, 10);
  let rrScore = 2;
  if (riskReward >= 3) rrScore = 5;
  else if (riskReward >= 2) rrScore = 4;
  else if (riskReward >= 1.3) rrScore = 3;

  const total = trendScore + volumeScore + rsiScore + macdScore + srScore + fundamentalScore + industryScore + rrScore;

  return {
    total,
    trendScore,
    volumeScore,
    rsiScore,
    macdScore,
    srScore,
    fundamentalScore,
    industryScore,
    relatedNews,
    marketStrength: latestMarketStrength,
    rrScore,
    currentPrice,
    ma50,
    ma100,
    ma200,
    latestRsi,
    latestMacd,
    latestSignal,
    latestHistogram,
    change30,
    avgVolume20,
    avgVolume60,
    latestVolume,
    levels,
    stopPrice,
    targetPrice,
    riskPercent,
    rewardPercent,
    riskReward
  };
}

function conclusionForScore(total) {
  if (total >= 85) return "Mua rất mạnh theo hệ thống";
  if (total >= 75) return "Mua mạnh theo hệ thống";
  if (total >= 65) return "Theo dõi mua / mua từng phần";
  if (total >= 50) return "Trung tính, cần thêm tín hiệu xác nhận";
  return "Yếu, chưa nên ưu tiên";
}

function renderScoreAnalysis(symbol, quote, overview, bars, movingAverages, indicators) {
  const score = scoreStock(symbol, quote, overview, bars, movingAverages, indicators);
  const name = safeText(overview.name) !== "-" ? overview.name : symbol;
  const macdState = score.latestMacd > score.latestSignal ? "MACD đang nằm trên Signal" : "MACD đang nằm dưới Signal";
  const trendState = score.currentPrice > score.ma50 && score.ma50 > score.ma100 && score.ma100 > score.ma200
    ? "Xu hướng giá đang rất tích cực: giá trên MA50 và MA50 > MA100 > MA200."
    : "Xu hướng chưa đồng thuận hoàn toàn giữa giá và các đường MA lớn.";
  const rsiState = score.latestRsi >= 50 && score.latestRsi <= 65
    ? "RSI nằm trong vùng khỏe, chưa quá nóng."
    : score.latestRsi > 70
      ? "RSI đang cao, cần để ý rủi ro rung lắc ngắn hạn."
      : "RSI chưa cho tín hiệu sức mạnh rõ ràng.";
  const rrText = score.riskReward === null ? "-" : `${formatNumber(score.riskReward, 2)} : 1`;
  const upgradeText = [
    score.latestMacd <= score.latestSignal ? "MACD cắt lên Signal" : null,
    score.latestRsi < 55 ? "RSI vượt lại trên 55" : null,
    score.levels.resistance1 ? `Giá vượt ${formatPrice(score.levels.resistance1)} với volume tốt` : "Giá vượt kháng cự gần",
    score.latestVolume < score.avgVolume20 ? "Volume vượt trung bình 20 phiên" : null
  ].filter(Boolean);
  const relatedNewsHtml = score.relatedNews.length
    ? `
      <p>Tìm thấy ${score.relatedNews.length} tin liên quan trực tiếp tới mã hoặc doanh nghiệp từ nguồn RSS uy tín.</p>
      <ul class="score-points">
        ${score.relatedNews.slice(0, 3).map((item) => `
          <li><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a> <small>(${escapeHtml(item.source)}, ${formatNewsDate(item.pubDate)})</small></li>
        `).join("")}
      </ul>
    `
    : `<p>Chưa tìm thấy tin liên quan trực tiếp tới ${escapeHtml(symbol)} trong RSS mới nhất. Điểm cơ bản được giữ thận trọng và nên đọc thêm báo cáo tài chính, công bố thông tin hoặc tin doanh nghiệp riêng.</p>`;
  const strength = score.marketStrength || {};
  const marketStrengthHtml = strength.relative20 !== null || strength.relative60 !== null
    ? `
      <p>App đang dùng sức mạnh tương đối so với VNINDEX làm thước đo thay thế khi chưa có API phân ngành realtime đầy đủ.</p>
      <ul class="score-points">
        <li>20 phiên: ${escapeHtml(symbol)} ${formatPercent(strength.stock20)} / VNINDEX ${formatPercent(strength.index20)} / chênh lệch ${formatPercent(strength.relative20)}</li>
        <li>60 phiên: ${escapeHtml(symbol)} ${formatPercent(strength.stock60)} / VNINDEX ${formatPercent(strength.index60)} / chênh lệch ${formatPercent(strength.relative60)}</li>
      </ul>
    `
    : `<p>Chưa tải được dữ liệu VNINDEX để so sánh sức mạnh tương đối. Điểm này được giữ ở mức trung tính có điều kiện.</p>`;

  fields.scoreTotalBadge.textContent = `${score.total}/100 điểm`;
  fields.scoreAnalysis.innerHTML = `
    <div class="score-hero">
      <h3>${escapeHtml(symbol)} - ${escapeHtml(name)}</h3>
      <p><strong>Giá hiện tại:</strong> ${formatPrice(score.currentPrice)}</p>
      <p><strong>Kết luận:</strong> ${conclusionForScore(score.total)}.</p>
      <span class="score-tag">${score.total}/100</span>
    </div>

    <div class="score-block">
      <h3>1. Xu hướng (${score.trendScore}/25)</h3>
      <p>${trendState}</p>
      <ul class="score-points">
        <li>Giá hiện tại: ${formatPrice(score.currentPrice)}</li>
        <li>MA50: ${formatOptional(score.ma50, 2)}, MA100: ${formatOptional(score.ma100, 2)}, MA200: ${formatOptional(score.ma200, 2)}</li>
        <li>Biến động 30 phiên: ${formatPercent(score.change30)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>2. Volume - Dòng tiền (${score.volumeScore}/20)</h3>
      <p>Thanh khoản phiên gần nhất được so sánh với trung bình 20 và 60 phiên.</p>
      <ul class="score-points">
        <li>Volume gần nhất: ${formatInteger(score.latestVolume)}</li>
        <li>Volume TB20: ${formatInteger(score.avgVolume20)}</li>
        <li>Volume TB60: ${formatInteger(score.avgVolume60)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>3. RSI (${score.rsiScore}/10)</h3>
      <p>${rsiState}</p>
      <p>RSI 14 hiện tại: <strong>${formatOptional(score.latestRsi, 2)}</strong>.</p>
    </div>

    <div class="score-block">
      <h3>4. MACD (${score.macdScore}/10)</h3>
      <p>${macdState}. Histogram hiện tại: ${formatOptional(score.latestHistogram, 2)}.</p>
      <p>MACD: ${formatOptional(score.latestMacd, 2)} / Signal: ${formatOptional(score.latestSignal, 2)}.</p>
    </div>

    <div class="score-block">
      <h3>5. Hỗ trợ - Kháng cự (${score.srScore}/10)</h3>
      <ul class="score-points">
        <li>Hỗ trợ gần: ${formatPrice(score.levels.support1)}</li>
        <li>Hỗ trợ sâu: ${formatPrice(score.levels.support2)}</li>
        <li>Kháng cự gần: ${formatPrice(score.levels.resistance1)}</li>
        <li>Kháng cự sau: ${formatPrice(score.levels.resistance2)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>6. Cơ bản - Tin tức (${score.fundamentalScore}/10)</h3>
      ${relatedNewsHtml}
    </div>

    <div class="score-block">
      <h3>7. Sức mạnh ngành (${score.industryScore}/10)</h3>
      ${marketStrengthHtml}
    </div>

    <div class="score-block">
      <h3>8. Risk / Reward (${score.rrScore}/5)</h3>
      <ul class="score-points">
        <li>Giá mua tham chiếu: ${formatPrice(score.currentPrice)}</li>
        <li>Cắt lỗ gợi ý: ${formatPrice(score.stopPrice)} (${formatPercent(-score.riskPercent)})</li>
        <li>Mục tiêu gần: ${formatPrice(score.targetPrice)} (${formatPercent(score.rewardPercent)})</li>
        <li>Tỷ lệ Reward/Risk: ${rrText}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>Tổng điểm</h3>
      <div class="table-wrap score-table-wrap">
        <table class="score-table">
          <thead><tr><th>Tiêu chí</th><th>Điểm</th></tr></thead>
          <tbody>
            <tr><td>Xu hướng</td><td>${score.trendScore}/25</td></tr>
            <tr><td>Volume - Dòng tiền</td><td>${score.volumeScore}/20</td></tr>
            <tr><td>RSI</td><td>${score.rsiScore}/10</td></tr>
            <tr><td>MACD</td><td>${score.macdScore}/10</td></tr>
            <tr><td>Hỗ trợ / Kháng cự</td><td>${score.srScore}/10</td></tr>
            <tr><td>Cơ bản - Tin tức</td><td>${score.fundamentalScore}/10</td></tr>
            <tr><td>Sức mạnh ngành</td><td>${score.industryScore}/10</td></tr>
            <tr><td>Risk / Reward</td><td>${score.rrScore}/5</td></tr>
            <tr class="total-row"><td>Tổng</td><td>${score.total}/100</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="score-block">
      <h3>Kết luận và kế hoạch</h3>
      <p><strong>${escapeHtml(symbol)} = ${score.total}/100.</strong> ${conclusionForScore(score.total)}.</p>
      <p>Nếu tham gia, có thể chia vị thế theo từng phần thay vì mua một lần: một phần ở vùng hiện tại, một phần khi MACD xác nhận, và một phần khi giá vượt kháng cự với volume tốt.</p>
      <p>Điều kiện để nâng điểm: ${upgradeText.length ? upgradeText.join("; ") : "các tín hiệu kỹ thuật chính hiện đã khá tích cực, cần duy trì thanh khoản và xu hướng."}</p>
    </div>
  `;

  return score;
}

function recommendationLabel(score) {
  if (score >= 4) return { text: "Ưu tiên mua", className: "positive" };
  if (score >= 2) return { text: "Mua thăm dò", className: "positive" };
  if (score >= 0) return { text: "Theo dõi", className: "neutral" };
  if (score >= -2) return { text: "Giảm tỷ trọng", className: "negative" };
  return { text: "Tránh mua", className: "negative" };
}

function buildRecommendation(title, bars, options) {
  const latestBar = bars[bars.length - 1] || {};
  const currentPrice = latestBar.close;
  const movingAverages = calculateMovingAverages(bars);
  const rsi = calculateRsi(bars);
  const macd = calculateMacd(bars);
  const maFast = latestNonNull(movingAverages[options.fastMa]);
  const maSlow = latestNonNull(movingAverages[options.slowMa]);
  const latestRsi = latestNonNull(rsi);
  const latestMacd = latestNonNull(macd.macd);
  const latestSignal = latestNonNull(macd.signal);
  const latestHistogram = latestNonNull(macd.histogram);
  const volumes = bars.map((bar) => bar.volume);
  const latestVolume = latestBar.volume;
  const avgVolume20 = average(volumes.slice(-20));
  const levels = findSupportResistance(bars, currentPrice);

  let score = 0;
  const reasons = [];

  if (currentPrice > maFast) {
    score += 1;
    reasons.push(`giá trên ${options.fastLabel}`);
  } else {
    score -= 1;
    reasons.push(`giá dưới ${options.fastLabel}`);
  }

  if (maFast > maSlow) {
    score += 1;
    reasons.push(`${options.fastLabel} trên ${options.slowLabel}`);
  } else {
    score -= 1;
    reasons.push(`${options.fastLabel} dưới ${options.slowLabel}`);
  }

  if (latestMacd > latestSignal && latestHistogram > 0) {
    score += 1;
    reasons.push("MACD ủng hộ tăng");
  } else if (latestMacd < latestSignal && latestHistogram < 0) {
    score -= 1;
    reasons.push("MACD còn yếu");
  }

  if (latestRsi >= 45 && latestRsi <= 65) {
    score += 1;
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} khỏe`);
  } else if (latestRsi > 75 || latestRsi < 35) {
    score -= 1;
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} rủi ro`);
  } else {
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} trung tính`);
  }

  if (latestVolume && avgVolume20 && latestVolume > avgVolume20) {
    score += 1;
    reasons.push("volume trên TB20");
  }

  const distanceToSupport = levels.support1 ? ((currentPrice - levels.support1) / currentPrice) * 100 : null;
  if (distanceToSupport !== null && distanceToSupport <= 4) {
    score += 1;
    reasons.push("gần hỗ trợ");
  }

  const label = recommendationLabel(score);
  return {
    title,
    label,
    detail: `${reasons.slice(0, 4).join(", ")}. Hỗ trợ gần ${formatPrice(levels.support1)}, kháng cự gần ${formatPrice(levels.resistance1)}.`
  };
}

function renderTradingRecommendations(bars) {
  if (!bars.length) return;
  const normalizedBars = normalizeTechnicalBars(bars);
  const recommendations = [
    buildRecommendation("Ngắn hạn", normalizedBars.slice(-80), {
      fastMa: "ma10",
      slowMa: "ma50",
      fastLabel: "MA20",
      slowLabel: "MA50"
    }),
    buildRecommendation("Trung hạn", normalizedBars.slice(-180), {
      fastMa: "ma50",
      slowMa: "ma100",
      fastLabel: "MA50",
      slowLabel: "MA100"
    }),
    buildRecommendation("Dài hạn", normalizedBars, {
      fastMa: "ma100",
      slowMa: "ma200",
      fastLabel: "MA100",
      slowLabel: "MA200"
    })
  ];

  fields.recommendationBody.innerHTML = recommendations.map((item) => `
    <article>
      <span>${escapeHtml(item.title)}</span>
      <strong class="${item.label.className}">${escapeHtml(item.label.text)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </article>
  `).join("");
}

function fillData(symbol, quote, overview, bars) {
  const isCrypto = overview.assetType === "crypto";
  const latestBar = bars[bars.length - 1] || {};
  const previousBar = bars[bars.length - 2] || {};
  const currentPrice = latestBar.close ?? quote.price;
  const reference = previousBar.close ?? quote.referencePrice;
  const change = toNumber(currentPrice) !== null && toNumber(reference) !== null
    ? toNumber(currentPrice) - toNumber(reference)
    : null;
  const changePercent = toNumber(change) !== null && toNumber(reference)
    ? (toNumber(change) / toNumber(reference)) * 100
    : null;
  const priceLimits = isCrypto ? { ceiling: null, floor: null } : calculateCeilingFloor(reference, overview.exchange || quote.exchange);

  fields.exchange.textContent = `${symbol} ${overview.exchange || quote.exchange ? "- " + safeText(overview.exchange || quote.exchange) : ""}`;
  fields.companyName.textContent = safeText(overview.name) !== "-" ? overview.name : symbol;
  fields.companyDescription.textContent = safeText(overview.description) !== "-"
    ? overview.description
    : isCrypto
      ? "Dữ liệu coin được ưu tiên lấy từ Binance, sau đó OKX; Yahoo Finance chỉ dùng làm dự phòng. Một số chỉ số cơ bản kiểu cổ phiếu sẽ không áp dụng cho coin."
      : "Dữ liệu được lấy từ nguồn công khai. Một số trường có thể trống tùy theo mã cổ phiếu.";
  fields.currentPrice.textContent = formatPrice(currentPrice);
  fields.priceChange.textContent = `${toNumber(change) > 0 ? "+" : ""}${formatPrice(change)} (${formatPercent(changePercent)})`;
  updatePriceColor(currentPrice, reference, fields.priceChange);

  fields.referencePrice.textContent = formatPrice(reference);
  fields.ceilingPrice.classList.remove("ceiling");
  fields.floorPrice.classList.remove("floor");
  fields.ceilingPrice.textContent = isCrypto ? "-" : formatPrice(quote.ceilingPrice ?? priceLimits.ceiling);
  fields.floorPrice.textContent = isCrypto ? "-" : formatPrice(quote.floorPrice ?? priceLimits.floor);
  if (!isCrypto) {
    fields.ceilingPrice.classList.add("ceiling");
    fields.floorPrice.classList.add("floor");
  }
  fields.highPrice.textContent = formatPrice(quote.highPrice ?? latestBar.high);
  fields.lowPrice.textContent = formatPrice(quote.lowPrice ?? latestBar.low);
  fields.volume.textContent = formatInteger(quote.volume ?? latestBar.volume);

  fields.ticker.textContent = symbol;
  fields.listedExchange.textContent = safeText(overview.exchange || quote.exchange);
  fields.industry.textContent = safeText(overview.industry);
  fields.sector.textContent = safeText(overview.sector);
  fields.marketCap.textContent = toNumber(overview.marketCap) ? formatLargeNumber(overview.marketCap) : "-";
  fields.peRatio.textContent = formatFundamentalNumber(overview.pe, 2);
  fields.pbRatio.textContent = formatFundamentalNumber(overview.pb, 2);
  fields.roe.textContent = toNumber(overview.roe) ? formatPercent(overview.roe) : "-";
  fields.eps.textContent = formatFundamentalNumber(overview.eps, 2);
  fields.beta.textContent = formatFundamentalNumber(overview.beta, 2);

  currentSymbol = symbol;
  currentAssetType = isCrypto ? "crypto" : "stock";
  currentDataSymbol = quote.ticker || overview.ticker || symbol;
  currentDailyBars = bars;
  activeChartRange = "1d";
  activeHistoryLimit = 30;
  setActiveChartButton(activeChartRange);
  setActiveHistoryButton(activeHistoryLimit);
  renderSelectedChart(bars, activeChartRange);
  const scoreBars = aggregateBarsForPreset(bars, CHART_PRESETS["1d"]);
  const scoreTechnicalBars = normalizeTechnicalBars(scoreBars);
  const movingAverages = calculateMovingAverages(scoreBars);
  const indicators = {
    rsi: calculateRsi(scoreTechnicalBars),
    macd: calculateMacd(scoreTechnicalBars)
  };
  renderPriceChanges(bars);
  renderTradingRecommendations(bars);
  renderInvestorFlow(quote);
  renderHistory(bars, activeHistoryLimit);
  const score = renderScoreAnalysis(symbol, quote, overview, scoreBars, movingAverages, indicators);
  const fundamentalView = renderFundamentalAnalysis(overview, score);
  return { movingAverages, indicators, score, fundamentalView };
}

async function loadVietnamStock(symbol) {
  setMessage("Đang tải dữ liệu...");
  const normalizedSymbol = normalizeSymbolInput(symbol);
  const cryptoSymbol = toCryptoPairSymbol(normalizedSymbol);
  const yahooCryptoSymbol = toYahooCryptoSymbol(normalizedSymbol);
  if (cryptoSymbol || yahooCryptoSymbol) {
    await loadCryptoAsset(normalizedSymbol, cryptoSymbol || yahooCryptoSymbol);
    return;
  }

  let parsed = null;
  let lastError = null;

  try {
    const rawVci = await requestVciData(symbol, "2y");
    parsed = parseVciData(rawVci);
  } catch (error) {
    lastError = error;
  }

  const candidates = parsed ? [] : makeYahooCandidates(symbol);

  for (const candidate of candidates) {
    try {
      const raw = await requestJson(`/v8/finance/chart/${encodeURIComponent(candidate)}?range=2y&interval=1d`);
      parsed = parseYahooChart(raw);
      if (parsed && parsed.bars.length) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!parsed || !parsed.bars.length) {
    throw new Error(lastError?.message || "Không tìm thấy mã chứng khoán Việt Nam này trên nguồn dữ liệu hiện tại.");
  }

  const quote = parsed.quote;
  let overview = parsed.overview;
  const bars = parsed.bars;

  latestMarketStrength = null;
  const [newsResult, indexResult, fundamentalsResult] = await Promise.allSettled([
    loadNews(symbol, { silent: true }),
    requestVciData("VNINDEX", "2y"),
    requestFundamentalsData(symbol)
  ]);

  if (indexResult.status === "fulfilled") {
    const indexParsed = parseVciData(indexResult.value);
    if (indexParsed?.bars?.length) {
      latestMarketStrength = calculateMarketStrength(bars, indexParsed.bars);
    }
  }

  if (newsResult.status !== "fulfilled") {
    latestNewsItems = [];
  }

  if (fundamentalsResult.status === "fulfilled") {
    overview = mergeOverviewWithFundamentals(overview, fundamentalsResult.value);
  }

  const analysis = fillData(symbol, quote, overview, bars);
  latestPayload = {
    source: parsed.source,
    assetType: currentAssetType,
    symbol,
    resolvedSymbol: quote.ticker,
    activeTimeframe: CHART_PRESETS[activeChartRange]?.label || activeChartRange,
    quote,
    overview,
    recentBars: bars.slice(-30),
    indicators: {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    },
    score: analysis.score,
    news: {
      sources: "CafeF RSS, VnExpress RSS",
      relatedCount: analysis.score.relatedNews.length,
      topRelated: analysis.score.relatedNews.slice(0, 3)
    },
    fundamentals: {
      source: overview.fundamentalsSource || "Chưa có dữ liệu cơ bản",
      marketCap: overview.marketCap,
      pe: overview.pe,
      pb: overview.pb,
      roe: overview.roe,
      eps: overview.eps,
      beta: overview.beta
    },
    marketStrength: latestMarketStrength,
    investorFlow: {
      status: parsed.source === "Vietcap/VCI"
        ? "Dữ liệu bảng giá VCI nếu có"
        : `${parsed.source} không cung cấp dữ liệu mua/bán theo nhóm nhà đầu tư`
    }
  };
  fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  fields.lastUpdated.textContent = `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;
  setMessage("");
}

async function loadCryptoAsset(inputSymbol, cryptoSymbol) {
  let parsed = null;
  let lastError = null;

  try {
    parsed = await requestCryptoData(cryptoSymbol, "2y");
  } catch (error) {
    lastError = error;
  }

  if (!parsed?.bars?.length) {
    const yahooSymbol = toYahooCryptoSymbol(inputSymbol) || toYahooCryptoSymbol(cryptoSymbol);
    if (yahooSymbol) {
      try {
        parsed = parseYahooChart(await requestYahooChartData(yahooSymbol, "2y", "1d"));
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (!parsed || !parsed.bars.length) {
    throw new Error(lastError?.message || "Không tìm thấy coin này trên nguồn dữ liệu hiện tại.");
  }

  latestMarketStrength = null;
  const newsResult = await Promise.allSettled([
    loadNews(inputSymbol, { silent: true })
  ]);
  if (newsResult[0].status !== "fulfilled") {
    latestNewsItems = [];
  }

  const quote = parsed.quote;
  const overview = {
    ...parsed.overview,
    ticker: parsed.resolvedSymbol || parsed.quote?.ticker || cryptoSymbol,
    assetType: "crypto"
  };
  const bars = parsed.bars;
  const analysis = fillData(inputSymbol, quote, overview, bars);

  latestPayload = {
    source: parsed.source,
    assetType: "crypto",
    symbol: inputSymbol,
    resolvedSymbol: parsed.resolvedSymbol || cryptoSymbol,
    activeTimeframe: CHART_PRESETS[activeChartRange]?.label || activeChartRange,
    quote,
    overview,
    recentBars: bars.slice(-30),
    indicators: {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    },
    score: analysis.score,
    news: {
      sources: "CafeF RSS, VnExpress RSS",
      relatedCount: analysis.score.relatedNews.length,
      topRelated: analysis.score.relatedNews.slice(0, 3)
    },
    note: "Coin không có giá trần/sàn và các chỉ số P/E, P/B, ROE như cổ phiếu."
  };
  fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  fields.lastUpdated.textContent = `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;
  setMessage("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = symbolInput.value.trim().toUpperCase();

  if (!symbol) {
    setMessage("Hãy nhập mã chứng khoán Việt Nam hoặc mã coin.");
    symbolInput.focus();
    return;
  }

  try {
    await loadVietnamStock(symbol);
  } catch (error) {
    setMessage(error.message || "Không tải được dữ liệu.");
  }
});

quickSymbols.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-symbol]");
  if (!button) return;
  symbolInput.value = button.dataset.symbol;
  form.requestSubmit();
});

chartControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chart-range]");
  if (!button) return;
  applyChartRange(button.dataset.chartRange);
});

historyControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-limit]");
  if (!button || !currentDailyBars.length) return;
  activeHistoryLimit = Number(button.dataset.historyLimit) || 30;
  setActiveHistoryButton(activeHistoryLimit);
  renderHistory(currentDailyBars, activeHistoryLimit);
});

fullscreenChartButton?.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await (chartWorkspace || chartSection).requestFullscreen();
    }
  } catch {
    setMessage("Trình duyệt không cho phép phóng to biểu đồ.");
  }
});

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenChartButton) return;
  fullscreenChartButton.textContent = document.fullscreenElement ? "Thu nhỏ" : "Phóng to";
  if (currentChartSourceBars.length) {
    requestAnimationFrame(() => renderSelectedChart(currentChartSourceBars, activeChartRange));
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
    if (tab.dataset.tab === "news") {
      loadNews(currentSymbol);
    }
    if (tab.dataset.tab === "ai") {
      loadAiAnalysis();
    }
    if (tab.dataset.tab === "trade") {
      loadTradeAnalysis();
    }
    if (tab.dataset.tab === "scanner" && !latestScannerResults.length) {
      loadMarketScanner();
    }
  });
});

refreshNewsButton?.addEventListener("click", () => {
  loadNews(currentSymbol);
});

refreshAiButton?.addEventListener("click", () => {
  loadAiAnalysis();
});

refreshTradeButton?.addEventListener("click", () => {
  loadTradeAnalysis();
});

refreshScannerButton?.addEventListener("click", () => {
  loadMarketScanner();
});

scannerControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scanner-type]");
  if (!button) return;
  activeScannerType = button.dataset.scannerType || "all";
  scannerControls.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  loadMarketScanner();
});

copyButton.addEventListener("click", async () => {
  if (!latestPayload) {
    setMessage("Chưa có dữ liệu để copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(latestPayload, null, 2));
    setMessage("Đã copy JSON.");
  } catch {
    setMessage("Không copy được. Hãy bôi đen phần JSON và copy thủ công.");
  }
});

drawChart([]);
drawLineCanvas(rsiCanvas, []);
drawMacdCanvas(macdCanvas, { macd: [], signal: [], histogram: [] });
loadMarketStrip();
setInterval(loadMarketStrip, 60000);
symbolInput.focus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Service worker chi hoat dong tren HTTPS hoac localhost.
    });
  });
}

