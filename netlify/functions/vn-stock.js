const API_BASE = "https://query1.finance.yahoo.com";
const VCI_TRADING_BASE = "https://trading.vietcap.com.vn/api";
const TRADINGVIEW_SCAN_BASE = "https://scanner.tradingview.com/vietnam/scan";
const BINANCE_BASE = "https://data-api.binance.vision/api/v3";
const OKX_BASE = "https://www.okx.com/api/v5";
const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
const COINPAPRIKA_BASE = "https://api.coinpaprika.com/v1";
const CRYPTO_MARKET_CACHE = new Map();
const { fetchMarketOverview } = require("../../server/market-overview");

const ALLOWED_PREFIXES = [
  "/v8/finance/chart/"
];

const RSS_SOURCES = [
  { name: "CafeF", url: "https://cafef.vn/thi-truong-chung-khoan.rss" },
  { name: "VnExpress", url: "https://vnexpress.net/rss/kinh-doanh.rss" }
];

const FUNDAMENTAL_COLUMNS = [
  "name",
  "description",
  "exchange",
  "sector",
  "industry",
  "market_cap_basic",
  "price_earnings_ttm",
  "price_book_fq",
  "return_on_equity_fy",
  "earnings_per_share_basic_ttm",
  "beta_1_year"
];

const VCI_RANGE_CONFIG = {
  "max": { timeFrame: "ONE_DAY", lookbackDays: 18250 },
  "2y": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "1min": { timeFrame: "ONE_MINUTE", lookbackDays: 14 },
  "5m": { timeFrame: "ONE_MINUTE", lookbackDays: 30 },
  "15m": { timeFrame: "ONE_MINUTE", lookbackDays: 60 },
  "30m": { timeFrame: "ONE_MINUTE", lookbackDays: 120 },
  "1h": { timeFrame: "ONE_HOUR", lookbackDays: 365 },
  "2h": { timeFrame: "ONE_HOUR", lookbackDays: 500 },
  "4h": { timeFrame: "ONE_HOUR", lookbackDays: 730 },
  "1d": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "3d": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "5d": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "1w": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "1m": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "3m": { timeFrame: "ONE_DAY", lookbackDays: 7300 }
};

const CRYPTO_RANGE_CONFIG = {
  "max": { binanceInterval: "1d", okxBar: "1D", limit: 1000, fullHistory: true },
  "1min": { binanceInterval: "1m", okxBar: "1m", limit: 500 },
  "3min": { binanceInterval: "3m", okxBar: "3m", limit: 500 },
  "5m": { binanceInterval: "5m", okxBar: "5m", limit: 500 },
  "15m": { binanceInterval: "15m", okxBar: "15m", limit: 500 },
  "30m": { binanceInterval: "30m", okxBar: "30m", limit: 500 },
  "45min": { binanceInterval: "15m", okxBar: "15m", limit: 500 },
  "1h": { binanceInterval: "1h", okxBar: "1H", limit: 500 },
  "2h": { binanceInterval: "2h", okxBar: "2H", limit: 500 },
  "3h": { binanceInterval: "1h", okxBar: "1H", limit: 500 },
  "4h": { binanceInterval: "4h", okxBar: "4H", limit: 500 },
  "6h": { binanceInterval: "6h", okxBar: "6H", limit: 500 },
  "8h": { binanceInterval: "4h", okxBar: "4H", limit: 500 },
  "12h": { binanceInterval: "12h", okxBar: "12H", limit: 500 },
  "1d": { binanceInterval: "1d", okxBar: "1D", limit: 730 },
  "2y": { binanceInterval: "1d", okxBar: "1D", limit: 730 },
  "3d": { binanceInterval: "3d", okxBar: "3D", limit: 500 },
  "5d": { binanceInterval: "1d", okxBar: "1D", limit: 730 },
  "1w": { binanceInterval: "1w", okxBar: "1W", limit: 500 },
  "1m": { binanceInterval: "1M", okxBar: "1M", limit: 500 },
  "3m": { binanceInterval: "1M", okxBar: "1M", limit: 500 }
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

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=20"
    },
    body: JSON.stringify(body)
  };
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function stripHtml(value) {
  return decodeXml(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(item, tag) {
  const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function getAttribute(tagText, attribute) {
  const match = String(tagText || "").match(new RegExp(`${attribute}=["']([^"']+)["']`, "i"));
  return match ? decodeXml(match[1]).trim() : "";
}

function getThumbnail(item) {
  const mediaMatch = item.match(/<media:(?:content|thumbnail)\b[^>]*>/i);
  if (mediaMatch) {
    const url = getAttribute(mediaMatch[0], "url");
    if (url) return url;
  }

  const enclosureMatch = item.match(/<enclosure\b[^>]*>/i);
  if (enclosureMatch) {
    const url = getAttribute(enclosureMatch[0], "url");
    if (url) return url;
  }

  const description = getTag(item, "description");
  const imageMatch = description.match(/<img\b[^>]*>/i);
  return imageMatch ? getAttribute(imageMatch[0], "src") : "";
}

function parseRss(xml, sourceName) {
  return [...String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    .map((match) => {
      const item = match[0];
      return {
        source: sourceName,
        title: stripHtml(getTag(item, "title")),
        link: stripHtml(getTag(item, "link")),
        pubDate: stripHtml(getTag(item, "pubDate")),
        description: stripHtml(getTag(item, "description")),
        thumbnail: getThumbnail(item)
      };
    })
    .filter((item) => item.title && item.link);
}

async function fetchNews() {
  const responses = await Promise.allSettled(RSS_SOURCES.map(async (source) => {
    const upstream = await fetch(source.url, {
      headers: {
        accept: "application/rss+xml,text/xml,*/*",
        "user-agent": "stock-tracker-vietnam-news/1.0"
      }
    });
    if (!upstream.ok) throw new Error(`${source.name} HTTP ${upstream.status}`);
    const xml = await upstream.text();
    return parseRss(xml, source.name);
  }));

  const items = responses
    .flatMap((result) => result.status === "fulfilled" ? result.value : [])
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
    .slice(0, 40);

  return {
    source: RSS_SOURCES.map((item) => item.name).join(", "),
    updatedAt: new Date().toISOString(),
    items
  };
}

async function fetchFundamentals(symbol) {
  const normalized = String(symbol || "").toUpperCase();
  if (!/^[A-Z0-9]{2,12}$/.test(normalized)) {
    throw new Error("Missing or invalid symbol");
  }

  const tickers = ["HOSE", "HNX", "UPCOM"].map((exchange) => `${exchange}:${normalized}`);
  const upstream = await fetch(TRADINGVIEW_SCAN_BASE, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: "https://www.tradingview.com",
      referer: "https://www.tradingview.com/",
      "user-agent": "Mozilla/5.0"
    },
    body: JSON.stringify({
      symbols: { tickers, query: { types: [] } },
      columns: FUNDAMENTAL_COLUMNS
    })
  });

  if (!upstream.ok) {
    throw new Error(`TradingView HTTP ${upstream.status}`);
  }

  const payload = await upstream.json();
  const row = Array.isArray(payload.data) ? payload.data[0] : null;
  if (!row) {
    return { source: "TradingView", symbol: normalized, found: false, overview: null };
  }

  const values = {};
  FUNDAMENTAL_COLUMNS.forEach((column, index) => {
    values[column] = row.d?.[index] ?? null;
  });

  return {
    source: "TradingView Scanner",
    symbol: normalized,
    resolvedSymbol: row.s,
    found: true,
    overview: {
      ticker: values.name || normalized,
      name: values.description || values.name || normalized,
      exchange: values.exchange || String(row.s || "").split(":")[0],
      industry: values.industry,
      sector: values.sector,
      marketCap: values.market_cap_basic,
      pe: values.price_earnings_ttm,
      pb: values.price_book_fq,
      roe: values.return_on_equity_fy,
      eps: values.earnings_per_share_basic_ttm,
      beta: values.beta_1_year
    },
    raw: values
  };
}

function normalizeCryptoInput(symbol) {
  return String(symbol || "").toUpperCase().trim().replace(/\s+/g, "");
}

function toCryptoPair(symbol) {
  const raw = normalizeCryptoInput(symbol);
  if (CRYPTO_EXCHANGE_ALIASES[raw]) return CRYPTO_EXCHANGE_ALIASES[raw];
  if (/^[A-Z0-9]+-USDT(-SWAP)?$/.test(raw)) return raw;

  const normalized = raw
    .replace("/USDT", "-USDT")
    .replace("USDT", "-USDT")
    .replace("/USD", "-USDT")
    .replace("-USD", "-USDT");

  if (CRYPTO_EXCHANGE_ALIASES[normalized]) return CRYPTO_EXCHANGE_ALIASES[normalized];
  if (/^[A-Z0-9]+-USDT(-SWAP)?$/.test(normalized)) return normalized;
  if (/^[A-Z0-9]{2,20}$/.test(normalized)) return `${normalized}-USDT`;
  throw new Error("Missing or invalid crypto symbol");
}

function parseBinanceKlines(klines) {
  return (Array.isArray(klines) ? klines : [])
    .map((item) => ({
      timestamp: Number(item[0]),
      time: new Date(Number(item[0])).toLocaleDateString("vi-VN"),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5])
    }))
    .filter((bar) => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function parseOkxCandles(candles) {
  return (Array.isArray(candles) ? candles : [])
    .map((item) => ({
      timestamp: Number(item[0]),
      time: new Date(Number(item[0])).toLocaleDateString("vi-VN"),
      open: Number(item[1]),
      high: Number(item[2]),
      low: Number(item[3]),
      close: Number(item[4]),
      volume: Number(item[5])
    }))
    .filter((bar) => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function makeCryptoPayload(source, pair, ticker, bars, book = {}) {
  const latestBar = bars[bars.length - 1] || {};
  const price = Number(ticker.last ?? ticker.lastPrice ?? latestBar.close);
  const referencePrice = Number(ticker.open24h ?? ticker.openPrice ?? bars[bars.length - 2]?.close);
  const change = Number.isFinite(price) && Number.isFinite(referencePrice) ? price - referencePrice : null;
  const changePercent = change !== null && referencePrice ? (change / referencePrice) * 100 : null;
  const bidPrice = Number(ticker.bidPx ?? book.bidPrice);
  const askPrice = Number(ticker.askPx ?? book.askPrice);
  const spreadPercent = Number.isFinite(bidPrice) && Number.isFinite(askPrice) && price
    ? ((askPrice - bidPrice) / price) * 100
    : null;
  const quoteVolume = Number(ticker.quoteVolume ?? ticker.volCcy24h);

  return {
    source,
    symbol: pair.replace("-USDT", ""),
    resolvedSymbol: pair,
    quote: {
      ticker: pair,
      exchange: source,
      price,
      referencePrice,
      ceilingPrice: null,
      floorPrice: null,
      highPrice: Number(ticker.high24h ?? ticker.highPrice ?? latestBar.high),
      lowPrice: Number(ticker.low24h ?? ticker.lowPrice ?? latestBar.low),
      volume: Number(ticker.vol24h ?? ticker.volume ?? latestBar.volume),
      quoteVolume: Number.isFinite(quoteVolume) ? quoteVolume : Number(ticker.vol24h ?? ticker.volume ?? latestBar.volume) * price,
      bidPrice: Number.isFinite(bidPrice) ? bidPrice : null,
      askPrice: Number.isFinite(askPrice) ? askPrice : null,
      spreadPercent,
      change,
      changePercent
    },
    overview: {
      ticker: pair,
      name: `${pair.replace("-USDT", "")} / USDT`,
      exchange: source,
      industry: "Tiền mã hóa",
      sector: "Crypto",
      description: `Dữ liệu coin lấy từ ${source} cho cặp ${pair}. Tiền tệ: USDT.`,
      marketCap: null,
      pe: null,
      pb: null,
      roe: null,
      eps: null,
      beta: null,
      currency: "USDT",
      assetType: "crypto"
    },
    bars
  };
}

async function fetchBinanceKlineHistory(symbol, config) {
  const headers = { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" };
  if (!config.fullHistory) {
    const response = await fetch(`${BINANCE_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(config.binanceInterval)}&limit=${config.limit}`, { headers });
    if (!response.ok) throw new Error(`Binance klines HTTP ${response.status}`);
    return response.json();
  }

  const all = [];
  let endTime = Date.now() + 86400000;
  for (let page = 0; page < 30; page += 1) {
    const response = await fetch(`${BINANCE_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(config.binanceInterval)}&limit=1000&endTime=${endTime}`, { headers });
    if (!response.ok) throw new Error(`Binance history HTTP ${response.status}`);
    const batch = await response.json();
    if (!Array.isArray(batch) || !batch.length) break;
    all.push(...batch);
    const oldest = Number(batch[0]?.[0]);
    if (batch.length < 1000 || !Number.isFinite(oldest)) break;
    endTime = oldest - 1;
  }
  return [...new Map(all.map((item) => [Number(item[0]), item])).values()];
}

async function fetchOkxCandleHistory(pair, config) {
  const headers = { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" };
  if (!config.fullHistory) {
    const response = await fetch(`${OKX_BASE}/market/candles?instId=${encodeURIComponent(pair)}&bar=${encodeURIComponent(config.okxBar)}&limit=${config.limit}`, { headers });
    if (!response.ok) throw new Error(`OKX candles HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.code !== "0") throw new Error(`OKX ${payload.msg || "không có dữ liệu"}`);
    return payload.data || [];
  }

  const all = [];
  let after = "";
  for (let page = 0; page < 40; page += 1) {
    const cursor = after ? `&after=${encodeURIComponent(after)}` : "";
    const response = await fetch(`${OKX_BASE}/market/history-candles?instId=${encodeURIComponent(pair)}&bar=${encodeURIComponent(config.okxBar)}&limit=300${cursor}`, { headers });
    if (!response.ok) throw new Error(`OKX history HTTP ${response.status}`);
    const payload = await response.json();
    if (payload.code !== "0") throw new Error(`OKX ${payload.msg || "không có dữ liệu"}`);
    const batch = payload.data || [];
    if (!batch.length) break;
    all.push(...batch);
    const oldest = Math.min(...batch.map((item) => Number(item[0])).filter(Number.isFinite));
    if (batch.length < 300 || !Number.isFinite(oldest) || String(oldest) === after) break;
    after = String(oldest);
  }
  return [...new Map(all.map((item) => [Number(item[0]), item])).values()];
}

async function fetchBinanceCrypto(symbol, range) {
  const pair = toCryptoPair(symbol);
  const config = CRYPTO_RANGE_CONFIG[range] || CRYPTO_RANGE_CONFIG["2y"];
  const binanceSymbol = pair.replace("-", "");
  const [tickerResponse, rawKlines, bookResponse] = await Promise.all([
    fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    }),
    fetchBinanceKlineHistory(binanceSymbol, config),
    fetch(`${BINANCE_BASE}/ticker/bookTicker?symbol=${encodeURIComponent(binanceSymbol)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    })
  ]);

  if (!tickerResponse.ok) {
    throw new Error(`Binance HTTP ${tickerResponse.status}`);
  }

  const ticker = await tickerResponse.json();
  const book = bookResponse.ok ? await bookResponse.json() : {};
  const bars = parseBinanceKlines(rawKlines);
  if (!bars.length) throw new Error("Binance không có dữ liệu nến");
  return makeCryptoPayload("Binance", pair, ticker, bars, book);
}

async function fetchOkxCrypto(symbol, range) {
  const pair = toCryptoPair(symbol);
  const config = CRYPTO_RANGE_CONFIG[range] || CRYPTO_RANGE_CONFIG["2y"];
  const [tickerResponse, rawCandles] = await Promise.all([
    fetch(`${OKX_BASE}/market/ticker?instId=${encodeURIComponent(pair)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    }),
    fetchOkxCandleHistory(pair, config)
  ]);

  if (!tickerResponse.ok) {
    throw new Error(`OKX HTTP ${tickerResponse.status}`);
  }

  const tickerPayload = await tickerResponse.json();
  if (tickerPayload.code !== "0") {
    throw new Error(`OKX ${tickerPayload.msg || "không có dữ liệu"}`);
  }

  const ticker = tickerPayload.data?.[0] || {};
  const bars = parseOkxCandles(rawCandles);
  if (!bars.length) throw new Error("OKX không có dữ liệu nến");
  return makeCryptoPayload("OKX", pair, ticker, bars);
}

async function enrichCryptoMarketCap(payload, symbol) {
  const token = toCryptoPair(symbol).replace("-SWAP", "").split("-")[0].toLowerCase();
  const cached = CRYPTO_MARKET_CACHE.get(token);
  if (cached && Date.now() - cached.cachedAt < 10 * 60 * 1000) {
    payload.overview.marketCap = cached.marketCap;
    payload.overview.marketCapSource = cached.source || "CoinGecko";
    return payload;
  }

  try {
    const response = await fetch(`${COINGECKO_BASE}/coins/markets?vs_currency=usd&symbols=${encodeURIComponent(token)}&order=market_cap_desc&per_page=10&page=1&sparkline=false`, {
      headers: { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" }
    });
    if (response.ok) {
      const markets = await response.json();
      const match = (Array.isArray(markets) ? markets : [])
        .filter((item) => String(item.symbol || "").toLowerCase() === token && Number.isFinite(Number(item.market_cap)))
        .sort((a, b) => Number(b.market_cap) - Number(a.market_cap))[0];
      if (match) {
        payload.overview.marketCap = Number(match.market_cap);
        payload.overview.marketCapSource = "CoinGecko";
      }
    }
  } catch {
    // Continue with the fallback source below.
  }

  if (!(Number.isFinite(Number(payload.overview.marketCap)) && Number(payload.overview.marketCap) > 0)) {
    try {
      const searchResponse = await fetch(`${COINPAPRIKA_BASE}/search?q=${encodeURIComponent(token)}&c=currencies&limit=20`, {
        headers: { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" }
      });
      if (searchResponse.ok) {
        const search = await searchResponse.json();
        const match = (Array.isArray(search.currencies) ? search.currencies : [])
          .filter((item) => String(item.symbol || "").toLowerCase() === token && item.is_active !== false)
          .sort((a, b) => Number(a.rank || Number.MAX_SAFE_INTEGER) - Number(b.rank || Number.MAX_SAFE_INTEGER))[0];
        if (match?.id) {
          const tickerResponse = await fetch(`${COINPAPRIKA_BASE}/tickers/${encodeURIComponent(match.id)}`, {
            headers: { accept: "application/json", "user-agent": "ai-trading-terminal/1.0" }
          });
          if (tickerResponse.ok) {
            const ticker = await tickerResponse.json();
            const marketCap = Number(ticker.quotes?.USD?.market_cap);
            if (Number.isFinite(marketCap) && marketCap > 0) {
              payload.overview.marketCap = marketCap;
              payload.overview.marketCapSource = "CoinPaprika";
            }
          }
        }
      }
    } catch {
      // Price and chart data remain usable if both optional market-cap sources fail.
    }
  }

  if (Number.isFinite(Number(payload.overview.marketCap)) && Number(payload.overview.marketCap) > 0) {
    CRYPTO_MARKET_CACHE.set(token, {
      marketCap: Number(payload.overview.marketCap),
      source: payload.overview.marketCapSource,
      cachedAt: Date.now()
    });
  }
  return payload;
}

async function fetchCrypto(symbol, range = "2y") {
  const pair = toCryptoPair(symbol);
  if (pair.endsWith("-SWAP")) {
    return enrichCryptoMarketCap(await fetchOkxCrypto(pair, range), symbol);
  }

  let binanceError = null;
  try {
    return enrichCryptoMarketCap(await fetchBinanceCrypto(symbol, range), symbol);
  } catch (error) {
    binanceError = error;
  }

  try {
    return enrichCryptoMarketCap(await fetchOkxCrypto(symbol, range), symbol);
  } catch (okxError) {
    throw new Error(`Binance: ${binanceError.message}; OKX: ${okxError.message}`);
  }
}

async function fetchOkxUniverse(instType = "SPOT") {
  const safeType = String(instType || "SPOT").toUpperCase() === "SWAP" ? "SWAP" : "SPOT";
  const upstream = await fetch(`${OKX_BASE}/market/tickers?instType=${encodeURIComponent(safeType)}`, {
    headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
  });
  if (!upstream.ok) throw new Error(`OKX tickers HTTP ${upstream.status}`);

  const payload = await upstream.json();
  if (payload.code !== "0") throw new Error(`OKX ${payload.msg || "khong co du lieu"}`);

  const items = (payload.data || [])
    .filter((item) => /-USDT(-SWAP)?$/.test(String(item.instId || "")))
    .map((item) => {
      const last = Number(item.last);
      const open24h = Number(item.open24h);
      const volume = Number(item.vol24h);
      const quoteVolumeRaw = Number(item.volCcy24h);
      const quoteVolume = Number.isFinite(quoteVolumeRaw) ? quoteVolumeRaw : volume * last;
      const bid = Number(item.bidPx);
      const ask = Number(item.askPx);
      const spreadPercent = Number.isFinite(bid) && Number.isFinite(ask) && last ? ((ask - bid) / last) * 100 : null;
      return {
        instId: item.instId,
        symbol: String(item.instId).replace("-USDT-SWAP", "").replace("-USDT", ""),
        last,
        open24h,
        changePercent: Number.isFinite(last) && Number.isFinite(open24h) && open24h ? ((last - open24h) / open24h) * 100 : null,
        volume,
        quoteVolume,
        spreadPercent
      };
    })
    .filter((item) => item.symbol && Number.isFinite(item.last));

  return { source: "OKX", instType: safeType, updatedAt: new Date().toISOString(), items };
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "market-overview") {
    try {
      return response(200, await fetchMarketOverview());
    } catch (error) {
      return response(502, { error: "Market overview request failed", details: error.message });
    }
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "okx-universe") {
    try {
      return response(200, await fetchOkxUniverse(event.queryStringParameters.instType || "SPOT"));
    } catch (error) {
      return response(502, { error: "OKX universe request failed", details: error.message });
    }
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "crypto") {
    try {
      return response(200, await fetchCrypto(event.queryStringParameters.symbol, event.queryStringParameters.range || "2y"));
    } catch (error) {
      return response(502, { error: "Crypto request failed", details: error.message });
    }
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "fundamentals") {
    try {
      return response(200, await fetchFundamentals(event.queryStringParameters.symbol));
    } catch (error) {
      return response(502, { error: "Fundamentals request failed", details: error.message });
    }
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "news") {
    try {
      return response(200, await fetchNews());
    } catch (error) {
      return response(502, { error: "News request failed", details: error.message });
    }
  }

  if (event.queryStringParameters && event.queryStringParameters.source === "vci") {
    const symbol = String(event.queryStringParameters.symbol || "").toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(symbol)) {
      return response(400, { error: "Missing or invalid symbol" });
    }

    const range = event.queryStringParameters.range || "2y";
    const rangeConfig = VCI_RANGE_CONFIG[range] || VCI_RANGE_CONFIG["2y"];
    const now = Math.floor(Date.now() / 1000) + 86400;
    const from = now - 86400 * rangeConfig.lookbackDays;
    const headers = {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json",
      referer: "https://trading.vietcap.com.vn/",
      origin: "https://trading.vietcap.com.vn",
      "user-agent": "Mozilla/5.0"
    };

    try {
      const [chartResponse, boardResponse] = await Promise.all([
        fetch(`${VCI_TRADING_BASE}/chart/OHLCChart/gap`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            timeFrame: rangeConfig.timeFrame,
            symbols: [symbol],
            from,
            to: now
          })
        }),
        fetch(`${VCI_TRADING_BASE}/price/symbols/getList`, {
          method: "POST",
          headers,
          body: JSON.stringify({ symbols: [symbol] })
        })
      ]);

      const chart = await chartResponse.json();
      const board = await boardResponse.json();
      return response(chartResponse.ok && boardResponse.ok ? 200 : 502, {
        source: "VCI",
        symbol,
        range,
        timeFrame: rangeConfig.timeFrame,
        chart,
        board
      });
    } catch (error) {
      return response(502, { error: "VCI request failed", details: error.message });
    }
  }

  const path = event.queryStringParameters && event.queryStringParameters.path;

  if (!path || !path.startsWith("/")) {
    return response(400, { error: "Missing or invalid path" });
  }

  if (!ALLOWED_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    return response(403, { error: "Path is not allowed" });
  }

  try {
    const upstream = await fetch(`${API_BASE}${path}`, {
      headers: {
        accept: "application/json",
        "user-agent": "stock-tracker-vietnam/1.0"
      }
    });

    const text = await upstream.text();

    return {
      statusCode: upstream.status,
      headers: {
        "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
        "access-control-allow-origin": "*",
        "cache-control": "public, max-age=20"
      },
      body: text
    };
  } catch (error) {
    return response(502, {
      error: "Upstream request failed",
      details: error.message
    });
  }
};
