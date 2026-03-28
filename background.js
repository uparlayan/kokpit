/**
 * KOKPIT — Arka Plan Servisi (Service Worker)
 * CORS engellerini aşmak için veri çekme işlemlerini burada yapıyoruz.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchRSS") {
        fetchWithTimeout(request.url, 12000)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Asenkron cevap
    }
    
    if (request.action === "fetchStock") {
        const finalUrl = request.url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
        fetchWithTimeout(finalUrl, 8000)
            .then(text => {
                try { return JSON.parse(text); }
                catch(e) { throw new Error("JSON hatası"); }
            })
            .then(data => sendResponse({ success: true, data }))
            .catch(error => {
                if (!request.isRetry) {
                    return fetchWithTimeout(request.url, 8000)
                        .then(text => JSON.parse(text))
                        .then(data => sendResponse({ success: true, data }))
                        .catch(err => sendResponse({ success: false, error: err.message }));
                }
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
});

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const isYahoo = url.includes('yahoo.com');
        const isTefas = url.includes('tefas.gov.tr');
        const isCoingecko = url.includes('coingecko.com');
        const isGoogle = url.includes('google.com');

        const fetchOptions = {
            signal: controller.signal,
            referrerPolicy: 'no-referrer',
            credentials: 'omit',
            cache: 'no-store',
            headers: {
                'Accept': (isYahoo || isCoingecko) ? 'application/json, text/plain, */*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        };

        if (isYahoo) {
            fetchOptions.headers['Origin'] = 'https://finance.yahoo.com';
            fetchOptions.headers['Referer'] = 'https://finance.yahoo.com/';
        } else if (isTefas) {
            fetchOptions.headers['Origin'] = 'https://www.tefas.gov.tr';
            fetchOptions.headers['Referer'] = 'https://www.tefas.gov.tr/';
        } else if (isGoogle) {
            fetchOptions.headers['Referer'] = 'https://www.google.com/';
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(id);

        if (!response.ok) {
            if (response.status === 403 || response.status === 401) throw new Error("Erişim Reddedildi (403/401)");
            if (response.status === 429) throw new Error("Sınır Aşıldı (429)");
            throw new Error(`HTTP ${response.status}`);
        }

        const text = await response.text();
        if (!text) throw new Error("Sunucudan boş yanıt döndü.");
        return text.trim();
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') throw new Error("Zaman aşımı (Bağlantı yavaş)");
        throw error;
    }
}
