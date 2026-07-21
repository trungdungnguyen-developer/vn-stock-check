const API_BASE = "https://query1.finance.yahoo.com";
const VCI_TRADING_BASE = "https://trading.vietcap.com.vn/api";
const TRADINGVIEW_SCAN_BASE = "https://scanner.tradingview.com/vietnam/scan";
const BINANCE_BASE = "https://data-api.binance.vision/api/v3";
const OKX_BASE = "https://www.okx.com/api/v5";

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
  "2y": { timeFrame: "ONE_DAY", lookbackDays: 7300 },
  "5m": { timeFrame: "ONE_MINUTE", lookbackDays: 30 },
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
  "5m": { binanceInterval: "5m", okxBar: "5m", limit: 500 },
  "30m": { binanceInterval: "30m", okxBar: "30m", limit: 500 },
  "1h": { binanceInterval: "1h", okxBar: "1H", limit: 500 },
  "2h": { binanceInterval: "2h", okxBar: "2H", limit: 500 },
  "4h": { binanceInterval: "4h", okxBar: "4H", limit: 500 },
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

  const normalized = raw
    .replace("/USDT", "-USDT")
    .replace("USDT", "-USDT")
    .replace("/USD", "-USDT")
    .replace("-USD", "-USDT");

  if (CRYPTO_EXCHANGE_ALIASES[normalized]) return CRYPTO_EXCHANGE_ALIASES[normalized];
  if (/^[A-Z0-9]+-USDT$/.test(normalized)) return normalized;
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
    .filter((bar) => Number.isFinite(bar.timestamp) && Number.isFinite(bar.close));
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

async function fetchBinanceCrypto(symbol, range) {
  const pair = toCryptoPair(symbol);
  const config = CRYPTO_RANGE_CONFIG[range] || CRYPTO_RANGE_CONFIG["2y"];
  const binanceSymbol = pair.replace("-", "");
  const [tickerResponse, klinesResponse, bookResponse] = await Promise.all([
    fetch(`${BINANCE_BASE}/ticker/24hr?symbol=${encodeURIComponent(binanceSymbol)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    }),
    fetch(`${BINANCE_BASE}/klines?symbol=${encodeURIComponent(binanceSymbol)}&interval=${encodeURIComponent(config.binanceInterval)}&limit=${config.limit}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    }),
    fetch(`${BINANCE_BASE}/ticker/bookTicker?symbol=${encodeURIComponent(binanceSymbol)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    })
  ]);

  if (!tickerResponse.ok || !klinesResponse.ok) {
    throw new Error(`Binance HTTP ${tickerResponse.status}/${klinesResponse.status}`);
  }

  const ticker = await tickerResponse.json();
  const book = bookResponse.ok ? await bookResponse.json() : {};
  const bars = parseBinanceKlines(await klinesResponse.json());
  if (!bars.length) throw new Error("Binance không có dữ liệu nến");
  return makeCryptoPayload("Binance", pair, ticker, bars, book);
}

async function fetchOkxCrypto(symbol, range) {
  const pair = toCryptoPair(symbol);
  const config = CRYPTO_RANGE_CONFIG[range] || CRYPTO_RANGE_CONFIG["2y"];
  const [tickerResponse, candlesResponse] = await Promise.all([
    fetch(`${OKX_BASE}/market/ticker?instId=${encodeURIComponent(pair)}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    }),
    fetch(`${OKX_BASE}/market/candles?instId=${encodeURIComponent(pair)}&bar=${encodeURIComponent(config.okxBar)}&limit=${config.limit}`, {
      headers: { accept: "application/json", "user-agent": "stock-tracker-vietnam-crypto/1.0" }
    })
  ]);

  if (!tickerResponse.ok || !candlesResponse.ok) {
    throw new Error(`OKX HTTP ${tickerResponse.status}/${candlesResponse.status}`);
  }

  const tickerPayload = await tickerResponse.json();
  const candlesPayload = await candlesResponse.json();
  if (tickerPayload.code !== "0" || candlesPayload.code !== "0") {
    throw new Error(`OKX ${tickerPayload.msg || candlesPayload.msg || "không có dữ liệu"}`);
  }

  const ticker = tickerPayload.data?.[0] || {};
  const bars = parseOkxCandles(candlesPayload.data);
  if (!bars.length) throw new Error("OKX không có dữ liệu nến");
  return makeCryptoPayload("OKX", pair, ticker, bars);
}

async function fetchCrypto(symbol, range = "2y") {
  let binanceError = null;
  try {
    return await fetchBinanceCrypto(symbol, range);
  } catch (error) {
    binanceError = error;
  }

  try {
    return await fetchOkxCrypto(symbol, range);
  } catch (okxError) {
    throw new Error(`Binance: ${binanceError.message}; OKX: ${okxError.message}`);
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
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
