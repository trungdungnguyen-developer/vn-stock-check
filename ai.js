function flattenAiPoints(validAnalyses, key, limit = 8) {
  const seen = new Set();
  const points = [];
  validAnalyses.forEach(({ label, data }) => {
    (data[key] || []).forEach((item) => {
      const text = `${label}: ${item}`;
      if (!seen.has(text)) {
        seen.add(text);
        points.push(text);
      }
    });
  });
  return points.slice(0, limit);
}

function renderAiPointList(points, className, fallback) {
  const items = points.length ? points : [fallback];
  return `
    <ul class="ai-section-list">
      ${items.map((item) => `<li class="${className}">${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function buildAiActionPlan(overall, validAnalyses) {
  const shortTerm = validAnalyses.find((item) => item.label === "1h" || item.label === "4h")?.data;
  const daily = validAnalyses.find((item) => item.label === "1 ngày")?.data;
  const plan = [];
  if (overall.className === "positive") {
    plan.push("Ưu tiên quan sát điểm vào thay vì mua đuổi; chỉ hành động khi khung nhỏ xác nhận lại momentum.");
    plan.push("Nếu giá đang trên MA và RSI chưa quá nóng, có thể chia vị thế nhỏ rồi tăng khi volume xác nhận.");
  } else if (overall.className === "neutral") {
    plan.push("Không vội mở vị thế lớn; chờ giá thoát vùng nhiễu hoặc RSI/MACD đồng thuận hơn.");
    plan.push("Ưu tiên kịch bản theo dõi, đặt cảnh báo tại hỗ trợ/kháng cự gần nhất.");
  } else {
    plan.push("Tránh bắt đáy khi xu hướng còn yếu; ưu tiên bảo toàn vốn và đợi tín hiệu đảo chiều rõ.");
    plan.push("Nếu đang nắm giữ, cần kiểm tra stoploss và giảm rủi ro khi giá tiếp tục mất hỗ trợ.");
  }
  if (shortTerm) plan.push(`Khung ngắn: RSI ${formatOptional(shortTerm.latestRsi, 2)}, MACD ${formatOptional(shortTerm.latestMacd, 2)} / Signal ${formatOptional(shortTerm.latestSignal, 2)}.`);
  if (daily) plan.push(`Khung ngày: biến động 20 nến ${formatPercent(daily.change20)}, điểm kỹ thuật ${daily.score}.`);
  return plan;
}

function renderAiCards(symbol, analyses) {
  const validAnalyses = analyses.filter((item) => item && item.data);
  if (!validAnalyses.length) {
    fields.aiBadge.textContent = "Thiếu dữ liệu";
    fields.aiBadge.className = "neutral";
    fields.aiAnalysisBody.innerHTML = `
      <article class="ai-panel-card summary">
        <span>Không đủ dữ liệu</span>
        <h3>Chưa phân tích được ${escapeHtml(symbol)}.</h3>
        <p>Hãy kiểm tra lại mã cổ phiếu hoặc nguồn dữ liệu intraday/ngày.</p>
      </article>
    `;
    return;
  }

  const totalScore = validAnalyses.reduce((sum, item) => sum + item.data.score, 0);
  const overall = totalScore >= 8
    ? { text: "Tổng quan tích cực nhưng vẫn cần điểm mua", className: "positive" }
    : totalScore >= 3
      ? { text: "Có tín hiệu tốt, chưa đủ để hưng phấn", className: "positive" }
      : totalScore >= -2
        ? { text: "Tổng quan lẫn lộn, nên kiên nhẫn", className: "neutral" }
        : { text: "Tổng quan yếu, không nên cố mua", className: "negative" };

  const goodPoints = flattenAiPoints(validAnalyses, "good");
  const badPoints = flattenAiPoints(validAnalyses, "bad");
  const neutralPoints = flattenAiPoints(validAnalyses, "neutral");
  const strongestFrame = [...validAnalyses].sort((a, b) => b.data.score - a.data.score)[0];
  const weakestFrame = [...validAnalyses].sort((a, b) => a.data.score - b.data.score)[0];
  const actionPlan = buildAiActionPlan(overall, validAnalyses);

  fields.aiBadge.textContent = overall.text;
  fields.aiBadge.className = overall.className;
  fields.aiAnalysisBody.innerHTML = `
    <article class="ai-panel-card ai-summary-card ${overall.className}">
      <span>Summary</span>
      <h3 class="${overall.className}">${escapeHtml(symbol)} · ${overall.text}</h3>
      <p>Điểm tổng hợp đa khung: <strong>${totalScore}</strong>. Phân tích dựa trên MA20/50/100, RSI 14, MACD 12-26-9, volume và biến động giá ở các khung 1h, 4h, 1 ngày, 1 tuần, 1 tháng.</p>
      <div class="ai-frame-strip">
        ${validAnalyses.map(({ label, data }) => `<em class="${data.verdict.className}">${escapeHtml(label)} · ${data.score}</em>`).join("")}
      </div>
    </article>

    <article class="ai-panel-card ai-trend-card">
      <span>Trend</span>
      <h3>Khung mạnh nhất: ${escapeHtml(strongestFrame.label)} · Khung yếu nhất: ${escapeHtml(weakestFrame.label)}</h3>
      <div class="ai-timeframe-grid">
        ${validAnalyses.map(({ label, data }) => `
          <section>
            <strong class="${data.verdict.className}">${escapeHtml(label)} · ${data.verdict.text}</strong>
            <p>Giá ${formatOptional(data.latestClose, 2)} · Nến gần nhất ${formatPercent(data.change)} · 20 nến ${formatPercent(data.change20)}</p>
            <p>RSI ${formatOptional(data.latestRsi, 2)} · MACD ${formatOptional(data.latestMacd, 2)} / Signal ${formatOptional(data.latestSignal, 2)} / Hist ${formatOptional(data.latestHistogram, 2)}</p>
          </section>
        `).join("")}
      </div>
    </article>

    <article class="ai-panel-card ai-opportunity-card">
      <span>Opportunity</span>
      <h3>Điểm đáng chú ý để tìm cơ hội</h3>
      ${renderAiPointList(goodPoints, "positive", "Chưa có lợi thế kỹ thuật rõ ràng từ các khung hiện tại.")}
    </article>

    <article class="ai-panel-card ai-risk-card">
      <span>Risk</span>
      <h3>Rủi ro cần nhìn thẳng</h3>
      ${renderAiPointList(badPoints, "negative", "Chưa phát hiện rủi ro kỹ thuật nổi bật, nhưng vẫn cần quản trị vị thế.")}
    </article>

    <article class="ai-panel-card ai-catalyst-card">
      <span>Catalyst</span>
      <h3>Yếu tố trung lập/chờ xác nhận</h3>
      ${renderAiPointList(neutralPoints, "neutral", "Chưa có catalyst rõ từ dữ liệu kỹ thuật hiện tại; cần đối chiếu thêm tin tức và volume mới.")}
    </article>

    <article class="ai-panel-card ai-action-card ${overall.className}">
      <span>Action Plan</span>
      <h3>Kế hoạch hành động thực tế</h3>
      ${renderAiPointList(actionPlan, overall.className, "Chờ thêm dữ liệu trước khi ra quyết định.")}
    </article>
  `;
}
async function loadAiAnalysis() {
  if (!currentSymbol || !currentDailyBars.length) {
    fields.aiBadge.textContent = "Chưa có dữ liệu";
    fields.aiBadge.className = "neutral";
    fields.aiAnalysisBody.innerHTML = `
      <article>
        <span>Chưa có dữ liệu</span>
        <h3>Hãy tra cứu một mã cổ phiếu trước.</h3>
        <p>AI cần dữ liệu giá để phân tích các khung 1h, 4h, 1 ngày, 1 tuần và 1 tháng.</p>
      </article>
    `;
    return;
  }

  fields.aiBadge.textContent = "Đang phân tích...";
  fields.aiBadge.className = "neutral";
  fields.aiAnalysisBody.innerHTML = `
    <article>
      <span>Đang phân tích</span>
      <h3>Đang tải dữ liệu đa khung cho ${escapeHtml(currentSymbol)}...</h3>
      <p>Khung 1h và 4h cần gọi thêm dữ liệu intraday từ VCI.</p>
    </article>
  `;

  const [oneHourResult, fourHourResult] = await Promise.allSettled([
    requestBarsForRange(currentSymbol, "1h"),
    requestBarsForRange(currentSymbol, "4h")
  ]);

  const analyses = [];
  if (oneHourResult.status === "fulfilled") {
    const bars = aggregateBarsForPreset(oneHourResult.value, CHART_PRESETS["1h"]);
    if (bars.length) analyses.push({ label: "1h", data: scoreTimeframeSignals(bars) });
  }
  if (fourHourResult.status === "fulfilled") {
    const bars = aggregateBarsForPreset(fourHourResult.value, CHART_PRESETS["4h"]);
    if (bars.length) analyses.push({ label: "4h", data: scoreTimeframeSignals(bars) });
  }

  [
    ["1 ngày", "1d"],
    ["1 tuần", "1w"],
    ["1 tháng", "1m"]
  ].forEach(([label, key]) => {
    const bars = aggregateBarsForPreset(currentDailyBars, CHART_PRESETS[key]);
    if (bars.length) analyses.push({ label, data: scoreTimeframeSignals(bars) });
  });

  renderAiCards(currentSymbol, analyses);
}

