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
        // query1 bazen bloklanıyor, query2 daha stabil olabiliyor
        const finalUrl = request.url.replace('query1.finance.yahoo.com', 'query2.finance.yahoo.com');
        fetchWithTimeout(finalUrl, 8000)
            .then(text => {
                try {
                    return JSON.parse(text);
                } catch(e) {
                    throw new Error("JSON Ayrıştırma Hatası (Sunucu HTML dönmüş olabilir)");
                }
            })
            .then(data => sendResponse({ success: true, data }))
            .catch(error => {
                // Eğer query2 de başarısız olursa orijinali tekrar dene (belki o an geçicidir)
                if (!request.isRetry) {
                    return fetchWithTimeout(request.url, 8000)
                        .then(JSON.parse)
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
        const fetchOptions = {
            signal: controller.signal,
            referrerPolicy: 'no-referrer',
            credentials: 'omit',
            cache: 'no-store',
            headers: {
                'Accept': isYahoo ? 'application/json, text/plain, */*' : 'application/rss+xml, application/xml, text/xml, */*',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
            }
        };

        if (isYahoo) {
            // Yahoo bazen referer ve origin bekler
            fetchOptions.headers['Origin'] = 'https://finance.yahoo.com';
            fetchOptions.headers['Referer'] = 'https://finance.yahoo.com/';
        }

        const response = await fetch(url, fetchOptions);
        clearTimeout(id);

        if (!response.ok) {
            console.error(`Fetch error: ${response.status} for ${url}`);
            if (response.status === 403 || response.status === 401) throw new Error("Erişim Reddedildi (Yahoo Blokladı)");
            if (response.status === 404) throw new Error("Sembol Bulunamadı (404)");
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
