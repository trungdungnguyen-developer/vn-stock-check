function calculateEma(values, period) {
  const ema = Array(values.length).fill(null);
  if (values.length < period) return ema;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let index = 0; index < period; index += 1) {
    sum += values[index];
  }
  ema[period - 1] = sum / period;

  for (let index = period; index < values.length; index += 1) {
    ema[index] = (values[index] - ema[index - 1]) * multiplier + ema[index - 1];
  }

  return ema;
}

