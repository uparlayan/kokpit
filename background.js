/**
 * KOKPIT — Arka Plan Servisi (Service Worker)
 * CORS engellerini aşmak için veri çekme işlemlerini burada yapıyoruz.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "fetchRSS") {
        fetchWithTimeout(request.url, 12000)
            .then(data => sendResponse({ success: true, data }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Asenkron cevap vereceğimizi belirtiyoruz
    }
});

async function fetchWithTimeout(url, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            referrerPolicy: 'no-referrer',
            credentials: 'omit',
            cache: 'no-store',
            headers: {
                // Tarayıcı gibi davranmaya çalışalım (Bazı CDN'ler için gerekli)
                'Accept': 'application/rss+xml, application/xml, text/xml, */*'
            }
        });
        clearTimeout(id);

        if (!response.ok) {
            if (response.status === 403 || response.status === 401) {
                throw new Error("Erişim Reddedildi (CORS/WAF)");
            }
            throw new Error(`HTTP Hatası: ${response.status}`);
        }

        const text = await response.text();
        return text.trim();
    } catch (error) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error("Zaman aşımı (Bağlantı çok yavaş)");
        }
        throw error;
    }
}
