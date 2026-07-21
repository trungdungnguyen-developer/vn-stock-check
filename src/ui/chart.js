function drawChart(points, movingAverages = null) {
  const canvas = chartCanvas;
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  if (!points.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "18px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa có dữ liệu biểu đồ.", 24, 48);
    return;
  }

  const padding = 44;
  const volumeHeight = 74;
  const gap = 16;
  const plotTop = padding;
  const plotBottom = height - padding - volumeHeight - gap;
  const volumeTop = plotBottom + gap;
  const plotHeight = plotBottom - plotTop;
  const priceValues = points.flatMap((point) => [
    toNumber(point.high) ?? toNumber(point.close),
    toNumber(point.low) ?? toNumber(point.close),
    toNumber(point.open),
    toNumber(point.close)
  ]).filter((value) => value !== null);
  const min = Math.min(...priceValues);
  const max = Math.max(...priceValues);
  const span = max - min || 1;
  const xStep = (width - padding * 2) / Math.max(points.length - 1, 1);
  const candleWidth = Math.max(3, Math.min(14, xStep * 0.58));
  const maxVolume = Math.max(...points.map((point) => toNumber(point.volume) || 0), 1);
  const xFor = (index) => padding + xStep * index;
  const yFor = (value) => plotBottom - ((value - min) / span) * plotHeight;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index < 5; index += 1) {
    const y = plotTop + (plotHeight / 4) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  points.forEach((point, index) => {
    const open = toNumber(point.open) ?? point.close;
    const close = toNumber(point.close);
    const high = toNumber(point.high) ?? Math.max(open, close);
    const low = toNumber(point.low) ?? Math.min(open, close);
    if (close === null || open === null) return;

    const x = xFor(index);
    const color = close >= open ? CHART_COLORS.positive : CHART_COLORS.negative;
    const openY = yFor(open);
    const closeY = yFor(close);
    const highY = yFor(high);
    const lowY = yFor(low);
    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(Math.abs(closeY - openY), 2);
    const volume = toNumber(point.volume) || 0;
    const volumeBarHeight = (volume / maxVolume) * volumeHeight;

    context.strokeStyle = color;
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(x, highY);
    context.lineTo(x, lowY);
    context.stroke();

    context.fillStyle = color;
    context.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

    context.globalAlpha = 0.42;
    context.fillRect(x - candleWidth / 2, height - padding - volumeBarHeight, candleWidth, volumeBarHeight);
    context.globalAlpha = 1;
  });

  const chartMovingAverages = movingAverages || calculateMovingAverages(points);
  [
    { values: chartMovingAverages.ma10, color: CHART_COLORS.ma10 },
    { values: chartMovingAverages.ma50, color: CHART_COLORS.ma50 },
    { values: chartMovingAverages.ma100, color: CHART_COLORS.ma100 },
    { values: chartMovingAverages.ma200, color: CHART_COLORS.ma200 }
  ].forEach((series) => {
    context.beginPath();
    let started = false;
    series.values.forEach((value, index) => {
      if (value === null) return;
      const x = xFor(index);
      const y = yFor(value);
      if (!started) {
        context.moveTo(x, y);
        started = true;
      } else {
        context.lineTo(x, y);
      }
    });
    context.strokeStyle = series.color;
    context.lineWidth = 2;
    context.stroke();
  });

  context.fillStyle = CHART_COLORS.text;
  context.font = "13px 'Be Vietnam Pro', Arial";
  context.fillText(formatAssetPrice(max), 8, padding + 4);
  context.fillText(formatAssetPrice(min), 8, plotBottom + 4);
  context.fillText("Vol", 8, volumeTop + 14);
  context.fillText(safeText(points[0].time), padding, height - 12);
  context.fillText(safeText(points[points.length - 1].time), width - padding - 110, height - 12);
}

