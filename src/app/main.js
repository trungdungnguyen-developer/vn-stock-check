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
    const rawVci = await requestVciData(symbol, "2y");
    parsed = parseVciData(rawVci);
  } catch (error) {
    lastError = error;
  }

  const candidates = parsed ? [] : makeYahooCandidates(symbol);

  for (const candidate of candidates) {
    try {
      const raw = await requestJson(`/v8/finance/chart/${encodeURIComponent(candidate)}?range=2y&interval=1d`);
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
    requestVciData("VNINDEX", "2y"),
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
  setMessage("");
}

async function loadCryptoAsset(inputSymbol, cryptoSymbol) {
  let parsed = null;
  let lastError = null;

  try {
    parsed = await requestCryptoData(cryptoSymbol, "2y");
  } catch (error) {
    lastError = error;
  }

  if (!parsed?.bars?.length) {
    const yahooSymbol = toYahooCryptoSymbol(inputSymbol) || toYahooCryptoSymbol(cryptoSymbol);
    if (yahooSymbol) {
      try {
        parsed = parseYahooChart(await requestYahooChartData(yahooSymbol, "2y", "1d"));
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
  setMessage("");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const symbol = symbolInput.value.trim().toUpperCase();

  if (!symbol) {
    setMessage("Hãy nhập mã chứng khoán Việt Nam hoặc mã coin.");
    symbolInput.focus();
    return;
  }

  try {
    await loadVietnamStock(symbol);
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
  activeHistoryLimit = Number(button.dataset.historyLimit) || 30;
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

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenChartButton) return;
  fullscreenChartButton.textContent = document.fullscreenElement ? "Thu nhỏ" : "Phóng to";
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

