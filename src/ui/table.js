function updatePriceColor(price, reference, target) {
  target.classList.remove("positive", "negative", "neutral", "ceiling", "floor");
  const current = toNumber(price);
  const ref = toNumber(reference);
  if (current === null || ref === null) return;
  if (current > ref) target.classList.add("positive");
  if (current < ref) target.classList.add("negative");
  if (current === ref) target.classList.add("neutral");
}

function renderMovingAverages(bars, movingAverages = null) {
  const maValues = movingAverages || calculateMovingAverages(bars);
  const latestValue = (series) => [...series].reverse().find((value) => value !== null);
  const currentPrice = bars[bars.length - 1]?.close;
  const renderMa = (target, value) => {
    target.textContent = formatAssetPrice(value);
    target.classList.remove("positive", "negative", "neutral");
    if (toNumber(value) === null || toNumber(currentPrice) === null) return;
    if (currentPrice > value) target.classList.add("positive");
    if (currentPrice < value) target.classList.add("negative");
    if (currentPrice === value) target.classList.add("neutral");
  };

  renderMa(fields.ma10, latestValue(maValues.ma10));
  renderMa(fields.ma50, latestValue(maValues.ma50));
  renderMa(fields.ma100, latestValue(maValues.ma100));
  renderMa(fields.ma200, latestValue(maValues.ma200));

  return maValues;
}

function setActiveChartButton(rangeKey) {
  chartControls?.querySelectorAll("button[data-chart-range]").forEach((button) => {
    button.classList.toggle("active", button.dataset.chartRange === rangeKey);
  });
}

function setActiveHistoryButton(limit) {
  historyControls?.querySelectorAll("button[data-history-limit]").forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.historyLimit) === Number(limit));
  });
}

function formatChartPointTime(bar, preset) {
  const timestamp = toNumber(bar.timestamp);
  if (timestamp === null) return safeText(bar.time);
  const date = new Date(timestamp);
  if (preset.intraday) {
    return date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("vi-VN");
}

function startOfLocalDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getCalendarBucket(timestamp, preset) {
  const date = new Date(timestamp);

  if (preset.intervalMs) {
    return Math.floor(timestamp / preset.intervalMs) * preset.intervalMs;
  }

  if (preset.bucket === "1d") {
    return startOfLocalDay(date);
  }

  if (preset.bucket === "3d" || preset.bucket === "5d") {
    const size = preset.bucket === "3d" ? 3 : 5;
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const dayIndex = Math.floor((dayStart - yearStart) / 86400000);
    return new Date(date.getFullYear(), 0, 1 + Math.floor(dayIndex / size) * size).getTime();
  }

  if (preset.bucket === "1w") {
    const day = date.getDay() || 7;
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() - day + 1).getTime();
  }

  if (preset.bucket === "1m") {
    return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
  }

  if (preset.bucket === "3m") {
    return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1).getTime();
  }

  return startOfLocalDay(date);
}

function aggregateBarsForPreset(bars, preset) {
  if (!bars.length) return [];
  const buckets = new Map();

  bars.forEach((bar) => {
    const timestamp = toNumber(bar.timestamp);
    const close = toNumber(bar.close);
    if (timestamp === null || close === null) return;

    const bucket = getCalendarBucket(timestamp, preset);
    const current = buckets.get(bucket);
    if (!current) {
      buckets.set(bucket, {
        timestamp: bucket,
        time: bar.time,
        open: toNumber(bar.open) ?? close,
        high: toNumber(bar.high) ?? close,
        low: toNumber(bar.low) ?? close,
        close,
        volume: toNumber(bar.volume) ?? 0
      });
      return;
    }

    current.high = Math.max(current.high, toNumber(bar.high) ?? close);
    current.low = Math.min(current.low, toNumber(bar.low) ?? close);
    current.close = close;
    current.volume += toNumber(bar.volume) ?? 0;
  });

  return [...buckets.values()].sort((a, b) => a.timestamp - b.timestamp).slice(-260);
}

function renderSelectedChart(bars, rangeKey = activeChartRange) {
  const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
  currentChartSourceBars = bars;
  const timeframeBars = normalizeTechnicalBars(aggregateBarsForPreset(bars, preset));
  const fullMovingAverages = calculateMovingAverages(timeframeBars);
  const fullIndicators = {
    rsi: calculateRsi(timeframeBars),
    macd: calculateMacd(timeframeBars)
  };
  const displayBars = timeframeBars.map((bar) => ({
    ...bar,
    time: formatChartPointTime(bar, preset)
  }));

  drawChart(displayBars, fullMovingAverages);
  renderMovingAverages(timeframeBars, fullMovingAverages);
  renderIndicators(timeframeBars, fullIndicators);
  fields.chartRange.textContent = `${preset.label} - ${displayBars.length} nến`;

  if (latestPayload) {
    latestPayload.activeTimeframe = preset.label;
    latestPayload.indicators = {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    };
    fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  }

  return { bars: displayBars, movingAverages: fullMovingAverages, indicators: fullIndicators };
}

async function applyChartRange(rangeKey) {
  if (!currentSymbol) {
    setMessage("Hãy nhập mã chứng khoán trước khi chọn khung biểu đồ.");
    return;
  }

  const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
  activeChartRange = rangeKey;
  setActiveChartButton(rangeKey);

  if (!preset.intraday) {
    renderSelectedChart(currentDailyBars, rangeKey);
    setMessage("");
    return;
  }

  const requestId = chartRequestId + 1;
  chartRequestId = requestId;
  fields.chartRange.textContent = `Đang tải biểu đồ ${preset.label}...`;

  try {
    const bars = await requestBarsForRange(currentSymbol, rangeKey);
    if (requestId !== chartRequestId) return;
    renderSelectedChart(bars, rangeKey);
    setMessage("");
  } catch (error) {
    renderSelectedChart(currentDailyBars, "1d");
    setActiveChartButton("1d");
    activeChartRange = "1d";
    setMessage(error.message || "Không tải được dữ liệu biểu đồ.");
  }
}

function latestNonNull(series) {
  return [...series].reverse().find((value) => value !== null);
}

function escapeHtml(value) {
  return safeText(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatNewsDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function percentChangeBetween(bars, periods) {
  if (!bars.length || bars.length <= periods) return null;
  const latest = bars[bars.length - 1]?.close;
  const previous = bars[bars.length - 1 - periods]?.close;
  if (!toNumber(latest) || !toNumber(previous)) return null;
  return ((latest - previous) / previous) * 100;
}

function normalizeSearchText(value) {
  return safeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function isRelatedNews(item, symbol, companyName) {
  const text = normalizeSearchText(`${item.title} ${item.description}`);
  const ticker = normalizeSearchText(symbol);
  const company = normalizeSearchText(companyName)
    .replace(/\bctcp\b|\bcong ty\b|\btap doan\b|\bcorporation\b|\bgroup\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const companyWords = company.split(" ").filter((word) => word.length >= 4).slice(0, 3);

  if (ticker && new RegExp(`(^|[^a-z0-9])${ticker}([^a-z0-9]|$)`).test(text)) return true;
  return companyWords.length >= 2 && companyWords.some((word) => text.includes(word));
}

function renderNews(items, symbol = currentSymbol, companyName = fields.companyName.textContent) {
  if (!fields.newsBody) return;

  const marketKeywords = /vn-?index|chứng khoán|co phieu|cổ phiếu|khối ngoại|thanh khoản|dòng tiền|nâng hạng|thị trường/i;
  const related = items.filter((item) => isRelatedNews(item, symbol, companyName));
  const market = items.filter((item) => !related.includes(item) && marketKeywords.test(`${item.title} ${item.description}`));
  const displayItems = [...related.slice(0, 8), ...market.slice(0, 16)].slice(0, 20);

  if (!displayItems.length) {
    fields.newsBody.innerHTML = `
      <article>
        <span>Chưa có tin phù hợp</span>
        <h3>Chưa tìm thấy tin mới từ nguồn RSS hiện tại.</h3>
        <p>Hãy bấm Cập nhật tin sau hoặc kiểm tra lại khi nguồn CafeF/VnExpress có bài mới.</p>
      </article>
    `;
    return;
  }

  fields.newsBody.innerHTML = `
    ${displayItems.map((item) => {
      const relatedClass = related.includes(item) ? " related" : "";
      const label = related.includes(item) ? `Liên quan ${escapeHtml(symbol || "mã đang xem")}` : "Tin thị trường";
      const thumbnail = item.thumbnail
        ? `<img class="news-thumb" src="${escapeHtml(item.thumbnail)}" alt="${escapeHtml(item.title)}" loading="lazy">`
        : `<div class="news-thumb" aria-hidden="true"></div>`;
      return `
        <article class="${relatedClass.trim()}">
          ${thumbnail}
          <div class="news-content">
            <span>${escapeHtml(item.source)} · ${formatNewsDate(item.pubDate)} · ${label}</span>
            <h3><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.title)}</a></h3>
            <p>${escapeHtml(item.description || "Bấm để xem chi tiết bài viết từ nguồn gốc.")}</p>
          </div>
        </article>
      `;
    }).join("")}
    <p class="news-source-note">Nguồn: RSS CafeF và VnExpress. Tin được tải lại khi mở tab Tin tức hoặc bấm Cập nhật tin.</p>
  `;
}

