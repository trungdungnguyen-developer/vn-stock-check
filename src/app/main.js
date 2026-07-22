async function loadVietnamStock(symbol) {
  setMessage("Đang tải dữ liệu...");
  const normalizedSymbol = normalizeSymbolInput(symbol);
  const cryptoSymbol = toCryptoPairSymbol(normalizedSymbol);
  const yahooCryptoSymbol = toYahooCryptoSymbol(normalizedSymbol);
  if (cryptoSymbol || yahooCryptoSymbol) {
    await loadCryptoAsset(normalizedSymbol, cryptoSymbol || yahooCryptoSymbol);
    return;
  }

  let parsed = null;
  let lastError = null;

  try {
    const rawVci = await requestVciData(symbol, "max");
    parsed = parseVciData(rawVci);
  } catch (error) {
    lastError = error;
  }

  const candidates = parsed ? [] : makeYahooCandidates(symbol);

  for (const candidate of candidates) {
    try {
      const raw = await requestJson(`/v8/finance/chart/${encodeURIComponent(candidate)}?range=max&interval=1d`);
      parsed = parseYahooChart(raw);
      if (parsed && parsed.bars.length) break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!parsed || !parsed.bars.length) {
    throw new Error(lastError?.message || "Không tìm thấy mã chứng khoán Việt Nam này trên nguồn dữ liệu hiện tại.");
  }

  const quote = parsed.quote;
  let overview = parsed.overview;
  const bars = parsed.bars;

  latestMarketStrength = null;
  const [newsResult, indexResult, fundamentalsResult] = await Promise.allSettled([
    loadNews(symbol, { silent: true }),
    requestVciData("VNINDEX", "max"),
    requestFundamentalsData(symbol)
  ]);

  if (indexResult.status === "fulfilled") {
    const indexParsed = parseVciData(indexResult.value);
    if (indexParsed?.bars?.length) {
      latestMarketStrength = calculateMarketStrength(bars, indexParsed.bars);
    }
  }

  if (newsResult.status !== "fulfilled") {
    latestNewsItems = [];
  }

  if (fundamentalsResult.status === "fulfilled") {
    overview = mergeOverviewWithFundamentals(overview, fundamentalsResult.value);
  }

  const analysis = fillData(symbol, quote, overview, bars);
  renderDashboardAnalytics({
    symbol,
    assetType: currentAssetType,
    quote,
    overview,
    bars,
    score: analysis.score,
    marketStrength: latestMarketStrength
  });
  latestPayload = {
    source: parsed.source,
    assetType: currentAssetType,
    symbol,
    resolvedSymbol: quote.ticker,
    activeTimeframe: CHART_PRESETS[activeChartRange]?.label || activeChartRange,
    quote,
    overview,
    recentBars: bars.slice(-30),
    indicators: {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    },
    score: analysis.score,
    news: {
      sources: "CafeF RSS, VnExpress RSS",
      relatedCount: analysis.score.relatedNews.length,
      topRelated: analysis.score.relatedNews.slice(0, 3)
    },
    fundamentals: {
      source: overview.fundamentalsSource || "Chưa có dữ liệu cơ bản",
      marketCap: overview.marketCap,
      pe: overview.pe,
      pb: overview.pb,
      roe: overview.roe,
      eps: overview.eps,
      beta: overview.beta
    },
    marketStrength: latestMarketStrength,
    investorFlow: {
      status: parsed.source === "Vietcap/VCI"
        ? "Dữ liệu bảng giá VCI nếu có"
        : `${parsed.source} không cung cấp dữ liệu mua/bán theo nhóm nhà đầu tư`
    }
  };
  fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  fields.lastUpdated.textContent = `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;
  publishAssetMonitorData({
    symbol,
    assetType: "stock",
    resolvedSymbol: quote.ticker,
    source: parsed.source,
    quote,
    overview,
    bars,
    score: analysis.score,
    marketStrength: latestMarketStrength,
    newsItems: latestNewsItems
  });
  setMessage("");
}

async function loadCryptoAsset(inputSymbol, cryptoSymbol) {
  let parsed = null;
  let lastError = null;

  try {
    parsed = await requestCryptoData(cryptoSymbol, "max");
  } catch (error) {
    lastError = error;
  }

  if (!parsed?.bars?.length) {
    const yahooSymbol = toYahooCryptoSymbol(inputSymbol) || toYahooCryptoSymbol(cryptoSymbol);
    if (yahooSymbol) {
      try {
        parsed = parseYahooChart(await requestYahooChartData(yahooSymbol, "max", "1d"));
      } catch (error) {
        lastError = error;
      }
    }
  }

  if (!parsed || !parsed.bars.length) {
    throw new Error(lastError?.message || "Không tìm thấy coin này trên nguồn dữ liệu hiện tại.");
  }

  latestMarketStrength = null;
  const newsResult = await Promise.allSettled([
    loadNews(inputSymbol, { silent: true })
  ]);
  if (newsResult[0].status !== "fulfilled") {
    latestNewsItems = [];
  }

  const quote = parsed.quote;
  const overview = {
    ...parsed.overview,
    ticker: parsed.resolvedSymbol || parsed.quote?.ticker || cryptoSymbol,
    assetType: "crypto"
  };
  const bars = parsed.bars;
  const analysis = fillData(inputSymbol, quote, overview, bars);
  renderDashboardAnalytics({
    symbol: inputSymbol,
    assetType: "crypto",
    quote,
    overview,
    bars,
    score: analysis.score,
    marketStrength: latestMarketStrength
  });

  latestPayload = {
    source: parsed.source,
    assetType: "crypto",
    symbol: inputSymbol,
    resolvedSymbol: parsed.resolvedSymbol || cryptoSymbol,
    activeTimeframe: CHART_PRESETS[activeChartRange]?.label || activeChartRange,
    quote,
    overview,
    recentBars: bars.slice(-30),
    indicators: {
      rsi14: fields.rsiValue.textContent,
      macd: fields.macdValue.textContent,
      movingAverages: {
        ma20: fields.ma10.textContent,
        ma50: fields.ma50.textContent,
        ma100: fields.ma100.textContent,
        ma200: fields.ma200.textContent
      }
    },
    score: analysis.score,
    news: {
      sources: "CafeF RSS, VnExpress RSS",
      relatedCount: analysis.score.relatedNews.length,
      topRelated: analysis.score.relatedNews.slice(0, 3)
    },
    note: "Coin không có giá trần/sàn và các chỉ số P/E, P/B, ROE như cổ phiếu."
  };
  fields.rawData.textContent = JSON.stringify(latestPayload, null, 2);
  fields.lastUpdated.textContent = `Cập nhật: ${new Date().toLocaleString("vi-VN")}`;
  publishAssetMonitorData({
    symbol: inputSymbol,
    assetType: "crypto",
    resolvedSymbol: parsed.resolvedSymbol || cryptoSymbol,
    source: parsed.source,
    quote,
    overview,
    bars,
    score: analysis.score,
    marketStrength: latestMarketStrength,
    newsItems: latestNewsItems
  });
  setMessage("");
}

function publishAssetMonitorData(context) {
  const detail = { ...context, payload: latestPayload, updatedAt: Date.now() };
  window.__aiTradingTerminalLatestAsset = detail;
  window.dispatchEvent(new CustomEvent("ai-trading-terminal:asset-loaded", { detail }));
}

async function refreshActiveSymbolPanel() {
  const activeTab = document.querySelector(".terminal-layout")?.dataset.activeTab;

  if (activeTab === "ai") {
    await loadAiAnalysis();
    return;
  }

  if (activeTab === "trade") {
    await loadTradeAnalysis();
  }
}

const stickySearchForm = document.getElementById("stickyStockForm");
const stickySymbolInput = document.getElementById("stickySymbol");
const primarySearchRow = form.querySelector(".input-row");
const stickyHomeToggle = document.getElementById("stickyHomeToggle");
const stickyFavoriteToggle = document.getElementById("stickyFavoriteToggle");
const stickyNotificationToggle = document.getElementById("stickyNotificationToggle");
const stickyUserButton = document.getElementById("stickyUserButton");
const primaryHomeToggle = document.getElementById("homeToggle");
const primaryFavoriteToggle = document.getElementById("favoriteToggle");
const primaryNotificationToggle = document.getElementById("notificationToggle");
const primaryUserButton = form.querySelector(".user-chip");

function returnToDashboard() {
  document.getElementById("overviewTab")?.click();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

primaryHomeToggle?.addEventListener("click", returnToDashboard);
stickyHomeToggle?.addEventListener("click", returnToDashboard);

window.aiTradingTerminalBridge = {
  search(symbol) {
    const normalized = String(symbol || "").trim().toUpperCase();
    if (!normalized) return;
    symbolInput.value = normalized;
    if (stickySymbolInput) stickySymbolInput.value = normalized;
    form.requestSubmit();
  },
  getLatestAsset() {
    return window.__aiTradingTerminalLatestAsset || null;
  },
  async requestFrame(rangeKey) {
    if (!currentSymbol || !currentDailyBars.length) throw new Error("Chưa có mã đang được tra cứu.");
    const preset = CHART_PRESETS[rangeKey] || CHART_PRESETS["1d"];
    if (!preset.intraday) return aggregateBarsForPreset(currentDailyBars, preset);
    const bars = await requestBarsForRange(currentSymbol, rangeKey);
    return aggregateBarsForPreset(bars, preset);
  }
};

if (stickySearchForm && stickySymbolInput && primarySearchRow) {
  stickySymbolInput.value = symbolInput.value;

  symbolInput.addEventListener("input", () => {
    stickySymbolInput.value = symbolInput.value;
  });

  stickySymbolInput.addEventListener("input", () => {
    symbolInput.value = stickySymbolInput.value;
  });

  stickySearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    symbolInput.value = stickySymbolInput.value;
    form.requestSubmit();
  });

  const stickySearchObserver = new IntersectionObserver(([entry]) => {
    stickySearchForm.classList.toggle("is-visible", !entry.isIntersecting);
  }, { threshold: 0 });

  stickySearchObserver.observe(primarySearchRow);

  stickyFavoriteToggle?.addEventListener("click", () => primaryFavoriteToggle?.click());
  stickyNotificationToggle?.addEventListener("click", () => primaryNotificationToggle?.click());
  stickyUserButton?.addEventListener("click", () => primaryUserButton?.click());

  if (primaryFavoriteToggle && stickyFavoriteToggle) {
    const syncFavoriteState = () => {
      stickyFavoriteToggle.classList.toggle("is-favorite", primaryFavoriteToggle.classList.contains("is-favorite"));
      stickyFavoriteToggle.setAttribute("aria-pressed", primaryFavoriteToggle.getAttribute("aria-pressed") || "false");
      const primaryLabel = primaryFavoriteToggle.querySelector("span");
      const stickyLabel = stickyFavoriteToggle.querySelector("span");
      if (primaryLabel && stickyLabel) stickyLabel.textContent = primaryLabel.textContent;
    };
    new MutationObserver(syncFavoriteState).observe(primaryFavoriteToggle, { attributes: true, attributeFilter: ["class", "aria-pressed"] });
    syncFavoriteState();
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (stickySymbolInput) stickySymbolInput.value = symbolInput.value;
  const symbol = symbolInput.value.trim().toUpperCase();

  if (!symbol) {
    setMessage("Hãy nhập mã chứng khoán Việt Nam hoặc mã coin.");
    symbolInput.focus();
    return;
  }

  try {
    await loadVietnamStock(symbol);
    await refreshActiveSymbolPanel();
  } catch (error) {
    setMessage(error.message || "Không tải được dữ liệu.");
  }
});

quickSymbols.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-symbol]");
  if (!button) return;
  symbolInput.value = button.dataset.symbol;
  form.requestSubmit();
});

chartControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-chart-range]");
  if (!button) return;
  applyChartRange(button.dataset.chartRange);
});

historyControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-history-limit]");
  if (!button || !currentDailyBars.length) return;
  activeHistoryLimit = Number(button.dataset.historyLimit) || 7;
  setActiveHistoryButton(activeHistoryLimit);
  renderHistory(currentDailyBars, activeHistoryLimit);
});

fullscreenChartButton?.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await (chartWorkspace || chartSection).requestFullscreen();
    }
  } catch {
    setMessage("Trình duyệt không cho phép phóng to biểu đồ.");
  }
});

chartScreenshotButton?.addEventListener("click", () => {
  downloadLightweightChartScreenshot();
});

chartFitButton?.addEventListener("click", () => {
  fitLightweightChartContent();
});

const indicatorManager = chartSection?.querySelector(".indicator-manager");

function setIndicatorManagerOpen(open) {
  if (!indicatorManager) return;
  indicatorManager.classList.toggle("is-collapsed", !open);
  indicatorSettingsToggle?.setAttribute("aria-expanded", String(open));
  indicatorSettingsToggle?.classList.toggle("active", open);
}

indicatorSettingsToggle?.addEventListener("click", () => {
  setIndicatorManagerOpen(indicatorManager?.classList.contains("is-collapsed"));
});

document.getElementById("closeIndicatorSettings")?.addEventListener("click", () => {
  setIndicatorManagerOpen(false);
  indicatorSettingsToggle?.focus();
});

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenChartButton) return;
  fullscreenChartButton.textContent = document.fullscreenElement ? "Thoát toàn màn hình" : "Toàn màn hình";
  if (currentChartSourceBars.length) {
    requestAnimationFrame(() => renderSelectedChart(currentChartSourceBars, activeChartRange));
  }
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    setActiveTab(tab.dataset.tab);
    if (tab.dataset.tab === "news") {
      loadNews(currentSymbol);
    }
    if (tab.dataset.tab === "ai") {
      loadAiAnalysis();
    }
    if (tab.dataset.tab === "trade") {
      loadTradeAnalysis();
    }
    if (tab.dataset.tab === "scanner" && !latestScannerResults.length) {
      loadMarketScanner();
    }
    if (tab.dataset.tab === "cryptoTrading" && !latestCryptoTradingResults.length) {
      loadCryptoTrading();
    }
  });
});

refreshNewsButton?.addEventListener("click", () => {
  loadNews(currentSymbol);
});

refreshAiButton?.addEventListener("click", () => {
  loadAiAnalysis();
});

refreshTradeButton?.addEventListener("click", () => {
  loadTradeAnalysis();
});

refreshScannerButton?.addEventListener("click", () => {
  loadMarketScanner();
});

refreshCryptoTradingButton?.addEventListener("click", () => {
  loadCryptoTrading();
});

scannerControls?.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-scanner-type]");
  if (!button) return;
  activeScannerType = button.dataset.scannerType || "all";
  scannerControls.querySelectorAll("button").forEach((item) => {
    item.classList.toggle("active", item === button);
  });
  loadMarketScanner();
});

copyButton.addEventListener("click", async () => {
  if (!latestPayload) {
    setMessage("Chưa có dữ liệu để copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(latestPayload, null, 2));
    setMessage("Đã copy JSON.");
  } catch {
    setMessage("Không copy được. Hãy bôi đen phần JSON và copy thủ công.");
  }
});

setupIndicatorManager();
setupOverlayManager();
drawChart([]);
renderIndicators([]);
renderDashboardAnalytics();
loadMarketStrip();
setInterval(loadMarketStrip, 60000);
symbolInput.focus();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {
      // Service worker chi hoat dong tren HTTPS hoac localhost.
    });
  });
}

