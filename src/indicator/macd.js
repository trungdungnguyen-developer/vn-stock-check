function calculateMacd(points) {
  const closes = points.map((point) => point.close);
  const ema12 = calculateEma(closes, 12);
  const ema26 = calculateEma(closes, 26);
  const macd = closes.map((_, index) => {
    if (ema12[index] === null || ema26[index] === null) return null;
    return ema12[index] - ema26[index];
  });

  const signal = Array(macd.length).fill(null);
  const validMacd = macd.filter((value) => value !== null);
  const signalValues = calculateEma(validMacd, 9);
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

function drawLineCanvas(canvas, values, options = {}) {
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  const numericValues = values.filter((value) => value !== null);
  if (!numericValues.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "16px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa đủ dữ liệu.", 18, 38);
    return;
  }

  const padding = 34;
  const min = options.min ?? Math.min(...numericValues);
  const max = options.max ?? Math.max(...numericValues);
  const span = max - min || 1;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  for (let index = 0; index < 4; index += 1) {
    const y = padding + ((height - padding * 2) / 3) * index;
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  }

  (options.guides || []).forEach((guide) => {
    const y = height - padding - ((guide.value - min) / span) * (height - padding * 2);
    context.strokeStyle = guide.color;
    context.setLineDash([6, 5]);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
    context.setLineDash([]);
    context.fillStyle = guide.color;
    context.font = "12px 'Be Vietnam Pro', Arial";
    context.fillText(guide.label, width - padding - 28, y - 4);
  });

  context.beginPath();
  values.forEach((value, index) => {
    if (value === null) return;
    const x = padding + ((width - padding * 2) / Math.max(values.length - 1, 1)) * index;
    const y = height - padding - ((value - min) / span) * (height - padding * 2);
    if (index === values.findIndex((item) => item !== null)) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.strokeStyle = options.color || CHART_COLORS.price;
  context.lineWidth = 2.5;
  context.stroke();
}

function drawMacdCanvas(canvas, macdData) {
  const { width, height } = syncCanvasSize(canvas);
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, width, height);

  const allValues = [...macdData.macd, ...macdData.signal, ...macdData.histogram].filter((value) => value !== null);
  if (!allValues.length) {
    context.fillStyle = CHART_COLORS.text;
    context.font = "16px 'Be Vietnam Pro', Arial";
    context.fillText("Chưa đủ dữ liệu.", 18, 38);
    return;
  }

  const padding = 34;
  const maxAbs = Math.max(...allValues.map((value) => Math.abs(value))) || 1;
  const min = -maxAbs;
  const max = maxAbs;
  const span = max - min;

  const yFor = (value) => height - padding - ((value - min) / span) * (height - padding * 2);
  const xFor = (index) => padding + ((width - padding * 2) / Math.max(macdData.macd.length - 1, 1)) * index;

  context.strokeStyle = CHART_COLORS.grid;
  context.lineWidth = 1;
  [min, 0, max].forEach((value) => {
    const y = yFor(value);
    context.beginPath();
    context.moveTo(padding, y);
    context.lineTo(width - padding, y);
    context.stroke();
  });

  macdData.histogram.forEach((value, index) => {
    if (value === null) return;
    const x = xFor(index);
    const zeroY = yFor(0);
    const y = yFor(value);
    context.strokeStyle = value > 0 ? CHART_COLORS.positive : value < 0 ? CHART_COLORS.negative : CHART_COLORS.neutral;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(x, zeroY);
    context.lineTo(x, y);
    context.stroke();
  });

  [
    { values: macdData.macd, color: CHART_COLORS.price },
    { values: macdData.signal, color: CHART_COLORS.ma10 }
  ].forEach((line) => {
    context.beginPath();
    let started = false;
    line.values.forEach((value, index) => {
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
    context.strokeStyle = line.color;
    context.lineWidth = 2;
    context.stroke();
  });
}

