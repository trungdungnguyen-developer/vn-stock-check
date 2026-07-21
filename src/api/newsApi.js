async function loadNews(symbol = currentSymbol, options = {}) {
  if (fields.newsBody && !options.silent) {
    fields.newsBody.innerHTML = `
      <article>
        <span>Đang cập nhật</span>
        <h3>Đang tải tin tức thị trường...</h3>
        <p>Nguồn RSS có thể mất vài giây để phản hồi.</p>
      </article>
    `;
  }

  try {
    const data = await requestNewsData();
    latestNewsItems = Array.isArray(data.items) ? data.items : [];
    renderNews(latestNewsItems, symbol, fields.companyName.textContent);
    return latestNewsItems;
  } catch (error) {
    if (!options.silent && fields.newsBody) {
      fields.newsBody.innerHTML = `
        <article>
          <span>Lỗi dữ liệu</span>
          <h3>${escapeHtml(error.message || "Không tải được tin tức.")}</h3>
          <p>Hãy kiểm tra local server hoặc Netlify Function đã được upload cùng website.</p>
        </article>
      `;
    }
    latestNewsItems = [];
    return [];
  }
}

function calculateMarketStrength(stockBars, indexBars) {
  const stock20 = percentChangeBetween(stockBars, 20);
  const stock60 = percentChangeBetween(stockBars, 60);
  const index20 = percentChangeBetween(indexBars, 20);
  const index60 = percentChangeBetween(indexBars, 60);

  return {
    stock20,
    stock60,
    index20,
    index60,
    relative20: toNumber(stock20) !== null && toNumber(index20) !== null ? stock20 - index20 : null,
    relative60: toNumber(stock60) !== null && toNumber(index60) !== null ? stock60 - index60 : null
  };
}

function hasUsefulValue(value) {
  return value !== undefined && value !== null && value !== "" && value !== "-" && value !== 0;
}

function mergeOverviewWithFundamentals(overview, fundamentals) {
  const extra = fundamentals?.overview || {};
  return {
    ...overview,
    ticker: extra.ticker || overview.ticker,
    name: hasUsefulValue(extra.name) ? extra.name : overview.name,
    exchange: hasUsefulValue(extra.exchange) ? boardName(extra.exchange) : overview.exchange,
    industry: hasUsefulValue(extra.industry) ? extra.industry : overview.industry,
    sector: hasUsefulValue(extra.sector) ? extra.sector : overview.sector,
    marketCap: hasUsefulValue(extra.marketCap) ? extra.marketCap : overview.marketCap,
    pe: hasUsefulValue(extra.pe) ? extra.pe : overview.pe,
    pb: hasUsefulValue(extra.pb) ? extra.pb : overview.pb,
    roe: hasUsefulValue(extra.roe) ? extra.roe : overview.roe,
    eps: hasUsefulValue(extra.eps) ? extra.eps : overview.eps,
    beta: hasUsefulValue(extra.beta) ? extra.beta : overview.beta,
    fundamentalsSource: fundamentals?.found ? fundamentals.source : overview.fundamentalsSource
  };
}

function average(values) {
  const filtered = values.filter((value) => toNumber(value) !== null);
  if (!filtered.length) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function findSupportResistance(bars, currentPrice) {
  const recent = bars.slice(-80);
  const supports = recent
    .map((bar) => bar.low)
    .filter((value) => toNumber(value) !== null && value < currentPrice)
    .sort((a, b) => b - a);
  const resistances = recent
    .map((bar) => bar.high)
    .filter((value) => toNumber(value) !== null && value > currentPrice)
    .sort((a, b) => a - b);

  return {
    support1: supports[0] ?? null,
    support2: supports[Math.min(9, supports.length - 1)] ?? null,
    resistance1: resistances[0] ?? null,
    resistance2: resistances[Math.min(9, resistances.length - 1)] ?? null
  };
}

function scoreStock(symbol, quote, overview, bars, movingAverages, indicators) {
  const latestBar = bars[bars.length - 1] || {};
  const currentPrice = quote.price ?? latestBar.close;
  const ma50 = latestNonNull(movingAverages.ma50);
  const ma100 = latestNonNull(movingAverages.ma100);
  const ma200 = latestNonNull(movingAverages.ma200);
  const latestRsi = latestNonNull(indicators.rsi);
  const latestMacd = latestNonNull(indicators.macd.macd);
  const latestSignal = latestNonNull(indicators.macd.signal);
  const latestHistogram = latestNonNull(indicators.macd.histogram);
  const change30 = bars.length > 31 ? ((currentPrice - bars[bars.length - 31].close) / bars[bars.length - 31].close) * 100 : null;
  const volumes = bars.map((bar) => bar.volume);
  const avgVolume20 = average(volumes.slice(-20));
  const avgVolume60 = average(volumes.slice(-60));
  const latestVolume = latestBar.volume;
  const levels = findSupportResistance(bars, currentPrice);
  const stopPrice = levels.support1 ? levels.support1 * 0.98 : currentPrice * 0.95;
  const targetPrice = levels.resistance1 || currentPrice * 1.15;
  const riskPercent = ((currentPrice - stopPrice) / currentPrice) * 100;
  const rewardPercent = ((targetPrice - currentPrice) / currentPrice) * 100;
  const riskReward = riskPercent > 0 ? rewardPercent / riskPercent : null;

  let trendScore = 0;
  if (currentPrice > ma50) trendScore += 6;
  if (currentPrice > ma200) trendScore += 5;
  if (ma50 > ma100) trendScore += 5;
  if (ma100 > ma200) trendScore += 5;
  if (toNumber(change30) !== null && change30 > 0) trendScore += 4;
  trendScore = Math.min(trendScore, 25);

  let volumeScore = 4;
  if (latestVolume && avgVolume20 && latestVolume >= avgVolume20) volumeScore += 6;
  if (avgVolume20 && avgVolume60 && avgVolume20 >= avgVolume60) volumeScore += 5;
  if (toNumber(change30) !== null && change30 > 0) volumeScore += 3;
  if (latestVolume) volumeScore += 2;
  volumeScore = Math.min(volumeScore, 20);

  let rsiScore = 5;
  if (latestRsi >= 50 && latestRsi <= 65) rsiScore = 10;
  else if (latestRsi > 65 && latestRsi <= 75) rsiScore = 8;
  else if (latestRsi >= 40 && latestRsi < 50) rsiScore = 7;
  else if (latestRsi >= 30 && latestRsi < 40) rsiScore = 6;
  else if (latestRsi > 75) rsiScore = 5;
  else if (latestRsi < 30) rsiScore = 4;

  let macdScore = 3;
  if (latestMacd > latestSignal) macdScore += 4;
  if (latestHistogram > 0) macdScore += 2;
  if (latestMacd > 0) macdScore += 1;
  macdScore = Math.min(macdScore, 10);

  const distanceToSupport = levels.support1 ? ((currentPrice - levels.support1) / currentPrice) * 100 : null;
  let srScore = 4;
  if (distanceToSupport !== null && distanceToSupport <= 5) srScore += 3;
  if (riskReward !== null && riskReward >= 2) srScore += 2;
  if (levels.resistance1) srScore += 1;
  srScore = Math.min(srScore, 10);

  const relatedNews = latestNewsItems.filter((item) => isRelatedNews(item, symbol, overview.name || symbol));
  let fundamentalScore = overview.name && overview.name !== symbol ? 5 : 4;
  if (relatedNews.length >= 1) fundamentalScore += 1;
  if (relatedNews.length >= 3) fundamentalScore += 1;
  if (overview.industry && overview.industry !== "-") fundamentalScore += 1;
  if (overview.pe || overview.pb || overview.roe || overview.eps) fundamentalScore += 1;
  fundamentalScore = Math.min(fundamentalScore, 10);

  let industryScore = overview.exchange ? 5 : 4;
  if (latestMarketStrength && latestMarketStrength.relative20 !== null && latestMarketStrength.relative20 > 0) industryScore += 2;
  if (latestMarketStrength && latestMarketStrength.relative60 !== null && latestMarketStrength.relative60 > 0) industryScore += 2;
  if (latestMarketStrength && latestMarketStrength.stock20 !== null && latestMarketStrength.stock20 > 0) industryScore += 1;
  industryScore = Math.min(industryScore, 10);
  let rrScore = 2;
  if (riskReward >= 3) rrScore = 5;
  else if (riskReward >= 2) rrScore = 4;
  else if (riskReward >= 1.3) rrScore = 3;

  const total = trendScore + volumeScore + rsiScore + macdScore + srScore + fundamentalScore + industryScore + rrScore;

  return {
    total,
    trendScore,
    volumeScore,
    rsiScore,
    macdScore,
    srScore,
    fundamentalScore,
    industryScore,
    relatedNews,
    marketStrength: latestMarketStrength,
    rrScore,
    currentPrice,
    ma50,
    ma100,
    ma200,
    latestRsi,
    latestMacd,
    latestSignal,
    latestHistogram,
    change30,
    avgVolume20,
    avgVolume60,
    latestVolume,
    levels,
    stopPrice,
    targetPrice,
    riskPercent,
    rewardPercent,
    riskReward
  };
}

function conclusionForScore(total) {
  if (total >= 85) return "Mua rất mạnh theo hệ thống";
  if (total >= 75) return "Mua mạnh theo hệ thống";
  if (total >= 65) return "Theo dõi mua / mua từng phần";
  if (total >= 50) return "Trung tính, cần thêm tín hiệu xác nhận";
  return "Yếu, chưa nên ưu tiên";
}

