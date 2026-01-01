const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

// Khai báo Cache
const cacheGold = new NodeCache({ stdTTL: 60 });   // 60s
const cacheCoin = new NodeCache({ stdTTL: 60 });   // 60s
const cacheBank = new NodeCache({ stdTTL: 3600 }); // 1 tiếng

app.get('/', (req, res) => res.send("Server Tài Chính (Fixed V3) - Online"));

// ============================================================
// 1. GIÁ VÀNG (Dùng PAXG Binance + Tỷ giá USD Ngân hàng)
// ============================================================
app.get('/gold', async (req, res) => {
    const cachedData = cacheGold.get("gold_binance");
    if (cachedData) return res.send(cachedData);

    try {
        console.log("🚀 Đang tính giá vàng...");

        // Bước 1: Lấy giá PAXG (Vàng Crypto) từ Binance
        const paxgRes = await axios.get('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT');
        const pricePaxg = parseFloat(paxgRes.data.price); // Ví dụ: 2650 USD

        // Bước 2: Lấy tỷ giá USD/VND từ nguồn mở (Open Exchange Rates)
        const rateRes = await axios.get('https://open.er-api.com/v6/latest/USD');
        const usdToVnd = rateRes.data.rates.VND; // Ví dụ: 25400

        // [ĐÃ SỬA] Bước 3: Tính toán (Giả lập giá USDT chợ đen = Giá bank + 6%)
        // Đã sửa thành 1.06 theo yêu cầu của bạn
        const usdtRate = usdToVnd * 1.06; 
        
        // Công thức: (Giá PAXG * Giá Đô) / 0.82945 (Quy đổi Ounce -> Lượng)
        const priceVND_Luong = (pricePaxg * usdtRate) / 0.82945;
        
        // Làm tròn số đẹp (Ví dụ: 85,200,000)
        const finalPriceMillions = (priceVND_Luong / 1000000).toFixed(1); // 85.2
        const priceString = parseInt(priceVND_Luong).toLocaleString('vi-VN');

        // Tạo câu trả lời
        const msg = `Giá vàng thế giới (tham chiếu Binance PAXG) đang khoảng ${pricePaxg.toFixed(0)} Đô/Ounce. ` +
                    `Quy đổi ra tiền Việt là ${priceString} đồng/lượng. ` +
                    `(YÊU CẦU AI: Chém gió về mức giá ${finalPriceMillions} triệu này. ` +
                    `Nếu trên 82 triệu: Hô hào 'Đu đỉnh mát lắm', 'Sắp sập rồi'. ` +
                    `Nếu dưới 75 triệu: Hô 'Múc mạnh đi', 'All-in thôi'. ` +
                    `Nhớ nhắc đây là giá tham khảo).`;
        
        cacheGold.set("gold_binance", msg, 60);
        res.send(msg);

    } catch (e) {
        console.error("Lỗi Gold:", e.message);
        res.send("Đang không lấy được giá vàng, chắc cá mập cắn cáp rồi!");
    }
});

// ============================================================
// 2. GIÁ COIN (Binance Free)
// ============================================================
app.get('/coin', async (req, res) => {
    const symbol = (req.query.symbol || "BTC").toUpperCase();
    const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
    
    const cacheKey = `coin_${pair}`;
    const cached = cacheCoin.get(cacheKey);
    if (cached) return res.send(cached);

    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        // Format số tiền: 98000.50 -> 98,000.50
        const price = parseFloat(response.data.price).toLocaleString('en-US', {minimumFractionDigits: 2});
        
        const msg = `Giá ${symbol} hiện tại là ${price} Đô la (USDT). (YÊU CẦU AI: Nếu giá cao thì hô to the moon, giá thấp thì kêu bắt đáy).`;
        
        cacheCoin.set(cacheKey, msg);
        res.send(msg);
    } catch (e) {
        res.send(`Không tìm thấy đồng ${symbol} đâu cả.`);
    }
});

// ============================================================
// 3. GIÁ ĐÔ LA (USD & USDT)
// ============================================================
app.get('/usdt', async (req, res) => {
    const cached = cacheBank.get("usdt_price");
    if (cached) return res.send(cached);

    try {
        const response = await axios.get('https://open.er-api.com/v6/latest/USD');
        const rate = response.data.rates.VND; // Tỷ giá ngân hàng (ví dụ 25400)
        
        // [ĐÃ SỬA] Tính giá chợ đen (USDT) ~ cao hơn 6%
        const blackMarketRate = rate * 1.06; 

        // Format: 26,500
        const bankStr = parseInt(rate).toLocaleString('vi-VN');
        const blackStr = parseInt(blackMarketRate).toLocaleString('vi-VN');

        const msg = `Tỷ giá Đô la hôm nay: Ngân hàng khoảng ${bankStr} đồng. ` +
                    `Còn giá Đô chợ đen (USDT) khoảng ${blackStr} đồng. ` +
                    `(YÊU CẦU AI: Khuyên user nên giữ Đô hay giữ Tiền Việt. Dùng giọng điệu chuyên gia tài chính).`;
        
        cacheBank.set("usdt_price", msg);
        res.send(msg);
    } catch (e) {
        res.send("Không lấy được tỷ giá Đô rồi.");
    }
});

// ============================================================
// 4. ĐỔI TIỀN (CURRENCY)
// ============================================================
app.get('/currency', async (req, res) => {
    const from = (req.query.from || "USD").toUpperCase();
    const to = (req.query.to || "VND").toUpperCase();
    
    // Fix lỗi AI đọc sai: Chúng ta sẽ format rõ ràng
    try {
        const response = await axios.get(`https://open.er-api.com/v6/latest/${from}`);
        const rate = response.data.rates[to];
        
        if (!rate) return res.send(`Không đổi được từ ${from} sang ${to}.`);

        // Format số nguyên cho tiền Việt (bỏ số lẻ thập phân)
        const rateFormatted = parseInt(rate).toLocaleString('vi-VN');
        
        const msg = `1 ${from} đổi được khoảng ${rateFormatted} ${to}.`;
        res.send(msg);
    } catch (e) {
        res.send("Lỗi tính tỷ giá rồi.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Finance Server chạy port ${PORT}`));
