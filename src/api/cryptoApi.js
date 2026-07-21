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

async function requestOkxUniverseData(instType = "SPOT") {
  if (location.protocol === "file:") {
    throw new Error("Đang mở bằng file:// nên không có proxy dữ liệu. Hãy chạy local-server.js rồi mở http://localhost:8787.");
  }

  const response = await fetch(`${PROXY_BASE}?source=okx-universe&instType=${encodeURIComponent(instType)}`, {
    headers: { accept: "application/json" }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.details || payload.error || `Không tải được danh sách OKX. HTTP ${response.status}`);
  }
  return payload;
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
  try {
    const raw = await requestCryptoData(symbol, "1d");
    if (!raw?.quote) throw new Error(`Không có dữ liệu ${symbol}`);
    return raw.quote;
  } catch (error) {
    const yahooSymbol = toYahooCryptoSymbol(symbol);
    if (!yahooSymbol) throw error;
    return requestYahooQuote(yahooSymbol);
  }
}

function formatMarketValue(value, digits = 2) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

