const axios = require('axios');

// In-memory cache sederhana agar terhindar dari rate limit (429)
let cachedCandles = {};
let lastCacheTime = {};

/**
 * Normalisasi format symbol untuk berbagai exchange
 */
function parseSymbol(symbol = 'BTCUSDT') {
    let clean = symbol.toUpperCase().replace(/[-_]/g, '');
    let base = 'BTC';
    let quote = 'USDT';

    if (clean.endsWith('USDT')) {
        base = clean.replace('USDT', '');
        quote = 'USDT';
    } else if (clean.endsWith('BIDR')) {
        base = clean.replace('BIDR', '');
        quote = 'BIDR';
    } else if (clean.endsWith('IDR')) {
        base = clean.replace('IDR', '');
        quote = 'IDR';
    }

    return {
        raw: symbol,
        clean: `${base}${quote}`,             // Contoh: BTCUSDT (Format Resmi MBX Tokocrypto)
        base,
        quote,
        tokoUnderscore: `${base}_${quote}`,   // Contoh: BTC_USDT (Legacy NextMe)
    };
}

const AXIOS_CONFIG = {
    timeout: 7000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
};

/**
 * Parsing data kline dari berbagai macam format response
 */
function parseCandlesList(list) {
    if (!Array.isArray(list) || list.length === 0) return [];

    return list.map(c => {
        // Format Array Binance / Tokocrypto API v3: [openTime, open, high, low, close, volume, closeTime, ...]
        if (Array.isArray(c)) {
            return {
                openTime: Number(c[0]),
                open: parseFloat(c[1]),
                high: parseFloat(c[2]),
                low: parseFloat(c[3]),
                close: parseFloat(c[4]),
                volume: parseFloat(c[5] || 0),
                closeTime: Number(c[6] || c[0])
            };
        }
        // Format Object
        return {
            openTime: Number(c.openTime || c.time || c.t || Date.now()),
            open: parseFloat(c.open || c.o || c.price || 0),
            high: parseFloat(c.high || c.h || c.price || 0),
            low: parseFloat(c.low || c.l || c.price || 0),
            close: parseFloat(c.close || c.c || c.price || 0),
            volume: parseFloat(c.volume || c.v || 0),
            closeTime: Number(c.closeTime || c.time || Date.now())
        };
    }).filter(c => !isNaN(c.close) && c.close > 0);
}

/**
 * Mengambil data Candlestick (Kline) dengan multi-endpoint Tokocrypto & Mirror
 */
async function getCandles(symbol = 'BTCUSDT', interval = '15m', limit = 100) {
    const sym = parseSymbol(symbol);
    const now = Date.now();

    // ----------------------------------------------------
    // 1. Tokocrypto Official Engine MBX (v3 API - Standar Utama Tokocrypto)
    // ----------------------------------------------------
    const primaryUrls = [
        `https://www.tokocrypto.com/api/v3/klines?symbol=${sym.clean}&interval=${interval}&limit=${limit}`,
        `https://www.tokocrypto.site/api/v3/klines?symbol=${sym.clean}&interval=${interval}&limit=${limit}`,
        `https://data-api.binance.vision/api/v3/klines?symbol=${sym.clean}&interval=${interval}&limit=${limit}`
    ];

    for (const url of primaryUrls) {
        try {
            const response = await axios.get(url, AXIOS_CONFIG);
            if (Array.isArray(response.data) && response.data.length > 0) {
                const parsed = parseCandlesList(response.data);
                if (parsed.length > 0) {
                    const host = new URL(url).hostname;
                    console.log(`[MarketData] ✅ Berhasil mengambil ${parsed.length} candles dari ${host} (${sym.clean})!`);
                    
                    // Simpan cache
                    cachedCandles[sym.clean] = parsed;
                    lastCacheTime[sym.clean] = now;
                    return parsed;
                }
            }
        } catch (err) {
            // Lanjut ke URL berikutnya jika ada error
        }
    }

    // ----------------------------------------------------
    // 2. Fallback: Bitget Public API (Cepat, Tanpa Rate Limit Ketat)
    // ----------------------------------------------------
    try {
        const bgGranularity = interval === '1h' ? '1h' : interval === '1d' ? '1day' : '15m';
        const bgUrl = `https://api.bitget.com/api/v2/spot/market/candles?symbol=${sym.clean}&granularity=${bgGranularity}&limit=${limit}`;
        const response = await axios.get(bgUrl, AXIOS_CONFIG);

        if (response.data && response.data.code === '00000' && Array.isArray(response.data.data) && response.data.data.length > 0) {
            console.log(`[MarketData] ✅ Berhasil mengambil data dari Bitget API (${sym.clean})!`);
            // Format Bitget: [ [ts, open, high, low, close, baseVol, ...], ... ]
            // Urutkan dari terlama ke terbaru
            const parsed = parseCandlesList(response.data.data.reverse());
            cachedCandles[sym.clean] = parsed;
            lastCacheTime[sym.clean] = now;
            return parsed;
        }
    } catch (err) {
        // Abaikan
    }

    // ----------------------------------------------------
    // 3. Fallback: Cache Memori Terakhir (Jika API sedang sibuk)
    // ----------------------------------------------------
    if (cachedCandles[sym.clean] && cachedCandles[sym.clean].length > 0) {
        console.log(`[MarketData] 🔄 Menggunakan data cache pasar lokal terakhir untuk ${sym.clean}`);
        return cachedCandles[sym.clean];
    }

    return [];
}

module.exports = { getCandles };
