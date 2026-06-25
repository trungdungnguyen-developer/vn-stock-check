const API_BASE = "https://query1.finance.yahoo.com";
const VCI_TRADING_BASE = "https://trading.vietcap.com.vn/api";
const TRADINGVIEW_SCAN_BASE = "https://scanner.tradingview.com/vietnam/scan";

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

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return response(200, { ok: true });
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
