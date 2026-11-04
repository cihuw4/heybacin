const express = require('express');
const path = require('path');
require('dotenv').config();

const { getCandles } = require('./services/marketData');
const { analyzeMarketAndExecute } = require('./strategy/analyzer');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Symbol aktif default
let activeSymbol = 'BTCUSDT';

// State global untuk Dashboard UI
let latestBotState = {
    symbol: activeSymbol,
    lastUpdated: '-',
    currentPrice: 0,
    rsi: 0,
    signal: 'MEMUAT DATA...',
    candles: [],
    logs: ['Aplikasi dinyalakan, menghubungkan ke server pasar...'],
    analysis: null
};

// Fungsi Utama Bot
async function runBot(targetSymbol = activeSymbol) {
    console.log(`\n🔍 [${new Date().toLocaleTimeString('id-ID')}] Memulai analisis untuk ${targetSymbol}...`);

    const candles = await getCandles(targetSymbol, '15m', 100);

    if (candles && candles.length > 0) {
        const analysis = analyzeMarketAndExecute(candles, targetSymbol);

        // Pertahankan riwayat 25 log terakhir agar bisa dibaca di UI
        const existingLogs = latestBotState.logs.filter(l => !l.includes('Aplikasi dinyalakan'));
        const updatedLogs = [analysis.logs[0], ...existingLogs].slice(0, 25);

        latestBotState = {
            symbol: targetSymbol,
            lastUpdated: new Date().toLocaleTimeString('id-ID'),
            currentPrice: analysis.currentPrice,
            rsi: analysis.currentRSI,
            signal: analysis.signal.action,
            analysis,
            candles: candles.slice(-40),
            logs: updatedLogs
        };
        console.log(`✅ Data ${targetSymbol} diperbarui! Harga: $${analysis.currentPrice.toLocaleString()} | RSI: ${analysis.currentRSI} | ${analysis.trend.direction}`);
    } else {
        console.log(`⚠️ Gagal mengambil data kline/candles dari API untuk ${targetSymbol}.`);
    }
}

// REST API Endpoint: Ambil Status Dashboard
app.get('/api/status', (req, res) => {
    res.json(latestBotState);
});

// REST API Endpoint: Ubah Koin Aktif dari UI
app.post('/api/symbol', async (req, res) => {
    const { symbol } = req.body;
    if (!symbol) return res.status(400).json({ error: 'Symbol wajib diisi' });

    activeSymbol = symbol;
    console.log(`\n🔄 User mengganti koin aktif ke: ${activeSymbol}`);

    // Eksekusi bot instan saat koin diganti
    await runBot(activeSymbol);

    res.json({ success: true, activeSymbol, state: latestBotState });
});

// REST API Endpoint: Trigger Manual Refresh
app.post('/api/refresh', async (req, res) => {
    await runBot(activeSymbol);
    res.json({ success: true, state: latestBotState });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Dashboard berjalan di http://localhost:${PORT}`);

    // Eksekusi awal
    runBot(activeSymbol);

    // Interval otomatis setiap 60 detik
    setInterval(() => {
        runBot(activeSymbol);
    }, 60 * 1000);
});
