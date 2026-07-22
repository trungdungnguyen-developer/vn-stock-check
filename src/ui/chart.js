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

const OVERLAY_CONFIG_KEY = "trading-terminal-overlays-v1";
const DEFAULT_OVERLAY_CONFIG = {
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
      background: { type: lightweight.ColorType.Solid, color: "#0f172a" },
      textColor: "#cbd5e1",
      fontFamily: "Inter, 'Be Vietnam Pro', Arial, sans-serif",
      fontSize: 12
    },
    grid: {
      vertLines: { color: "rgba(148, 163, 184, 0.12)" },
      horzLines: { color: "rgba(148, 163, 184, 0.12)" }
    },
    rightPriceScale: {
      borderColor: "#334155",
      scaleMargins: { top: 0.08, bottom: 0.24 }
    },
    timeScale: {
      borderColor: "#334155",
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: { mode: lightweight.CrosshairMode.Normal },
    localization: {
      locale: "vi-VN",
      priceFormatter: (price) => formatAssetPrice(price)
    }
  });

  candleSeries = lightweightSeries(lightweightChart, "candlestick", lightweight.CandlestickSeries, {
    upColor: CHART_COLORS.positive,
    downColor: CHART_COLORS.negative,
    borderUpColor: CHART_COLORS.positive,
    borderDownColor: CHART_COLORS.negative,
    wickUpColor: CHART_COLORS.positive,
    wickDownColor: CHART_COLORS.negative,
    priceLineColor: "#60a5fa"
  });
  volumeSeries = lightweightSeries(lightweightChart, "histogram", lightweight.HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "volume",
    base: 0
  });
  lightweightChart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

  const maOptions = { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, crosshairMarkerVisible: false };
  ma20Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: CHART_COLORS.ma10 });
  ma50Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: CHART_COLORS.ma50 });
  ma100Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: CHART_COLORS.ma100 });
  ma200Series = lightweightSeries(lightweightChart, "line", lightweight.LineSeries, { ...maOptions, color: CHART_COLORS.ma200 });
  ensureOverlaySeries();

  new ResizeObserver(() => {
    if (!lightweightChart || !container.isConnected) return;
    lightweightChart.applyOptions({ width: container.clientWidth || 900, height: container.clientHeight || 560 });
  }).observe(container);

  return lightweightChart;
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
    bollinger: document.getElementById("toggleBollingerOverlay"),
    vwap: document.getElementById("toggleVwapOverlay"),
    supertrend: document.getElementById("toggleSupertrendOverlay"),
    ichimoku: document.getElementById("toggleIchimokuOverlay"),
    markers: document.getElementById("toggleSignalMarkers"),
    orderBlock: document.getElementById("toggleOrderBlockOverlay"),
    fvg: document.getElementById("toggleFvgOverlay")
  };
}

function setupOverlayManager() {
  const controls = overlayControls();
  if (!Object.values(controls).some(Boolean)) return;
  const config = getOverlayConfig();
  Object.entries(controls).forEach(([key, control]) => {
    if (!control) return;
    control.checked = Boolean(config[key]);
    control.addEventListener("change", () => {
      const nextConfig = Object.fromEntries(Object.entries(overlayControls()).map(([name, input]) => [name, Boolean(input?.checked)]));
      saveOverlayConfig(nextConfig);
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
      color: pricePoint.close >= pricePoint.open ? "rgba(74, 222, 128, 0.35)" : "rgba(248, 113, 113, 0.35)"
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
  updateLineSeries(ma20Series, lineData(points, chartMovingAverages.ma10), realtimeUpdate);
  updateLineSeries(ma50Series, lineData(points, chartMovingAverages.ma50), realtimeUpdate);
  updateLineSeries(ma100Series, lineData(points, chartMovingAverages.ma100), realtimeUpdate);
  updateLineSeries(ma200Series, lineData(points, chartMovingAverages.ma200), realtimeUpdate);
  renderAdvancedOverlays(points, chartMovingAverages, { realtimeUpdate });
  chartSeriesState = { times: nextTimes };
  if (!realtimeUpdate) chart.timeScale().fitContent();
}
