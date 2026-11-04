const { RSI, EMA } = require('technicalindicators');

/**
 * Menganalisis kondisi pasar secara mendalam dan menyajikan penjelasan
 * dalam bahasa yang mudah dipahami bagi trader pemula maupun berpengalaman.
 */
function analyzeMarketAndExecute(candles, symbol) {
    if (!candles || candles.length < 20) {
        return {
            currentPrice: 0,
            rsi: { value: 0, status: 'Data Kurang', color: '#94a3b8' },
            trend: { direction: 'NETRAL', status: 'Menunggu Data', badge: 'HOLD' },
            signal: { action: 'WAIT & SEE', badge: 'HOLD', confidence: 50, riskLevel: 'Rendah' },
            supportResistance: { support: 0, resistance: 0 },
            targetLevels: { entryPrice: 0, tp1: 0, tp2: 0, sl: 0 },
            explanation: {
                title: 'Data Belum Cukup',
                summary: 'Dibutuhkan minimal 20 candlestick untuk menganalisis indikator teknikal dengan akurat.',
                advice: 'Tunggu beberapa saat sampai data historis pasar terkumpul.'
            },
            logs: [`[${new Date().toLocaleTimeString('id-ID')}] Menunggu data candlestick terkumpul...`]
        };
    }

    const closePrices = candles.map(c => parseFloat(c.close));
    const highPrices = candles.map(c => parseFloat(c.high || c.close));
    const lowPrices = candles.map(c => parseFloat(c.low || c.close));
    const currentPrice = closePrices[closePrices.length - 1];
    const prevPrice = closePrices[closePrices.length - 2] || currentPrice;
    const priceChangeRecent = (((currentPrice - prevPrice) / prevPrice) * 100).toFixed(2);

    // ----------------------------------------------------
    // 1. Perhitungan RSI (Period 14)
    // ----------------------------------------------------
    const rsiValues = RSI.calculate({ values: closePrices, period: 14 });
    const currentRSI = rsiValues.length > 0 ? parseFloat(rsiValues[rsiValues.length - 1].toFixed(1)) : 50;

    let rsiStatus = 'Normal / Konsolidasi';
    let rsiColor = '#fbbf24'; // kuning
    if (currentRSI <= 30) {
        rsiStatus = 'Oversold (Zona Murah / Diskon)';
        rsiColor = '#4ade80'; // hijau
    } else if (currentRSI >= 70) {
        rsiStatus = 'Overbought (Jenuh Beli / Rawan Koreksi)';
        rsiColor = '#f87171'; // merah
    } else if (currentRSI < 45) {
        rsiStatus = 'Cenderung Melemah';
        rsiColor = '#38bdf8';
    } else if (currentRSI > 55) {
        rsiStatus = 'Cenderung Menguat';
        rsiColor = '#38bdf8';
    }

    // ----------------------------------------------------
    // 2. Perhitungan Tren EMA (EMA 9 & EMA 21)
    // ----------------------------------------------------
    const ema9Values = EMA.calculate({ period: 9, values: closePrices });
    const ema21Values = EMA.calculate({ period: 21, values: closePrices });

    const currentEma9 = ema9Values.length > 0 ? parseFloat(ema9Values[ema9Values.length - 1].toFixed(2)) : currentPrice;
    const currentEma21 = ema21Values.length > 0 ? parseFloat(ema21Values[ema21Values.length - 1].toFixed(2)) : currentPrice;

    let trendDirection = 'SIDEWAYS ➡️';
    let trendStatus = 'Pasar Bergerak Mendatar';
    let isBullishTrend = false;
    let isBearishTrend = false;

    if (currentEma9 > currentEma21 && currentPrice >= currentEma9) {
        trendDirection = 'BULLISH (UPTREND) 📈';
        trendStatus = 'Tren Naik Kuat (Harga di atas EMA 9 & 21)';
        isBullishTrend = true;
    } else if (currentEma9 < currentEma21 && currentPrice <= currentEma9) {
        trendDirection = 'BEARISH (DOWNTREND) 📉';
        trendStatus = 'Tren Turun Kuat (Harga di bawah EMA 9 & 21)';
        isBearishTrend = true;
    } else {
        trendDirection = 'SIDEWAYS / KONSOLIDASI ➡️';
        trendStatus = 'Tren Belum Jelas (EMA saling berdekatan)';
    }

    // ----------------------------------------------------
    // 3. Support & Resistance (Berdasarkan 30 Lilin Terakhir)
    // ----------------------------------------------------
    const recentLowPrices = lowPrices.slice(-30);
    const recentHighPrices = highPrices.slice(-30);
    const supportPrice = parseFloat(Math.min(...recentLowPrices).toFixed(2));
    const resistancePrice = parseFloat(Math.max(...recentHighPrices).toFixed(2));

    // ----------------------------------------------------
    // 4. Skor Keyakinan & Penentuan Sinyal Akhir
    // ----------------------------------------------------
    let action = 'WAIT & SEE / HOLD';
    let badge = 'HOLD';
    let confidence = 50;
    let riskLevel = 'Sedang';
    let title = 'Pasar Sedang Menunggu Momentum';
    let summary = '';
    let advice = '';

    if (currentRSI <= 30) {
        // Kondisi OVERSOLD KUAT
        action = 'REKOMENDASI: BUY (CICIL BELI)';
        badge = 'BUY';
        confidence = isBullishTrend ? 90 : 80;
        riskLevel = 'Rendah (Reward > Risk)';
        title = '🚨 PELUANG BELI: Pasar Berada di Titik Murah (Oversold)';
        summary = `Indikator RSI berada di level ${currentRSI} (di bawah 30), menandakan tekanan jual sudah hampir habis. Harga $${currentPrice.toLocaleString()} mendekati batas Support terkuat di $${supportPrice.toLocaleString()}. Potensi rebound atau pembalikan arah naik sangat terbuka.`;
        advice = 'Sangat layak untuk mulai akumulasi atau entry posisi Beli dengan cicilan modal secara bertahap.';
    } else if (currentRSI >= 70) {
        // Kondisi OVERBOUGHT KUAT
        action = 'REKOMENDASI: TAKE PROFIT / SELL';
        badge = 'SELL';
        confidence = isBearishTrend ? 90 : 80;
        riskLevel = 'Tinggi untuk Beli Baru';
        title = '🔥 WASPADA: Pasar Sudah Jenuh Beli (Overbought)';
        summary = `Indikator RSI telah menyentuh ${currentRSI} (di atas 70), menandakan harga sudah naik sangat tinggi dan mendekati area jenuh beli dekat Resistance $${resistancePrice.toLocaleString()}. Tekanan ambil untung (profit taking) biasanya segera terjadi.`;
        advice = 'Disarankan untuk mengamankan keuntungan (Take Profit). Hindari membuka posisi beli baru saat ini.';
    } else if (isBullishTrend && currentRSI >= 45 && currentRSI <= 60) {
        // Tren naik sehat
        action = 'MOMENTUM BELI (FOLLOW TREND)';
        badge = 'BUY';
        confidence = 75;
        riskLevel = 'Sedang';
        title = '📈 TREN NAIK AKTIF: Momentum Bullish Sehat';
        summary = `Tren harga berada dalam fase UPTREND sehat (EMA 9 > EMA 21) dan RSI di angka ${currentRSI} belum menyentuh zona jenuh. Pembeli masih mendominasi pasar.`;
        advice = 'Bisa masuk dengan strategi mengikuti tren (trend-following), pastikan memasang Stop Loss ketat.';
    } else if (isBearishTrend && currentRSI > 40 && currentRSI < 55) {
        // Tren turun aktif
        action = 'HINDARI BELI / HOLD';
        badge = 'HOLD';
        confidence = 70;
        riskLevel = 'Tinggi';
        title = '📉 TREN TURUN AKTIF: Menunggu Konfirmasi Pembalikan';
        summary = `Struktur harga masih tertekan di bawah garis rata-rata EMA 9 ($${currentEma9.toLocaleString()}) dan EMA 21 ($${currentEma21.toLocaleString()}). Belum ada sinyal pembalikan harga (reversal) yang valid.`;
        advice = 'Paling bijak adalah Wait & See (menunggu di pinggir pasar) sampai terbentuk sinyal beli yang jelas.';
    } else {
        // Konsolidasi netral
        action = 'WAIT & SEE / NETRAL';
        badge = 'HOLD';
        confidence = 60;
        riskLevel = 'Rendah';
        title = '⏳ FASE KONSOLIDASI: Menunggu Titik Tembus (Breakout)';
        summary = `Harga saat ini bergerak stabil di kisaran $${currentPrice.toLocaleString()}, berada di antara Support $${supportPrice.toLocaleString()} dan Resistance $${resistancePrice.toLocaleString()} dengan RSI netral ${currentRSI}.`;
        advice = 'Biarkan pasar memilih arah terlebih dahulu sebelum memasang posisi besar.';
    }

    // ----------------------------------------------------
    // 5. Kalkulasi Target Harga Rencana (Action Plan)
    // ----------------------------------------------------
    const tp1Price = parseFloat((currentPrice * 1.015).toFixed(2)); // +1.5%
    const tp2Price = parseFloat((currentPrice * 1.035).toFixed(2)); // +3.5%
    const slPrice = parseFloat((currentPrice * 0.985).toFixed(2));  // -1.5%

    const timestamp = new Date().toLocaleTimeString('id-ID');
    const logEntry = `[${timestamp}] ${symbol} | $${currentPrice.toLocaleString()} | RSI: ${currentRSI} (${rsiStatus}) | Tren: ${trendDirection} -> ${action}`;

    return {
        currentPrice,
        priceChangeRecent,
        currentRSI,
        rsi: {
            value: currentRSI,
            status: rsiStatus,
            color: rsiColor
        },
        trend: {
            direction: trendDirection,
            status: trendStatus,
            ema9: currentEma9,
            ema21: currentEma21
        },
        supportResistance: {
            support: supportPrice,
            resistance: resistancePrice
        },
        targetLevels: {
            entryPrice: currentPrice,
            tp1: tp1Price,
            tp2: tp2Price,
            sl: slPrice
        },
        signal: {
            action,
            badge,
            confidence,
            riskLevel
        },
        explanation: {
            title,
            summary,
            advice
        },
        logs: [logEntry]
    };
}

module.exports = { analyzeMarketAndExecute };
