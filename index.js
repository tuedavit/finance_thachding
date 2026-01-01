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

        // Bước 3: Tính toán (Giả lập giá USDT chợ đen = Giá bank + 4%)
        // Vì giá vàng Việt Nam thường cao hơn thế giới và USDT cao hơn USD bank
        const usdtRate = usdToVnd * 1.0606; 
        
        // Công thức: (Giá PAXG * Giá Đô) / 0.82945 (Quy đổi Ounce -> Lượng)
        const pric06; 

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
