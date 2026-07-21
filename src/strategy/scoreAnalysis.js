function renderScoreAnalysis(symbol, quote, overview, bars, movingAverages, indicators) {
  const score = scoreStock(symbol, quote, overview, bars, movingAverages, indicators);
  const name = safeText(overview.name) !== "-" ? overview.name : symbol;
  const macdState = score.latestMacd > score.latestSignal ? "MACD đang nằm trên Signal" : "MACD đang nằm dưới Signal";
  const trendState = score.currentPrice > score.ma50 && score.ma50 > score.ma100 && score.ma100 > score.ma200
    ? "Xu hướng giá đang rất tích cực: giá trên MA50 và MA50 > MA100 > MA200."
    : "Xu hướng chưa đồng thuận hoàn toàn giữa giá và các đường MA lớn.";
  const rsiState = score.latestRsi >= 50 && score.latestRsi <= 65
    ? "RSI nằm trong vùng khỏe, chưa quá nóng."
    : score.latestRsi > 70
      ? "RSI đang cao, cần để ý rủi ro rung lắc ngắn hạn."
      : "RSI chưa cho tín hiệu sức mạnh rõ ràng.";
  const rrText = score.riskReward === null ? "-" : `${formatNumber(score.riskReward, 2)} : 1`;
  const upgradeText = [
    score.latestMacd <= score.latestSignal ? "MACD cắt lên Signal" : null,
    score.latestRsi < 55 ? "RSI vượt lại trên 55" : null,
    score.levels.resistance1 ? `Giá vượt ${formatPrice(score.levels.resistance1)} với volume tốt` : "Giá vượt kháng cự gần",
    score.latestVolume < score.avgVolume20 ? "Volume vượt trung bình 20 phiên" : null
  ].filter(Boolean);
  const relatedNewsHtml = score.relatedNews.length
    ? `
      <p>Tìm thấy ${score.relatedNews.length} tin liên quan trực tiếp tới mã hoặc doanh nghiệp từ nguồn RSS uy tín.</p>
      <ul class="score-points">
        ${score.relatedNews.slice(0, 3).map((item) => `
          <li><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a> <small>(${escapeHtml(item.source)}, ${formatNewsDate(item.pubDate)})</small></li>
        `).join("")}
      </ul>
    `
    : `<p>Chưa tìm thấy tin liên quan trực tiếp tới ${escapeHtml(symbol)} trong RSS mới nhất. Điểm cơ bản được giữ thận trọng và nên đọc thêm báo cáo tài chính, công bố thông tin hoặc tin doanh nghiệp riêng.</p>`;
  const strength = score.marketStrength || {};
  const marketStrengthHtml = strength.relative20 !== undefined && strength.relative20 !== null || strength.relative60 !== undefined && strength.relative60 !== null
    ? `
      <p>App đang dùng sức mạnh tương đối so với VNINDEX làm thước đo thay thế khi chưa có API phân ngành realtime đầy đủ.</p>
      <ul class="score-points">
        <li>20 phiên: ${escapeHtml(symbol)} ${formatPercent(strength.stock20)} / VNINDEX ${formatPercent(strength.index20)} / chênh lệch ${formatPercent(strength.relative20)}</li>
        <li>60 phiên: ${escapeHtml(symbol)} ${formatPercent(strength.stock60)} / VNINDEX ${formatPercent(strength.index60)} / chênh lệch ${formatPercent(strength.relative60)}</li>
      </ul>
    `
    : `<p>Chưa tải được dữ liệu VNINDEX để so sánh sức mạnh tương đối. Điểm này được giữ ở mức trung tính có điều kiện.</p>`;

  fields.scoreTotalBadge.textContent = `${score.total}/100 điểm`;
  fields.scoreAnalysis.innerHTML = `
    <div class="score-hero">
      <h3>${escapeHtml(symbol)} - ${escapeHtml(name)}</h3>
      <p><strong>Giá hiện tại:</strong> ${formatPrice(score.currentPrice)}</p>
      <p><strong>Kết luận:</strong> ${conclusionForScore(score.total)}.</p>
      <span class="score-tag">${score.total}/100</span>
    </div>

    <div class="score-block">
      <h3>1. Xu hướng (${score.trendScore}/25)</h3>
      <p>${trendState}</p>
      <ul class="score-points">
        <li>Giá hiện tại: ${formatPrice(score.currentPrice)}</li>
        <li>MA50: ${formatOptional(score.ma50, 2)}, MA100: ${formatOptional(score.ma100, 2)}, MA200: ${formatOptional(score.ma200, 2)}</li>
        <li>Biến động 30 phiên: ${formatPercent(score.change30)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>2. Volume - Dòng tiền (${score.volumeScore}/20)</h3>
      <p>Thanh khoản phiên gần nhất được so sánh với trung bình 20 và 60 phiên.</p>
      <ul class="score-points">
        <li>Volume gần nhất: ${formatInteger(score.latestVolume)}</li>
        <li>Volume TB20: ${formatInteger(score.avgVolume20)}</li>
        <li>Volume TB60: ${formatInteger(score.avgVolume60)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>3. RSI (${score.rsiScore}/10)</h3>
      <p>${rsiState}</p>
      <p>RSI 14 hiện tại: <strong>${formatOptional(score.latestRsi, 2)}</strong>.</p>
    </div>

    <div class="score-block">
      <h3>4. MACD (${score.macdScore}/10)</h3>
      <p>${macdState}. Histogram hiện tại: ${formatOptional(score.latestHistogram, 2)}.</p>
      <p>MACD: ${formatOptional(score.latestMacd, 2)} / Signal: ${formatOptional(score.latestSignal, 2)}.</p>
    </div>

    <div class="score-block">
      <h3>5. Hỗ trợ - Kháng cự (${score.srScore}/10)</h3>
      <ul class="score-points">
        <li>Hỗ trợ gần: ${formatPrice(score.levels.support1)}</li>
        <li>Hỗ trợ sâu: ${formatPrice(score.levels.support2)}</li>
        <li>Kháng cự gần: ${formatPrice(score.levels.resistance1)}</li>
        <li>Kháng cự sau: ${formatPrice(score.levels.resistance2)}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>6. Cơ bản - Tin tức (${score.fundamentalScore}/10)</h3>
      ${relatedNewsHtml}
    </div>

    <div class="score-block">
      <h3>7. Sức mạnh ngành (${score.industryScore}/10)</h3>
      ${marketStrengthHtml}
    </div>

    <div class="score-block">
      <h3>8. Risk / Reward (${score.rrScore}/5)</h3>
      <ul class="score-points">
        <li>Giá mua tham chiếu: ${formatPrice(score.currentPrice)}</li>
        <li>Cắt lỗ gợi ý: ${formatPrice(score.stopPrice)} (${formatPercent(-score.riskPercent)})</li>
        <li>Mục tiêu gần: ${formatPrice(score.targetPrice)} (${formatPercent(score.rewardPercent)})</li>
        <li>Tỷ lệ Reward/Risk: ${rrText}</li>
      </ul>
    </div>

    <div class="score-block">
      <h3>Tổng điểm</h3>
      <div class="table-wrap score-table-wrap">
        <table class="score-table">
          <thead><tr><th>Tiêu chí</th><th>Điểm</th></tr></thead>
          <tbody>
            <tr><td>Xu hướng</td><td>${score.trendScore}/25</td></tr>
            <tr><td>Volume - Dòng tiền</td><td>${score.volumeScore}/20</td></tr>
            <tr><td>RSI</td><td>${score.rsiScore}/10</td></tr>
            <tr><td>MACD</td><td>${score.macdScore}/10</td></tr>
            <tr><td>Hỗ trợ / Kháng cự</td><td>${score.srScore}/10</td></tr>
            <tr><td>Cơ bản - Tin tức</td><td>${score.fundamentalScore}/10</td></tr>
            <tr><td>Sức mạnh ngành</td><td>${score.industryScore}/10</td></tr>
            <tr><td>Risk / Reward</td><td>${score.rrScore}/5</td></tr>
            <tr class="total-row"><td>Tổng</td><td>${score.total}/100</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="score-block">
      <h3>Kết luận và kế hoạch</h3>
      <p><strong>${escapeHtml(symbol)} = ${score.total}/100.</strong> ${conclusionForScore(score.total)}.</p>
      <p>Nếu tham gia, có thể chia vị thế theo từng phần thay vì mua một lần: một phần ở vùng hiện tại, một phần khi MACD xác nhận, và một phần khi giá vượt kháng cự với volume tốt.</p>
      <p>Điều kiện để nâng điểm: ${upgradeText.length ? upgradeText.join("; ") : "các tín hiệu kỹ thuật chính hiện đã khá tích cực, cần duy trì thanh khoản và xu hướng."}</p>
    </div>
  `;

  return score;
}

function recommendationLabel(score) {
  if (score >= 4) return { text: "Ưu tiên mua", className: "positive" };
  if (score >= 2) return { text: "Mua thăm dò", className: "positive" };
  if (score >= 0) return { text: "Theo dõi", className: "neutral" };
  if (score >= -2) return { text: "Giảm tỷ trọng", className: "negative" };
  return { text: "Tránh mua", className: "negative" };
}

function buildRecommendation(title, bars, options) {
  const latestBar = bars[bars.length - 1] || {};
  const currentPrice = latestBar.close;
  const movingAverages = calculateMovingAverages(bars);
  const rsi = calculateRsi(bars);
  const macd = calculateMacd(bars);
  const maFast = latestNonNull(movingAverages[options.fastMa]);
  const maSlow = latestNonNull(movingAverages[options.slowMa]);
  const latestRsi = latestNonNull(rsi);
  const latestMacd = latestNonNull(macd.macd);
  const latestSignal = latestNonNull(macd.signal);
  const latestHistogram = latestNonNull(macd.histogram);
  const volumes = bars.map((bar) => bar.volume);
  const latestVolume = latestBar.volume;
  const avgVolume20 = average(volumes.slice(-20));
  const levels = findSupportResistance(bars, currentPrice);

  let score = 0;
  const reasons = [];

  if (currentPrice > maFast) {
    score += 1;
    reasons.push(`giá trên ${options.fastLabel}`);
  } else {
    score -= 1;
    reasons.push(`giá dưới ${options.fastLabel}`);
  }

  if (maFast > maSlow) {
    score += 1;
    reasons.push(`${options.fastLabel} trên ${options.slowLabel}`);
  } else {
    score -= 1;
    reasons.push(`${options.fastLabel} dưới ${options.slowLabel}`);
  }

  if (latestMacd > latestSignal && latestHistogram > 0) {
    score += 1;
    reasons.push("MACD ủng hộ tăng");
  } else if (latestMacd < latestSignal && latestHistogram < 0) {
    score -= 1;
    reasons.push("MACD còn yếu");
  }

  if (latestRsi >= 45 && latestRsi <= 65) {
    score += 1;
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} khỏe`);
  } else if (latestRsi > 75 || latestRsi < 35) {
    score -= 1;
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} rủi ro`);
  } else {
    reasons.push(`RSI ${formatOptional(latestRsi, 1)} trung tính`);
  }

  if (latestVolume && avgVolume20 && latestVolume > avgVolume20) {
    score += 1;
    reasons.push("volume trên TB20");
  }

  const distanceToSupport = levels.support1 ? ((currentPrice - levels.support1) / currentPrice) * 100 : null;
  if (distanceToSupport !== null && distanceToSupport <= 4) {
    score += 1;
    reasons.push("gần hỗ trợ");
  }

  const label = recommendationLabel(score);
  return {
    title,
    label,
    detail: `${reasons.slice(0, 4).join(", ")}. Hỗ trợ gần ${formatPrice(levels.support1)}, kháng cự gần ${formatPrice(levels.resistance1)}.`
  };
}

function renderTradingRecommendations(bars) {
  if (!bars.length) return;
  const normalizedBars = normalizeTechnicalBars(bars);
  const recommendations = [
    buildRecommendation("Ngắn hạn", normalizedBars.slice(-80), {
      fastMa: "ma10",
      slowMa: "ma50",
      fastLabel: "MA20",
      slowLabel: "MA50"
    }),
    buildRecommendation("Trung hạn", normalizedBars.slice(-180), {
      fastMa: "ma50",
      slowMa: "ma100",
      fastLabel: "MA50",
      slowLabel: "MA100"
    }),
    buildRecommendation("Dài hạn", normalizedBars, {
      fastMa: "ma100",
      slowMa: "ma200",
      fastLabel: "MA100",
      slowLabel: "MA200"
    })
  ];

  fields.recommendationBody.innerHTML = recommendations.map((item) => `
    <article>
      <span>${escapeHtml(item.title)}</span>
      <strong class="${item.label.className}">${escapeHtml(item.label.text)}</strong>
      <p>${escapeHtml(item.detail)}</p>
    </article>
  `).join("");
}

function fillData(symbol, quote, overview, bars) {
  const isCrypto = overview.assetType === "crypto";
  const latestBar = bars[bars.length - 1] || {};
  const previousBar = bars[bars.length - 2] || {};
  const currentPrice = latestBar.close ?? quote.price;
  const reference = previousBar.close ?? quote.referencePrice;
  const change = toNumber(currentPrice) !== null && toNumber(reference) !== null
    ? toNumber(currentPrice) - toNumber(reference)
    : null;
  const changePercent = toNumber(change) !== null && toNumber(reference)
    ? (toNumber(change) / toNumber(reference)) * 100
    : null;
  const priceLimits = isCrypto ? { ceiling: null, floor: null } : calculateCeilingFloor(reference, overview.exchange || quote.exchange);

  fields.exchange.textContent = `${symbol} ${overview.exchange || quote.exchange ? "- " + safeText(overview.exchange || quote.exchange) : ""}`;
  fields.companyName.textContent = safeText(overview.name) !== "-" ? overview.name : symbol;
  fields.companyDescription.textContent = safeText(overview.description) !== "-"
    ? overview.description
    : isCrypto
      ? "Dữ liệu coin được ưu tiên lấy từ Binance, sau đó OKX; Yahoo Finance chỉ dùng làm dự phòng. Một số chỉ số cơ bản kiểu cổ phiếu sẽ không áp dụng cho coin."
      : "Dữ liệu được lấy từ nguồn công khai. Một số trường có thể trống tùy theo mã cổ phiếu.";
  fields.currentPrice.textContent = formatAssetPrice(currentPrice, isCrypto ? "crypto" : "stock");
  fields.priceChange.textContent = `${toNumber(change) > 0 ? "+" : ""}${formatAssetPrice(change, isCrypto ? "crypto" : "stock")} (${formatPercent(changePercent)})`;
  updatePriceColor(currentPrice, reference, fields.priceChange);

  fields.referencePrice.textContent = formatAssetPrice(reference, isCrypto ? "crypto" : "stock");
  fields.ceilingPrice.classList.remove("ceiling");
  fields.floorPrice.classList.remove("floor");
  fields.ceilingPrice.textContent = isCrypto ? "-" : formatPrice(quote.ceilingPrice ?? priceLimits.ceiling);
  fields.floorPrice.textContent = isCrypto ? "-" : formatPrice(quote.floorPrice ?? priceLimits.floor);
  if (!isCrypto) {
    fields.ceilingPrice.classList.add("ceiling");
    fields.floorPrice.classList.add("floor");
  }
  fields.highPrice.textContent = formatAssetPrice(quote.highPrice ?? latestBar.high, isCrypto ? "crypto" : "stock");
  fields.lowPrice.textContent = formatAssetPrice(quote.lowPrice ?? latestBar.low, isCrypto ? "crypto" : "stock");
  fields.volume.textContent = formatInteger(quote.volume ?? latestBar.volume);

  fields.ticker.textContent = symbol;
  fields.listedExchange.textContent = safeText(overview.exchange || quote.exchange);
  fields.industry.textContent = safeText(overview.industry);
  fields.sector.textContent = safeText(overview.sector);
  fields.marketCap.textContent = toNumber(overview.marketCap) ? formatLargeNumber(overview.marketCap) : "-";
  fields.peRatio.textContent = formatFundamentalNumber(overview.pe, 2);
  fields.pbRatio.textContent = formatFundamentalNumber(overview.pb, 2);
  fields.roe.textContent = toNumber(overview.roe) ? formatPercent(overview.roe) : "-";
  fields.eps.textContent = formatFundamentalNumber(overview.eps, 2);
  fields.beta.textContent = formatFundamentalNumber(overview.beta, 2);

  currentSymbol = symbol;
  currentAssetType = isCrypto ? "crypto" : "stock";
  currentDataSymbol = quote.ticker || overview.ticker || symbol;
  currentDailyBars = bars;
  activeChartRange = "1d";
  activeHistoryLimit = 30;
  setActiveChartButton(activeChartRange);
  setActiveHistoryButton(activeHistoryLimit);
  renderSelectedChart(bars, activeChartRange);
  const scoreBars = aggregateBarsForPreset(bars, CHART_PRESETS["1d"]);
  const scoreTechnicalBars = normalizeTechnicalBars(scoreBars);
  const movingAverages = calculateMovingAverages(scoreBars);
  const indicators = {
    rsi: calculateRsi(scoreTechnicalBars),
    macd: calculateMacd(scoreTechnicalBars)
  };
  renderPriceChanges(bars);
  renderTradingRecommendations(bars);
  renderInvestorFlow(quote);
  renderHistory(bars, activeHistoryLimit);
  const score = renderScoreAnalysis(symbol, quote, overview, scoreBars, movingAverages, indicators);
  const fundamentalView = renderFundamentalAnalysis(overview, score);
  return { movingAverages, indicators, score, fundamentalView };
}

