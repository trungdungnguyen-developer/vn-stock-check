const analyticsChartIds = {
  industry: "industryHeatmapChart",
  moneyFlow: "moneyFlowChart",
  portfolio: "portfolioAllocationChart",
  correlation: "correlationChart",
  breadth: "marketBreadthChart"
};
const analyticsCharts = {};
let analyticsResizeObserver = null;

function analyticsAvg(values) {
  const clean = values.filter((value) => Number.isFinite(value));
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : null;
}

function analyticsPctChange(bars, periods) {
  const latest = bars[bars.length - 1]?.close;
  const previous = bars[bars.length - 1 - periods]?.close;
  return latest && previous ? ((latest - previous) / previous) * 100 : null;
}

function analyticsReturns(bars) {
  return bars.slice(1).map((bar, index) => {
    const previous = bars[index]?.close;
    return previous ? ((bar.close - previous) / previous) * 100 : null;
  }).filter((value) => value !== null && Number.isFinite(value));
}

function analyticsCorrelation(left, right) {
  const length = Math.min(left.length, right.length);
  if (length < 3) return 0;
  const a = left.slice(-length);
  const b = right.slice(-length);
  const avgA = analyticsAvg(a);
  const avgB = analyticsAvg(b);
  if (avgA === null || avgB === null) return 0;
  let numerator = 0;
  let denominatorA = 0;
  let denominatorB = 0;
  for (let index = 0; index < length; index += 1) {
    const da = a[index] - avgA;
    const db = b[index] - avgB;
    numerator += da * db;
    denominatorA += da * da;
    denominatorB += db * db;
  }
  const denominator = Math.sqrt(denominatorA * denominatorB);
  return denominator ? numerator / denominator : 0;
}

function analyticsLatest(series) {
  return [...series].reverse().find((value) => value !== null && value !== undefined && Number.isFinite(value));
}

function analyticsSetText(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

function analyticsShowPlaceholder(id, messageText) {
  const element = document.getElementById(id);
  if (!element) return;
  element.innerHTML = `<div class="analytics-empty">${messageText}</div>`;
}

function ensureAnalyticsResizeObserver() {
  if (analyticsResizeObserver || !window.ResizeObserver) return;
  analyticsResizeObserver = new ResizeObserver(() => {
    Object.values(analyticsCharts).forEach((chart) => chart?.resize());
  });
  Object.values(analyticsChartIds).forEach((id) => {
    const element = document.getElementById(id);
    if (element) analyticsResizeObserver.observe(element);
  });
}

function ensureAnalyticsChart(key) {
  const id = analyticsChartIds[key];
  const element = document.getElementById(id);
  if (!element) return null;
  if (!window.echarts) {
    analyticsShowPlaceholder(id, "Không tải được ECharts CDN.");
    return null;
  }
  if (!analyticsCharts[key]) {
    element.innerHTML = "";
    analyticsCharts[key] = window.echarts.init(element, null, { renderer: "svg" });
    ensureAnalyticsResizeObserver();
  }
  return analyticsCharts[key];
}

function setAnalyticsOption(key, option) {
  const chart = ensureAnalyticsChart(key);
  if (!chart) return;
  chart.setOption(option, true);
  requestAnimationFrame(() => chart.resize());
}

function getAnalyticsTheme() {
  return {
    background: "transparent",
    primary: "#f8fafc",
    secondary: "#cbd5e1",
    muted: "#94a3b8",
    grid: "#334155",
    panel: "#1e293b",
    positive: "#4ade80",
    negative: "#f87171",
    warning: "#facc15",
    link: "#60a5fa",
    purple: "#a855f7"
  };
}

function getPortfolioAllocation(symbol, quote) {
  const currentPrice = toNumber(quote?.price ?? quote?.regularMarketPrice ?? quote?.close);
  try {
    const raw = JSON.parse(localStorage.getItem("aiTradingTerminal.portfolio.v1") || "[]");
    const items = Array.isArray(raw) ? raw : [];
    const allocation = items
      .map((item) => {
        const holding = Number(item.holding);
        const price = Number(item.currentPrice || item.averagePrice);
        return {
          name: String(item.symbol || "Asset").toUpperCase(),
          value: Number.isFinite(holding * price) ? holding * price : 0
        };
      })
      .filter((item) => item.value > 0);
    if (allocation.length) return allocation;
  } catch {
    // Ignore invalid user storage and show the current asset fallback below.
  }
  return currentPrice ? [{ name: symbol || "Current", value: currentPrice }] : [{ name: "No data", value: 1 }];
}

function buildIndustryItems(context) {
  const { bars, overview, symbol, assetType } = context;
  const latestChange = analyticsPctChange(bars, 1) ?? 0;
  const change7 = analyticsPctChange(bars, 7) ?? latestChange;
  const change30 = analyticsPctChange(bars, 30) ?? change7;
  const scannerItems = (typeof latestScannerResults !== "undefined" ? latestScannerResults : [])
    .slice()
    .sort((a, b) => (toNumber(b.score) ?? 0) - (toNumber(a.score) ?? 0))
    .slice(0, 8)
    .map((item) => ({
      name: item.symbol || "Asset",
      value: Math.max(1, Math.abs(toNumber(item.score) ?? 50)),
      change: toNumber(item.change24h) ?? 0
    }));

  if (scannerItems.length >= 4) return scannerItems;

  const currentName = assetType === "crypto"
    ? `${symbol || "Coin"} / Crypto`
    : overview?.industry || overview?.sector || `${symbol || "Ma"} / Stock`;
  return [
    { name: currentName, value: 40, change: latestChange },
    { name: "Đà 1 tuần", value: 26, change: change7 },
    { name: "Đà 1 tháng", value: 22, change: change30 },
    { name: assetType === "crypto" ? "Altcoin watch" : "VNINDEX relative", value: 18, change: context.marketStrength?.relative20 ?? latestChange },
    { name: "Xung lực volume", value: 14, change: context.volumeRatioChange ?? 0 }
  ];
}

function renderIndustryHeatmap(context) {
  const theme = getAnalyticsTheme();
  const data = buildIndustryItems(context).map((item) => ({
    name: item.name,
    value: item.value,
    change: item.change,
    itemStyle: {
      color: (item.change ?? 0) >= 0 ? theme.positive : theme.negative
    }
  }));
  analyticsSetText("industryHeatmapNote", context.assetType === "crypto" ? "Scanner coin + tài sản hiện tại" : "Scanner/VNINDEX + tài sản hiện tại");
  setAnalyticsOption("industry", {
    backgroundColor: theme.background,
    tooltip: {
      formatter: (params) => `${params.name}<br/>Change: ${formatPercent(params.data.change)}<br/>Weight: ${formatNumber(params.value, 0)}`,
      backgroundColor: theme.panel,
      borderColor: theme.grid,
      textStyle: { color: theme.primary }
    },
    series: [{
      type: "treemap",
      roam: false,
      nodeClick: false,
      breadcrumb: { show: false },
      label: {
        color: "#020617",
        fontWeight: 700,
        formatter: (params) => `${params.name}\n${formatPercent(params.data.change)}`
      },
      upperLabel: { show: false },
      itemStyle: {
        borderColor: "#0f172a",
        borderWidth: 3,
        gapWidth: 3,
        borderRadius: 8
      },
      levels: [{ itemStyle: { borderWidth: 0, gapWidth: 3 } }],
      data
    }]
  });
}

function renderMoneyFlow(context) {
  const theme = getAnalyticsTheme();
  const { quote, bars } = context;
  const latestVolume = toNumber(bars[bars.length - 1]?.volume) ?? 0;
  const avgVolume20 = analyticsAvg(bars.slice(-20).map((bar) => toNumber(bar.volume)).filter((value) => value !== null)) ?? latestVolume;
  const foreignBuy = toNumber(quote?.foreignBuyValue);
  const foreignSell = toNumber(quote?.foreignSellValue);
  const totalValue = toNumber(quote?.totalValue);
  const buyValue = foreignBuy ?? Math.max(latestVolume, 0);
  const sellValue = foreignSell ?? Math.max(avgVolume20, 0);
  const netValue = foreignBuy !== null && foreignSell !== null ? foreignBuy - foreignSell : latestVolume - avgVolume20;
  analyticsSetText("moneyFlowNote", foreignBuy !== null ? "Dòng tiền ngoại VCI" : "Suy ra từ volume");
  setAnalyticsOption("moneyFlow", {
    backgroundColor: theme.background,
    grid: { left: 44, right: 18, top: 20, bottom: 34 },
    tooltip: { trigger: "axis", backgroundColor: theme.panel, borderColor: theme.grid, textStyle: { color: theme.primary } },
    xAxis: {
      type: "category",
      data: ["Mua/Vol", "Bán/TB", "Ròng"],
      axisLabel: { color: theme.secondary },
      axisLine: { lineStyle: { color: theme.grid } }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: theme.muted, formatter: (value) => formatLargeNumber(value) },
      splitLine: { lineStyle: { color: theme.grid } }
    },
    series: [{
      type: "bar",
      barWidth: "48%",
      data: [
        { value: buyValue, itemStyle: { color: theme.positive } },
        { value: sellValue, itemStyle: { color: theme.negative } },
        { value: netValue, itemStyle: { color: netValue >= 0 ? theme.positive : theme.negative } }
      ],
      label: { show: true, position: "top", color: theme.secondary, formatter: (params) => formatLargeNumber(params.value) }
    }]
  });
}

function renderPortfolioAllocation(context) {
  const theme = getAnalyticsTheme();
  const data = getPortfolioAllocation(context.symbol, context.quote);
  analyticsSetText("portfolioAllocationNote", data.length > 1 ? `${data.length} tài sản` : "Theo mã đang xem");
  setAnalyticsOption("portfolio", {
    backgroundColor: theme.background,
    tooltip: { trigger: "item", backgroundColor: theme.panel, borderColor: theme.grid, textStyle: { color: theme.primary } },
    legend: { bottom: 0, textStyle: { color: theme.secondary }, type: "scroll" },
    series: [{
      type: "pie",
      radius: ["46%", "72%"],
      center: ["50%", "45%"],
      avoidLabelOverlap: true,
      label: { color: theme.secondary, formatter: "{b}" },
      color: [theme.purple, theme.link, theme.positive, theme.warning, theme.negative, "#38bdf8", "#818cf8"],
      data
    }]
  });
}

function renderCorrelation(context) {
  const theme = getAnalyticsTheme();
  const bars = context.bars;
  const ma = calculateMovingAverages(bars);
  const rsi = calculateRsi(bars);
  const closeReturns = analyticsReturns(bars);
  const volumeSeries = bars.map((bar) => toNumber(bar.volume)).filter((value) => value !== null);
  const ma20Returns = analyticsReturns(bars.map((bar, index) => ({ ...bar, close: ma.ma10[index] ?? bar.close })));
  const rsiSeries = rsi.filter((value) => value !== null && Number.isFinite(value));
  const labels = ["Giá", "Volume", "MA20", "RSI"];
  const source = [closeReturns, volumeSeries, ma20Returns, rsiSeries];
  const data = [];
  labels.forEach((_, row) => {
    labels.forEach((__, column) => {
      const value = row === column ? 1 : analyticsCorrelation(source[row], source[column]);
      data.push([column, row, Number(value.toFixed(2))]);
    });
  });
  analyticsSetText("correlationNote", `${labels.length} biến kỹ thuật`);
  setAnalyticsOption("correlation", {
    backgroundColor: theme.background,
    tooltip: {
      position: "top",
      formatter: (params) => `${labels[params.value[1]]} / ${labels[params.value[0]]}: ${params.value[2]}`,
      backgroundColor: theme.panel,
      borderColor: theme.grid,
      textStyle: { color: theme.primary }
    },
    grid: { left: 58, right: 18, top: 24, bottom: 44 },
    xAxis: { type: "category", data: labels, axisLabel: { color: theme.secondary }, splitArea: { show: true } },
    yAxis: { type: "category", data: labels, axisLabel: { color: theme.secondary }, splitArea: { show: true } },
    visualMap: {
      min: -1,
      max: 1,
      calculable: false,
      orient: "horizontal",
      left: "center",
      bottom: 4,
      textStyle: { color: theme.muted },
      inRange: { color: [theme.negative, theme.panel, theme.positive] }
    },
    series: [{
      type: "heatmap",
      data,
      label: { show: true, color: theme.primary, formatter: (params) => params.value[2] },
      emphasis: { itemStyle: { borderColor: theme.primary, borderWidth: 1 } }
    }]
  });
}

function renderMarketBreadth(context) {
  const theme = getAnalyticsTheme();
  const bars = context.bars;
  const periods = [1, 3, 7, 14, 30, 60].filter((period) => bars.length > period);
  const data = periods.map((period) => analyticsPctChange(bars, period) ?? 0);
  const volume = bars.map((bar) => toNumber(bar.volume)).filter((value) => value !== null);
  const volumeLatest = volume[volume.length - 1] ?? 0;
  const volumeAvg20 = analyticsAvg(volume.slice(-20)) ?? volumeLatest;
  const volumeRatio = volumeAvg20 ? volumeLatest / volumeAvg20 : null;
  analyticsSetText("marketBreadthNote", volumeRatio ? `Volume ${formatNumber(volumeRatio, 2)}x TB20` : "Theo biến động gần nhất");
  setAnalyticsOption("breadth", {
    backgroundColor: theme.background,
    grid: { left: 48, right: 22, top: 22, bottom: 36 },
    tooltip: {
      trigger: "axis",
      backgroundColor: theme.panel,
      borderColor: theme.grid,
      textStyle: { color: theme.primary },
      valueFormatter: (value) => formatPercent(value)
    },
    xAxis: {
      type: "category",
      data: periods.map((period) => `${period}D`),
      axisLabel: { color: theme.secondary },
      axisLine: { lineStyle: { color: theme.grid } }
    },
    yAxis: {
      type: "value",
      axisLabel: { color: theme.muted, formatter: (value) => `${value}%` },
      splitLine: { lineStyle: { color: theme.grid } }
    },
    series: [{
      name: "Change",
      type: "bar",
      barWidth: "46%",
      data: data.map((value) => ({
        value,
        itemStyle: { color: value >= 0 ? theme.positive : theme.negative }
      })),
      markLine: { silent: true, symbol: "none", lineStyle: { color: theme.grid }, data: [{ yAxis: 0 }] },
      label: { show: true, position: "top", color: theme.secondary, formatter: (params) => formatPercent(params.value) }
    }]
  });
}

function renderDashboardAnalytics(context = null) {
  const status = document.getElementById("analyticsStatus");
  if (!context?.bars?.length) {
    Object.values(analyticsChartIds).forEach((id) => analyticsShowPlaceholder(id, "Tra cứu mã để hiển thị analytics."));
    if (status) status.textContent = "Chưa có dữ liệu";
    return;
  }

  const bars = normalizeTechnicalBars(context.bars);
  const volumes = bars.map((bar) => toNumber(bar.volume)).filter((value) => value !== null);
  const latestVolume = volumes[volumes.length - 1] ?? 0;
  const avgVolume20 = analyticsAvg(volumes.slice(-20)) ?? latestVolume;
  const enrichedContext = {
    ...context,
    bars,
    volumeRatioChange: avgVolume20 ? ((latestVolume / avgVolume20) - 1) * 100 : null
  };

  if (status) {
    const label = context.assetType === "crypto" ? "Coin analytics" : "Stock analytics";
    status.textContent = `${label}: ${context.symbol || "-"}`;
  }
  renderIndustryHeatmap(enrichedContext);
  renderMoneyFlow(enrichedContext);
  renderPortfolioAllocation(enrichedContext);
  renderCorrelation(enrichedContext);
  renderMarketBreadth(enrichedContext);
}
