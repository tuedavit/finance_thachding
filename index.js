const express = require('express');
const cors = require('cors');
const axios = require('axios');
const NodeCache = require('node-cache');

const app = express();
app.use(cors());


// --- 1. GIÁ VÀNG (PHIÊN BẢN BINANCE - FREE VĨNH VIỄN) ---
// Không cần GoldAPI Key nữa, vứt luôn cũng được!

app.get('/gold', async (req, res) => {
    // Check cache 10 giây thôi, vì hàng Free mà!
    const cachedData = cacheGold.get("gold_binance");
    if (cachedData) return res.send(cachedData);

    try {
        console.log("🚀 Đang lấy giá vàng từ Binance (PAXG)...");

        // 1. Gọi 2 API cùng lúc: Giá Vàng (PAXG) và Giá Đô (USDT)
        // Lưu ý: Binance P2P không có API public dễ lấy, ta dùng mẹo lấy BTC/VND chia BTC/USDT để ra tỷ giá Đô chuẩn
        const [paxgRes, btcUsdtRes, btcVndRes] = await Promise.all([
            axios.get('https://api.binance.com/api/v3/ticker/price?symbol=PAXGUSDT'),
            axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'),
            axios.get('https://api.binance.com/api/v3/ticker/price?symbol=BTCVND') // Cặp này Binance có list
        ]);

        // 2. Tính toán
        const pricePaxg = parseFloat(paxgRes.data.price); // Ví dụ: 2650$
        const priceBtcUsdt = parseFloat(btcUsdtRes.data.price);
        const priceBtcVnd = parseFloat(btcVndRes.data.price);
        
        // Tỷ giá USDT thật (theo thị trường crypto VN)
        const usdtRate = priceBtcVnd / priceBtcUsdt; 

        // Công thức quy đổi Ounce sang Lượng (1 Oz = 0.82945 Lượng)
        // Giá 1 Lượng = (Giá 1 Oz * Tỷ giá Đô) / 0.82945
        const priceVND_Luong = (pricePaxg * usdtRate) / 0.82945;
        
        // Làm tròn
        const finalPrice = (priceVND_Luong / 1000000).toFixed(2); // Ra số kiểu "82.50" (Triệu)
        const priceString = parseInt(priceVND_Luong).toLocaleString('vi-VN');

        // 3. Tạo câu trả lời (Kèm mớm lời cho AI)
        const now = new Date();
        const timeString = `${(now.getUTCHours() + 7) % 24}:${now.getUTCMinutes()}`;
        
        const msg = `Giá vàng thế giới (theo cặp PAXG Binance) đang là ${pricePaxg.toFixed(1)} Đô một Ounce. ` +
                    `Quy đổi ra tiền Việt khoảng ${priceString} đồng một lượng. ` +
                    `(YÊU CẦU AI: Chém gió về giá vàng ${finalPrice} triệu này. ` +
                    `Nếu trên 80 triệu thì kêu 'Đu đỉnh mát lắm', nếu dưới 70 triệu thì kêu 'Bắt đáy đi'. ` +
                    `Nhắc user đây là giá tham khảo từ sàn Binance).`;
        
        // Cache 60 giây
        cacheGold.set("gold_binance", msg, 60);
        res.send(msg);

    } catch (e) {
        console.error("Lỗi Binance:", e.message);
        res.send("Sàn Binance đang bảo trì hay sao ấy, không lấy được giá vàng rồi!");
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
