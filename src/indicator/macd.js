const INDICATOR_CONFIG_KEY = "trading-terminal-indicators-v1";
const DEFAULT_INDICATOR_CONFIG = {
  rsi: { enabled: true, period: 14, color: "#a855f7" },
  macd: { enabled: true, fast: 12, slow: 26, signal: 9, color: "#38bdf8", signalColor: "#f59e0b" }
};

let indicatorSourceBars = [];
let indicatorCharts = {
  rsi: null,
  macd: null,
  rsiLine: null,
  rsiUpper: null,
  rsiLower: null,
  macdLine: null,
  macdSignal: null,
  macdHistogram: null
};

function calculateMacd(points, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const closes = points.map((point) => point.close);
  const emaFast = calculateEma(closes, fastPeriod);
  const emaSlow = calculateEma(closes, slowPeriod);
  const macd = closes.map((_, index) => {
    if (emaFast[index] === null || emaSlow[index] === null) return null;
    return emaFast[index] - emaSlow[index];
  });

  const signal = Array(macd.length).fill(null);
  const validMacd = macd.filter((value) => value !== null);
  const signalValues = calculateEma(validMacd, signalPeriod);
  let validIndex = 0;
  macd.forEach((value, index) => {
    if (value === null) return;
    signal[index] = signalValues[validIndex];
    validIndex += 1;
  });

  const histogram = macd.map((value, index) => {
    if (value === null || signal[index] === null) return null;
    return value - signal[index];
  });

  return { macd, signal, histogram };
}

function safeIndicatorConfig(rawConfig) {
  const config = {
    rsi: { ...DEFAULT_INDICATOR_CONFIG.rsi, ...(rawConfig?.rsi || {}) },
    macd: { ...DEFAULT_INDICATOR_CONFIG.macd, ...(rawConfig?.macd || {}) }
  };
  config.rsi.period = Math.min(50, Math.max(2, Number(config.rsi.period) || 14));
  config.macd.fast = Math.min(50, Math.max(2, Number(config.macd.fast) || 12));
  config.macd.slow = Math.min(100, Math.max(config.macd.fast + 1, Number(config.macd.slow) || 26));
  config.macd.signal = Math.min(50, Math.max(2, Number(config.macd.signal) || 9));
  return config;
}

function getIndicatorConfig() {
  try {
    return safeIndicatorConfig(JSON.parse(localStorage.getItem(INDICATOR_CONFIG_KEY) || "{}"));
  } catch {
    return safeIndicatorConfig(null);
  }
}

function saveIndicatorConfig(config) {
  localStorage.setItem(INDICATOR_CONFIG_KEY, JSON.stringify(safeIndicatorConfig(config)));
}

function setIndicatorFormValues(config = getIndicatorConfig()) {
  const controls = indicatorControls();
  if (!controls.rsiToggle) return;
  controls.rsiToggle.checked = config.rsi.enabled;
  controls.rsiPeriod.value = config.rsi.period;
  controls.rsiColor.value = config.rsi.color;
  controls.macdToggle.checked = config.macd.enabled;
  controls.macdFast.value = config.macd.fast;
  controls.macdSlow.value = config.macd.slow;
  controls.macdSignal.value = config.macd.signal;
  controls.macdColor.value = config.macd.color;
  controls.macdSignalColor.value = config.macd.signalColor;
}

function readIndicatorFormConfig() {
  const controls = indicatorControls();
  return safeIndicatorConfig({
    rsi: {
      enabled: controls.rsiToggle?.checked ?? true,
      period: controls.rsiPeriod?.value,
      color: controls.rsiColor?.value || DEFAULT_INDICATOR_CONFIG.rsi.color
    },
    macd: {
      enabled: controls.macdToggle?.checked ?? true,
      fast: controls.macdFast?.value,
      slow: controls.macdSlow?.value,
      signal: controls.macdSignal?.value,
      color: controls.macdColor?.value || DEFAULT_INDICATOR_CONFIG.macd.color,
      signalColor: controls.macdSignalColor?.value || DEFAULT_INDICATOR_CONFIG.macd.signalColor
    }
  });
}

function indicatorControls() {
  return {
    rsiToggle: document.getElementById("toggleRsiIndicator"),
    rsiPeriod: document.getElementById("rsiPeriodInput"),
    rsiColor: document.getElementById("rsiColorInput"),
    macdToggle: document.getElementById("toggleMacdIndicator"),
    macdFast: document.getElementById("macdFastInput"),
    macdSlow: document.getElementById("macdSlowInput"),
    macdSignal: document.getElementById("macdSignalInput"),
    macdColor: document.getElementById("macdColorInput"),
    macdSignalColor: document.getElementById("macdSignalColorInput")
  };
}

function setupIndicatorManager() {
  const controls = indicatorControls();
  if (!controls.rsiToggle) return;
  setIndicatorFormValues();
  Object.values(controls).forEach((control) => {
    control?.addEventListener("change", () => {
      const nextConfig = readIndicatorFormConfig();
      saveIndicatorConfig(nextConfig);
      setIndicatorFormValues(nextConfig);
      renderIndicators(indicatorSourceBars);
    });
  });
}

function createIndicatorChart(container, height = 220) {
  const lightweight = window.LightweightCharts;
  if (!container || !lightweight) return null;
  const chart = lightweight.createChart(container, {
    width: container.clientWidth || 600,
    height,
    autoSize: true,
    layout: {
      background: { type: lightweight.ColorType.Solid, color: "#0f172a" },
      textColor: "#cbd5e1",
      fontFamily: "Inter, 'Be Vietnam Pro', Arial, sans-serif",
      fontSize: 12
    },
    grid: {
      vertLines: { color: "rgba(148, 163, 184, 0.1)" },
      horzLines: { color: "rgba(148, 163, 184, 0.1)" }
    },
    rightPriceScale: { borderColor: "#334155" },
    timeScale: {
      borderColor: "#334155",
      timeVisible: true,
      secondsVisible: false
    },
    crosshair: { mode: lightweight.CrosshairMode.Normal },
    localization: { locale: "vi-VN" }
  });
  new ResizeObserver(() => {
    if (!container.isConnected) return;
    chart.applyOptions({ width: container.clientWidth || 600, height: container.clientHeight || height });
  }).observe(container);
  return chart;
}

function ensureIndicatorCharts() {
  const lightweight = window.LightweightCharts;
  if (!lightweight) return false;
  if (!indicatorCharts.rsi) {
    indicatorCharts.rsi = createIndicatorChart(rsiCanvas, 220);
    if (!indicatorCharts.rsi) return false;
    indicatorCharts.rsiLine = lightweightSeries(indicatorCharts.rsi, "line", lightweight.LineSeries, {
      color: DEFAULT_INDICATOR_CONFIG.rsi.color,
      lineWidth: 2,
      priceLineVisible: false
    });
    indicatorCharts.rsiUpper = lightweightSeries(indicatorCharts.rsi, "line", lightweight.LineSeries, {
      color: "rgba(248, 113, 113, 0.75)",
      lineWidth: 1,
      lineStyle: lightweight.LineStyle?.Dashed ?? 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
    indicatorCharts.rsiLower = lightweightSeries(indicatorCharts.rsi, "line", lightweight.LineSeries, {
      color: "rgba(74, 222, 128, 0.75)",
      lineWidth: 1,
      lineStyle: lightweight.LineStyle?.Dashed ?? 2,
      priceLineVisible: false,
      lastValueVisible: false
    });
  }
  if (!indicatorCharts.macd) {
    indicatorCharts.macd = createIndicatorChart(macdCanvas, 240);
    if (!indicatorCharts.macd) return false;
    indicatorCharts.macdHistogram = lightweightSeries(indicatorCharts.macd, "histogram", lightweight.HistogramSeries, {
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
      base: 0
    });
    indicatorCharts.macdLine = lightweightSeries(indicatorCharts.macd, "line", lightweight.LineSeries, {
      color: DEFAULT_INDICATOR_CONFIG.macd.color,
      lineWidth: 2,
      priceLineVisible: false
    });
    indicatorCharts.macdSignal = lightweightSeries(indicatorCharts.macd, "line", lightweight.LineSeries, {
      color: DEFAULT_INDICATOR_CONFIG.macd.signalColor,
      lineWidth: 2,
      priceLineVisible: false
    });
  }
  return true;
}

function indicatorData(points, values) {
  return values
    .map((value, index) => {
      const number = toNumber(value);
      if (number === null) return null;
      return { time: lightweightTimeFor(points[index], index), value: number };
    })
    .filter(Boolean);
}

function guideData(points, value) {
  return points.map((point, index) => ({ time: lightweightTimeFor(point, index), value }));
}

function setIndicatorVisibility(config) {
  document.querySelector("#rsiChart")?.closest(".indicator-card")?.classList.toggle("is-hidden", !config.rsi.enabled);
  document.querySelector("#macdChart")?.closest(".indicator-card")?.classList.toggle("is-hidden", !config.macd.enabled);
}

function showIndicatorMessage(container, text) {
  if (!container) return;
  let overlay = container.querySelector(".lightweight-chart-empty");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.className = "lightweight-chart-empty";
    container.appendChild(overlay);
  }
  overlay.textContent = text;
}

function hideIndicatorMessage(container) {
  container?.querySelector(".lightweight-chart-empty")?.remove();
}

function drawLineCanvas(_canvas, values, options = {}) {
  const config = getIndicatorConfig();
  if (!ensureIndicatorCharts() || !config.rsi.enabled) return;
  indicatorCharts.rsiLine?.applyOptions({ color: config.rsi.color || options.color || DEFAULT_INDICATOR_CONFIG.rsi.color });
  indicatorCharts.rsiLine?.setData(indicatorData(indicatorSourceBars, values));
  indicatorCharts.rsiUpper?.setData(guideData(indicatorSourceBars, 70));
  indicatorCharts.rsiLower?.setData(guideData(indicatorSourceBars, 30));
  indicatorCharts.rsi?.timeScale().fitContent();
}

function drawMacdCanvas(_canvas, macdData) {
  const config = getIndicatorConfig();
  if (!ensureIndicatorCharts() || !config.macd.enabled) return;
  indicatorCharts.macdLine?.applyOptions({ color: config.macd.color });
  indicatorCharts.macdSignal?.applyOptions({ color: config.macd.signalColor });
  indicatorCharts.macdLine?.setData(indicatorData(indicatorSourceBars, macdData.macd));
  indicatorCharts.macdSignal?.setData(indicatorData(indicatorSourceBars, macdData.signal));
  indicatorCharts.macdHistogram?.setData(macdData.histogram.map((value, index) => {
    const number = toNumber(value);
    if (number === null) return null;
    return {
      time: lightweightTimeFor(indicatorSourceBars[index], index),
      value: number,
      color: number > 0 ? "rgba(74, 222, 128, 0.7)" : number < 0 ? "rgba(248, 113, 113, 0.7)" : "rgba(250, 204, 21, 0.7)"
    };
  }).filter(Boolean));
  indicatorCharts.macd?.timeScale().fitContent();
}
