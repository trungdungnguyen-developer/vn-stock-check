function technicalPriceDivisor(bars) {
  const closes = bars
    .map((bar) => toNumber(bar.close))
    .filter((value) => value !== null)
    .sort((a, b) => a - b);
  if (!closes.length) return 1;
  const median = closes[Math.floor(closes.length / 2)];
  return median >= 1000 ? 1000 : 1;
}

function normalizeTechnicalBars(bars) {
  const divisor = technicalPriceDivisor(bars);
  if (divisor === 1) return bars;
  const normalize = (value) => {
    const number = toNumber(value);
    return number === null ? null : number / divisor;
  };

  return bars.map((bar) => ({
    ...bar,
    open: normalize(bar.open),
    high: normalize(bar.high),
    low: normalize(bar.low),
    close: normalize(bar.close)
  }));
}

