const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());

// Cấu hình Cache: Vàng 8 tiếng, Coin 1 phút, Tỷ giá 1 tiếng
const cacheGold = new NodeCache({ stdTTL: 28800 }); 
const cacheCoin = new NodeCache({ stdTTL: 60 });
const cacheBank = new NodeCache({ stdTTL: 3600 });

// Key Vàng của bạn (Đã điền sẵn)
const GOLD_API_KEY = "goldapi-12ys7019mjtu2byb-io"; 

app.get('/', (req, res) => res.send("Server Tài Chính ThachDing - Online"));

// --- 1. GIÁ VÀNG (Tiết kiệm Key - 8 tiếng cập nhật 1 lần) ---
app.get('/gold', async (req, res) => {
    const cachedData = cacheGold.get("gold_vn");
    if (cachedData) return res.send(cachedData);

    try {
        console.log("⚠️ Đang gọi GoldAPI...");
        const response = await axios.get('https://www.goldapi.io/api/XAU/VND', {
            headers: { 'x-access-token': GOLD_API_KEY }
        });

        const priceVND_Oz = response.data.price;
        const priceVND_Luong = (priceVND_Oz / 0.82945).toFixed(0);
        const priceString = parseInt(priceVND_Luong).toLocaleString('vi-VN');

        const now = new Date();
        // Giờ VN = UTC+7
        const hour = (now.getUTCHours() + 7) % 24;
        const min = now.getUTCMinutes();
        const timeString = `${hour} giờ ${min} phút`;
        
        const msg = `Vàng thế giới quy đổi lúc ${timeString} là khoảng ${priceString} đồng một lượng.`;
        
        cacheGold.set("gold_vn", msg);
        res.send(msg);
    } catch (e) {
        console.error(e.message);
        res.send("Hết lượt gọi Vàng hoặc lỗi mạng rồi!");
    }
});

// --- 2. GIÁ COIN (Binance Free) ---
app.get('/coin', async (req, res) => {
    const symbol = (req.query.symbol || "BTC").toUpperCase();
    const pair = symbol.endsWith("USDT") ? symbol : `${symbol}USDT`;
    
    const cacheKey = `coin_${pair}`;
    const cached = cacheCoin.get(cacheKey);
    if (cached) return res.send(cached);

    try {
        const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
        const price = parseFloat(response.data.price).toLocaleString('en-US');
        const msg = `Giá ${symbol} đang là ${price} Đô la.`;
        
        cacheCoin.set(cacheKey, msg);
        res.send(msg);
    } catch (e) {
        res.send(`Không tìm thấy đồng ${symbol} đâu.`);
    }
});

// --- 3. GIÁ USDT (Chợ đen) ---
app.get('/usdt', async (req, res) => {
    const cached = cacheCoin.get("usdt_vnd");
    if (cached) return res.send(cached);

    try {
        const rateRes = await axios.get('https://open.er-api.com/v6/latest/USD');
        const rate = rateRes.data.rates.VND;
        const usdtRate = (rate * 1.025).toFixed(0); // Cộng thêm 2.5% chênh lệch
        const msg = `Giá Đô USDT thị trường khoảng ${parseInt(usdtRate).toLocaleString()} đồng.`;
        
        cacheCoin.set("usdt_vnd", msg);
        res.send(msg);
    } catch (e) {
        res.send("Không lấy được giá Đô rồi.");
    }
});

// --- 4. TỶ GIÁ NGÂN HÀNG ---
app.get('/currency', async (req, res) => {
    const from = (req.query.from || "USD").toUpperCase();
    const to = (req.query.to || "VND").toUpperCase();
    
    const cacheKey = `rate_${from}_${to}`;
    const cached = cacheBank.get(cacheKey);
    if (cached) return res.send(cached);

    try {
        const response = await axios.get(`https://open.er-api.com/v6/latest/${from}`);
        const rate = response.data.rates[to];
        if (!rate) return res.send(`Không đổi được cặp này.`);
        const msg = `1 ${from} đổi được khoảng ${parseInt(rate).toLocaleString()} ${to}.`;
        
        cacheBank.set(cacheKey, msg);
        res.send(msg);
    } catch (e) {
        res.send("Lỗi lấy tỷ giá rồi.");
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Finance Server chạy port ${PORT}`));
