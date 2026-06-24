const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 8787;
const API_BASE = "https://query1.finance.yahoo.com";
const VCI_TRADING_BASE = "https://trading.vietcap.com.vn/api";
const TRADINGVIEW_SCAN_BASE = "https://scanner.tradingview.com/vietnam/scan";
const ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

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

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*"
  });
  res.end(JSON.stringify(body));
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

function parseRss(xml, sourceName) {
  return [...String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi)]
    .map((match) => {
      const item = match[0];
      return {
        source: sourceName,
        title: stripHtml(getTag(item, "title")),
        link: stripHtml(getTag(item, "link")),
        pubDate: stripHtml(getTag(item, "pubDate")),
        description: stripHtml(getTag(item, "description"))
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

async function handleProxy(req, res, url) {
  if (url.searchParams.get("source") === "fundamentals") {
    try {
      sendJson(res, 200, await fetchFundamentals(url.searchParams.get("symbol")));
    } catch (error) {
      sendJson(res, 502, { error: "Fundamentals request failed", details: error.message });
    }
    return;
  }

  if (url.searchParams.get("source") === "news") {
    try {
      sendJson(res, 200, await fetchNews());
    } catch (error) {
      sendJson(res, 502, { error: "News request failed", details: error.message });
    }
    return;
  }

  if (url.searchParams.get("source") === "vci") {
    const symbol = (url.searchParams.get("symbol") || "").toUpperCase();
    if (!/^[A-Z0-9]{2,12}$/.test(symbol)) {
      sendJson(res, 400, { error: "Missing or invalid symbol" });
      return;
    }

    const range = url.searchParams.get("range") || "2y";
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
      sendJson(res, chartResponse.ok && boardResponse.ok ? 200 : 502, {
        source: "VCI",
        symbol,
        range,
        timeFrame: rangeConfig.timeFrame,
        chart,
        board
      });
    } catch (error) {
      sendJson(res, 502, { error: "VCI request failed", details: error.message });
    }
    return;
  }

  const apiPath = url.searchParams.get("path");

  if (!apiPath || !apiPath.startsWith("/")) {
    sendJson(res, 400, { error: "Missing or invalid path" });
    return;
  }

  if (!ALLOWED_PREFIXES.some((prefix) => apiPath.startsWith(prefix))) {
    sendJson(res, 403, { error: "Path is not allowed" });
    return;
  }

  try {
    const upstream = await fetch(`${API_BASE}${apiPath}`, {
      headers: {
        accept: "application/json",
        "user-agent": "stock-tracker-vietnam-local/1.0"
      }
    });
    const text = await upstream.text();
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
      "access-control-allow-origin": "*"
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, {
      error: "Upstream request failed",
      details: error.message
    });
  }
}

function handleStatic(req, res, url) {
  const requestedPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === "/.netlify/functions/vn-stock") {
    handleProxy(req, res, url);
    return;
  }

  handleStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`Stock tracker dang chay tai http://localhost:${PORT}`);
});
