
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

function isHammerCandle(bar) {
  const open = toNumber(bar?.open);
  const close = toNumber(bar?.close);
  const high = toNumber(bar?.high);
  const low = toNumber(bar?.low);
  if (open === null || close === null || high === null || low === null) return false;
  const body = Math.abs(close - open);
  const range = high - low || 1;
  const lowerWick = Math.min(open, close) - low;
  const upperWick = high - Math.max(open, close);
  return lowerWick >= body * 2 && upperWick <= range * 0.35 && body / range <= 0.45;
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
      <p>Entry tham chiếu: ${formatAssetPrice(plan.entry)}. Stop loss: ${formatAssetPrice(plan.stopLoss)} (${formatPercent(-plan.riskPercent)}). RR tới TP2: ${plan.rr ? formatNumber(plan.rr, 2) + " : 1" : "-"}.</p>
    </article>

    <div class="trade-grid">
      <article>
        <span>Bước 1 - Xu hướng 1H</span>
        <h3 class="${oneHour.direction === "BUY" ? "positive" : oneHour.direction === "SELL" ? "negative" : "neutral"}">${oneHour.direction === "BUY" ? "Chỉ tìm BUY" : oneHour.direction === "SELL" ? "Chỉ tìm SELL" : "Không giao dịch"}</h3>
        <p>Giá ${formatAssetPrice(oneHour.latest.close)}, EMA9 ${formatAssetPrice(oneHour.latestEma9)}, EMA21 ${formatAssetPrice(oneHour.latestEma21)}, RSI ${formatOptional(oneHour.latestRsi, 2)}.</p>
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
        <p>TP1 ${formatAssetPrice(plan.tp1)}: bán 50%. TP2 ${formatAssetPrice(plan.tp2)}: bán 30%. TP3 ${formatAssetPrice(plan.tp3)}: giữ 20% nếu giá chạy khỏe.</p>
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

function calculateAdx(points, period = 14) {
  const adx = Array(points.length).fill(null);
  const plusDi = Array(points.length).fill(null);
  const minusDi = Array(points.length).fill(null);
  if (points.length <= period * 2) return { adx, plusDi, minusDi };

  const trueRanges = Array(points.length).fill(0);
  const plusDm = Array(points.length).fill(0);
  const minusDm = Array(points.length).fill(0);

  for (let index = 1; index < points.length; index += 1) {
    const current = points[index];
    const previous = points[index - 1];
    const upMove = current.high - previous.high;
    const downMove = previous.low - current.low;
    trueRanges[index] = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );
    plusDm[index] = upMove > downMove && upMove > 0 ? upMove : 0;
    minusDm[index] = downMove > upMove && downMove > 0 ? downMove : 0;
  }

  let trSmooth = trueRanges.slice(1, period + 1).reduce((sum, value) => sum + value, 0);
  let plusSmooth = plusDm.slice(1, period + 1).reduce((sum, value) => sum + value, 0);
  let minusSmooth = minusDm.slice(1, period + 1).reduce((sum, value) => sum + value, 0);
  const dx = Array(points.length).fill(null);

  for (let index = period; index < points.length; index += 1) {
    if (index > period) {
      trSmooth = trSmooth - trSmooth / period + trueRanges[index];
      plusSmooth = plusSmooth - plusSmooth / period + plusDm[index];
      minusSmooth = minusSmooth - minusSmooth / period + minusDm[index];
    }
    plusDi[index] = trSmooth ? (plusSmooth / trSmooth) * 100 : null;
    minusDi[index] = trSmooth ? (minusSmooth / trSmooth) * 100 : null;
    const sumDi = (plusDi[index] || 0) + (minusDi[index] || 0);
    dx[index] = sumDi ? (Math.abs((plusDi[index] || 0) - (minusDi[index] || 0)) / sumDi) * 100 : null;
  }

  const firstDx = dx.slice(period, period * 2).filter((value) => value !== null);
  if (firstDx.length === period) {
    adx[period * 2 - 1] = average(firstDx);
    for (let index = period * 2; index < points.length; index += 1) {
      adx[index] = dx[index] === null ? adx[index - 1] : ((adx[index - 1] || 0) * (period - 1) + dx[index]) / period;
    }
  }

  return { adx, plusDi, minusDi };
}

function swingHigh(bars, lookback = 24, excludeRecent = 3) {
  const values = bars
    .slice(Math.max(0, bars.length - lookback - excludeRecent), Math.max(0, bars.length - excludeRecent))
    .map((bar) => toNumber(bar.high))
    .filter((value) => value !== null);
  return values.length ? Math.max(...values) : null;
}

function swingLow(bars, lookback = 24, excludeRecent = 3) {
  const values = bars
    .slice(Math.max(0, bars.length - lookback - excludeRecent), Math.max(0, bars.length - excludeRecent))
    .map((bar) => toNumber(bar.low))
    .filter((value) => value !== null);
  return values.length ? Math.min(...values) : null;
}

function detectBos(bars) {
  const latest = bars[bars.length - 1] || {};
  const previousSwingHigh = swingHigh(bars, 30, 4);
  return previousSwingHigh !== null && latest.close > previousSwingHigh;
}

function detectChoch(bars) {
  if (bars.length < 45) return false;
  const latest = bars[bars.length - 1] || {};
  const ema20 = calculateEmaForBars(bars, 20);
  const previousEma20 = ema20[ema20.length - 8];
  const latestEma20 = latestNonNull(ema20);
  const previousSwingHigh = swingHigh(bars, 36, 5);
  const recentLowerLow = Math.min(...bars.slice(-18, -6).map((bar) => bar.low)) < Math.min(...bars.slice(-36, -18).map((bar) => bar.low));
  return Boolean(recentLowerLow && latest.close > latestEma20 && previousEma20 && bars[bars.length - 8].close < previousEma20 && previousSwingHigh && latest.close > previousSwingHigh * 0.995);
}

function detectBullishOrderBlock(bars) {
  if (bars.length < 28) return { pass: false, distance: null };
  const recent = bars.slice(-24);
  const latest = bars[bars.length - 1] || {};
  for (let index = recent.length - 4; index >= 1; index -= 1) {
    const candle = recent[index];
    const nextBars = recent.slice(index + 1, Math.min(recent.length, index + 6));
    const impulseHigh = Math.max(...nextBars.map((bar) => bar.high));
    const redCandle = candle.close < candle.open;
    const impulse = candle.high && impulseHigh > candle.high * 1.018;
    if (redCandle && impulse) {
      const zoneMid = (candle.open + candle.low) / 2;
      const distance = latest.close ? Math.abs((latest.close - zoneMid) / latest.close) * 100 : null;
      return { pass: distance !== null && distance <= 5, distance };
    }
  }
  return { pass: false, distance: null };
}

function detectUnfilledFvg(bars) {
  if (bars.length < 8) return { pass: false, distance: null };
  const latest = bars[bars.length - 1] || {};
  for (let index = bars.length - 2; index >= Math.max(2, bars.length - 34); index -= 1) {
    const previousTwo = bars[index - 2];
    const current = bars[index];
    if (current.low > previousTwo.high) {
      const gapLow = previousTwo.high;
      const gapHigh = current.low;
      const filled = bars.slice(index + 1).some((bar) => bar.low <= gapLow);
      const distance = latest.close ? Math.abs((latest.close - gapHigh) / latest.close) * 100 : null;
      if (!filled) return { pass: distance !== null && distance <= 7, distance };
    }
  }
  return { pass: false, distance: null };
}

function hasConfirmedVolume(bars, multiplier = 1.35) {
  const latestVolume = toNumber(bars[bars.length - 1]?.volume);
  const avgVolume20 = average(bars.slice(-21, -1).map((bar) => bar.volume));
  return {
    pass: latestVolume !== null && avgVolume20 && latestVolume >= avgVolume20 * multiplier,
    ratio: latestVolume !== null && avgVolume20 ? latestVolume / avgVolume20 : null
  };
}

function calculateRiskReward(bars) {
  const latest = bars[bars.length - 1] || {};
  const entry = latest.close;
  const support = swingLow(bars, 30, 1);
  const resistance = swingHigh(bars, 50, 1);
  if (!entry || !support || !resistance || entry <= support) return { pass: false, rr: null };
  const stopLoss = Math.max(support, entry * 0.98);
  const risk = entry - stopLoss;
  const target = Math.max(resistance, entry * 1.04);
  const reward = target - entry;
  const rr = risk > 0 ? reward / risk : null;
  return { pass: rr !== null && rr >= 2, rr, entry, stopLoss, target, support, resistance, riskPercent: risk > 0 ? (risk / entry) * 100 : null };
}

function checkMomentum(bars4h, bars1h) {
  const ema20_4h = latestNonNull(calculateEmaForBars(bars4h, 20));
  const ema50_4h = latestNonNull(calculateEmaForBars(bars4h, 50));
  const ema20_1h = latestNonNull(calculateEmaForBars(bars1h, 20));
  const latest4h = bars4h[bars4h.length - 1] || {};
  const latest1h = bars1h[bars1h.length - 1] || {};
  return latest4h.close > ema20_4h && ema20_4h > ema50_4h && latest1h.close > ema20_1h;
}

