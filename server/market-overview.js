const YAHOO_BASE = "https://query1.finance.yahoo.com";
const FRED_DFF_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DFF";
const BINANCE_BASE = "https://data-api.binance.vision/api/v3";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const VCI_TRADING_BASE = "https://trading.vietcap.com.vn/api";
const CACHE_TTL_MS = 45_000;

const YAHOO_MARKETS = {
  dxy: "DX-Y.NYB",
  us10y: "^TNX",
  vix: "^VIX",
  gold: "GC=F",
  silver: "SI=F",
  brent: "BZ=F",
  wti: "CL=F",
  sp500: "^GSPC",
  nasdaq: "^IXIC",
  dowJones: "^DJI",
  eurUsd: "EURUSD=X",
  usdJpy: "JPY=X",
  usdCny: "CNY=X",
  usdVnd: "VND=X"
};

let marketCache = null;

async function fetchWithTimeout(url, options = {}, timeoutMs = 9_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function quote(price, referencePrice, extra = {}) {
  const numericPrice = Number(price);
  const numericReference = Number(referencePrice);
  const changePercent = Number.isFinite(numericPrice) && Number.isFinite(numericReference) && numericReference !== 0
    ? ((numericPrice - numericReference) / numericReference) * 100
    : null;
  return {
    price: Number.isFinite(numericPrice) ? numericPrice : null,
    changePercent,
    ...extra
  };
}

async function fetchYahooQuote(symbol) {
  const url = `${YAHOO_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;
  const response = await fetchWithTimeout(url, {
    headers: { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" }
  });
  if (!response.ok) throw new Error(`Yahoo ${symbol} HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const closes = (result?.indicators?.quote?.[0]?.close || []).filter(Number.isFinite);
  const price = Number(meta.regularMarketPrice ?? closes[closes.length - 1]);
  const reference = Number(meta.chartPreviousClose ?? meta.previousClose ?? closes[closes.length - 2]);
  if (!Number.isFinite(price)) throw new Error(`Yahoo ${symbol} has no price`);
  return quote(price, reference, { source: "Yahoo Finance" });
}

async function fetchBinanceQuote(symbol) {
  const response = await fetchWithTimeout(`${BINANCE_BASE}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`, {
    headers: { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" }
  });
  if (!response.ok) throw new Error(`Binance ${symbol} HTTP ${response.status}`);
  const payload = await response.json();
  return {
    price: Number(payload.lastPrice),
    changePercent: Number(payload.priceChangePercent),
    source: "Binance"
  };
}

async function fetchVniQuote() {
  const now = Math.floor(Date.now() / 1000) + 86400;
  const from = now - 86400 * 14;
  const headers = {
    accept: "application/json, text/plain, */*",
    "content-type": "application/json",
    referer: "https://trading.vietcap.com.vn/",
    origin: "https://trading.vietcap.com.vn",
    "user-agent": "Mozilla/5.0"
  };
  const response = await fetchWithTimeout(`${VCI_TRADING_BASE}/chart/OHLCChart/gap`, {
    method: "POST",
    headers,
    body: JSON.stringify({ timeFrame: "ONE_DAY", symbols: ["VNINDEX"], from, to: now })
  });
  if (!response.ok) throw new Error(`VCI VNINDEX HTTP ${response.status}`);
  const chart = (await response.json())?.[0];
  const closes = (chart?.c || []).map(Number).filter(Number.isFinite);
  const price = closes[closes.length - 1];
  const previous = closes[closes.length - 2];
  if (!Number.isFinite(price)) throw new Error("VCI VNINDEX has no price");
  return quote(price, previous, { source: "Vietcap/VCI" });
}

async function fetchFedRate() {
  const response = await fetchWithTimeout(FRED_DFF_URL, {
    headers: { accept: "text/csv", "user-agent": "ai-trading-terminal/1.0" }
  });
  if (!response.ok) throw new Error(`FRED HTTP ${response.status}`);
  const rows = (await response.text()).trim().split(/\r?\n/).slice(1)
    .map((line) => Number(line.split(",")[1]))
    .filter(Number.isFinite);
  const price = rows[rows.length - 1];
  const previous = rows[rows.length - 2];
  if (!Number.isFinite(price)) throw new Error("FRED has no DFF value");
  const difference = Number.isFinite(previous) ? price - previous : 0;
  return {
    price,
    changePercent: difference === 0 ? 0 : null,
    changeText: difference === 0 ? "Không đổi" : `${difference > 0 ? "+" : ""}${difference.toFixed(2)} điểm`,
    direction: difference > 0 ? 1 : difference < 0 ? -1 : 0,
    source: "FRED DFF"
  };
}

async function fetchCryptoGlobal() {
  const headers = { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" };
  const [globalResponse, coinsResponse] = await Promise.all([
    fetchWithTimeout(`${COINGECKO_BASE}/global`, { headers }),
    fetchWithTimeout(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=24h`, { headers })
  ]);
  if (!globalResponse.ok || !coinsResponse.ok) {
    throw new Error(`CoinGecko HTTP ${globalResponse.status}/${coinsResponse.status}`);
  }
  const globalData = (await globalResponse.json())?.data || {};
  const bitcoin = (await coinsResponse.json())?.[0] || {};
  const totalMarketCap = Number(globalData?.total_market_cap?.usd);
  const totalChange = Number(globalData?.market_cap_change_percentage_24h_usd);
  const dominance = Number(globalData?.market_cap_percentage?.btc);
  const bitcoinMarketCapChange = Number(bitcoin?.market_cap_change_percentage_24h);
  let dominanceChange = null;
  if (Number.isFinite(dominance) && Number.isFinite(totalChange) && Number.isFinite(bitcoinMarketCapChange)) {
    const previousDominance = dominance * (1 + totalChange / 100) / (1 + bitcoinMarketCapChange / 100);
    dominanceChange = previousDominance ? ((dominance - previousDominance) / previousDominance) * 100 : null;
  }
  return {
    btcDominance: { price: dominance, changePercent: dominanceChange, source: "CoinGecko" },
    cryptoTotalMarketCap: { price: totalMarketCap, changePercent: totalChange, source: "CoinGecko" }
  };
}

async function fetchMarketOverview() {
  if (marketCache && Date.now() - marketCache.timestamp < CACHE_TTL_MS) return marketCache.payload;

  const yahooEntries = Object.entries(YAHOO_MARKETS);
  const tasks = [
    ...yahooEntries.map(([, symbol]) => fetchYahooQuote(symbol)),
    fetchFedRate(),
    fetchBinanceQuote("BTCUSDT"),
    fetchBinanceQuote("ETHUSDT"),
    fetchCryptoGlobal(),
    fetchVniQuote()
  ];
  const results = await Promise.allSettled(tasks);
  const items = {};
  yahooEntries.forEach(([key], index) => {
    items[key] = results[index].status === "fulfilled" ? results[index].value : null;
  });

  const offset = yahooEntries.length;
  items.fedRate = results[offset].status === "fulfilled" ? results[offset].value : null;
  items.bitcoin = results[offset + 1].status === "fulfilled" ? results[offset + 1].value : null;
  items.ethereum = results[offset + 2].status === "fulfilled" ? results[offset + 2].value : null;
  const globalResult = results[offset + 3].status === "fulfilled" ? results[offset + 3].value : {};
  items.btcDominance = globalResult.btcDominance || null;
  items.cryptoTotalMarketCap = globalResult.cryptoTotalMarketCap || null;
  items.vni = results[offset + 4].status === "fulfilled" ? results[offset + 4].value : null;

  const payload = {
    source: "Yahoo Finance, Binance, CoinGecko, Vietcap/VCI, FRED",
    updatedAt: new Date().toISOString(),
    items
  };
  marketCache = { timestamp: Date.now(), payload };
  return payload;
}

module.exports = { fetchMarketOverview };
