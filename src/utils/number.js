function safeText(value) {
  if (value === undefined || value === null || value === "" || value === "N/A") return "-";
  return String(value);
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatNumber(value, digits = 2) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  });
}

function formatInteger(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", { maximumFractionDigits: 0 });
}

function formatPrice(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

function cryptoPriceDigits(value) {
  const number = Math.abs(toNumber(value) ?? 0);
  if (number >= 1000) return 2;
  if (number >= 1) return 4;
  if (number >= 0.1) return 5;
  if (number >= 0.01) return 6;
  if (number >= 0.001) return 7;
  return 8;
}

function formatCryptoPrice(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return number.toLocaleString("vi-VN", {
    maximumFractionDigits: cryptoPriceDigits(number),
    minimumFractionDigits: Math.min(2, cryptoPriceDigits(number))
  });
}

function formatAssetPrice(value, assetType = currentAssetType) {
  return assetType === "crypto" ? formatCryptoPrice(value) : formatPrice(value);
}

function detectVietnamExchange(exchangeText) {
  const text = safeText(exchangeText).toUpperCase();
  if (text.includes("UPCOM")) return "UPCOM";
  if (text.includes("HNX") || text.includes("HANOI")) return "HNX";
  return "HOSE";
}

function priceStep(price) {
  const value = toNumber(price);
  if (value === null) return 100;
  if (value < 10000) return 10;
  if (value < 50000) return 50;
  return 100;
}

function roundToStep(value, step, mode) {
  if (mode === "ceil") return Math.ceil(value / step) * step;
  return Math.floor(value / step) * step;
}

function calculateCeilingFloor(referencePrice, exchangeText) {
  const reference = toNumber(referencePrice);
  if (reference === null) return { ceiling: null, floor: null, exchange: detectVietnamExchange(exchangeText) };

  const exchange = detectVietnamExchange(exchangeText);
  const limit = exchange === "UPCOM" ? 0.15 : exchange === "HNX" ? 0.10 : 0.07;
  const ceilingRaw = reference * (1 + limit);
  const floorRaw = reference * (1 - limit);

  return {
    ceiling: roundToStep(ceilingRaw, priceStep(ceilingRaw), "floor"),
    floor: roundToStep(floorRaw, priceStep(floorRaw), "ceil"),
    exchange
  };
}

function formatPercent(value) {
  const number = toNumber(value);
  if (number === null) return "-";
  return `${number > 0 ? "+" : ""}${number.toLocaleString("vi-VN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  })}%`;
}

function valueClass(value) {
  const number = toNumber(value);
  if (number === null) return "";
  if (number === 0) return "neutral";
  return number > 0 ? "positive" : "negative";
}

function formatLargeNumber(value) {
  const number = toNumber(value);
  if (number === null) return "-";

  if (Math.abs(number) >= 1_000_000_000_000) {
    return `${formatNumber(number / 1_000_000_000_000, 2)} nghìn tỷ`;
  }
  if (Math.abs(number) >= 1_000_000_000) {
    return `${formatNumber(number / 1_000_000_000, 2)} tỷ`;
  }
  if (Math.abs(number) >= 1_000_000) {
    return `${formatNumber(number / 1_000_000, 2)} triệu`;
  }
  return formatInteger(number);
}

function formatOptional(value, digits = 2) {
  return toNumber(value) === null ? "-" : formatNumber(value, digits);
}

function formatFundamentalNumber(value, digits = 2) {
  const number = toNumber(value);
  if (number === null || number === 0) return "-";
  return formatNumber(number, digits);
}

