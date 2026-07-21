# Theo dõi chứng khoán Việt Nam và Coin

Website để theo dõi các mã cổ phiếu Việt Nam như `FPT`, `VNM`, `VCB`, `HPG`, `MWG`, `SSI` và coin phổ biến như `BTC`, `ETH`, `SOL`, `PI`.

## Cách dùng

### Chạy thử trên máy tính

Không mở trực tiếp bằng `file://`. Hãy chạy local server:

```powershell
cd C:\Users\Admin\Documents\Codex\2026-06-23\t\outputs\stock_tracker_app
& "C:\Users\Admin\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" .\local-server.js
```

Sau đó mở:

```text
http://localhost:8787
```

### Chạy online

1. Deploy app lên Netlify kèm thư mục `netlify/functions`.
2. Mở website Netlify.
3. Nhập mã chứng khoán Việt Nam hoặc mã coin.
4. Bấm `Tải dữ liệu`.

Không cần Alpha Vantage API key. App ưu tiên lấy dữ liệu cổ phiếu từ Vietcap/VCI để hỗ trợ HOSE, HNX, UPCOM. Với coin, app ưu tiên Binance Spot, nếu Binance không có cặp giao dịch thì tự chuyển sang OKX; Yahoo Finance chỉ dùng làm dự phòng cuối.

CoinMarketCap chưa bật mặc định vì API chính thức thường cần API key. Nếu muốn dùng CMC sau này, có thể thêm biến môi trường API key vào Netlify Function.

## Tính năng

- Giá hiện tại, biến động, khối lượng và biểu đồ kỹ thuật.
- Tra cứu coin bằng mã ngắn như `BTC`, `ETH`, `SOL`, `PI`, hoặc cặp như `BTCUSDT`, `BTC-USDT`, `PI/USDT`.
- Riêng Pi Network được map sang cặp `PI-USDT` để thử qua Binance/OKX trước.
- Đóng trước là giá đóng cửa của phiên liền trước, dùng làm mốc tính tăng/giảm.
- Giá trần/sàn được lấy từ nguồn VCI khi có dữ liệu; nếu thiếu thì app tự tính theo biên độ HOSE 7%, HNX 10%, UPCOM 15% và làm tròn theo bước giá.
- MA 20, MA 50, MA 100, MA 200 tính từ giá đóng cửa của khung biểu đồ đang chọn, hiển thị ngay dưới biểu đồ giá và vẽ trên biểu đồ.
- RSI 14 và MACD 12, 26, 9 tính theo dữ liệu của khung biểu đồ đang chọn.
- Bảng lịch sử giá có lựa chọn 7, 15, 30, 60 phiên.
- Vùng tổng hợp % thay đổi giá trong 3, 7, 10, 14, 21, 30 phiên.
- Tab bảng đánh giá theo thang điểm 100.
- Tab tin tức thị trường từ RSS CafeF và VnExpress.
- Tab phân tích cùng AI dựa trên dữ liệu kỹ thuật hiện có trong app.
- Tab Market Scanner lọc nhanh coin và cổ phiếu Việt Nam theo thanh khoản, biến động, xu hướng 1D/4H, relative strength và volume bất thường để tạo watchlist 10-20 mã đáng phân tích.
- Trong Market Scanner có ô Trade Analysis chọn 1-3 coin tốt nhất để tìm entry theo 4H, 1H, 30m với momentum, RSI, MACD, ADX, BOS/CHOCH, liquidity, Order Block, FVG, volume và RR. Phần này có thêm Giai đoạn 4 xác nhận entry trên 15m/5m và Giai đoạn 5 quản trị rủi ro trước khi bấm Buy.
- Giá trị mua/bán nước ngoài và ước tính trong nước lấy từ dữ liệu bảng giá VCI khi nguồn trả về.

## Đưa lên website

Nên deploy bằng Git/Netlify project để Netlify Function hoạt động. Nếu chỉ mở bằng `file://`, trình duyệt có thể báo `Failed to fetch` vì API chứng khoán/coin bị chặn CORS.

Thư mục function nằm tại:

`netlify/functions/vn-stock.js`

Sau khi deploy đúng, app sẽ gọi dữ liệu qua:

`/.netlify/functions/vn-stock`

## Lưu ý

- App dùng dữ liệu công khai qua proxy, không phải API chính thức có SLA cho sản phẩm thương mại.
- Nếu cần sản phẩm ổn định để kinh doanh, nên dùng nhà cung cấp dữ liệu có hợp đồng/API key riêng.
- Dữ liệu hiển thị phụ thuộc vào các trường mà endpoint trả về cho từng mã cổ phiếu hoặc từng cặp coin.
