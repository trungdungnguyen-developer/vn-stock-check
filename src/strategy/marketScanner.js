const SCANNER_CACHE_TTL_MS = 120000;
const SCANNER_UNIVERSE_CACHE_TTL_MS = 60000;
const SCANNER_TIMEOUT_MS = 15000;
const SCANNER_RETRIES = 1;
const scannerRequestCache = new Map();

function scannerDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function scannerWithTimeout(promise, label, timeoutMs = SCANNER_TIMEOUT_MS) {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`${label} quá thời gian tải dữ liệu.`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
}

async function scannerRetry(factory, label, retries = SCANNER_RETRIES, timeoutMs = SCANNER_TIMEOUT_MS) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await scannerWithTimeout(factory(), label, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await scannerDelay(250 * (attempt + 1));
    }
  }
  throw lastError;
}

function scannerCachedRequest(key, factory, options = {}) {
  const now = Date.now();
  const ttl = options.ttl ?? SCANNER_CACHE_TTL_MS;
  const cached = scannerRequestCache.get(key);
  if (cached && now - cached.createdAt < ttl) return cached.promise;

  const promise = scannerRetry(factory, key, options.retries ?? SCANNER_RETRIES, options.timeoutMs ?? SCANNER_TIMEOUT_MS)
    .catch((error) => {
      scannerRequestCache.delete(key);
      throw error;
    });
  scannerRequestCache.set(key, { createdAt: now, promise });
  return promise;
}

function scannerCryptoData(symbol, range = "2y") {
  return scannerCachedRequest(`crypto:${symbol}:${range}`, () => requestCryptoData(symbol, range));
}

function scannerStockData(symbol, range = "2y") {
  return scannerCachedRequest(`stock:${symbol}:${range}`, () => requestVciData(symbol, range));
}

function scannerOkxUniverseData(instType = "SPOT") {
  return scannerCachedRequest(
    `okx-universe:${instType}`,
    () => requestOkxUniverseData(instType),
    { ttl: SCANNER_UNIVERSE_CACHE_TTL_MS, timeoutMs: 12000 }
  );
}

async function scannerRunWithConcurrency(items, limit, worker, onProgress) {
  const results = [];
  let index = 0;
  let completed = 0;
  async function next() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    try {
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    } catch (error) {
      results[currentIndex] = { error, item: items[currentIndex] };
    } finally {
      completed += 1;
      if (onProgress) onProgress(completed, items.length);
    }
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}
async function loadScannerCandidate(symbol, type, baseDailyBars) {
  if (type === "crypto") {
    const [daily, fourHour, oneHour, thirtyMinute, fifteenMinute, fiveMinute] = await Promise.all([
      scannerCryptoData(symbol, "2y"),
      scannerCryptoData(symbol, "4h"),
      scannerCryptoData(symbol, "1h"),
      scannerCryptoData(symbol, "30m"),
      scannerCryptoData(symbol, "15m"),
      scannerCryptoData(symbol, "5m")
    ]);
    const candidate = analyzeScannerCandidate({
      symbol,
      type,
      source: daily.source,
      quote: daily.quote,
      dailyBars: daily.bars,
      fourHourBars: fourHour.bars,
      baseDailyBars
    });
    if (fourHour?.bars?.length >= 80 && oneHour?.bars?.length >= 80 && thirtyMinute?.bars?.length >= 50) {
      candidate.tradeAnalysis = buildTradeAnalysisForCoin(symbol, daily.quote, fourHour.bars, oneHour.bars, thirtyMinute.bars);
      if (fifteenMinute?.bars?.length >= 40 && fiveMinute?.bars?.length >= 40) {
        candidate.entryConfirmation = buildEntryConfirmationForCoin(fifteenMinute.bars, fiveMinute.bars);
        candidate.riskManagement = buildRiskManagementForCoin(candidate.tradeAnalysis, candidate.entryConfirmation);
        candidate.tradeAnalysis.finalAllowed = candidate.tradeAnalysis.allowed && candidate.entryConfirmation.confirmed && candidate.riskManagement.approved;
        candidate.tradeAnalysis.summary = candidate.tradeAnalysis.finalAllowed
          ? "Được phép tìm Entry"
          : candidate.tradeAnalysis.allowed
            ? "Chờ xác nhận entry/risk trước khi giao dịch"
            : candidate.tradeAnalysis.summary;
      }
    }
    return candidate;
  }

  const [dailyRaw, fourHourRaw] = await Promise.allSettled([
    scannerStockData(symbol, "2y"),
    scannerStockData(symbol, "4h")
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

const scannerTableState = {
  sort: "rank",
  direction: "asc",
  type: "all",
  signal: "all",
  query: ""
};

function getScannerDisplayItems(results) {
  const byScore = [...results].sort((a, b) => b.score - a.score);
  const display = byScore.filter((item) => item.score >= 50).slice(0, 20);
  return display.length ? display : byScore.slice(0, 10);
}

function getScannerSignal(item) {
  const trendPositive = item.trend?.className === "positive";
  const trendWeak = item.trend?.className === "negative";
  const volumeStrong = item.volumeRatio !== null && item.volumeRatio >= 1.5;
  if (item.score >= 75 && trendPositive && volumeStrong) {
    return { text: "Strong", className: "positive" };
  }
  if (item.score >= 60 && !trendWeak) {
    return { text: "Watch", className: "neutral" };
  }
  return { text: "Skip", className: "negative" };
}

function getScannerSortValue(item, index, key) {
  const signalRank = { Strong: 3, Watch: 2, Skip: 1 };
  switch (key) {
    case "rank": return index;
    case "coin": return item.symbol || "";
    case "price": return toNumber(item.price) ?? -Infinity;
    case "change24h": return toNumber(item.change24h) ?? -Infinity;
    case "volume": return toNumber(item.liquidity?.value) ?? -Infinity;
    case "score": return toNumber(item.score) ?? -Infinity;
    case "trend": return item.trend?.text || "";
    case "signal": return signalRank[getScannerSignal(item).text] || 0;
    default: return index;
  }
}

function getFilteredScannerItems(items) {
  const query = scannerTableState.query.trim().toUpperCase();
  const filtered = items.filter((item) => {
    const signal = getScannerSignal(item);
    const typePass = scannerTableState.type === "all" || item.type === scannerTableState.type;
    const signalPass = scannerTableState.signal === "all" || signal.text === scannerTableState.signal;
    const queryPass = !query || String(item.symbol || "").toUpperCase().includes(query);
    return typePass && signalPass && queryPass;
  });
  return filtered.sort((a, b) => {
    const valueA = getScannerSortValue(a, items.indexOf(a), scannerTableState.sort);
    const valueB = getScannerSortValue(b, items.indexOf(b), scannerTableState.sort);
    const compare = typeof valueA === "string" || typeof valueB === "string"
      ? String(valueA).localeCompare(String(valueB))
      : valueA - valueB;
    return scannerTableState.direction === "asc" ? compare : -compare;
  });
}

function renderScannerTableRows(items) {
  if (!items.length) {
    return `
      <tr>
        <td colspan="8" class="scanner-empty-row">Không có mã phù hợp với bộ lọc hiện tại.</td>
      </tr>
    `;
  }
  return items.map((item, index) => {
    const signal = getScannerSignal(item);
    const changeClass = valueClass(item.change24h);
    const volumeUnit = item.type === "crypto" ? "USD" : "VND";
    return `
      <tr>
        <td><span class="scanner-rank">#${index + 1}</span></td>
        <td>
          <button type="button" class="scanner-coin-button" data-symbol="${escapeHtml(item.symbol)}">
            <strong>${escapeHtml(item.symbol)}</strong>
            <em>${item.type === "crypto" ? "Coin" : "CK Việt Nam"} · ${escapeHtml(item.source || "-")}</em>
          </button>
        </td>
        <td>${formatOptional(item.price, item.type === "crypto" ? 4 : 2)}</td>
        <td class="${changeClass}">${formatPercent(item.change24h)}</td>
        <td>${formatLargeNumber(item.liquidity.value)} ${volumeUnit}</td>
        <td><strong class="${item.score >= 70 ? "positive" : item.score >= 55 ? "neutral" : "negative"}">${item.score}</strong></td>
        <td><span class="scanner-pill ${item.trend.className}">${escapeHtml(item.trend.text)}</span></td>
        <td><span class="scanner-pill ${signal.className}">${signal.text}</span></td>
      </tr>
    `;
  }).join("");
}

function updateScannerTable(root, items) {
  const tbody = root.querySelector("[data-scanner-table-body]");
  const count = root.querySelector("[data-scanner-count]");
  const filtered = getFilteredScannerItems(items);
  if (tbody) tbody.innerHTML = renderScannerTableRows(filtered);
  if (count) count.textContent = `${filtered.length}/${items.length} hiển thị`;
  root.querySelectorAll("[data-sort]").forEach((button) => {
    button.classList.toggle("active", button.dataset.sort === scannerTableState.sort);
    button.dataset.direction = button.dataset.sort === scannerTableState.sort ? scannerTableState.direction : "";
  });
}

function bindScannerTable(root, items) {
  root.querySelector("[data-scanner-filter='query']")?.addEventListener("input", (event) => {
    scannerTableState.query = event.target.value || "";
    updateScannerTable(root, items);
  });
  root.querySelector("[data-scanner-filter='type']")?.addEventListener("change", (event) => {
    scannerTableState.type = event.target.value || "all";
    updateScannerTable(root, items);
  });
  root.querySelector("[data-scanner-filter='signal']")?.addEventListener("change", (event) => {
    scannerTableState.signal = event.target.value || "all";
    updateScannerTable(root, items);
  });
  root.querySelectorAll("[data-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      if (scannerTableState.sort === button.dataset.sort) {
        scannerTableState.direction = scannerTableState.direction === "asc" ? "desc" : "asc";
      } else {
        scannerTableState.sort = button.dataset.sort;
        scannerTableState.direction = ["rank", "coin", "trend", "signal"].includes(button.dataset.sort) ? "asc" : "desc";
      }
      updateScannerTable(root, items);
    });
  });
  root.querySelector("[data-scanner-table-body]")?.addEventListener("click", (event) => {
    const button = event.target.closest(".scanner-coin-button[data-symbol]");
    if (!button || !symbolInput || !form) return;
    symbolInput.value = button.dataset.symbol;
    form.requestSubmit();
  });
  updateScannerTable(root, items);
}

function renderScannerResults(results, errors = []) {
  latestScannerResults = results;
  const items = getScannerDisplayItems(results);

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
  renderScannerTradeBox(results);

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
    <section class="scanner-terminal-table">
      <div class="scanner-table-toolbar">
        <div>
          <span>Market Scanner</span>
          <strong data-scanner-count>${items.length}/${items.length} hiển thị</strong>
        </div>
        <label>
          <span>Filter</span>
          <input type="search" data-scanner-filter="query" placeholder="Tìm coin/mã..." autocomplete="off">
        </label>
        <label>
          <span>Type</span>
          <select data-scanner-filter="type">
            <option value="all">Tất cả</option>
            <option value="crypto">Coin</option>
            <option value="stock">Cổ phiếu</option>
          </select>
        </label>
        <label>
          <span>Signal</span>
          <select data-scanner-filter="signal">
            <option value="all">Tất cả</option>
            <option value="Strong">Strong</option>
            <option value="Watch">Watch</option>
            <option value="Skip">Skip</option>
          </select>
        </label>
      </div>
      <div class="table-wrap scanner-table-wrap coinglass-table-wrap">
        <table class="coinglass-scanner-table">
          <thead>
            <tr>
              <th><button type="button" data-sort="rank">Rank</button></th>
              <th><button type="button" data-sort="coin">Coin</button></th>
              <th><button type="button" data-sort="price">Price</button></th>
              <th><button type="button" data-sort="change24h">24H</button></th>
              <th><button type="button" data-sort="volume">Volume</button></th>
              <th><button type="button" data-sort="score">Score</button></th>
              <th><button type="button" data-sort="trend">Trend</button></th>
              <th><button type="button" data-sort="signal">Signal</button></th>
            </tr>
          </thead>
          <tbody data-scanner-table-body></tbody>
        </table>
      </div>
    </section>
  `;
  bindScannerTable(fields.scannerBody.querySelector(".scanner-terminal-table"), items);
}
function renderScannerTradeBox(results) {
  if (!fields.scannerTradeBox) return;
  const tradeCoins = results
    .filter((item) => item.type === "crypto" && item.tradeAnalysis)
    .sort((a, b) => {
      const finalDiff = Number(Boolean(b.tradeAnalysis.finalAllowed)) - Number(Boolean(a.tradeAnalysis.finalAllowed));
      if (finalDiff) return finalDiff;
      const passDiff = b.tradeAnalysis.passed - a.tradeAnalysis.passed;
      return passDiff || b.score - a.score;
    })
    .slice(0, 3);
  const allowedCoins = tradeCoins.filter((item) => item.tradeAnalysis.finalAllowed || item.tradeAnalysis.allowed);
  const displayCoins = (allowedCoins.length ? allowedCoins : tradeCoins).slice(0, 3);

  if (!displayCoins.length) {
    fields.scannerTradeBox.innerHTML = `
      <article>
        <span>Trade Analysis</span>
        <h3>Chưa có coin đủ dữ liệu 4H, 1H và 30m.</h3>
        <p>Scanner vẫn có thể tạo watchlist, nhưng chưa đủ dữ liệu đa khung để chọn coin giao dịch.</p>
      </article>
    `;
    return;
  }

  const leader = displayCoins[0];
  fields.scannerTradeBox.innerHTML = `
    <article class="trade-pick-hero">
      <span>Trade Analysis · Chọn coin giao dịch</span>
      <div>
        <h3>${escapeHtml(leader.symbol)}</h3>
        <strong class="${leader.tradeAnalysis.finalAllowed ? "positive" : leader.tradeAnalysis.allowed ? "neutral" : "negative"}">${leader.tradeAnalysis.passed}/${leader.tradeAnalysis.total}</strong>
      </div>
      <p>${escapeHtml(leader.tradeAnalysis.summary)}. Đây mới là bước được phép tìm entry, không phải lệnh mua tự động.</p>
    </article>
    <div class="trade-pick-grid">
      ${displayCoins.map((item) => `
        <article class="trade-pick-card">
          <div class="trade-pick-title">
            <span>${escapeHtml(item.symbol)}</span>
            <strong class="${item.tradeAnalysis.finalAllowed ? "positive" : item.tradeAnalysis.allowed ? "neutral" : "negative"}">${item.tradeAnalysis.passed}/${item.tradeAnalysis.total}</strong>
          </div>
          <p>${escapeHtml(item.tradeAnalysis.summary)}</p>
          <h4>Trade Analysis</h4>
          <ul class="trade-pick-checks">
            ${item.tradeAnalysis.checks.map((check) => `
              <li class="${check.pass ? "positive" : "negative"}">
                <b>${check.pass ? "✓" : "×"}</b>
                <span>${escapeHtml(check.label)}</span>
                <em>${escapeHtml(check.detail)}</em>
              </li>
            `).join("")}
          </ul>
          ${item.entryConfirmation ? `
            <h4>Giai đoạn 4 · Entry Confirmation</h4>
            <p>${escapeHtml(item.entryConfirmation.note)}</p>
            <ul class="trade-pick-checks">
              ${item.entryConfirmation.checks.map((check) => `
                <li class="${check.pass ? "positive" : "negative"}">
                  <b>${check.pass ? "✓" : "×"}</b>
                  <span>${escapeHtml(check.label)}</span>
                  <em>${escapeHtml(check.detail)}</em>
                </li>
              `).join("")}
            </ul>
          ` : ""}
          ${item.riskManagement ? `
            <h4>Giai đoạn 5 · Risk Management</h4>
            <p>${escapeHtml(item.riskManagement.warning)}</p>
            <ul class="trade-pick-checks risk-checks">
              ${item.riskManagement.checks.map((check) => `
                <li class="${check.pass ? "positive" : "negative"}">
                  <b>${check.pass ? "✓" : "×"}</b>
                  <span>${escapeHtml(check.label)}</span>
                  <em>${escapeHtml(check.detail)}</em>
                </li>
              `).join("")}
            </ul>
          ` : ""}
        </article>
      `).join("")}
    </div>
  `;
}

function mergeOkxUniverse(spotData, swapData) {
  const bySymbol = new Map();
  [...(spotData?.items || []), ...(swapData?.items || [])].forEach((item) => {
    if (!item?.symbol || /^(USDT|USDC|USD)$/.test(item.symbol)) return;
    const current = bySymbol.get(item.symbol);
    if (!current || (item.quoteVolume || 0) > (current.quoteVolume || 0)) {
      bySymbol.set(item.symbol, item);
    }
  });
  SCANNER_CRYPTO_SYMBOLS.forEach((symbol) => {
    if (!bySymbol.has(symbol)) bySymbol.set(symbol, { symbol, quoteVolume: 0, spreadPercent: null });
  });
  return [...bySymbol.values()]
    .filter((item) => item.symbol && item.symbol.length <= 12)
    .sort((a, b) => (b.quoteVolume || 0) - (a.quoteVolume || 0));
}

function latestValue(series) {
  const value = latestNonNull(series);
  return toNumber(value);
}

function isHigherHighHigherLow(bars) {
  if (!bars?.length || bars.length < 60) return false;
  const recentHigh = swingHigh(bars, 28, 2);
  const previousHigh = swingHigh(bars.slice(0, -28), 28, 2);
  const recentLow = swingLow(bars, 28, 2);
  const previousLow = swingLow(bars.slice(0, -28), 28, 2);
  return recentHigh !== null && previousHigh !== null && recentLow !== null && previousLow !== null && recentHigh > previousHigh && recentLow > previousLow;
}

function calculateRangePosition(bars) {
  const latest = bars[bars.length - 1]?.close;
  const recent = bars.slice(-120);
  const low = Math.min(...recent.map((bar) => bar.low).filter(Number.isFinite));
  const high = Math.max(...recent.map((bar) => bar.high).filter(Number.isFinite));
  if (!latest || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) return { score: 2, text: "Không đủ dữ liệu vị trí giá" };
  const position = ((latest - low) / (high - low)) * 100;
  if (position <= 38) return { score: 5, text: `Đang gần vùng hỗ trợ của range (${formatNumber(position, 0)}%).` };
  if (position >= 78) return { score: 0, text: `Giá sát vùng kháng cự mạnh (${formatNumber(position, 0)}%).` };
  return { score: 2, text: `Giá ở giữa range (${formatNumber(position, 0)}%), cần chờ điểm đẹp hơn.` };
}

function calculateVolumeProfileProxy(bars) {
  const recent = bars.slice(-120);
  const weighted = recent.reduce((sum, bar) => sum + (bar.close || 0) * (bar.volume || 0), 0);
  const volume = recent.reduce((sum, bar) => sum + (bar.volume || 0), 0);
  const poc = volume ? weighted / volume : null;
  const latest = bars[bars.length - 1]?.close;
  const volumeRatio = hasConfirmedVolume(bars, 1.2).ratio;
  if (!latest || !poc) return { score: 2, text: "Chưa tính được vùng POC/HVN." };
  const distance = Math.abs((latest - poc) / latest) * 100;
  if (distance <= 4 || (bars[bars.length - 2]?.close < poc && latest > poc)) return { score: 5, text: `Giá đang quanh/vừa vượt POC ước tính ${formatCryptoPrice(poc)}.` };
  if (volumeRatio !== null && volumeRatio < 0.75) return { score: 0, text: "Volume suy yếu, chưa có dòng tiền xác nhận." };
  return { score: 2, text: `POC ước tính ${formatCryptoPrice(poc)}, vị trí chưa thật rõ.` };
}

function calculateFibonacciPosition(bars) {
  const recent = bars.slice(-120);
  const low = Math.min(...recent.map((bar) => bar.low).filter(Number.isFinite));
  const high = Math.max(...recent.map((bar) => bar.high).filter(Number.isFinite));
  const latest = bars[bars.length - 1]?.close;
  if (!latest || !Number.isFinite(low) || !Number.isFinite(high) || high <= low) return { score: 0, text: "Không đủ dữ liệu Fibonacci." };
  const retracement = (high - latest) / (high - low);
  if (retracement >= 0.5 && retracement <= 0.618) return { score: 5, text: `Pullback đúng vùng 0.5-0.618 (${formatNumber(retracement, 2)}).` };
  if (Math.abs(retracement - 0.382) <= 0.06) return { score: 3, text: `Pullback gần vùng 0.382 (${formatNumber(retracement, 2)}).` };
  return { score: 0, text: `Giá ngoài vùng Fibonacci đẹp (${formatNumber(retracement, 2)}).` };
}

function hasDistributionSignal(bars) {
  const latest = bars[bars.length - 1] || {};
  const avgVolume20 = average(bars.slice(-21, -1).map((bar) => bar.volume));
  return Boolean(latest.close < latest.open && avgVolume20 && latest.volume > avgVolume20 * 1.6);
}

function scoreCryptoTradingCandidate(symbol, ticker, dailyRaw, fourHourRaw, oneHourRaw, thirtyRaw, fifteenRaw, fiveRaw, btcBars, ethBars) {
  const dailyBars = normalizeTechnicalBars(dailyRaw?.bars || []);
  const fourHourBars = normalizeTechnicalBars(fourHourRaw?.bars || []);
  const oneHourBars = normalizeTechnicalBars(oneHourRaw?.bars || []);
  const thirtyBars = normalizeTechnicalBars(thirtyRaw?.bars || []);
  const fifteenBars = normalizeTechnicalBars(fifteenRaw?.bars || []);
  const fiveBars = normalizeTechnicalBars(fiveRaw?.bars || []);
  if (dailyBars.length < 220 || oneHourBars.length < 80 || thirtyBars.length < 50) {
    throw new Error(`${symbol} thiếu dữ liệu đa khung`);
  }

  const quote = dailyRaw?.quote || {};
  const latestDaily = dailyBars[dailyBars.length - 1] || {};
  const ema20 = latestValue(calculateEmaForBars(dailyBars, 20));
  const ema50 = latestValue(calculateEmaForBars(dailyBars, 50));
  const ema100 = latestValue(calculateEmaForBars(dailyBars, 100));
  const ema200 = latestValue(calculateEmaForBars(dailyBars, 200));
  const ema20_4h = latestValue(calculateEmaForBars(fourHourBars, 20));
  const ema50_4h = latestValue(calculateEmaForBars(fourHourBars, 50));
  const ema200_4h = latestValue(calculateEmaForBars(fourHourBars, 200));
  const rsi1h = latestValue(calculateRsi(oneHourBars));
  const macd1h = calculateMacd(oneHourBars);
  const macd = latestValue(macd1h.macd);
  const signal = latestValue(macd1h.signal);
  const adxData = calculateAdx(oneHourBars);
  const adx = latestValue(adxData.adx);
  const atr = latestValue(calculateAtr(dailyBars));
  const atrPercent = atr && latestDaily.close ? (atr / latestDaily.close) * 100 : null;
  const volumeRatio = hasConfirmedVolume(dailyBars, 1.5).ratio;
  const liquidity = scannerLiquidityScore("crypto", { ...quote, quoteVolume: ticker?.quoteVolume ?? quote.quoteVolume, spreadPercent: ticker?.spreadPercent ?? quote.spreadPercent }, latestDaily);
  const rs20 = scannerPercentChange(dailyBars, 20);
  const btcRs20 = scannerPercentChange(btcBars, 20);
  const ethRs20 = scannerPercentChange(ethBars, 20);
  const rs60 = scannerPercentChange(dailyBars, 60);
  const btcRs60 = scannerPercentChange(btcBars, 60);
  const ethRs60 = scannerPercentChange(ethBars, 60);
  const newsHit = latestNewsItems.some((item) => normalizeSearchText(`${item.title} ${item.description}`).includes(normalizeSearchText(symbol)));
  const trendUp = latestDaily.close > ema20 && ema20 > ema50 && ema50 > ema200 && fourHourBars.at(-1)?.close > ema20_4h;
  const trendForming = latestDaily.close > ema20 && ema20 > ema50 && rsi1h >= 48;

  const marketItems = [
    { name: "Thanh khoản", max: 5, score: liquidity.value >= 10_000_000 && (liquidity.spread === null || liquidity.spread <= 0.25) ? 5 : liquidity.value >= 3_000_000 ? 3 : 0, detail: `Volume 24h ${formatLargeNumber(liquidity.value)} USD · Spread ${formatPercent(liquidity.spread)}` },
    { name: "Biến động", max: 5, score: atrPercent >= 4 && atrPercent <= 12 ? 5 : atrPercent >= 2 && atrPercent <= 20 ? 3 : 0, detail: `ATR ${formatPercent(atrPercent)} · 24h ${formatPercent(ticker?.changePercent ?? quote.changePercent)}` },
    { name: "Xu hướng 1D & 4H", max: 5, score: trendUp ? 5 : trendForming ? 3 : 0, detail: trendUp ? "EMA 1D/4H đồng thuận tăng." : trendForming ? "Đang hình thành xu hướng tăng." : "Xu hướng chưa đạt yêu cầu." },
    { name: "Relative Strength", max: 5, score: rs20 !== null && btcRs20 !== null && ethRs20 !== null && rs20 > btcRs20 && rs20 > ethRs20 ? 5 : rs20 !== null && (rs20 > btcRs20 || rs20 > ethRs20) ? 3 : 0, detail: `20 phiên ${formatPercent(rs20)} · BTC ${formatPercent(btcRs20)} · ETH ${formatPercent(ethRs20)}` },
    { name: "Catalyst", max: 5, score: newsHit || volumeRatio >= 2 ? 5 : volumeRatio >= 1.2 ? 3 : 2, detail: newsHit ? "Có tin liên quan trong nguồn tin hiện tại." : `Volume daily x${volumeRatio ? formatNumber(volumeRatio, 2) : "-"}; chưa có API unlock/tokenomics.` }
  ];

  const rangePosition = calculateRangePosition(dailyBars);
  const volumeProfile = calculateVolumeProfileProxy(dailyBars);
  const fib = calculateFibonacciPosition(dailyBars);
  const hhhl = isHigherHighHigherLow(dailyBars);
  const strategicItems = [
    { name: "EMA50 > EMA100 > EMA200", max: 5, score: ema50 > ema100 && ema100 > ema200 ? 5 : 0, detail: `EMA50 ${formatCryptoPrice(ema50)} · EMA100 ${formatCryptoPrice(ema100)} · EMA200 ${formatCryptoPrice(ema200)}` },
    { name: "Higher High + Higher Low", max: 5, score: hhhl ? 5 : 0, detail: hhhl ? "Cấu trúc đỉnh/đáy cao dần." : "Chưa xác nhận HH/HL rõ." },
    { name: "Vị trí giá", max: 5, score: rangePosition.score, detail: rangePosition.text },
    { name: "Volume Profile", max: 5, score: volumeProfile.score, detail: volumeProfile.text },
    { name: "Fibonacci", max: 5, score: fib.score, detail: fib.text },
    { name: "Tokenomics & Tin tức", max: 5, score: newsHit ? 5 : 3, detail: newsHit ? "Có catalyst/tin liên quan." : "Trung lập; chưa có API unlock token theo thời gian thực." },
    { name: "Relative Strength dài hạn", max: 5, score: rs60 !== null && btcRs60 !== null && ethRs60 !== null && rs60 > btcRs60 && rs60 > ethRs60 ? 5 : rs60 !== null && (rs60 > btcRs60 || rs60 > ethRs60) ? 3 : 0, detail: `60 phiên ${formatPercent(rs60)} · BTC ${formatPercent(btcRs60)} · ETH ${formatPercent(ethRs60)}` }
  ];

  const bos = detectBos(oneHourBars);
  const choch = detectChoch(oneHourBars);
  const volume = hasConfirmedVolume(thirtyBars, 1.5);
  const orderBlock = detectBullishOrderBlock(oneHourBars);
  const fvg = detectUnfilledFvg(oneHourBars);
  const liquiditySweep = fiveBars.length > 30 && fiveBars.at(-1).low < swingLow(fiveBars, 30, 2) && fiveBars.at(-1).close > fiveBars.at(-1).open;
  const smcCount = [orderBlock.pass, fvg.pass, liquiditySweep].filter(Boolean).length;
  const rr = calculateRiskReward(oneHourBars);
  const momentumHits = [rsi1h >= 50 && rsi1h <= 70, macd > signal, adx > 25].filter(Boolean).length;
  const tradeItems = [
    { name: "Momentum", max: 5, score: momentumHits === 3 ? 5 : momentumHits === 2 ? 3 : 0, detail: `RSI ${formatOptional(rsi1h, 1)} · MACD ${formatOptional(macd, 4)} / Signal ${formatOptional(signal, 4)} · ADX ${formatOptional(adx, 1)}` },
    { name: "Market Structure", max: 5, score: bos && choch ? 5 : bos || choch ? 3 : 0, detail: `BOS ${bos ? "có" : "chưa"} · CHOCH ${choch ? "có" : "chưa"}` },
    { name: "Volume", max: 5, score: volume.pass ? 5 : volume.ratio >= 1.1 ? 3 : 0, detail: `Break/đẩy giá với volume x${volume.ratio ? formatNumber(volume.ratio, 2) : "-"}` },
    { name: "Smart Money Concepts", max: 5, score: smcCount >= 2 ? 5 : smcCount === 1 ? 2 : 0, detail: `OB ${orderBlock.pass ? "có" : "chưa"} · FVG ${fvg.pass ? "có" : "chưa"} · Sweep ${liquiditySweep ? "có" : "chưa"}` },
    { name: "Risk/Reward", max: 5, score: rr.rr >= 3 ? 5 : rr.rr >= 2 ? 3 : 0, detail: `RR ${rr.rr ? formatNumber(rr.rr, 2) + " : 1" : "-"} · Entry ${formatCryptoPrice(rr.entry)} · SL ${formatCryptoPrice(rr.stopLoss)}` }
  ];

  const entryBase = buildEntryConfirmationForCoin(fifteenBars, fiveBars);
  const breakRetest = entryBase.checks[0]?.pass && entryBase.checks[1]?.pass;
  const candle = entryBase.checks[2]?.pass || entryBase.checks[3]?.pass;
  const entryVolume = entryBase.checks[4]?.pass;
  const noDistribution = !hasDistributionSignal(fiveBars);
  const clearSl = Boolean(rr.stopLoss && rr.stopLoss < rr.entry);
  const entryItems = [
    { name: "Break & Retest thành công", max: 5, score: breakRetest ? 5 : 0, detail: breakRetest ? "15m break, 5m retest vùng vừa vượt." : "Chưa có break/retest đủ rõ." },
    { name: "Nến xác nhận", max: 3, score: candle ? 3 : 0, detail: candle ? "Có nến Bullish Engulfing/Hammer." : "Chưa có nến xác nhận." },
    { name: "Volume xác nhận", max: 3, score: entryVolume ? 3 : 0, detail: entryBase.checks[4]?.detail || "-" },
    { name: "Không phân phối mạnh", max: 2, score: noDistribution ? 2 : 0, detail: noDistribution ? "Chưa thấy nến đỏ volume lớn ở 5m." : "Có dấu hiệu phân phối ngắn hạn." },
    { name: "Stop Loss rõ ràng", max: 2, score: clearSl ? 2 : 0, detail: clearSl ? `SL ${formatCryptoPrice(rr.stopLoss)}` : "Chưa xác định SL hợp lý." }
  ];

  const marketScore = marketItems.reduce((sum, item) => sum + item.score, 0);
  const strategicScore = strategicItems.reduce((sum, item) => sum + item.score, 0);
  const tradeScore = tradeItems.reduce((sum, item) => sum + item.score, 0);
  const entryScore = entryItems.reduce((sum, item) => sum + item.score, 0);
  const total = marketScore + strategicScore + tradeScore + entryScore;
  const hardFilters = [
    { label: "Thanh khoản quá thấp hoặc spread rộng", pass: liquidity.value >= 3_000_000 && (liquidity.spread === null || liquidity.spread <= 0.45), detail: `Volume ${formatLargeNumber(liquidity.value)} USD · Spread ${formatPercent(liquidity.spread)}` },
    { label: "Unlock token lớn rất gần", pass: true, detail: "Chưa có API unlock token; cần kiểm tra thủ công trước khi vào lệnh." },
    { label: "RR tối thiểu 1:2", pass: rr.rr >= 2, detail: rr.rr ? `${formatNumber(rr.rr, 2)} : 1` : "Chưa tính được RR." },
    { label: "Stop Loss rõ ràng", pass: clearSl, detail: clearSl ? formatCryptoPrice(rr.stopLoss) : "Thiếu SL." },
    { label: "Risk <= 1% tài khoản/lệnh", pass: clearSl, detail: clearSl ? "Đạt nếu tính vị thế theo khoảng cách Entry-SL." : "Chưa tính được kích thước vị thế." },
    { label: "1D không đi ngược hoàn toàn", pass: !(latestDaily.close < ema200 && ema50 < ema100), detail: latestDaily.close < ema200 && ema50 < ema100 ? "1D đang chống lại hướng BUY." : "Không bị hard filter xu hướng 1D." }
  ];
  const blocked = hardFilters.some((item) => !item.pass);
  const decision = blocked
    ? { rank: "Không giao dịch", action: "Bị hard filter, không vào lệnh dù điểm số cao.", className: "negative" }
    : total >= 90
      ? { rank: "A+ Setup", action: "Có thể giao dịch ngay nếu RR và kế hoạch vị thế đã khóa.", className: "positive" }
      : total >= 85
        ? { rank: "A Setup", action: "Ưu tiên cao, chỉ chờ entry đúng checklist.", className: "positive" }
        : total >= 80
          ? { rank: "B Setup", action: "Đưa vào watchlist, chờ xác nhận thêm.", className: "neutral" }
          : total >= 70
            ? { rank: "C Setup", action: "Không vào, chỉ theo dõi.", className: "neutral" }
            : { rank: "Loại", action: "Không đáng giao dịch lúc này.", className: "negative" };

  return {
    symbol,
    source: dailyRaw?.source || "OKX/Binance",
    price: quote.price ?? ticker?.last ?? latestDaily.close,
    scores: { market: marketScore, strategic: strategicScore, trade: tradeScore, entry: entryScore, total },
    stages: { marketItems, strategicItems, tradeItems, entryItems },
    thresholds: {
      market: marketScore >= 20 ? "Sang Strategic Analysis" : "Loại",
      strategic: strategicScore >= 28 ? "Sang Trade Analysis" : strategicScore >= 24 ? "Watchlist" : "Loại",
      trade: tradeScore >= 20 ? "Sang Entry Confirmation" : "Chờ",
      entry: entryScore >= 12 ? "Vào lệnh" : entryScore >= 9 ? "Chờ thêm" : "Không giao dịch"
    },
    hardFilters,
    blocked,
    decision,
    rr,
    ticker
  };
}

async function loadCryptoTradingCandidate(item, btcBars, ethBars) {
  const symbol = item.symbol;
  const dataSymbol = item.instId || symbol;
  const [daily, fourHour, oneHour, thirty, fifteen, five] = await Promise.all([
    scannerCryptoData(dataSymbol, "2y"),
    scannerCryptoData(dataSymbol, "4h"),
    scannerCryptoData(dataSymbol, "1h"),
    scannerCryptoData(dataSymbol, "30m"),
    scannerCryptoData(dataSymbol, "15m"),
    scannerCryptoData(dataSymbol, "5m")
  ]);
  return scoreCryptoTradingCandidate(symbol, item, daily, fourHour, oneHour, thirty, fifteen, five, btcBars, ethBars);
}

function playbookTone(score, max) {
  const percent = max ? (score / max) * 100 : 0;
  if (percent >= 80) return "positive";
  if (percent >= 60) return "neutral";
  return "negative";
}

function renderPlaybookProgress(score, max) {
  const percent = max ? Math.max(0, Math.min(100, Math.round((score / max) * 100))) : 0;
  return `
    <div class="playbook-progress" aria-label="Tiến độ ${score}/${max}">
      <span style="width: ${percent}%"></span>
    </div>
  `;
}

function renderPlaybookStage(title, score, max, action, rows) {
  const tone = playbookTone(score, max);
  return `
    <section class="crypto-stage-card playbook-stage ${tone}">
      <div class="playbook-stage-head">
        <div>
          <span>Checklist</span>
          <h4>${escapeHtml(title)}</h4>
          <em>${escapeHtml(action)}</em>
        </div>
        <strong>${score}/${max}</strong>
      </div>
      ${renderPlaybookProgress(score, max)}
      <ul class="trade-pick-checks crypto-checks playbook-checklist">
        ${rows.map((row) => `
          <li class="${row.score >= row.max ? "positive" : row.score > 0 ? "neutral" : "negative"}">
            <b>${row.score}/${row.max}</b>
            <span>${escapeHtml(row.name)}</span>
            <em>${escapeHtml(row.detail)}</em>
          </li>
        `).join("")}
      </ul>
    </section>
  `;
}

function renderCryptoTradingResults(results, errors = []) {
  latestCryptoTradingResults = results;
  const sorted = [...results].sort((a, b) => b.scores.total - a.scores.total);
  const tradable = sorted.filter((item) => !item.blocked && item.scores.total >= 80);
  const display = (tradable.length ? tradable : sorted).slice(0, 5);
  const topSetups = display.slice(0, 2);

  fields.cryptoTradingBadge.textContent = `${topSetups.length || display.length} setup nổi bật`;
  fields.cryptoTradingBadge.className = topSetups.some((item) => !item.blocked && item.scores.total >= 85) ? "positive" : display.length ? "neutral" : "negative";

  if (!display.length) {
    fields.cryptoTradingBody.innerHTML = `
      <article>
        <span>Không có setup</span>
        <h3>Chưa tìm được coin đủ dữ liệu để chấm điểm.</h3>
        <p>Bỏ qua ${errors.length} coin thiếu dữ liệu hoặc nguồn API tạm thời không phản hồi.</p>
      </article>
    `;
    return;
  }

  fields.cryptoTradingBody.innerHTML = `
    <div class="crypto-trading-hero">
      <article>
        <span>Kết quả chọn lệnh</span>
        <h3>${topSetups.map((item) => item.symbol).join(" / ")}</h3>
        <p>Đang hiển thị ${display.length}/${results.length} coin điểm cao nhất. Bỏ qua ${errors.length} coin lỗi dữ liệu. Quy tắc: thiếu RR >= 1:2, Stop Loss hoặc kiểm soát rủi ro thì không giao dịch.</p>
      </article>
      ${topSetups.map((item) => `
        <article class="crypto-decision-card">
          <span>${escapeHtml(item.symbol)} · ${escapeHtml(item.source)}</span>
          <strong class="${item.decision.className}">${item.scores.total}/100</strong>
          <h3>${escapeHtml(item.decision.rank)}</h3>
          <p>${escapeHtml(item.decision.action)}</p>
          <em>Giá ${formatCryptoPrice(item.price)} · RR ${item.rr.rr ? formatNumber(item.rr.rr, 2) + " : 1" : "-"}</em>
        </article>
      `).join("")}
    </div>
    ${display.map((item) => `
      <article class="crypto-setup-card">
        <div class="crypto-setup-head">
          <div>
            <span>${escapeHtml(item.symbol)} · Swing 1-10 ngày</span>
            <h3>${escapeHtml(item.decision.rank)}</h3>
            <p>${escapeHtml(item.decision.action)}</p>
          </div>
          <strong class="${item.decision.className}">${item.scores.total}/100</strong>
        </div>
        <div class="crypto-score-grid playbook-score-grid">
          ${[
            ["Market Scanner", item.scores.market, 25, item.thresholds.market],
            ["Strategic", item.scores.strategic, 35, item.thresholds.strategic],
            ["Trade", item.scores.trade, 25, item.thresholds.trade],
            ["Entry", item.scores.entry, 15, item.thresholds.entry]
          ].map(([title, score, max, action]) => `
            <div class="playbook-score-card ${playbookTone(score, max)}">
              <span>${escapeHtml(title)}</span>
              <strong>${score}/${max}</strong>
              ${renderPlaybookProgress(score, max)}
              <em>${escapeHtml(action)}</em>
            </div>
          `).join("")}
        </div>
        <div class="crypto-stage-grid playbook-grid">
          ${[
            ["Market Scanner", item.scores.market, 25, item.thresholds.market, item.stages.marketItems],
            ["Strategic", item.scores.strategic, 35, item.thresholds.strategic, item.stages.strategicItems],
            ["Trade", item.scores.trade, 25, item.thresholds.trade, item.stages.tradeItems],
            ["Entry", item.scores.entry, 15, item.thresholds.entry, item.stages.entryItems]
          ].map(([title, score, max, action, rows]) => renderPlaybookStage(title, score, max, action, rows)).join("")}
        </div>
        <section class="crypto-stage-card hard-filter-card">
          <h4>Hard Filters</h4>
          <ul class="trade-pick-checks crypto-checks">
            ${item.hardFilters.map((filter) => `
              <li class="${filter.pass ? "positive" : "negative"}">
                <b>${filter.pass ? "OK" : "NO"}</b>
                <span>${escapeHtml(filter.label)}</span>
                <em>${escapeHtml(filter.detail)}</em>
              </li>
            `).join("")}
          </ul>
        </section>
      </article>
    `).join("")}
  `;
}

async function loadCryptoTrading() {
  if (!fields.cryptoTradingBadge || !fields.cryptoTradingBody) return;
  fields.cryptoTradingBadge.textContent = "Đang quét...";
  fields.cryptoTradingBadge.className = "neutral";
  fields.cryptoTradingBody.innerHTML = `
    <article>
      <span>Đang quét OKX</span>
      <h3>Đang lọc thanh khoản, xu hướng, relative strength và xác nhận entry...</h3>
      <p>Quá trình này tải nhiều khung thời gian nên có thể mất một chút thời gian.</p>
    </article>
  `;

  try {
    const [spot, swap, btcBase, ethBase] = await Promise.allSettled([
      scannerOkxUniverseData("SPOT"),
      scannerOkxUniverseData("SWAP"),
      scannerCryptoData("BTC", "2y"),
      scannerCryptoData("ETH", "2y")
    ]);
    const universe = mergeOkxUniverse(
      spot.status === "fulfilled" ? spot.value : null,
      swap.status === "fulfilled" ? swap.value : null
    );
    const btcBars = btcBase.status === "fulfilled" ? normalizeTechnicalBars(btcBase.value?.bars || []) : [];
    const ethBars = ethBase.status === "fulfilled" ? normalizeTechnicalBars(ethBase.value?.bars || []) : [];
    const candidates = universe
      .filter((item) => (item.quoteVolume || 0) >= 3_000_000 || SCANNER_CRYPTO_SYMBOLS.includes(item.symbol))
      .slice(0, 32);
    const rawResults = await scannerRunWithConcurrency(candidates, 6, (item) => loadCryptoTradingCandidate(item, btcBars, ethBars), (done, total) => { fields.cryptoTradingBadge.textContent = `Đang quét ${done}/${total}`; });
    renderCryptoTradingResults(rawResults.filter((item) => item && !item.error), rawResults.filter((item) => item?.error));
  } catch (error) {
    fields.cryptoTradingBadge.textContent = "Lỗi dữ liệu";
    fields.cryptoTradingBadge.className = "negative";
    fields.cryptoTradingBody.innerHTML = `
      <article>
        <span>Lỗi Crypto Trading</span>
        <h3>${escapeHtml(error.message || "Không quét được coin.")}</h3>
        <p>Hãy kiểm tra local server hoặc Netlify Function rồi thử lại.</p>
      </article>
    `;
  }
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
  if (fields.scannerTradeBox) {
    fields.scannerTradeBox.innerHTML = `
      <article>
        <span>Trade Analysis</span>
        <h3>Đang lọc 1-3 coin tốt để giao dịch...</h3>
        <p>Hệ thống đang kiểm tra 4H, 1H, 30m theo momentum, RSI, MACD, ADX, BOS/CHOCH, liquidity, OB, FVG, volume và RR.</p>
      </article>
    `;
  }

  try {
    const tasks = [];
    const includeCrypto = activeScannerType === "all" || activeScannerType === "crypto";
    const includeStock = activeScannerType === "all" || activeScannerType === "stock";
    const [btcBase, vnBase] = await Promise.allSettled([
      includeCrypto ? scannerCryptoData("BTC", "2y") : Promise.resolve(null),
      includeStock ? scannerStockData("VNINDEX", "2y") : Promise.resolve(null)
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

    const rawResults = await scannerRunWithConcurrency(tasks, 8, (item) => loadScannerCandidate(item.symbol, item.type, item.base), (done, total) => { fields.scannerBadge.textContent = `Đang quét ${done}/${total}`; });
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
    if (fields.scannerTradeBox) {
      fields.scannerTradeBox.innerHTML = `
        <article>
          <span>Trade Analysis</span>
          <h3>Chưa lọc được coin giao dịch.</h3>
          <p>Phần này cần dữ liệu coin đa khung 4H, 1H và 30m.</p>
        </article>
      `;
    }
  }
}



