function renderIndicators(bars, indicators = null) {
  const rsi = indicators?.rsi || calculateRsi(bars);
  const macd = indicators?.macd || calculateMacd(bars);
  const latestRsi = [...rsi].reverse().find((value) => value !== null);
  const latestMacd = [...macd.macd].reverse().find((value) => value !== null);
  const latestSignal = [...macd.signal].reverse().find((value) => value !== null);
  const latestHistogram = [...macd.histogram].reverse().find((value) => value !== null);

  fields.rsiValue.textContent = latestRsi === undefined ? "-" : formatNumber(latestRsi, 2);
  fields.macdValue.textContent = latestMacd === undefined
    ? "-"
    : `${formatNumber(latestMacd, 2)} / Signal ${formatOptional(latestSignal, 2)} / Hist ${formatOptional(latestHistogram, 2)}`;

  drawLineCanvas(rsiCanvas, rsi, {
    min: 0,
    max: 100,
    color: CHART_COLORS.price,
    guides: [
      { value: 70, color: CHART_COLORS.negative, label: "70" },
      { value: 30, color: CHART_COLORS.positive, label: "30" }
    ]
  });
  drawMacdCanvas(macdCanvas, macd);

  return { rsi, macd };
}

function renderInvestorFlow(quote) {
  const foreignBuy = toNumber(quote.foreignBuyValue);
  const foreignSell = toNumber(quote.foreignSellValue);
  const totalValue = toNumber(quote.totalValue);
  const foreignNet = foreignBuy !== null && foreignSell !== null ? foreignBuy - foreignSell : null;
  const domesticBuy = totalValue !== null && foreignBuy !== null ? totalValue - foreignBuy : null;
  const domesticSell = totalValue !== null && foreignSell !== null ? totalValue - foreignSell : null;
  const domesticNet = foreignNet !== null ? -foreignNet : null;

  fields.foreignBuy.textContent = formatLargeNumber(foreignBuy);
  fields.foreignSell.textContent = formatLargeNumber(foreignSell);
  fields.foreignNet.textContent = formatLargeNumber(foreignNet);
  fields.domesticBuy.textContent = formatLargeNumber(domesticBuy);
  fields.domesticSell.textContent = formatLargeNumber(domesticSell);
  fields.domesticNet.textContent = formatLargeNumber(domesticNet);
  fields.foreignNet.classList.remove("positive", "negative", "neutral");
  fields.domesticNet.classList.remove("positive", "negative", "neutral");
  const foreignClass = valueClass(foreignNet);
  const domesticClass = valueClass(domesticNet);
  if (foreignClass) fields.foreignNet.classList.add(foreignClass);
  if (domesticClass) fields.domesticNet.classList.add(domesticClass);
  fields.flowStatus.textContent = foreignBuy !== null ? "Dữ liệu từ Vietcap/VCI" : "Chưa có dữ liệu";
}

function renderHistory(bars, limit = activeHistoryLimit) {
  const rows = bars
    .map((bar, index) => {
      const previousClose = index > 0 ? bars[index - 1].close : null;
      const changePercent = previousClose ? ((bar.close - previousClose) / previousClose) * 100 : null;
      return { ...bar, changePercent };
    })
    .slice(-limit)
    .reverse();

  const limitInfo = HISTORY_LIMITS[String(limit)] || { label: `${limit} ngày` };
  fields.historyCount.textContent = `${rows.length} phiên gần nhất (${limitInfo.label})`;
  fields.historyBody.innerHTML = rows.map((row) => `
    <tr>
      <td>${safeText(row.time)}</td>
      <td>${formatAssetPrice(row.open)}</td>
      <td>${formatAssetPrice(row.high)}</td>
      <td>${formatAssetPrice(row.low)}</td>
      <td class="${valueClass(row.changePercent)}">${formatAssetPrice(row.close)}</td>
      <td class="${valueClass(row.changePercent)}">${formatPercent(row.changePercent)}</td>
      <td>${formatInteger(row.volume)}</td>
    </tr>
  `).join("");
}

function renderPriceChanges(bars) {
  const latest = bars[bars.length - 1]?.close;
  const periods = [3, 7, 10, 14, 21, 30];

  periods.forEach((period) => {
    const target = fields[`change${period}`];
    const compare = bars[bars.length - 1 - period]?.close;
    const change = latest && compare ? ((latest - compare) / compare) * 100 : null;
    target.textContent = formatPercent(change);
    target.classList.remove("positive", "negative", "neutral");
    const className = valueClass(change);
    if (className) target.classList.add(className);
  });
}

function classifyPe(pe) {
  const value = toNumber(pe);
  if (value === null || value <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có P/E hợp lệ để đánh giá định giá theo lợi nhuận." };
  if (value < 8) return { label: "Rẻ tương đối", className: "positive", score: 2, text: "P/E thấp, có thể đang rẻ nếu lợi nhuận không suy giảm mạnh." };
  if (value <= 15) return { label: "Hợp lý", className: "positive", score: 2, text: "P/E nằm trong vùng dễ chấp nhận với nhiều cổ phiếu Việt Nam." };
  if (value <= 25) return { label: "Cao vừa", className: "neutral", score: 1, text: "P/E không rẻ, cần doanh nghiệp có tăng trưởng tốt để hấp dẫn." };
  return { label: "Đắt", className: "negative", score: -1, text: "P/E cao, biên an toàn định giá thấp hơn nếu tăng trưởng không đủ mạnh." };
}

function classifyPb(pb, roe) {
  const pbValue = toNumber(pb);
  const roeValue = toNumber(roe);
  if (pbValue === null || pbValue <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có P/B hợp lệ để đánh giá giá trị sổ sách." };
  if (pbValue < 1) return { label: "Dưới giá trị sổ sách", className: "positive", score: 2, text: "P/B dưới 1, cần kiểm tra chất lượng tài sản và triển vọng ngành." };
  if (pbValue <= 2) return { label: "Hợp lý", className: "positive", score: 1, text: "P/B ở vùng vừa phải, phù hợp hơn nếu ROE tốt." };
  if (pbValue <= 4 && roeValue !== null && roeValue >= 18) return { label: "Cao nhưng có ROE hỗ trợ", className: "neutral", score: 1, text: "P/B cao hơn trung bình nhưng ROE tốt giúp định giá dễ chấp nhận hơn." };
  if (pbValue <= 4) return { label: "Cao", className: "neutral", score: 0, text: "P/B cao, cần xem tăng trưởng và lợi thế cạnh tranh." };
  return { label: "Rất cao", className: "negative", score: -1, text: "P/B rất cao, rủi ro định giá lớn nếu ROE/growth không nổi bật." };
}

function classifyRoe(roe) {
  const value = toNumber(roe);
  if (value === null) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có ROE để đánh giá hiệu quả sinh lời." };
  if (value >= 20) return { label: "Sinh lời mạnh", className: "positive", score: 2, text: "ROE cao, doanh nghiệp đang tạo lợi nhuận tốt trên vốn chủ." };
  if (value >= 12) return { label: "Sinh lời ổn", className: "positive", score: 1, text: "ROE ở mức khá, có thể chấp nhận nếu xu hướng lợi nhuận ổn định." };
  if (value >= 5) return { label: "Trung bình", className: "neutral", score: 0, text: "ROE chưa nổi bật, cần thêm yếu tố tăng trưởng hoặc định giá rẻ." };
  return { label: "Yếu", className: "negative", score: -1, text: "ROE thấp, chất lượng sinh lời chưa hấp dẫn." };
}

function classifyBeta(beta) {
  const value = toNumber(beta);
  if (value === null || value <= 0) return { label: "Thiếu dữ liệu", className: "neutral", score: 0, text: "Chưa có Beta để đánh giá độ biến động." };
  if (value < 0.8) return { label: "Biến động thấp", className: "positive", score: 1, text: "Beta thấp hơn thị trường, phù hợp hơn với phong cách thận trọng." };
  if (value <= 1.2) return { label: "Biến động vừa", className: "neutral", score: 1, text: "Beta gần thị trường, rủi ro biến động ở mức vừa phải." };
  return { label: "Biến động cao", className: "negative", score: -1, text: "Beta cao, cần quản trị vị thế và điểm cắt lỗ chặt hơn." };
}

function renderFundamentalAnalysis(overview, score) {
  if (!fields.fundamentalAnalysis) return null;

  const pe = classifyPe(overview.pe);
  const pb = classifyPb(overview.pb, overview.roe);
  const roe = classifyRoe(overview.roe);
  const beta = classifyBeta(overview.beta);
  const eps = toNumber(overview.eps);
  const marketCap = toNumber(overview.marketCap);
  const total = pe.score + pb.score + roe.score + beta.score + (eps !== null && eps > 0 ? 1 : eps !== null && eps < 0 ? -1 : 0);
  const valuationLabel = total >= 5
    ? { text: "Cơ bản hấp dẫn", className: "positive" }
    : total >= 2
      ? { text: "Cơ bản tương đối ổn", className: "positive" }
      : total >= 0
        ? { text: "Trung tính", className: "neutral" }
        : { text: "Cần thận trọng", className: "negative" };
  const investText = score?.total >= 65 && total >= 2
    ? "Có thể đưa vào danh sách theo dõi mua từng phần khi kỹ thuật xác nhận."
    : score?.total >= 50 && total >= 0
      ? "Chưa nên mua vội, phù hợp để theo dõi thêm tín hiệu giá và dòng tiền."
      : "Chưa nên ưu tiên giải ngân nếu chưa có thêm tín hiệu cải thiện rõ.";

  fields.fundamentalBadge.textContent = valuationLabel.text;
  fields.fundamentalBadge.classList.remove("positive", "negative", "neutral");
  fields.fundamentalBadge.classList.add(valuationLabel.className);
  fields.fundamentalAnalysis.innerHTML = `
    <article>
      <span>Định giá P/E, P/B</span>
      <strong class="${pe.className}">${pe.label}</strong>
      <p>P/E ${formatFundamentalNumber(overview.pe, 2)}. P/B ${formatFundamentalNumber(overview.pb, 2)}. ${pe.text} ${pb.text}</p>
    </article>
    <article>
      <span>Chất lượng lợi nhuận</span>
      <strong class="${roe.className}">${roe.label}</strong>
      <p>ROE ${toNumber(overview.roe) ? formatPercent(overview.roe) : "-"}, EPS ${formatFundamentalNumber(overview.eps, 2)}. ${roe.text}</p>
    </article>
    <article>
      <span>Rủi ro và kết luận</span>
      <strong class="${valuationLabel.className}">${valuationLabel.text}</strong>
      <p>Beta ${formatFundamentalNumber(overview.beta, 2)}, vốn hóa ${marketCap ? formatLargeNumber(marketCap) : "-"}. ${beta.text} ${investText}</p>
    </article>
  `;

  return { valuationLabel, total, pe, pb, roe, beta };
}

function scoreTimeframeSignals(bars) {
  const technicalBars = normalizeTechnicalBars(bars);
  const movingAverages = calculateMovingAverages(technicalBars);
  const rsi = calculateRsi(technicalBars);
  const macd = calculateMacd(technicalBars);
  const latest = technicalBars[technicalBars.length - 1] || {};
  const previous = technicalBars[technicalBars.length - 2] || {};
  const ma20 = latestNonNull(movingAverages.ma10);
  const ma50 = latestNonNull(movingAverages.ma50);
  const ma100 = latestNonNull(movingAverages.ma100);
  const latestRsi = latestNonNull(rsi);
  const latestMacd = latestNonNull(macd.macd);
  const latestSignal = latestNonNull(macd.signal);
  const latestHistogram = latestNonNull(macd.histogram);
  const volumes = bars.map((bar) => bar.volume);
  const latestVolume = bars[bars.length - 1]?.volume;
  const avgVolume20 = average(volumes.slice(-20));
  const change = previous.close ? ((latest.close - previous.close) / previous.close) * 100 : null;
  const change20 = percentChangeBetween(bars, Math.min(20, Math.max(1, bars.length - 2)));

  let score = 0;
  const good = [];
  const bad = [];
  const neutral = [];

  if (latest.close > ma20) {
    score += 1;
    good.push(`Giá đang trên MA20 (${formatOptional(ma20, 2)})`);
  } else if (toNumber(ma20) !== null) {
    score -= 1;
    bad.push(`Giá nằm dưới MA20 (${formatOptional(ma20, 2)}), xu hướng ngắn hạn yếu`);
  }

  if (latest.close > ma50) {
    score += 1;
    good.push(`Giá trên MA50 (${formatOptional(ma50, 2)})`);
  } else if (toNumber(ma50) !== null) {
    score -= 1;
    bad.push(`Giá dưới MA50 (${formatOptional(ma50, 2)}), lực hồi chưa thuyết phục`);
  }

  if (ma20 > ma50 && ma50 > ma100) {
    score += 1;
    good.push("Cấu trúc MA20 > MA50 > MA100 ủng hộ xu hướng tăng");
  } else if (toNumber(ma20) !== null && toNumber(ma50) !== null && toNumber(ma100) !== null) {
    bad.push("Các đường MA chưa xếp thành cấu trúc tăng rõ ràng");
  }

  if (latestMacd > latestSignal && latestHistogram > 0) {
    score += 2;
    good.push(`MACD đang trên Signal, histogram ${formatOptional(latestHistogram, 2)} tích cực`);
  } else if (latestMacd < latestSignal && latestHistogram < 0) {
    score -= 2;
    bad.push(`MACD dưới Signal, histogram ${formatOptional(latestHistogram, 2)} còn xấu`);
  } else {
    neutral.push("MACD chưa cho tín hiệu rõ");
  }

  if (latestRsi >= 50 && latestRsi <= 65) {
    score += 1;
    good.push(`RSI ${formatOptional(latestRsi, 2)} khỏe nhưng chưa quá nóng`);
  } else if (latestRsi > 70) {
    score -= 1;
    bad.push(`RSI ${formatOptional(latestRsi, 2)} cao, dễ rung lắc`);
  } else if (latestRsi < 40) {
    score -= 1;
    bad.push(`RSI ${formatOptional(latestRsi, 2)} yếu, lực cầu chưa tốt`);
  } else if (toNumber(latestRsi) !== null) {
    neutral.push(`RSI ${formatOptional(latestRsi, 2)} trung tính`);
  }

  if (latestVolume && avgVolume20 && latestVolume > avgVolume20 * 1.2 && toNumber(change) !== null && change > 0) {
    score += 1;
    good.push("Giá tăng kèm volume cao hơn trung bình 20 nến");
  } else if (latestVolume && avgVolume20 && latestVolume > avgVolume20 * 1.2 && toNumber(change) !== null && change < 0) {
    score -= 1;
    bad.push("Giá giảm với volume cao, cần cẩn thận áp lực bán");
  } else if (latestVolume && avgVolume20) {
    neutral.push(`Volume hiện tại ${formatInteger(latestVolume)}, TB20 ${formatInteger(avgVolume20)}`);
  }

  const verdict = score >= 4
    ? { text: "Tích cực", className: "positive" }
    : score >= 1
      ? { text: "Nghiêng tích cực", className: "positive" }
      : score >= -1
        ? { text: "Trung tính", className: "neutral" }
        : { text: "Tiêu cực", className: "negative" };

  return {
    score,
    verdict,
    latestClose: latest.close,
    change,
    change20,
    ma20,
    ma50,
    latestRsi,
    latestMacd,
    latestSignal,
    latestHistogram,
    good,
    bad,
    neutral
  };
}

