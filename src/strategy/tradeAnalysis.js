function buildTradeAnalysisForCoin(symbol, quote, bars4h, bars1h, bars30m) {
  const normalized4h = normalizeTechnicalBars(bars4h);
  const normalized1h = normalizeTechnicalBars(bars1h);
  const normalized30m = normalizeTechnicalBars(bars30m);
  const rsi4h = latestNonNull(calculateRsi(normalized4h));
  const rsi1h = latestNonNull(calculateRsi(normalized1h));
  const rsi30m = latestNonNull(calculateRsi(normalized30m));
  const macd1h = calculateMacd(normalized1h);
  const latestMacd = latestNonNull(macd1h.macd);
  const latestSignal = latestNonNull(macd1h.signal);
  const latestHistogram = latestNonNull(macd1h.histogram);
  const previousHistogram = macd1h.histogram.slice().reverse().find((value, index) => index > 0 && value !== null);
  const adxData = calculateAdx(normalized1h);
  const latestAdx = latestNonNull(adxData.adx);
  const latestPlusDi = latestNonNull(adxData.plusDi);
  const latestMinusDi = latestNonNull(adxData.minusDi);
  const liquidity = scannerLiquidityScore("crypto", quote, bars4h[bars4h.length - 1]);
  const orderBlock = detectBullishOrderBlock(normalized1h);
  const fvg = detectUnfilledFvg(normalized1h);
  const volume = hasConfirmedVolume(bars30m);
  const rr = calculateRiskReward(normalized1h);

  const checks = [
    { label: "Momentum 4H/1H", pass: checkMomentum(normalized4h, normalized1h), detail: "Giá trên EMA20 và EMA20 4H trên EMA50." },
    { label: "RSI", pass: rsi4h >= 50 && rsi1h >= 50 && rsi30m >= 45 && rsi30m <= 70, detail: `4H ${formatOptional(rsi4h, 1)} · 1H ${formatOptional(rsi1h, 1)} · 30m ${formatOptional(rsi30m, 1)}` },
    { label: "MACD", pass: latestMacd > latestSignal && latestHistogram > 0 && (previousHistogram === undefined || latestHistogram >= previousHistogram * 0.75), detail: `MACD ${formatOptional(latestMacd, 4)} / Signal ${formatOptional(latestSignal, 4)}` },
    { label: "ADX", pass: latestAdx >= 18 && latestPlusDi > latestMinusDi, detail: `ADX ${formatOptional(latestAdx, 1)} · +DI ${formatOptional(latestPlusDi, 1)} · -DI ${formatOptional(latestMinusDi, 1)}` },
    { label: "BOS", pass: detectBos(normalized1h), detail: "Close 1H vượt swing high gần nhất." },
    { label: "CHOCH", pass: detectChoch(normalized1h), detail: "Có dấu hiệu đổi tính chất từ giảm/yếu sang hồi phục." },
    { label: "Liquidity", pass: liquidity.value >= 10_000_000 && (liquidity.spread === null || liquidity.spread <= 0.2), detail: `Volume 24h ${formatLargeNumber(liquidity.value)} USD · Spread ${formatPercent(liquidity.spread)}` },
    { label: "Order Block", pass: orderBlock.pass, detail: orderBlock.distance === null ? "Chưa thấy OB rõ." : `Giá cách vùng OB khoảng ${formatPercent(orderBlock.distance)}` },
    { label: "FVG", pass: fvg.pass, detail: fvg.distance === null ? "Chưa thấy FVG chưa lấp." : `Giá cách FVG khoảng ${formatPercent(fvg.distance)}` },
    { label: "Volume + RR", pass: volume.pass && rr.pass, detail: `Volume x${volume.ratio ? formatNumber(volume.ratio, 2) : "-"} · RR ${rr.rr ? formatNumber(rr.rr, 2) + " : 1" : "-"}` }
  ];

  const passed = checks.filter((item) => item.pass).length;
  return {
    symbol,
    passed,
    total: checks.length,
    allowed: passed >= 7,
    checks,
    rr,
    summary: passed >= 8
      ? "Được phép tìm Entry"
      : passed >= 7
        ? "Có thể tìm Entry nhưng cần xác nhận thêm"
        : "Chưa đủ điều kiện giao dịch"
  };
}

function detectBreakRetest(bars15m, bars5m) {
  const normalized15m = normalizeTechnicalBars(bars15m);
  const normalized5m = normalizeTechnicalBars(bars5m);
  const latest15m = normalized15m[normalized15m.length - 1] || {};
  const latest5m = normalized5m[normalized5m.length - 1] || {};
  const level = swingHigh(normalized15m, 36, 4);
  const breakPass = level !== null && latest15m.close > level;
  const recentRetest = level !== null && normalized5m.slice(-10).some((bar) => bar.low <= level * 1.004 && bar.close >= level * 0.996);
  return {
    level,
    breakPass,
    retestPass: breakPass && recentRetest,
    latest5m
  };
}

function buildEntryConfirmationForCoin(bars15m, bars5m) {
  const normalized15m = normalizeTechnicalBars(bars15m);
  const normalized5m = normalizeTechnicalBars(bars5m);
  const breakRetest = detectBreakRetest(bars15m, bars5m);
  const latest5m = normalized5m[normalized5m.length - 1] || {};
  const volume = hasConfirmedVolume(bars5m, 1.5);
  const bullishCandle = isStrongGreenCandle(normalized5m);
  const hammer = isHammerCandle(latest5m);
  const checks = [
    { label: "Break 15m", pass: breakRetest.breakPass, detail: breakRetest.level ? `Close 15m vượt vùng ${formatOptional(breakRetest.level, 4)}` : "Chưa có swing high rõ để xác nhận break." },
    { label: "Retest 5m", pass: breakRetest.retestPass, detail: breakRetest.level ? `Giá retest quanh ${formatOptional(breakRetest.level, 4)}` : "Chưa có vùng retest rõ." },
    { label: "Bullish Engulfing", pass: bullishCandle, detail: bullishCandle ? "Có nến xanh mạnh/engulfing trên 5m." : "Chưa có nến engulfing đủ rõ." },
    { label: "Hammer", pass: hammer, detail: hammer ? "Có hammer/rút chân trên 5m." : "Chưa thấy hammer đẹp." },
    { label: "Volume Spike", pass: volume.pass, detail: `Volume 5m x${volume.ratio ? formatNumber(volume.ratio, 2) : "-"} so với TB20.` },
    { label: "Delta dương", pass: false, detail: "Chưa có dữ liệu order flow/delta thật từ nguồn hiện tại." }
  ];
  const passed = checks.filter((item) => item.pass).length;
  return {
    passed,
    total: checks.length,
    confirmed: breakRetest.breakPass && breakRetest.retestPass && (bullishCandle || hammer) && volume.pass,
    checks,
    note: "Chỉ vào lệnh khi có xác nhận. Không mua chỉ vì giá đang tăng."
  };
}

function buildRiskManagementForCoin(tradeAnalysis, entryConfirmation) {
  const rr = tradeAnalysis.rr || {};
  const riskPerTrade = rr.entry && rr.stopLoss ? "0,5-1% tổng tài khoản" : "-";
  const positionFormula = rr.entry && rr.stopLoss
    ? "Vị thế = số tiền rủi ro / (Entry - Stop Loss)"
    : "-";
  const checks = [
    { label: "Điểm vào ở đâu?", pass: entryConfirmation.confirmed && rr.entry, detail: rr.entry ? `Entry tham chiếu ${formatOptional(rr.entry, 4)}` : "Chưa có entry cụ thể." },
    { label: "Stop Loss ở đâu?", pass: rr.stopLoss && rr.stopLoss < rr.entry, detail: rr.stopLoss ? `Dưới hỗ trợ/OB: ${formatOptional(rr.stopLoss, 4)}` : "Chưa xác định stop loss." },
    { label: "Take Profit ở đâu?", pass: rr.target && rr.target > rr.entry, detail: rr.target ? `Theo kháng cự/RR: ${formatOptional(rr.target, 4)}` : "Chưa xác định take profit." },
    { label: "RR đạt bao nhiêu?", pass: rr.rr >= 2, detail: rr.rr ? `${formatNumber(rr.rr, 2)} : 1${rr.rr >= 3 ? " · ưu tiên tốt" : ""}` : "Chưa tính được RR." },
    { label: "Rủi ro mỗi lệnh?", pass: Boolean(riskPerTrade !== "-"), detail: riskPerTrade },
    { label: "Kích thước vị thế?", pass: Boolean(positionFormula !== "-"), detail: positionFormula }
  ];
  const passed = checks.filter((item) => item.pass).length;
  return {
    passed,
    total: checks.length,
    approved: checks.every((item) => item.pass),
    checks,
    warning: "Nếu không trả lời được một trong các câu hỏi trên thì không giao dịch."
  };
}

function scannerPercentChange(bars, periods) {
  if (!bars?.length || bars.length <= periods) return null;
  const latest = toNumber(bars[bars.length - 1].close);
  const previous = toNumber(bars[bars.length - 1 - periods].close);
  if (latest === null || previous === null || !previous) return null;
  return ((latest - previous) / previous) * 100;
}

function scannerTrendLabel(dailyBars, fourHourBars) {
  const dailyClose = dailyBars[dailyBars.length - 1]?.close;
  const dailyEma20 = latestNonNull(calculateEmaForBars(dailyBars, 20));
  const dailyEma50 = latestNonNull(calculateEmaForBars(dailyBars, 50));
  const dailyEma200 = latestNonNull(calculateEmaForBars(dailyBars, 200));
  const fourHourClose = fourHourBars[fourHourBars.length - 1]?.close;
  const fourHourEma20 = latestNonNull(calculateEmaForBars(fourHourBars, 20));
  const rsi = latestNonNull(calculateRsi(dailyBars));

  const uptrend = dailyClose > dailyEma20 && dailyEma20 > dailyEma50 && dailyEma50 > dailyEma200 && fourHourClose > fourHourEma20;
  const reversal = dailyClose > dailyEma20 && dailyEma20 > dailyEma50 && rsi >= 45 && rsi <= 62;
  const weak = dailyClose < dailyEma50 && dailyEma20 < dailyEma50;

  return {
    text: uptrend ? "Uptrend" : reversal ? "Chuẩn bị đảo chiều" : weak ? "Yếu" : "Trung tính",
    className: uptrend || reversal ? "positive" : weak ? "negative" : "neutral",
    score: uptrend ? 25 : reversal ? 19 : weak ? 5 : 12,
    dailyClose,
    dailyEma20,
    dailyEma50,
    dailyEma200,
    fourHourEma20,
    rsi
  };
}

function scannerLiquidityScore(type, quote, latestBar) {
  const price = toNumber(quote?.price ?? latestBar?.close);
  const volume = toNumber(quote?.quoteVolume) ?? (toNumber(quote?.volume ?? latestBar?.volume) * (price || 0));
  const spread = toNumber(quote?.spreadPercent);

  if (type === "crypto") {
    let score = volume >= 50_000_000 ? 25 : volume >= 10_000_000 ? 20 : volume >= 3_000_000 ? 12 : 4;
    if (spread !== null && spread > 0.25) score -= 5;
    return { score: Math.max(0, score), value: volume, spread };
  }

  const value = toNumber(latestBar?.volume) * (price || 0);
  const score = value >= 100_000_000_000 ? 25 : value >= 20_000_000_000 ? 20 : value >= 5_000_000_000 ? 12 : 4;
  return { score, value, spread: null };
}

function analyzeScannerCandidate(input) {
  const { symbol, type, source, quote, dailyBars, fourHourBars, baseDailyBars } = input;
  const latestBar = dailyBars[dailyBars.length - 1] || {};
  const trend = scannerTrendLabel(dailyBars, fourHourBars.length ? fourHourBars : dailyBars);
  const liquidity = scannerLiquidityScore(type, quote, latestBar);
  const atr = latestNonNull(calculateAtr(dailyBars));
  const atrPercent = atr && latestBar.close ? (atr / latestBar.close) * 100 : null;
  const change24h = toNumber(quote?.changePercent) ?? scannerPercentChange(dailyBars, 1);
  const change20 = scannerPercentChange(dailyBars, 20);
  const baseChange20 = scannerPercentChange(baseDailyBars, 20);
  const relativeStrength = change20 !== null && baseChange20 !== null ? change20 - baseChange20 : null;
  const avgVolume20 = average(dailyBars.slice(-20).map((bar) => bar.volume));
  const volumeRatio = avgVolume20 ? (latestBar.volume || 0) / avgVolume20 : null;

  const volatilityScore = atrPercent === null
    ? 5
    : atrPercent >= 4 && atrPercent <= 12
      ? 15
      : atrPercent >= 2 && atrPercent < 4
        ? 9
        : atrPercent > 12 && atrPercent <= 20
          ? 10
          : 5;
  const relativeScore = relativeStrength === null ? 6 : relativeStrength >= 10 ? 15 : relativeStrength >= 4 ? 12 : relativeStrength >= 0 ? 8 : 3;
  const volumeScore = volumeRatio === null ? 5 : volumeRatio >= 3 ? 15 : volumeRatio >= 1.5 ? 12 : volumeRatio >= 1 ? 7 : 3;
  const newsScore = latestNewsItems.some((item) => normalizeSearchText(`${item.title} ${item.description}`).includes(normalizeSearchText(symbol))) ? 5 : 2;
  const score = Math.round(liquidity.score + volatilityScore + trend.score + relativeScore + volumeScore + newsScore);

  const tags = [
    liquidity.score >= 20 ? "Thanh khoản tốt" : "Thanh khoản cần kiểm tra",
    atrPercent !== null && atrPercent >= 4 && atrPercent <= 12 ? "Biến động vừa trade" : atrPercent > 12 ? "Biến động mạnh" : "Biến động thấp",
    trend.text,
    relativeStrength !== null && relativeStrength > 0 ? "Mạnh hơn thị trường" : "Yếu hơn thị trường",
    volumeRatio !== null && volumeRatio >= 1.5 ? `Volume x${formatNumber(volumeRatio, 1)}` : "Volume chưa nổi bật"
  ];

  return {
    symbol,
    type,
    source,
    price: quote?.price ?? latestBar.close,
    score,
    tags,
    trend,
    liquidity,
    atrPercent,
    change24h,
    relativeStrength,
    volumeRatio
  };
}

async function runWithConcurrency(items, limit, worker) {
  const results = [];
  let index = 0;
  async function next() {
    const currentIndex = index;
    index += 1;
    if (currentIndex >= items.length) return;
    try {
      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    } catch (error) {
      results[currentIndex] = { error, item: items[currentIndex] };
    }
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, next));
  return results;
}

