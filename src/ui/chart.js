let lightweightChart = null;
let candleSeries = null;
let volumeSeries = null;
let ma20Series = null;
let ma50Series = null;
let ma100Series = null;
let ma200Series = null;
let overlaySeries = {};
let chartSeriesState = { times: [] };
let latestChartPoints = [];
let latestChartMovingAverages = null;
let chartHudState = { points: [], movingAverages: null, indexByTime: new Map() };
let syncingVisibleRange = false;

const PROFESSIONAL_CHART_COLORS = {
  background: "#131722",
  grid: "rgba(42, 46, 57, 0.72)",
  text: "#b2b5be",
  border: "#2a2e39",
  up: "#26a69a",
  down: "#ef5350",
  ma20: "#2196f3",
  ma50: "#22c55e",
  ma100: "#f97316",
  ma200: "#a855f7"
};

const OVERLAY_CONFIG_KEY = "trading-terminal-overlays-v1";
const DEFAULT_OVERLAY_CONFIG = {
  ma20: true,
  ma50: true,
  ma100: true,
  ma200: true,
  bollinger: false,
  vwap: false,
  supertrend: false,
  ichimoku: false,
  markers: false,
  orderBlock: false,
  fvg: false
};

function lightweightSeries(chart, kind, seriesType, options) {
  if (!chart) return null;
  if (chart.addSeries && seriesType) return chart.addSeries(seriesType, options);
  if (kind === "candlestick" && chart.addCandlestickSeries) return chart.addCandlestickSeries(options);
  if (kind === "histogram" && chart.addHistogramSeries) return chart.addHistogramSeries(options);
  if (kind === "line" && chart.addLineSeries) return chart.addLineSeries(options);
  return null;
}

function ensureLightweightChart() {
  const container = chartCanvas;
  const lightweight = window.LightweightCharts;
  if (!container || !lightweight) return null;
  if (lightweightChart) return lightweightChart;

  lightweightChart = lightweight.createChart(container, {
    width: container.clientWidth || 900,
    height: container.clientHeight || 560,
    autoSize: true,
    layout: {
      background: { type: lightweight.ColorType.Solid, color: PROFESSIONAL_CHART_COLORS.background },
      textColor: PROFESSIONAL_CHART_COLORS.text,
      fontFamily: "Inter, 'Be Vietnam Pro', Arial, sans-serif",
      fontSize: 12
    },
    grid: {
      vertLines: { color: PROFESSIONAL_CHART_COLORS.grid },
      horzLines: { color: PROFESSIONAL_CHART_COLORS.grid }
    },
    rightPriceScale: {
      borderVisible: false,
      alignLabels: true,
      entireTextOnly: true,
      scaleMargins: { top: 0.12, bottom: 0.25 }
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 8,
      barSpacing: 7,
      minBarSpacing: 3,
      fixLeftEdge: true
    },
    crosshair: {
      mode: lightweight.CrosshairMode.Normal,
      vertLine: { color: "rgba(178, 181, 190, 0.55)", width: 1, style: lightweight.LineStyle?.Dashed ?? 2, labelBackgroundColor: "#363a45" },
      horzLine: { color: "rgba(178, 181, 190, 0.55)", width: 1, style: lightweight.LineStyle?.Dashed ?? 2, labelBackgroundColor: "#363a45" }
    },
    handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
    handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    kineticScroll: { mouse: true, touch: true },
    localization: {
      locale: "vi-VN",
      priceFormatter: (price) => formatAssetPrice(price)
    }
  });

  candleSeries = lightweightSeries(lightweightChart, "candlestick", lightweight.CandlestickSeries, {
    upColor: PROFESSIONAL_CHART_COLORS.up,
    downColor: PROFESSIONAL_CHART_COLORS.down,
    borderVisible: false,
    wickUpColor: PROFESSIONAL_CHART_COLORS.up,
    wickDownColor: PROFESSIONAL_CHART_COLORS.down,
    priceLineColor: "#2962ff",
    priceLineWidth: 1,
    priceLineStyle: lightweight.LineStyle?.Dotted ?? 1,
    lastValueVisible: true
  });
  volumeSeries = lightweightSeries(lightweightChart, "histogram", lightweight.HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    base: 0
  });
  lightweightChart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 }, borderVisible: false });

  // Keep moving averages visually secondary to the candles, matching TradingView's default weight.
  const maOptions = { lineWidth: 1, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false };
  ma20Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: PROFESSIONAL_CHART_COLORS.ma20 });
  ma50Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: PROFESSIONAL_CHART_COLORS.ma50 });
  ma100Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: PROFESSIONAL_CHART_COLORS.ma100 });
  ma200Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: PROFESSIONAL_CHART_COLORS.ma200 });
  ensureOverlaySeries();

  lightweightChart.subscribeCrosshairMove((param) => {
    const index = chartHudState.indexByTime.get(chartTimeKey(param?.time));
    if (index === undefined) {
      updateChartHud(chartHudState.points.length - 1);
      return;
    }
    updateChartHud(index);
  });
  lightweightChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
    if (!range || syncingVisibleRange || typeof indicatorCharts === "undefined") return;
    syncingVisibleRange = true;
    indicatorCharts.rsi?.timeScale().setVisibleLogicalRange(range);
    indicatorCharts.macd?.timeScale().setVisibleLogicalRange(range);
    syncingVisibleRange = false;
  });

  new ResizeObserver(() => {
    if (!lightweightChart || !container.isConnected) return;
    lightweightChart.applyOptions({ width: container.clientWidth || 900, height: container.clientHeight || 560 });
  }).observe(container);

  return lightweightChart;
}

function chartTimeKey(time) {
  if (time && typeof time === "object") return `${time.year}-${time.month}-${time.day}`;
  return String(time ?? "");
}

function setChartHudText(id, value) {
  const target = document.getElementById(id);
  if (target) target.textContent = value;
}

function updateChartHud(index) {
  const points = chartHudState.points;
  const point = points[index];
  if (!point) return;
  const previousClose = index > 0 ? toNumber(points[index - 1]?.close) : null;
  const close = toNumber(point.close);
  const change = close !== null && previousClose ? ((close - previousClose) / previousClose) * 100 : null;
  const symbol = safeText(fields?.ticker?.textContent || currentSymbol || "-");
  const exchange = safeText(fields?.listedExchange?.textContent || "");
  const preset = CHART_PRESETS?.[activeChartRange];
  setChartHudText("chartHudSymbol", exchange && exchange !== "-" ? `${symbol} · ${exchange}` : symbol);
  setChartHudText("chartHudTimeframe", preset?.label || activeChartRange || "-");
  setChartHudText("chartHudOpen", formatAssetPrice(point.open));
  setChartHudText("chartHudHigh", formatAssetPrice(point.high));
  setChartHudText("chartHudLow", formatAssetPrice(point.low));
  setChartHudText("chartHudClose", formatAssetPrice(point.close));
  setChartHudText("chartHudChange", change === null ? "-" : formatPercent(change));
  const changeTarget = document.getElementById("chartHudChange");
  changeTarget?.classList.remove("positive", "negative", "neutral");
  if (changeTarget) changeTarget.classList.add(change > 0 ? "positive" : change < 0 ? "negative" : "neutral");
  const statusTarget = document.getElementById("chartHudStatus");
  statusTarget?.classList.toggle("negative", change < 0);

  const averages = chartHudState.movingAverages || {};
  setChartHudText("chartHudMa20", formatAssetPrice(averages.ma10?.[index]));
  setChartHudText("chartHudMa50", formatAssetPrice(averages.ma50?.[index]));
  setChartHudText("chartHudMa100", formatAssetPrice(averages.ma100?.[index]));
  setChartHudText("chartHudMa200", formatAssetPrice(averages.ma200?.[index]));
}

function fitLightweightChartContent() {
  lightweightChart?.timeScale().fitContent();
}

function showRecentLogicalRange(chart, length, visibleBars = 160) {
  if (!chart || !length) return;
  chart.timeScale().setVisibleLogicalRange({
    from: Math.max(0, length - visibleBars),
    to: length + 8
  });
}

function downloadLightweightChartScreenshot() {
  const canvas = lightweightChart?.takeScreenshot?.();
  if (!canvas) {
    setMessage("Không thể chụp ảnh biểu đồ lúc này.");
    return;
  }
  const link = document.createElement("a");
  link.download = `${safeText(currentSymbol || "chart")}-${safeText(activeChartRange || "range")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function getOverlayConfig() {
  try {
    return { ...DEFAULT_OVERLAY_CONFIG, ...JSON.parse(localStorage.getItem(OVERLAY_CONFIG_KEY) || "{}") };
  } catch {
    return { ...DEFAULT_OVERLAY_CONFIG };
  }
}

function saveOverlayConfig(config) {
  localStorage.setItem(OVERLAY_CONFIG_KEY, JSON.stringify({ ...DEFAULT_OVERLAY_CONFIG, ...config }));
}

function overlayControls() {
  return {
    ma20: document.getElementById("toggleMa20Overlay"),
    ma50: document.getElementById("toggleMa50Overlay"),
    ma100: document.getElementById("toggleMa100Overlay"),
    ma200: document.getElementById("toggleMa200Overlay"),
    bollinger: document.getElementById("toggleBollingerOverlay"),
    vwap: document.getElementById("toggleVwapOverlay"),
    supertrend: document.getElementById("toggleSupertrendOverlay"),
    ichimoku: document.getElementById("toggleIchimokuOverlay"),
    markers: document.getElementById("toggleSignalMarkers"),
    orderBlock: document.getElementById("toggleOrderBlockOverlay"),
    fvg: document.getElementById("toggleFvgOverlay")
  };
}

function syncMovingAverageVisibility(config = getOverlayConfig()) {
  ["ma20", "ma50", "ma100", "ma200"].forEach((key) => {
    document.querySelectorAll(`[data-ma-key="${key}"]`).forEach((element) => {
      element.classList.toggle("ma-series-hidden", config[key] === false);
    });
  });
  const allHidden = ["ma20", "ma50", "ma100", "ma200"].every((key) => config[key] === false);
  const summary = document.querySelector(".ma-summary");
  const summaryItems = [...(summary?.querySelectorAll("[data-ma-key]") || [])];
  const visibleItems = summaryItems.filter((element) => config[element.dataset.maKey] !== false);
  summaryItems.forEach((element) => element.classList.remove("ma-last-visible"));
  visibleItems.at(-1)?.classList.add("ma-last-visible");
  summary?.style.setProperty("grid-template-columns", `repeat(${Math.max(visibleItems.length, 1)}, minmax(0, 1fr))`, "important");
  summary?.classList.toggle("all-ma-hidden", allHidden);
  document.querySelector(".chart-inline-legend")?.classList.toggle("all-ma-hidden", allHidden);
}

function renderMovingAverageSeries(points, movingAverages, useUpdate = false) {
  const config = getOverlayConfig();
  const averages = movingAverages || calculateMovingAverages(points);
  updateLineSeries(ma20Series, config.ma20 ? lineData(points, averages.ma10) : [], useUpdate && config.ma20);
  updateLineSeries(ma50Series, config.ma50 ? lineData(points, averages.ma50) : [], useUpdate && config.ma50);
  updateLineSeries(ma100Series, config.ma100 ? lineData(points, averages.ma100) : [], useUpdate && config.ma100);
  updateLineSeries(ma200Series, config.ma200 ? lineData(points, averages.ma200) : [], useUpdate && config.ma200);
  syncMovingAverageVisibility(config);
}

function setupOverlayManager() {
  const controls = overlayControls();
  if (!Object.values(controls).some(Boolean)) return;
  const config = getOverlayConfig();
  syncMovingAverageVisibility(config);
  Object.entries(controls).forEach(([key, control]) => {
    if (!control) return;
    control.checked = Boolean(config[key]);
    control.addEventListener("change", () => {
      const nextConfig = Object.fromEntries(Object.entries(overlayControls()).map(([name, input]) => [name, Boolean(input?.checked)]));
      saveOverlayConfig(nextConfig);
      renderMovingAverageSeries(latestChartPoints, latestChartMovingAverages, false);
      renderAdvancedOverlays(latestChartPoints, latestChartMovingAverages, { forceSetData: true });
    });
  });
}

function ensureOverlaySeries() {
  if (!lightweightChart || overlaySeries.bollingerUpper) return;
  const lightweight = window.LightweightCharts;
  const line = { lineWidth: 1, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false };
  overlaySeries.bollingerUpper = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#facc15" });
  overlaySeries.bollingerMiddle = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "rgba(250, 204, 21, 0.65)" });
  overlaySeries.bollingerLower = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#facc15" });
  overlaySeries.vwap = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, lineWidth: 2, color: "#60a5fa" });
  overlaySeries.supertrend = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, lineWidth: 2, color: "#4ade80" });
  overlaySeries.tenkan = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#f472b6" });
  overlaySeries.kijun = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#818cf8" });
  overlaySeries.senkouA = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "rgba(74, 222, 128, 0.75)" });
  overlaySeries.senkouB = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "rgba(248, 113, 113, 0.75)" });
  overlaySeries.orderBlock = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#fb7185" });
  overlaySeries.fvg = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...line, color: "#22d3ee" });
}

function parseVietnameseDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function lightweightTimeFor(point, index) {
  const timestamp = toNumber(point?.timestamp);
  if (timestamp !== null) return Math.floor(timestamp / 1000);
  return parseVietnameseDate(point?.time) || Math.floor(Date.now() / 1000) + index;
}

function validPricePoint(point) {
  const close = toNumber(point.close);
  if (close === null) return null;
  const open = toNumber(point.open) ?? close;
  const high = toNumber(point.high) ?? Math.max(open, close);
  const low = toNumber(point.low) ?? Math.min(open, close);
  return { open, high, low, close };
}

function lineData(points, values) {
  return values
    .map((value, index) => {
      const number = toNumber(value);
      if (number === null) return null;
      return { time: lightweightTimeFor(points[index], index), value: number };
    })
    .filter(Boolean);
}

function showChartMessage(messageText) {
  if (!chartCanvas) return;
  let overlay = chartCanvas.querySelector(".lightweight-chart-empty");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "lightweight-chart-empty";
    chartCanvas.appendChild(overlay);
  }
  overlay.textContent = safeText(messageText);
}

function hideChartMessage() {
  chartCanvas?.querySelector(".lightweight-chart-empty")?.remove();
}

function updateLineSeries(series, data, useRealtimeUpdate) {
  if (!series) return;
  if (!useRealtimeUpdate) {
    series.setData(data);
    return;
  }
  const latest = data[data.length - 1];
  if (latest) series.update(latest);
}

function canRealtimeUpdate(nextTimes) {
  const previousTimes = chartSeriesState.times;
  if (!previousTimes.length) return false;
  if (nextTimes.length === previousTimes.length) {
    return nextTimes.slice(0, -1).every((time, index) => time === previousTimes[index]);
  }
  if (nextTimes.length === previousTimes.length + 1) {
    return previousTimes.every((time, index) => time === nextTimes[index]);
  }
  return false;
}

function rollingMidpoint(points, period) {
  return points.map((_, index) => {
    if (index < period - 1) return null;
    const window = points.slice(index - period + 1, index + 1);
    const highs = window.map((bar) => toNumber(bar.high)).filter((value) => value !== null);
    const lows = window.map((bar) => toNumber(bar.low)).filter((value) => value !== null);
    if (!highs.length || !lows.length) return null;
    return (Math.max(...highs) + Math.min(...lows)) / 2;
  });
}

function calculateBollinger(points, period = 20, multiplier = 2) {
  const closes = points.map((point) => toNumber(point.close));
  const middle = Array(points.length).fill(null);
  const upper = Array(points.length).fill(null);
  const lower = Array(points.length).fill(null);
  for (let index = period - 1; index < points.length; index += 1) {
    const window = closes.slice(index - period + 1, index + 1);
    if (window.some((value) => value === null)) continue;
    const mean = window.reduce((sum, value) => sum + value, 0) / period;
    const deviation = Math.sqrt(window.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / period);
    middle[index] = mean;
    upper[index] = mean + deviation * multiplier;
    lower[index] = mean - deviation * multiplier;
  }
  return { upper, middle, lower };
}

function calculateVwap(points) {
  let totalPv = 0;
  let totalVolume = 0;
  return points.map((point) => {
    const high = toNumber(point.high);
    const low = toNumber(point.low);
    const close = toNumber(point.close);
    const volume = toNumber(point.volume) || 0;
    if (high === null || low === null || close === null || volume <= 0) return null;
    totalPv += ((high + low + close) / 3) * volume;
    totalVolume += volume;
    return totalVolume ? totalPv / totalVolume : null;
  });
}

function calculateAtr(points, period = 10) {
  const ranges = points.map((point, index) => {
    const high = toNumber(point.high);
    const low = toNumber(point.low);
    const previousClose = index ? toNumber(points[index - 1].close) : null;
    if (high === null || low === null) return null;
    if (previousClose === null) return high - low;
    return Math.max(high - low, Math.abs(high - previousClose), Math.abs(low - previousClose));
  });
  return ranges.map((_, index) => {
    if (index < period - 1) return null;
    const window = ranges.slice(index - period + 1, index + 1);
    if (window.some((value) => value === null)) return null;
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

function calculateSupertrend(points, period = 10, multiplier = 3) {
  const atr = calculateAtr(points, period);
  return points.map((point, index) => {
    const high = toNumber(point.high);
    const low = toNumber(point.low);
    const close = toNumber(point.close);
    if (high === null || low === null || close === null || atr[index] === null) return null;
    const middle = (high + low) / 2;
    const previous = index ? toNumber(points[index - 1].close) : close;
    return close >= previous ? middle - multiplier * atr[index] : middle + multiplier * atr[index];
  });
}

function calculateIchimoku(points) {
  const tenkan = rollingMidpoint(points, 9);
  const kijun = rollingMidpoint(points, 26);
  return {
    tenkan,
    kijun,
    senkouA: tenkan.map((value, index) => value === null || kijun[index] === null ? null : (value + kijun[index]) / 2),
    senkouB: rollingMidpoint(points, 52)
  };
}

function calculateSignalMarkers(points, movingAverages) {
  const fast = movingAverages?.ma10 || [];
  const slow = movingAverages?.ma50 || [];
  const markers = [];
  for (let index = 1; index < points.length; index += 1) {
    if ([fast[index - 1], slow[index - 1], fast[index], slow[index]].some((value) => value === null)) continue;
    if (fast[index - 1] <= slow[index - 1] && fast[index] > slow[index]) {
      markers.push({ time: lightweightTimeFor(points[index], index), position: "belowBar", color: "#4ade80", shape: "arrowUp", text: "Buy" });
    }
    if (fast[index - 1] >= slow[index - 1] && fast[index] < slow[index]) {
      markers.push({ time: lightweightTimeFor(points[index], index), position: "aboveBar", color: "#f87171", shape: "arrowDown", text: "Sell" });
    }
  }
  return markers.slice(-40);
}

function setCandleMarkers(markers) {
  const lightweight = window.LightweightCharts;
  if (lightweight?.createSeriesMarkers) {
    if (!overlaySeries.markerPrimitive) overlaySeries.markerPrimitive = lightweight.createSeriesMarkers(candleSeries, markers);
    else overlaySeries.markerPrimitive.setMarkers(markers);
    return;
  }
  candleSeries?.setMarkers?.(markers);
}

function latestOrderBlockLine(points) {
  const values = Array(points.length).fill(null);
  for (let index = 1; index < points.length; index += 1) {
    const prevOpen = toNumber(points[index - 1].open);
    const prevClose = toNumber(points[index - 1].close);
    const close = toNumber(points[index].close);
    const previousHigh = toNumber(points[index - 1].high);
    if ([prevOpen, prevClose, close, previousHigh].some((value) => value === null)) continue;
    if (prevClose < prevOpen && close > previousHigh) values[index] = prevOpen;
  }
  return values;
}

function latestFvgLine(points) {
  const values = Array(points.length).fill(null);
  for (let index = 2; index < points.length; index += 1) {
    const low = toNumber(points[index].low);
    const highTwoBack = toNumber(points[index - 2].high);
    const high = toNumber(points[index].high);
    const lowTwoBack = toNumber(points[index - 2].low);
    if (low !== null && highTwoBack !== null && low > highTwoBack) values[index] = (low + highTwoBack) / 2;
    if (high !== null && lowTwoBack !== null && high < lowTwoBack) values[index] = (high + lowTwoBack) / 2;
  }
  return values;
}

function renderAdvancedOverlays(points, movingAverages, options = {}) {
  ensureOverlaySeries();
  latestChartPoints = points;
  latestChartMovingAverages = movingAverages;
  const config = getOverlayConfig();
  const useUpdate = Boolean(options.realtimeUpdate && !options.forceSetData);
  const bollinger = calculateBollinger(points);
  const ichimoku = calculateIchimoku(points);
  updateLineSeries(overlaySeries.bollingerUpper, config.bollinger ? lineData(points, bollinger.upper) : [], useUpdate);
  updateLineSeries(overlaySeries.bollingerMiddle, config.bollinger ? lineData(points, bollinger.middle) : [], useUpdate);
  updateLineSeries(overlaySeries.bollingerLower, config.bollinger ? lineData(points, bollinger.lower) : [], useUpdate);
  updateLineSeries(overlaySeries.vwap, config.vwap ? lineData(points, calculateVwap(points)) : [], useUpdate);
  updateLineSeries(overlaySeries.supertrend, config.supertrend ? lineData(points, calculateSupertrend(points)) : [], useUpdate);
  updateLineSeries(overlaySeries.tenkan, config.ichimoku ? lineData(points, ichimoku.tenkan) : [], useUpdate);
  updateLineSeries(overlaySeries.kijun, config.ichimoku ? lineData(points, ichimoku.kijun) : [], useUpdate);
  updateLineSeries(overlaySeries.senkouA, config.ichimoku ? lineData(points, ichimoku.senkouA) : [], useUpdate);
  updateLineSeries(overlaySeries.senkouB, config.ichimoku ? lineData(points, ichimoku.senkouB) : [], useUpdate);
  updateLineSeries(overlaySeries.orderBlock, config.orderBlock ? lineData(points, latestOrderBlockLine(points)) : [], useUpdate);
  updateLineSeries(overlaySeries.fvg, config.fvg ? lineData(points, latestFvgLine(points)) : [], useUpdate);
  setCandleMarkers(config.markers ? calculateSignalMarkers(points, movingAverages) : []);
}

function drawChart(points, movingAverages = null) {
  if (!points.length) {
    candleSeries?.setData([]);
    volumeSeries?.setData([]);
    [ma20Series, ma50Series, ma100Series, ma200Series].forEach((series) => series?.setData([]));
    showChartMessage("Chưa có dữ liệu biểu đồ.");
    return;
  }

  const chart = ensureLightweightChart();
  if (!chart || !candleSeries || !volumeSeries) {
    showChartMessage("Không tải được Lightweight Charts. Hãy kiểm tra kết nối mạng/CDN.");
    return;
  }
  hideChartMessage();

  const candles = [];
  const volumes = [];
  points.forEach((point, index) => {
    const pricePoint = validPricePoint(point);
    if (!pricePoint) return;
    const time = lightweightTimeFor(point, index);
    candles.push({ time, ...pricePoint });
    volumes.push({
      time,
      value: toNumber(point.volume) || 0,
      color: pricePoint.close >= pricePoint.open ? "rgba(38, 166, 154, 0.52)" : "rgba(239, 83, 80, 0.52)"
    });
  });

  const chartMovingAverages = movingAverages || calculateMovingAverages(points);
  const nextTimes = candles.map((candle) => candle.time);
  const realtimeUpdate = canRealtimeUpdate(nextTimes);
  if (realtimeUpdate) {
    candleSeries.update(candles[candles.length - 1]);
    volumeSeries.update(volumes[volumes.length - 1]);
  } else {
    candleSeries.setData(candles);
    volumeSeries.setData(volumes);
  }
  renderMovingAverageSeries(points, chartMovingAverages, realtimeUpdate);
  renderAdvancedOverlays(points, chartMovingAverages, { realtimeUpdate });
  chartHudState = {
    points,
    movingAverages: chartMovingAverages,
    indexByTime: new Map(points.map((point, index) => [chartTimeKey(lightweightTimeFor(point, index)), index]))
  };
  updateChartHud(points.length - 1);
  chartSeriesState = { times: nextTimes };
  if (!realtimeUpdate) showRecentLogicalRange(chart, candles.length);
}
