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
const refreshCryptoTradingButton = document.getElementById("refreshCryptoTradingButton");
const scannerControls = document.querySelector(".scanner-controls");
const tabs = document.querySelectorAll(".tab");
const tabPanels = {
  overview: document.getElementById("overviewPanel"),
  score: document.getElementById("scorePanel"),
  news: document.getElementById("newsPanel"),
  ai: document.getElementById("aiPanel"),
  trade: document.getElementById("tradePanel"),
  scanner: document.getElementById("scannerPanel"),
  cryptoTrading: document.getElementById("cryptoTradingPanel")
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
  scannerTradeBox: document.getElementById("scannerTradeBox"),
  scannerBody: document.getElementById("scannerBody"),
  cryptoTradingBadge: document.getElementById("cryptoTradingBadge"),
  cryptoTradingBody: document.getElementById("cryptoTradingBody"),
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
let latestCryptoTradingResults = [];

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

