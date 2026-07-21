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

