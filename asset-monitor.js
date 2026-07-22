(function initAssetMonitor() {
  const STORAGE_KEY = "aiTradingTerminal.assetMonitor.v1";
  const CRYPTO_SYMBOLS = new Set(["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "DOGE", "TRX", "TON", "DOT", "LINK", "LTC", "BCH", "AVAX", "SHIB", "UNI", "AAVE", "ETC", "ATOM", "NEAR", "APT", "ARB", "OP", "FIL", "ICP", "XLM", "HBAR", "PEPE", "SUI", "WLD", "TAO", "INJ", "SEI", "TIA", "FET", "ENA", "JUP", "BONK", "PI"]);
  const tab = document.getElementById("assetMonitorTab");
  const panel = document.getElementById("assetMonitorPanel");
  const form = document.getElementById("assetMonitorForm");
  if (!tab || !panel || !form) return;

  const fields = {
    symbol: document.getElementById("assetMonitorSymbol"),
    type: document.getElementById("assetMonitorType"),
    updated: document.getElementById("assetMonitorUpdated"),
    empty: document.getElementById("assetMonitorEmpty"),
    workspace: document.getElementById("assetMonitorWorkspace"),
    logo: document.getElementById("assetMonitorLogo"),
    name: document.getElementById("assetMonitorName"),
    fullName: document.getElementById("assetMonitorFullName"),
    favorite: document.getElementById("assetMonitorFavorite"),
    price: document.getElementById("assetMonitorPrice"),
    currency: document.getElementById("assetMonitorCurrency"),
    change: document.getElementById("assetMonitorChange"),
    frames: document.getElementById("assetMonitorFrames"),
    ohlcv: document.getElementById("assetMonitorOhlcv"),
    chart: document.getElementById("assetMonitorMiniChart"),
    metrics: document.getElementById("assetMonitorMetrics"),
    recommendations: document.getElementById("assetMonitorRecommendations"),
    recommendationTime: document.getElementById("assetMonitorRecommendationTime"),
    count: document.getElementById("assetMonitorCount"),
    filter: document.getElementById("assetMonitorFilter"),
    rows: document.getElementById("assetMonitorRows")
  };

  const state = {
    current: null,
    selectedSymbol: "",
    activeFrame: "1d",
    pendingAdd: "",
    loadingFrames: false,
    filter: ""
  };

  const toNumber = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  };
  const last = (values) => [...values].reverse().find((value) => toNumber(value) !== null) ?? null;
  const average = (values) => {
    const valid = values.map(toNumber).filter((value) => value !== null);
    return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  };
  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const normalizeSymbol = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, "");
  const baseSymbol = (value) => normalizeSymbol(value).replace(/[-/]?USDT(?:-SWAP)?$/, "").replace(/-USD$/, "");
  const classFor = (value, positiveThreshold = 0) => value > positiveThreshold ? "positive" : value < positiveThreshold ? "negative" : "neutral";
  const formatPercent = (value) => toNumber(value) === null ? "-" : `${value > 0 ? "+" : ""}${Number(value).toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
  const formatCompact = (value) => toNumber(value) === null ? "-" : new Intl.NumberFormat("vi-VN", { notation: "compact", maximumFractionDigits: 2 }).format(Number(value));
  const formatPrice = (value) => {
    const number = toNumber(value);
    if (number === null) return "-";
    const digits = number >= 1000 ? 0 : number >= 1 ? 2 : number >= 0.01 ? 4 : 8;
    return number.toLocaleString("vi-VN", { minimumFractionDigits: 0, maximumFractionDigits: digits });
  };

  function readItems() {
    try {
      const items = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(items) ? items : [];
    } catch {
      return [];
    }
  }

  function writeItems(items) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 40)));
  }

  function ema(values, period) {
    const result = Array(values.length).fill(null);
    if (values.length < period) return result;
    const multiplier = 2 / (period + 1);
    let current = average(values.slice(0, period));
    result[period - 1] = current;
    for (let index = period; index < values.length; index += 1) {
      current = (values[index] - current) * multiplier + current;
      result[index] = current;
    }
    return result;
  }

  function rsi(values, period = 14) {
    const result = Array(values.length).fill(null);
    if (values.length <= period) return result;
    let gain = 0;
    let loss = 0;
    for (let index = 1; index <= period; index += 1) {
      const change = values[index] - values[index - 1];
      gain += Math.max(change, 0);
      loss += Math.max(-change, 0);
    }
    let averageGain = gain / period;
    let averageLoss = loss / period;
    result[period] = averageLoss === 0 ? 100 : 100 - (100 / (1 + averageGain / averageLoss));
    for (let index = period + 1; index < values.length; index += 1) {
      const change = values[index] - values[index - 1];
      averageGain = ((averageGain * (period - 1)) + Math.max(change, 0)) / period;
      averageLoss = ((averageLoss * (period - 1)) + Math.max(-change, 0)) / period;
      result[index] = averageLoss === 0 ? 100 : 100 - (100 / (1 + averageGain / averageLoss));
    }
    return result;
  }

  function macd(values) {
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    const line = values.map((_, index) => fast[index] === null || slow[index] === null ? null : fast[index] - slow[index]);
    const compact = line.filter((value) => value !== null);
    const compactSignal = ema(compact, 9);
    const signal = Array(values.length).fill(null);
    let cursor = 0;
    line.forEach((value, index) => {
      if (value === null) return;
      signal[index] = compactSignal[cursor];
      cursor += 1;
    });
    const histogram = line.map((value, index) => value === null || signal[index] === null ? null : value - signal[index]);
    return { line, signal, histogram };
  }

  function atr(bars, period = 14) {
    const ranges = bars.map((bar, index) => {
      if (!index) return bar.high - bar.low;
      const previous = bars[index - 1].close;
      return Math.max(bar.high - bar.low, Math.abs(bar.high - previous), Math.abs(bar.low - previous));
    });
    const result = Array(bars.length).fill(null);
    if (ranges.length < period) return result;
    let current = average(ranges.slice(0, period));
    result[period - 1] = current;
    for (let index = period; index < ranges.length; index += 1) {
      current = ((current * (period - 1)) + ranges[index]) / period;
      result[index] = current;
    }
    return result;
  }

  function adx(bars, period = 14) {
    if (bars.length < period * 2 + 1) return null;
    const tr = [];
    const plusDm = [];
    const minusDm = [];
    for (let index = 1; index < bars.length; index += 1) {
      const current = bars[index];
      const previous = bars[index - 1];
      const up = current.high - previous.high;
      const down = previous.low - current.low;
      tr.push(Math.max(current.high - current.low, Math.abs(current.high - previous.close), Math.abs(current.low - previous.close)));
      plusDm.push(up > down && up > 0 ? up : 0);
      minusDm.push(down > up && down > 0 ? down : 0);
    }
    const dx = [];
    for (let index = period - 1; index < tr.length; index += 1) {
      const trSum = tr.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0);
      if (!trSum) continue;
      const plus = 100 * plusDm.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) / trSum;
      const minus = 100 * minusDm.slice(index - period + 1, index + 1).reduce((sum, value) => sum + value, 0) / trSum;
      dx.push({ value: plus + minus ? 100 * Math.abs(plus - minus) / (plus + minus) : 0, plus, minus });
    }
    const recent = dx.slice(-period);
    if (!recent.length) return null;
    return { value: average(recent.map((item) => item.value)), plus: last(recent.map((item) => item.plus)), minus: last(recent.map((item) => item.minus)) };
  }

  function normalizeBars(rawBars) {
    return (Array.isArray(rawBars) ? rawBars : []).map((bar) => ({
      timestamp: toNumber(bar.timestamp) ?? Date.parse(bar.time || ""),
      open: toNumber(bar.open) ?? toNumber(bar.close),
      high: toNumber(bar.high) ?? toNumber(bar.close),
      low: toNumber(bar.low) ?? toNumber(bar.close),
      close: toNumber(bar.close),
      volume: toNumber(bar.volume) ?? 0
    })).filter((bar) => bar.close !== null && Number.isFinite(bar.timestamp)).sort((a, b) => a.timestamp - b.timestamp);
  }

  function aggregateWeekly(bars) {
    const groups = new Map();
    bars.forEach((bar) => {
      const date = new Date(bar.timestamp);
      const monday = new Date(date);
      const day = (date.getDay() + 6) % 7;
      monday.setDate(date.getDate() - day);
      monday.setHours(0, 0, 0, 0);
      const key = monday.getTime();
      const item = groups.get(key);
      if (!item) groups.set(key, { ...bar, timestamp: key });
      else {
        item.high = Math.max(item.high, bar.high);
        item.low = Math.min(item.low, bar.low);
        item.close = bar.close;
        item.volume += bar.volume;
      }
    });
    return [...groups.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  function analyzeBars(rawBars, context = {}) {
    const bars = normalizeBars(rawBars);
    const closes = bars.map((bar) => bar.close);
    const volumes = bars.map((bar) => bar.volume);
    const current = bars.at(-1) || {};
    const previous = bars.at(-2) || {};
    const ema20 = ema(closes, 20);
    const ema50 = ema(closes, 50);
    const ema100 = ema(closes, 100);
    const ema200 = ema(closes, 200);
    const macdData = macd(closes);
    const rsiData = rsi(closes);
    const atrData = atr(bars);
    const adxData = adx(bars);
    const currentRsi = last(rsiData);
    const previousRsi = [...rsiData].reverse().filter((value) => value !== null)[1] ?? null;
    const currentAtr = last(atrData);
    const volumeMa20 = average(volumes.slice(-20));
    const relativeVolume = volumeMa20 ? current.volume / volumeMa20 : null;
    const middle = average(closes.slice(-20));
    const deviation = closes.length >= 20 ? Math.sqrt(closes.slice(-20).reduce((sum, value) => sum + ((value - middle) ** 2), 0) / 20) : null;
    const upper = deviation === null ? null : middle + deviation * 2;
    const lower = deviation === null ? null : middle - deviation * 2;
    const bandWidth = middle && upper !== null && lower !== null ? ((upper - lower) / middle) * 100 : null;
    const recent = bars.slice(-30);
    const support = recent.length ? Math.min(...recent.map((bar) => bar.low)) : null;
    const resistance = recent.length ? Math.max(...recent.map((bar) => bar.high)) : null;
    const earlier = bars.slice(-60, -30);
    const previousHigh = earlier.length ? Math.max(...earlier.map((bar) => bar.high)) : null;
    const previousLow = earlier.length ? Math.min(...earlier.map((bar) => bar.low)) : null;
    const structure = previousHigh !== null && resistance > previousHigh && previousLow !== null && support > previousLow
      ? "HH/HL"
      : previousHigh !== null && resistance < previousHigh && previousLow !== null && support < previousLow
        ? "LH/LL"
        : "Sideway";
    let obv = 0;
    const obvSeries = bars.map((bar, index) => {
      if (index) obv += bar.close > bars[index - 1].close ? bar.volume : bar.close < bars[index - 1].close ? -bar.volume : 0;
      return obv;
    });
    const roc = closes.length > 12 && closes.at(-13) ? ((current.close - closes.at(-13)) / closes.at(-13)) * 100 : null;
    const recentRsi = rsiData.filter((value) => value !== null).slice(-14);
    const stochasticRsi = recentRsi.length ? ((currentRsi - Math.min(...recentRsi)) / Math.max(0.000001, Math.max(...recentRsi) - Math.min(...recentRsi))) * 100 : null;
    const currentMacd = last(macdData.line);
    const currentSignal = last(macdData.signal);
    const histogram = last(macdData.histogram);
    const change = previous.close ? ((current.close - previous.close) / previous.close) * 100 : toNumber(context.quote?.changePercent);
    const trendStrong = current.close > last(ema20) && last(ema20) > last(ema50) && (last(ema100) === null || last(ema50) > last(ema100));
    const trendWeak = current.close < last(ema20) && last(ema20) < last(ema50);
    const trendSignal = trendStrong ? "Tăng mạnh" : trendWeak ? "Giảm" : current.close > last(ema20) ? "Tăng" : "Trung lập";
    const macdSignal = currentMacd !== null && currentSignal !== null ? currentMacd > currentSignal ? "Tăng" : "Giảm" : "Chưa đủ dữ liệu";
    const adxSignal = !adxData ? "Chưa đủ dữ liệu" : adxData.value > 40 ? "Trend rất mạnh" : adxData.value > 25 ? "Có xu hướng" : adxData.value < 20 ? "Đi ngang" : "Đang hình thành trend";
    const rsiSignal = currentRsi === null ? "Chưa đủ dữ liệu" : currentRsi > 70 ? "Quá mua" : currentRsi < 30 ? "Quá bán" : currentRsi > 55 ? "Tích cực" : currentRsi < 45 ? "Yếu" : "Trung lập";
    const volumeSignal = relativeVolume === null ? "Chưa đủ dữ liệu" : relativeVolume >= 1.5 ? "Dòng tiền mạnh" : relativeVolume >= 1 ? "Tích cực" : "Thanh khoản thấp";
    const atrPercent = current.close && currentAtr !== null ? (currentAtr / current.close) * 100 : null;
    const bollingerSignal = bandWidth === null ? "Chưa đủ dữ liệu" : bandWidth < 6 ? "Co hẹp" : bandWidth > 14 ? "Mở rộng" : "Ổn định";
    const structureSignal = structure === "HH/HL" ? "Tăng" : structure === "LH/LL" ? "Giảm" : "Trung lập";
    const marketStrength = toNumber(context.marketStrength?.relativeStrength ?? context.marketStrength?.changeDifference);
    const newsCount = Array.isArray(context.newsItems) ? context.newsItems.length : toNumber(context.payload?.news?.relatedCount) || 0;

    let trendScore = 0;
    if (current.close > last(ema20)) trendScore += 8;
    if (last(ema20) !== null && last(ema20) > last(ema50)) trendScore += 9;
    if (last(ema50) !== null && last(ema100) !== null && last(ema50) > last(ema100)) trendScore += 8;
    if (last(ema100) !== null && last(ema200) !== null && last(ema100) > last(ema200)) trendScore += 5;
    if (adxData?.value > 25) trendScore += 5;
    let momentumScore = 0;
    if (currentRsi !== null && currentRsi >= 50 && currentRsi <= 70) momentumScore += 10;
    else if (currentRsi !== null && currentRsi >= 40 && currentRsi < 50) momentumScore += 5;
    if (currentMacd !== null && currentSignal !== null && currentMacd > currentSignal) momentumScore += 10;
    if (histogram !== null && histogram > 0) momentumScore += 5;
    let volumeScore = relativeVolume === null ? 8 : relativeVolume >= 1.5 ? 20 : relativeVolume >= 1 ? 15 : relativeVolume >= 0.7 ? 9 : 4;
    let structureScore = structure === "HH/HL" ? 10 : structure === "Sideway" ? 5 : 2;
    const newsScore = newsCount > 2 ? 10 : newsCount > 0 ? 7 : 5;
    const totalScore = Math.max(0, Math.min(100, Math.round(trendScore + momentumScore + volumeScore + structureScore + newsScore)));

    return {
      bars, current, change, ema20: last(ema20), ema50: last(ema50), ema100: last(ema100), ema200: last(ema200),
      currentMacd, currentSignal, histogram, adx: adxData, rsi: currentRsi, rsiDirection: currentRsi !== null && previousRsi !== null ? currentRsi >= previousRsi ? "Tăng" : "Giảm" : "-",
      stochasticRsi, roc, volumeMa20, relativeVolume, obv: last(obvSeries), atr: currentAtr, atrPercent,
      upper, middle, lower, bandWidth, support, resistance, structure, marketStrength, newsCount,
      trendSignal, macdSignal, adxSignal, rsiSignal, volumeSignal, bollingerSignal, structureSignal,
      totalScore, groupScores: { trend: trendScore, momentum: momentumScore, volume: volumeScore, structure: structureScore, news: newsScore }
    };
  }

  function recommendation(score, horizon) {
    const common = score >= 85 ? { text: "MUA MẠNH", className: "positive" }
      : score >= 70 ? { text: "MUA", className: "positive" }
        : score >= 55 ? { text: "NẮM GIỮ", className: "neutral" }
          : score >= 40 ? { text: "GIẢM TỶ TRỌNG", className: "neutral" }
            : { text: "BÁN", className: "negative" };
    if (horizon === "week") {
      common.text = score >= 85 ? "TĂNG MẠNH" : score >= 70 ? "TĂNG" : score >= 55 ? "TRUNG LẬP" : score >= 40 ? "GIẢM" : "GIẢM MẠNH";
    }
    if (horizon === "month") {
      common.text = score >= 85 ? "TÍCH LŨY" : score >= 70 ? "MUA DẦN" : score >= 55 ? "NẮM GIỮ" : score >= 40 ? "CHỐT LỜI TỪNG PHẦN" : "GIẢM TỶ TRỌNG";
    }
    return common;
  }

  function metricCard(index, title, accent, rows, signal, signalClass) {
    return `<article class="asset-monitor-metric" style="--metric-accent:${accent}">
      <div class="asset-monitor-metric-head"><i>${String(index).padStart(2, "0")}</i><strong>${escapeHtml(title)}</strong></div>
      <dl>${rows.map(([label, value, className = ""]) => `<dt>${escapeHtml(label)}</dt><dd class="${className}">${escapeHtml(value)}</dd>`).join("")}</dl>
      <footer><span>Tín hiệu</span><b class="${signalClass}">${escapeHtml(signal)}</b></footer>
    </article>`;
  }

  function renderMetrics(analysis, context) {
    const crypto = context.assetType === "crypto";
    const quote = context.quote || {};
    const transactionValue = analysis.current.close * analysis.current.volume;
    const flowRows = crypto
      ? [["Funding Rate", quote.fundingRate === undefined ? "Chưa có nguồn" : formatPercent(quote.fundingRate)], ["Open Interest", quote.openInterest === undefined ? "Chưa có nguồn" : formatCompact(quote.openInterest)], ["Liquidation", "Chưa có nguồn công khai"]]
      : [["Giá đóng cửa", formatPrice(analysis.current.close)], ["Khối lượng", formatCompact(analysis.current.volume)], ["Giá trị GD", formatCompact(transactionValue)]];
    const strengthText = analysis.marketStrength === null ? "Chưa đủ dữ liệu" : formatPercent(analysis.marketStrength);
    const strengthClass = analysis.marketStrength === null ? "neutral" : classFor(analysis.marketStrength);
    const sentiment = crypto ? document.getElementById("marketBtcDominance")?.textContent || "-" : document.getElementById("marketVniChange")?.textContent || "-";
    fields.metrics.innerHTML = [
      metricCard(1, "Xu hướng (EMA)", "#22c55e", [["EMA20", formatPrice(analysis.ema20), classFor(analysis.current.close - analysis.ema20)], ["EMA50", formatPrice(analysis.ema50)], ["EMA100", formatPrice(analysis.ema100)], ["EMA200", formatPrice(analysis.ema200)]], analysis.trendSignal, analysis.trendSignal.includes("Tăng") ? "positive" : analysis.trendSignal.includes("Giảm") ? "negative" : "neutral"),
      metricCard(2, "MACD", "#38bdf8", [["MACD Line", formatPrice(analysis.currentMacd)], ["Signal Line", formatPrice(analysis.currentSignal)], ["Histogram", formatPrice(analysis.histogram), classFor(analysis.histogram)]], analysis.macdSignal, analysis.macdSignal === "Tăng" ? "positive" : analysis.macdSignal === "Giảm" ? "negative" : "neutral"),
      metricCard(3, "ADX", "#a855f7", [["ADX(14)", formatPrice(analysis.adx?.value)], ["+DI", formatPrice(analysis.adx?.plus), "positive"], ["-DI", formatPrice(analysis.adx?.minus), "negative"]], analysis.adxSignal, analysis.adx?.value > 25 ? "positive" : "neutral"),
      metricCard(4, "Momentum", "#f59e0b", [["RSI(14)", formatPrice(analysis.rsi)], ["RSI hướng", analysis.rsiDirection, analysis.rsiDirection === "Tăng" ? "positive" : "negative"], ["Stoch RSI", formatPrice(analysis.stochasticRsi)], ["ROC(12)", formatPercent(analysis.roc), classFor(analysis.roc)]], analysis.rsiSignal, analysis.rsiSignal === "Tích cực" ? "positive" : analysis.rsiSignal === "Yếu" ? "negative" : "neutral"),
      metricCard(5, "Khối lượng", "#14b8a6", [["Volume", formatCompact(analysis.current.volume)], ["Volume MA20", formatCompact(analysis.volumeMa20)], ["Relative Volume", analysis.relativeVolume === null ? "-" : `${analysis.relativeVolume.toFixed(2)}x`], ["OBV", formatCompact(analysis.obv)]], analysis.volumeSignal, analysis.relativeVolume >= 1 ? "positive" : "neutral"),
      metricCard(6, "ATR", "#818cf8", [["ATR(14)", formatPrice(analysis.atr)], ["ATR %", formatPercent(analysis.atrPercent)], ["Biên nến", formatPercent(analysis.current.low ? ((analysis.current.high - analysis.current.low) / analysis.current.low) * 100 : null)]], analysis.atrPercent > 4 ? "Biến động cao" : "Biến động vừa", analysis.atrPercent > 6 ? "negative" : "neutral"),
      metricCard(7, "Bollinger Band", "#d946ef", [["Upper", formatPrice(analysis.upper)], ["Middle", formatPrice(analysis.middle)], ["Lower", formatPrice(analysis.lower)], ["Band Width", formatPercent(analysis.bandWidth)]], analysis.bollingerSignal, analysis.bollingerSignal === "Mở rộng" ? "positive" : "neutral"),
      metricCard(8, "Cấu trúc thị trường", "#4ade80", [["Structure", analysis.structure], ["Break of Structure", analysis.structure !== "Sideway" ? "Có" : "Chưa"], ["Change of Character", "Cần xác nhận đa khung"]], analysis.structureSignal, analysis.structureSignal === "Tăng" ? "positive" : analysis.structureSignal === "Giảm" ? "negative" : "neutral"),
      metricCard(9, "Hỗ trợ / Kháng cự", "#ef4444", [["Kháng cự", formatPrice(analysis.resistance), "negative"], ["Hỗ trợ", formatPrice(analysis.support), "positive"], ["Khoảng giá", formatPercent(analysis.support ? ((analysis.resistance - analysis.support) / analysis.support) * 100 : null)]], analysis.current.close > analysis.middle ? "Vị trí tích cực" : "Cần thận trọng", analysis.current.close > analysis.middle ? "positive" : "neutral"),
      metricCard(10, "Dòng tiền", "#22c55e", flowRows, analysis.volumeSignal, analysis.relativeVolume >= 1 ? "positive" : "neutral"),
      metricCard(11, "Sức mạnh thị trường", "#38bdf8", [[crypto ? "So với BTC" : "So với VNINDEX", strengthText, strengthClass], ["24h hiện tại", formatPercent(analysis.change), classFor(analysis.change)], ["Trạng thái", strengthText === "Chưa đủ dữ liệu" ? "Cần benchmark" : analysis.marketStrength > 0 ? "Mạnh hơn" : "Yếu hơn"]], strengthText === "Chưa đủ dữ liệu" ? "Chờ đối chiếu" : analysis.marketStrength > 0 ? "Mạnh" : "Yếu", strengthClass),
      metricCard(12, "Tâm lý & Tin tức", "#eab308", [[crypto ? "BTC Dominance" : "VN-Index", sentiment], ["Tin liên quan", String(analysis.newsCount)], ["Vĩ mô", "Theo bảng thị trường"]], analysis.newsCount ? "Có tin cần theo dõi" : "Chưa có catalyst", analysis.newsCount ? "neutral" : "neutral")
    ].join("");
  }

  function renderChart(bars) {
    const data = bars.slice(-80);
    if (!data.length) {
      fields.chart.innerHTML = "";
      return;
    }
    const width = 420;
    const height = 248;
    const priceHeight = 176;
    const left = 8;
    const right = 8;
    const min = Math.min(...data.map((bar) => bar.low));
    const max = Math.max(...data.map((bar) => bar.high));
    const range = Math.max(max - min, Math.abs(max) * 0.001);
    const maxVolume = Math.max(...data.map((bar) => bar.volume), 1);
    const step = (width - left - right) / data.length;
    const x = (index) => left + index * step + step / 2;
    const y = (value) => 8 + ((max - value) / range) * (priceHeight - 16);
    const candles = data.map((bar, index) => {
      const color = bar.close >= bar.open ? "#22c55e" : "#ef4444";
      const bodyTop = y(Math.max(bar.open, bar.close));
      const bodyHeight = Math.max(1.5, Math.abs(y(bar.open) - y(bar.close)));
      const volumeHeight = (bar.volume / maxVolume) * 50;
      return `<line x1="${x(index)}" y1="${y(bar.high)}" x2="${x(index)}" y2="${y(bar.low)}" stroke="${color}" stroke-width="1"/><rect x="${x(index) - Math.max(1, step * 0.28)}" y="${bodyTop}" width="${Math.max(2, step * 0.56)}" height="${bodyHeight}" fill="${color}"/><rect x="${x(index) - Math.max(1, step * 0.28)}" y="${height - volumeHeight - 5}" width="${Math.max(2, step * 0.56)}" height="${volumeHeight}" fill="${color}" opacity="0.5"/>`;
    }).join("");
    fields.chart.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><g stroke="#1e344e" stroke-width="1">${[35, 75, 115, 155, 195].map((value) => `<line x1="0" y1="${value}" x2="${width}" y2="${value}"/>`).join("")}</g>${candles}<line x1="0" y1="${y(data.at(-1).close)}" x2="${width}" y2="${y(data.at(-1).close)}" stroke="#38bdf8" stroke-dasharray="3 3" opacity="0.7"/></svg>`;
  }

  function renderRecommendations(context) {
    const dayAnalysis = context.analyses["1h"] || context.analyses["1d"];
    const weekAnalysis = context.analyses["4h"] || context.analyses["1d"];
    const monthAnalysis = context.analyses["1w"] || context.analyses["1d"];
    const entries = [
      ["Trong ngày", "1H", dayAnalysis, "day"],
      ["Trong tuần", "4H / 1D", weekAnalysis, "week"],
      ["Trong tháng", "1W", monthAnalysis, "month"]
    ];
    fields.recommendations.innerHTML = entries.map(([label, frame, analysis, horizon]) => {
      const score = analysis?.totalScore ?? 50;
      const result = recommendation(score, horizon);
      const color = result.className === "positive" ? "#22c55e" : result.className === "negative" ? "#ef4444" : "#f5b800";
      return `<article class="asset-monitor-recommendation" style="--recommendation-color:${color}"><header><span>${label} (${frame})</span><em>Điểm kỹ thuật</em></header><strong class="${result.className}">${result.text}</strong><p>Xu hướng ${analysis?.trendSignal || "chưa rõ"}; RSI ${formatPrice(analysis?.rsi)}; volume ${analysis?.relativeVolume ? `${analysis.relativeVolume.toFixed(2)}x` : "chưa đủ"}.</p><div class="score-line"><span>Điểm: ${score}/100</span><b>${score}%</b></div><div class="asset-monitor-progress"><span style="width:${score}%"></span></div></article>`;
    }).join("");
    fields.recommendationTime.textContent = `Cập nhật: ${new Date(context.updatedAt || Date.now()).toLocaleString("vi-VN")}`;
  }

  function renderDetail() {
    const context = state.current;
    if (!context) {
      fields.empty.hidden = false;
      fields.workspace.hidden = true;
      return;
    }
    const analysis = context.analyses[state.activeFrame] || context.analyses["1d"];
    if (!analysis) return;
    fields.empty.hidden = true;
    fields.workspace.hidden = false;
    const symbol = baseSymbol(context.symbol);
    fields.logo.textContent = symbol.slice(0, 3);
    fields.name.textContent = context.assetType === "crypto" ? `${symbol}/USDT` : `${symbol} · ${context.overview?.exchange || context.quote?.exchange || "VN"}`;
    fields.fullName.textContent = context.overview?.name || symbol;
    fields.price.textContent = formatPrice(analysis.current.close ?? context.quote?.price);
    fields.currency.textContent = context.assetType === "crypto" ? "USDT" : "VND";
    fields.change.textContent = formatPercent(analysis.change);
    fields.change.className = classFor(analysis.change);
    fields.updated.textContent = `Cập nhật ${new Date(context.updatedAt || Date.now()).toLocaleString("vi-VN")}`;
    fields.frames.querySelectorAll("button").forEach((button) => button.classList.toggle("active", button.dataset.monitorFrame === state.activeFrame));
    const bar = analysis.current;
    fields.ohlcv.innerHTML = [["Open", bar.open], ["High", bar.high], ["Low", bar.low], ["Close", bar.close], ["Volume", bar.volume]].map(([label, value]) => `<span>${label}<strong>${label === "Volume" ? formatCompact(value) : formatPrice(value)}</strong></span>`).join("");
    renderChart(analysis.bars);
    renderMetrics(analysis, context);
    renderRecommendations(context);
  }

  function snapshotFromContext(context) {
    const daily = context.analyses["1d"];
    const day = recommendation((context.analyses["1h"] || daily).totalScore, "day");
    const week = recommendation((context.analyses["4h"] || daily).totalScore, "week");
    const month = recommendation((context.analyses["1w"] || daily).totalScore, "month");
    return {
      symbol: baseSymbol(context.symbol),
      assetType: context.assetType,
      name: context.overview?.name || baseSymbol(context.symbol),
      exchange: context.overview?.exchange || context.quote?.exchange || context.source || "-",
      updatedAt: context.updatedAt,
      analysis: {
        price: daily.current.close,
        change: daily.change,
        trendSignal: daily.trendSignal,
        macdSignal: daily.macdSignal,
        adx: daily.adx?.value,
        rsi: daily.rsi,
        relativeVolume: daily.relativeVolume,
        atrPercent: daily.atrPercent,
        bollingerSignal: daily.bollingerSignal,
        structure: daily.structure,
        support: daily.support,
        resistance: daily.resistance,
        volumeSignal: daily.volumeSignal,
        marketStrength: daily.marketStrength,
        newsCount: daily.newsCount,
        day, week, month,
        dayScore: (context.analyses["1h"] || daily).totalScore,
        weekScore: (context.analyses["4h"] || daily).totalScore,
        monthScore: (context.analyses["1w"] || daily).totalScore
      }
    };
  }

  function saveCurrent() {
    if (!state.current) return;
    const snapshot = snapshotFromContext(state.current);
    const items = readItems();
    const index = items.findIndex((item) => item.symbol === snapshot.symbol);
    if (index >= 0) items[index] = snapshot;
    else items.unshift(snapshot);
    writeItems(items);
    state.selectedSymbol = snapshot.symbol;
    renderList();
  }

  function renderList() {
    const filter = state.filter.toLowerCase();
    const items = readItems().filter((item) => !filter || `${item.symbol} ${item.name}`.toLowerCase().includes(filter));
    fields.count.textContent = `(${readItems().length})`;
    if (!items.length) {
      fields.rows.innerHTML = `<tr><td colspan="19" class="asset-monitor-table-empty">${filter ? "Không tìm thấy mã phù hợp." : "Chưa có mã nào."}</td></tr>`;
      return;
    }
    fields.rows.innerHTML = items.map((item) => {
      const data = item.analysis || {};
      const rec = (value) => `<span class="asset-monitor-rec-pill ${value?.className || "neutral"}">${escapeHtml(value?.text || "-")}</span>`;
      return `<tr data-monitor-symbol="${escapeHtml(item.symbol)}" class="${item.symbol === state.selectedSymbol ? "is-selected" : ""}">
        <td><div class="asset-monitor-symbol-cell"><i>${escapeHtml(item.symbol.slice(0, 2))}</i><span><strong>${escapeHtml(item.assetType === "crypto" ? `${item.symbol}/USDT` : item.symbol)}</strong><small>${escapeHtml(item.name)}</small></span></div></td>
        <td>${formatPrice(data.price)}</td><td class="${classFor(data.change)}">${formatPercent(data.change)}</td>
        <td class="${data.trendSignal?.includes("Tăng") ? "positive" : data.trendSignal?.includes("Giảm") ? "negative" : "neutral"}">${escapeHtml(data.trendSignal || "-")}</td>
        <td class="${data.macdSignal === "Tăng" ? "positive" : data.macdSignal === "Giảm" ? "negative" : "neutral"}">${escapeHtml(data.macdSignal || "-")}</td>
        <td>${formatPrice(data.adx)}</td><td>${formatPrice(data.rsi)}</td><td>${data.relativeVolume ? `${data.relativeVolume.toFixed(2)}x` : "-"}</td><td>${formatPercent(data.atrPercent)}</td>
        <td>${escapeHtml(data.bollingerSignal || "-")}</td><td>${escapeHtml(data.structure || "-")}</td><td><span class="positive">${formatPrice(data.support)}</span> / <span class="negative">${formatPrice(data.resistance)}</span></td>
        <td>${escapeHtml(data.volumeSignal || "-")}</td><td>${data.marketStrength === null || data.marketStrength === undefined ? "Chờ benchmark" : formatPercent(data.marketStrength)}</td><td>${data.newsCount ? `${data.newsCount} tin` : "Trung lập"}</td>
        <td>${rec(data.day)}</td><td>${rec(data.week)}</td><td>${rec(data.month)}</td><td><button type="button" class="asset-monitor-delete" data-monitor-delete="${escapeHtml(item.symbol)}">Xóa</button></td>
      </tr>`;
    }).join("");
  }

  async function hydrateFrames(context) {
    if (state.loadingFrames || !context || window.aiTradingTerminalBridge?.getLatestAsset()?.symbol !== context.symbol) return;
    state.loadingFrames = true;
    fields.updated.textContent = "Đang tải dữ liệu 1H và 4H...";
    try {
      const [oneHour, fourHour] = await Promise.allSettled([
        window.aiTradingTerminalBridge.requestFrame("1h"),
        window.aiTradingTerminalBridge.requestFrame("4h")
      ]);
      if (oneHour.status === "fulfilled" && oneHour.value.length) context.analyses["1h"] = analyzeBars(oneHour.value, context);
      if (fourHour.status === "fulfilled" && fourHour.value.length) context.analyses["4h"] = analyzeBars(fourHour.value, context);
      context.updatedAt = Date.now();
      if (state.current === context) renderDetail();
      if (readItems().some((item) => item.symbol === baseSymbol(context.symbol))) {
        saveCurrent();
      }
    } finally {
      state.loadingFrames = false;
    }
  }

  function buildContext(detail) {
    const dailyBars = normalizeBars(detail.bars);
    const context = {
      ...detail,
      symbol: baseSymbol(detail.symbol),
      analyses: {}
    };
    context.analyses["1d"] = analyzeBars(dailyBars, context);
    context.analyses["1w"] = analyzeBars(aggregateWeekly(dailyBars), context);
    return context;
  }

  function handleAssetLoaded(detail) {
    if (!detail?.bars?.length) return;
    const context = buildContext(detail);
    const symbol = baseSymbol(detail.symbol);
    const shouldSave = state.pendingAdd === symbol || readItems().some((item) => item.symbol === symbol);
    if (state.pendingAdd && state.pendingAdd !== symbol) return;
    state.current = context;
    state.selectedSymbol = symbol;
    state.activeFrame = "1d";
    fields.symbol.value = symbol;
    fields.type.value = detail.assetType || "auto";
    renderDetail();
    if (shouldSave) saveCurrent();
    state.pendingAdd = "";
    if (!panel.hidden) hydrateFrames(context);
  }

  function activateTab() {
    document.querySelectorAll(".tab").forEach((item) => {
      const active = item === tab;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    document.querySelectorAll(".tab-panel").forEach((item) => {
      const active = item === panel;
      item.hidden = !active;
      item.classList.toggle("active", active);
    });
    document.querySelector(".terminal-layout")?.setAttribute("data-active-tab", "assetMonitor");
    const latest = window.aiTradingTerminalBridge?.getLatestAsset();
    if (!state.current && latest?.bars?.length) handleAssetLoaded(latest);
    if (state.current) hydrateFrames(state.current);
  }

  tab.addEventListener("click", activateTab);
  document.addEventListener("click", (event) => {
    const otherTab = event.target.closest(".tab");
    if (otherTab && otherTab !== tab) {
      panel.hidden = true;
      panel.classList.remove("active");
    }
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const symbol = baseSymbol(fields.symbol.value);
    if (!symbol) {
      fields.symbol.focus();
      return;
    }
    const latest = window.aiTradingTerminalBridge?.getLatestAsset();
    state.pendingAdd = symbol;
    fields.updated.textContent = `Đang tải ${symbol}...`;
    if (latest?.bars?.length && baseSymbol(latest.symbol) === symbol) handleAssetLoaded(latest);
    else window.aiTradingTerminalBridge?.search(symbol);
  });

  fields.frames.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-monitor-frame]");
    if (!button || !state.current) return;
    state.activeFrame = button.dataset.monitorFrame;
    renderDetail();
  });

  fields.filter.addEventListener("input", () => {
    state.filter = fields.filter.value.trim();
    renderList();
  });

  fields.rows.addEventListener("click", (event) => {
    const deleteButton = event.target.closest("button[data-monitor-delete]");
    if (deleteButton) {
      const symbol = deleteButton.dataset.monitorDelete;
      writeItems(readItems().filter((item) => item.symbol !== symbol));
      if (state.selectedSymbol === symbol) state.selectedSymbol = "";
      renderList();
      event.stopPropagation();
      return;
    }
    const row = event.target.closest("tr[data-monitor-symbol]");
    if (!row) return;
    const symbol = row.dataset.monitorSymbol;
    state.selectedSymbol = symbol;
    state.pendingAdd = symbol;
    renderList();
    window.aiTradingTerminalBridge?.search(symbol);
  });

  window.addEventListener("ai-trading-terminal:asset-loaded", (event) => handleAssetLoaded(event.detail));
  renderList();
}());
