(async function bootTradingTerminal() {
  const files = [
    "src/app/bootstrap.js",
    "src/utils/number.js",
    "src/utils/date.js",
    "src/api/stockApi.js",
    "src/api/cryptoApi.js",
    "src/ui/notification.js",
    "src/ui/chart.js",
    "src/indicator/rsi.js",
    "src/indicator/ma.js",
    "src/indicator/macd.js",
    "src/ui/dashboard.js",
    "src/indicator/adx.js",
    "src/strategy/entryAnalysis.js",
    "src/strategy/tradeAnalysis.js",
    "src/strategy/marketScanner.js",
    "src/ui/table.js",
    "src/api/newsApi.js",
    "src/strategy/scoreAnalysis.js",
    "src/app/main.js"
  ];

  try {
    const source = await Promise.all(files.map(async (file) => {
      const response = await fetch(file, { cache: "no-cache" });
      if (!response.ok) throw new Error(`${file}: HTTP ${response.status}`);
      return await response.text();
    }));
    eval(source.join("\n\n"));
  } catch (error) {
    console.error("Không tải được mã nguồn đã tách.", error);
    const message = document.getElementById("message");
    if (message) message.textContent = `Không tải được mã nguồn app: ${error.message}`;
  }
}());
