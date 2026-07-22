function formatCompactMarketCap(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  if (Math.abs(number) >= 1e12) return `$${formatMarketValue(number / 1e12, 2)}T`;
  if (Math.abs(number) >= 1e9) return `$${formatMarketValue(number / 1e9, 2)}B`;
  if (Math.abs(number) >= 1e6) return `$${formatMarketValue(number / 1e6, 2)}M`;
  return `$${formatMarketValue(number, 0)}`;
}

function updateMarketCell(valueTarget, changeTarget, quote, options = {}) {
  const price = toNumber(quote?.price);
  const changePercent = toNumber(quote?.changePercent);
  valueTarget.textContent = price === null
    ? "-"
    : options.compactUsd
      ? formatCompactMarketCap(price)
      : `${options.prefix || ""}${formatMarketValue(price, options.digits ?? 2)}${options.suffix || ""}`;
  changeTarget.textContent = quote?.changeText || (changePercent === null ? "-" : formatPercent(changePercent));
  changeTarget.classList.remove("positive", "negative", "neutral");
  const direction = toNumber(quote?.direction);
  const className = valueClass(direction === null ? changePercent : direction);
  if (className) changeTarget.classList.add(className);
}

function marketAssessmentValue(quote, options = {}) {
  const price = toNumber(quote?.price);
  const change = toNumber(quote?.changePercent);
  if (price === null) return "-";
  const formattedPrice = options.compactUsd
    ? formatCompactMarketCap(price)
    : `${options.prefix || ""}${formatMarketValue(price, options.digits ?? 2)}${options.suffix || ""}`;
  return change === null ? formattedPrice : `${formattedPrice} · ${formatPercent(change)}`;
}

function updateAssessmentCard(id, state, badge, value, description) {
  const card = document.getElementById(id);
  if (!card) return;
  card.classList.remove("positive", "negative", "neutral", "warning");
  card.classList.add(state || "neutral");
  const badgeTarget = card.querySelector("div > em");
  const valueTarget = card.querySelector(":scope > strong");
  const descriptionTarget = card.querySelector(":scope > p");
  if (badgeTarget) badgeTarget.textContent = badge;
  if (valueTarget) valueTarget.textContent = value;
  if (descriptionTarget) descriptionTarget.textContent = description;
}

function renderMarketAssessment(items) {
  const dxy = items.dxy;
  const dxyChange = toNumber(dxy?.changePercent);
  if (dxyChange === null) {
    updateAssessmentCard("assessmentDxy", "neutral", "Chưa có", "-", "Chưa đủ dữ liệu để đánh giá sức mạnh USD.");
  } else if (dxyChange > 0.1) {
    updateAssessmentCard("assessmentDxy", "negative", "Bất lợi", marketAssessmentValue(dxy), "USD mạnh lên; vàng, crypto và chứng khoán có thể chịu áp lực.");
  } else if (dxyChange < -0.1) {
    updateAssessmentCard("assessmentDxy", "positive", "Thuận lợi", marketAssessmentValue(dxy), "USD suy yếu; dòng tiền có xu hướng thuận lợi hơn cho tài sản rủi ro.");
  } else {
    updateAssessmentCard("assessmentDxy", "neutral", "Trung tính", marketAssessmentValue(dxy), "DXY ít thay đổi; chưa tạo lực dẫn dắt rõ cho thị trường.");
  }

  const us10y = items.us10y;
  const us10yChange = toNumber(us10y?.changePercent);
  if (us10yChange === null) {
    updateAssessmentCard("assessmentUs10y", "neutral", "Chưa có", "-", "Chưa đủ dữ liệu để đánh giá áp lực lợi suất.");
  } else if (us10yChange > 0.1) {
    updateAssessmentCard("assessmentUs10y", "negative", "Áp lực tăng", marketAssessmentValue(us10y, { digits: 3, suffix: "%" }), "Lợi suất tăng gây bất lợi cho vàng, Nasdaq và crypto.");
  } else if (us10yChange < -0.1) {
    updateAssessmentCard("assessmentUs10y", "positive", "Hỗ trợ", marketAssessmentValue(us10y, { digits: 3, suffix: "%" }), "Lợi suất giảm hỗ trợ vàng, cổ phiếu công nghệ và crypto.");
  } else {
    updateAssessmentCard("assessmentUs10y", "neutral", "Ổn định", marketAssessmentValue(us10y, { digits: 3, suffix: "%" }), "Lợi suất gần như đi ngang; áp lực định giá chưa thay đổi đáng kể.");
  }

  const vix = items.vix;
  const vixValue = toNumber(vix?.price);
  if (vixValue === null) {
    updateAssessmentCard("assessmentVix", "neutral", "Chưa có", "-", "Chưa đủ dữ liệu để đo mức độ sợ hãi.");
  } else if (vixValue > 35) {
    updateAssessmentCard("assessmentVix", "negative", "Hoảng loạn", marketAssessmentValue(vix), "VIX trên 35: rủi ro bán tháo ở cổ phiếu và crypto ở mức cao.");
  } else if (vixValue >= 20) {
    updateAssessmentCard("assessmentVix", "warning", "Biến động cao", marketAssessmentValue(vix), "VIX từ 20–35: thị trường nhạy cảm, nên giảm đòn bẩy và quản trị vị thế.");
  } else if (vixValue < 15) {
    updateAssessmentCard("assessmentVix", "positive", "Bình tĩnh", marketAssessmentValue(vix), "VIX dưới 15: tâm lý thị trường đang tương đối ổn định.");
  } else {
    updateAssessmentCard("assessmentVix", "neutral", "Theo dõi", marketAssessmentValue(vix), "VIX từ 15–20: tâm lý chưa căng thẳng nhưng cần theo dõi biến động.");
  }

  const sp500Change = toNumber(items.sp500?.changePercent);
  const nasdaqChange = toNumber(items.nasdaq?.changePercent);
  const riskValue = sp500Change === null || nasdaqChange === null
    ? "-"
    : `S&P ${formatPercent(sp500Change)} · Nasdaq ${formatPercent(nasdaqChange)}`;
  if (sp500Change === null || nasdaqChange === null) {
    updateAssessmentCard("assessmentRiskAssets", "neutral", "Chưa có", riskValue, "Chưa đủ dữ liệu để đánh giá khẩu vị rủi ro.");
  } else if (sp500Change > 0 && nasdaqChange > 0) {
    updateAssessmentCard("assessmentRiskAssets", "positive", "Risk-on", riskValue, "Hai chỉ số cùng tăng; dòng tiền đang ủng hộ tài sản rủi ro và crypto.");
  } else if (sp500Change < 0 && nasdaqChange < 0) {
    updateAssessmentCard("assessmentRiskAssets", "negative", "Risk-off", riskValue, "Hai chỉ số cùng giảm; khẩu vị rủi ro suy yếu, crypto dễ chịu áp lực.");
  } else {
    updateAssessmentCard("assessmentRiskAssets", "warning", "Phân hóa", riskValue, "S&P 500 và Nasdaq chưa đồng thuận; dòng tiền tài sản rủi ro thiếu xác nhận.");
  }

  const fedRate = toNumber(items.fedRate?.price);
  const fedDirection = toNumber(items.fedRate?.direction) ?? 0;
  const liquidityValue = fedRate === null
    ? `DXY ${dxyChange === null ? "-" : formatPercent(dxyChange)}`
    : `Fed ${formatMarketValue(fedRate, 2)}% · DXY ${dxyChange === null ? "-" : formatPercent(dxyChange)}`;
  if (fedRate === null || dxyChange === null) {
    updateAssessmentCard("assessmentLiquidity", "neutral", "Dữ liệu hạn chế", liquidityValue, "Đây chỉ là tín hiệu đại diện; cần thêm Fed Balance Sheet, Reverse Repo và M2.");
  } else if (fedDirection < 0 && dxyChange < 0) {
    updateAssessmentCard("assessmentLiquidity", "positive", "Nới lỏng", liquidityValue, "Fed Rate và DXY cùng giảm, gợi ý điều kiện thanh khoản thuận lợi hơn.");
  } else if (fedDirection > 0 && dxyChange > 0) {
    updateAssessmentCard("assessmentLiquidity", "negative", "Thắt chặt", liquidityValue, "Fed Rate và DXY cùng tăng, gợi ý điều kiện thanh khoản kém thuận lợi.");
  } else {
    updateAssessmentCard("assessmentLiquidity", "neutral", "Trung tính", liquidityValue, "Tín hiệu Fed Rate và DXY chưa đồng thuận; chưa xác nhận chu kỳ thanh khoản.");
  }

  const bitcoinChange = toNumber(items.bitcoin?.changePercent);
  const dominance = toNumber(items.btcDominance?.price);
  const dominanceChange = toNumber(items.btcDominance?.changePercent);
  const totalChange = toNumber(items.cryptoTotalMarketCap?.changePercent);
  const dominanceValue = dominance === null
    ? "-"
    : `BTC.D ${formatMarketValue(dominance, 2)}% · ${dominanceChange === null ? "-" : formatPercent(dominanceChange)}`;
  if (dominance === null || dominanceChange === null || bitcoinChange === null) {
    updateAssessmentCard("assessmentDominance", "neutral", "Chưa đủ dữ liệu", dominanceValue, "Cần BTC, BTC Dominance và tổng vốn hóa để đọc luân chuyển dòng tiền.");
  } else if (bitcoinChange > 0 && dominanceChange < 0 && (totalChange === null || totalChange > 0)) {
    updateAssessmentCard("assessmentDominance", "positive", "Altcoin rotation", dominanceValue, "BTC tăng nhưng dominance giảm; dòng tiền đang có xu hướng lan sang altcoin.");
  } else if (bitcoinChange < 0 && (totalChange === null || totalChange < 0)) {
    updateAssessmentCard("assessmentDominance", "negative", "Crypto risk-off", dominanceValue, "BTC và tổng vốn hóa suy yếu; ưu tiên phòng thủ thay vì đuổi giá altcoin.");
  } else if (bitcoinChange > 0 && dominanceChange > 0) {
    updateAssessmentCard("assessmentDominance", "warning", "BTC dẫn dắt", dominanceValue, "Dòng tiền tập trung vào BTC; altcoin có thể tăng chậm hơn thị trường.");
  } else {
    updateAssessmentCard("assessmentDominance", "neutral", "Chưa rõ", dominanceValue, "Dòng tiền crypto chưa tạo mô hình luân chuyển đủ rõ để xác nhận.");
  }

  const updatedTarget = document.getElementById("marketAssessmentUpdated");
  if (updatedTarget) updatedTarget.textContent = `Cập nhật ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}`;
}

async function requestMarketOverviewFallback(existingItems = {}) {
  const yahooSymbols = {
    dxy: "DX-Y.NYB",
    us10y: "^TNX",
    vix: "^VIX",
    gold: "GC=F",
    silver: "SI=F",
    brent: "BZ=F",
    wti: "CL=F",
    sp500: "^GSPC",
    nasdaq: "^IXIC",
    dowJones: "^DJI",
    eurUsd: "EURUSD=X",
    usdJpy: "JPY=X",
    usdCny: "CNY=X",
    usdVnd: "VND=X"
  };
  const cryptoSymbols = {
    bitcoin: "BTC-USDT",
    ethereum: "ETH-USDT"
  };
  const jobs = [
    ...Object.entries(yahooSymbols),
    ...Object.entries(cryptoSymbols)
  ].filter(([key]) => !existingItems[key]);

  const results = await Promise.allSettled(jobs.map(([key, symbol]) => (
    Object.hasOwn(cryptoSymbols, key)
      ? requestCryptoQuote(symbol)
      : requestYahooQuote(symbol)
  )));

  const items = results.reduce((resultItems, result, index) => {
    if (result.status === "fulfilled" && result.value) {
      resultItems[jobs[index][0]] = result.value;
    }
    return resultItems;
  }, {});

  if (!existingItems.vni) {
    try {
      const parsedVni = parseVciData(await requestVciData("VNINDEX", "1d"));
      if (parsedVni?.quote) items.vni = parsedVni.quote;
    } catch {
      // VN-Index remains unavailable when both aggregate and VCI fallback fail.
    }
  }

  if (!existingItems.btcDominance || !existingItems.cryptoTotalMarketCap) {
    try {
      const [globalResponse, coinsResponse] = await Promise.all([
        fetch("https://api.coingecko.com/api/v3/global", { headers: { accept: "application/json" } }),
        fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=bitcoin&price_change_percentage=24h", { headers: { accept: "application/json" } })
      ]);
      if (globalResponse.ok && coinsResponse.ok) {
        const globalData = (await globalResponse.json())?.data || {};
        const bitcoin = (await coinsResponse.json())?.[0] || {};
        const totalMarketCap = toNumber(globalData?.total_market_cap?.usd);
        const totalChange = toNumber(globalData?.market_cap_change_percentage_24h_usd);
        const dominance = toNumber(globalData?.market_cap_percentage?.btc);
        const bitcoinMarketCapChange = toNumber(bitcoin?.market_cap_change_percentage_24h);
        let dominanceChange = null;
        if (dominance !== null && totalChange !== null && bitcoinMarketCapChange !== null) {
          const previousDominance = dominance * (1 + totalChange / 100) / (1 + bitcoinMarketCapChange / 100);
          dominanceChange = previousDominance ? ((dominance - previousDominance) / previousDominance) * 100 : null;
        }
        if (dominance !== null) items.btcDominance = { price: dominance, changePercent: dominanceChange };
        if (totalMarketCap !== null) items.cryptoTotalMarketCap = { price: totalMarketCap, changePercent: totalChange };
      }
    } catch {
      // CoinGecko fallback is optional; the aggregate endpoint remains primary.
    }
  }
  return items;
}

async function loadMarketStrip() {
  const marketCells = [
    ["dxy", "marketDxy", "marketDxyChange", { digits: 2 }],
    ["us10y", "marketUs10y", "marketUs10yChange", { digits: 3, suffix: "%" }],
    ["vix", "marketVix", "marketVixChange", { digits: 2 }],
    ["fedRate", "marketFedRate", "marketFedRateChange", { digits: 2, suffix: "%" }],
    ["gold", "marketGold", "marketGoldChange", { digits: 2 }],
    ["silver", "marketSilver", "marketSilverChange", { digits: 2 }],
    ["brent", "marketBrent", "marketBrentChange", { digits: 2 }],
    ["wti", "marketWti", "marketWtiChange", { digits: 2 }],
    ["bitcoin", "marketBitcoin", "marketBitcoinChange", { digits: 2, prefix: "$" }],
    ["ethereum", "marketEthereum", "marketEthereumChange", { digits: 2, prefix: "$" }],
    ["btcDominance", "marketBtcDominance", "marketBtcDominanceChange", { digits: 2, suffix: "%" }],
    ["cryptoTotalMarketCap", "marketCryptoTotal", "marketCryptoTotalChange", { compactUsd: true }],
    ["sp500", "marketSp500", "marketSp500Change", { digits: 2 }],
    ["nasdaq", "marketNasdaq", "marketNasdaqChange", { digits: 2 }],
    ["dowJones", "marketDowJones", "marketDowJonesChange", { digits: 2 }],
    ["vni", "marketVni", "marketVniChange", { digits: 2 }],
    ["eurUsd", "marketEurUsd", "marketEurUsdChange", { digits: 4 }],
    ["usdJpy", "marketUsdJpy", "marketUsdJpyChange", { digits: 2 }],
    ["usdCny", "marketUsdCny", "marketUsdCnyChange", { digits: 4 }],
    ["usdVnd", "marketUsdVnd", "marketUsdVndChange", { digits: 0 }]
  ];

  const setUnavailable = (valueId, changeId, label) => {
    const valueTarget = document.getElementById(valueId);
    const changeTarget = document.getElementById(changeId);
    if (valueTarget) valueTarget.textContent = "-";
    if (changeTarget) {
      changeTarget.textContent = label;
      changeTarget.className = "neutral";
    }
  };

  let items = {};
  try {
    const payload = await requestMarketOverviewData();
    items = payload?.items || {};
  } catch {
    // The per-symbol fallback below also supports an older local proxy.
  }

  const fallbackItems = await requestMarketOverviewFallback(items).catch(() => ({}));
  items = { ...fallbackItems, ...items };

  marketCells.forEach(([key, valueId, changeId, options]) => {
    const valueTarget = document.getElementById(valueId);
    const changeTarget = document.getElementById(changeId);
    if (!valueTarget || !changeTarget) return;
    const marketQuote = items[key];
    if (marketQuote) updateMarketCell(valueTarget, changeTarget, marketQuote, options);
    else setUnavailable(valueId, changeId, "Chưa có");
  });
  renderMarketAssessment(items);
}
