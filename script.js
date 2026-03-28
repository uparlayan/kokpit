// =============================================
// KOKPIT v2.0 — Tam Özellikli Yeni Sekme
// =============================================

const isFirefox = () => typeof browser !== 'undefined';

const kokpitData = {
    currentProfileName: "Varsayılan",
    activeTheme: "dark",
    background: "none",
    authSectionCollapsed: false,
    soundEnabled: true,
    widgets: {
        crypto: { enabled: true, currency: "usd", coins: "bitcoin,ethereum,solana" },
        rss: { enabled: true, feeds: "https://feeds.bbci.co.uk/news/world/rss.xml", count: 10 }
    },
    profiles: [
        {
            name: "Varsayılan",
            sidebar: [
                { name: "Gmail", url: "https://mail.google.com", type: "link" },
                { name: "Google Drive", url: "https://drive.google.com", type: "link" }
            ],
            shortcuts: [
                { name: "GitHub", url: "https://github.com", type: "link" },
                { name: "Stack Overflow", url: "https://stackoverflow.com", type: "link" },
                { name: "ChatGPT", url: "https://chat.openai.com", type: "link" }
            ],
            notes: []
        }
    ]
};

// =============================================
// v2.0: Favicon Cache (ayrı localStorage key)
// =============================================
const FAVICON_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 gün
let faviconCache = {};

function loadFaviconCache() {
    try {
        const raw = localStorage.getItem('kokpit_favicon_cache');
        if (raw) faviconCache = JSON.parse(raw);
    } catch(e) { faviconCache = {}; }
}

function saveFaviconCache() {
    try { localStorage.setItem('kokpit_favicon_cache', JSON.stringify(faviconCache)); } catch(e) {}
}

function getCachedFavicon(hostname) {
    const cached = faviconCache[hostname];
    if (!cached) return null;
    if (Date.now() - cached.ts > FAVICON_CACHE_TTL) {
        delete faviconCache[hostname];
        saveFaviconCache();
        return null;
    }
    return cached.url;
}

function cacheFavicon(hostname, url) {
    faviconCache[hostname] = { url, ts: Date.now() };
    saveFaviconCache();
}

// =============================================
// v1.4: Cyber-Audio Engine
// =============================================
class SoundManager {
    constructor() { this.ctx = null; this.masterGain = null; }

    init() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);
    }

    play(freq, type, duration, volume, rampType = 'exponential') {
        if (!kokpitData.soundEnabled) return;
        this.init();
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        g.gain.setValueAtTime(volume, this.ctx.currentTime);
        if (rampType === 'exponential') {
            g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
        } else {
            g.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        }
        osc.connect(g);
        g.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playBeep()    { this.play(2000 + Math.random() * 500, 'sine', 0.02, 0.01, 'linear'); }
    playClick()   { this.play(440, 'square', 0.05, 0.02); }
    playSave()    { this.play(660, 'sine', 0.1, 0.05); setTimeout(() => this.play(880, 'sine', 0.15, 0.03), 50); }
    playDelete()  { this.play(220, 'square', 0.2, 0.05); this.play(110, 'square', 0.3, 0.03); }
    playCancel()  { this.play(330, 'sine', 0.1, 0.04, 'linear'); }
    playHologram() {
        if (!kokpitData.soundEnabled) return;
        this.init();
        this.play(110, 'sine', 0.5, 0.1);
        this.play(220, 'sine', 0.3, 0.05);
    }
}

const sounds = new SoundManager();

function toggleSound() {
    kokpitData.soundEnabled = !kokpitData.soundEnabled;
    updateSoundUI();
    saveData();
    if (kokpitData.soundEnabled) sounds.playClick();
}

function updateSoundUI() {
    const btn = document.getElementById("btnSound");
    if (btn) btn.textContent = kokpitData.soundEnabled ? "🔊" : "🔇";
}

// =============================================
// YARDIMCI FONKSİYONLAR
// =============================================
function getActiveProfile() {
    return kokpitData.profiles.find(p => p.name === kokpitData.currentProfileName);
}

function modifyUrlWithAuthUser(url) {
    const authNo = kokpitData.globalActiveAuthNo;
    if (authNo === null || authNo === undefined || authNo === "") return url;
    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const googleDomains = ["mail.google.com","drive.google.com","docs.google.com","calendar.google.com","meet.google.com","contacts.google.com","keep.google.com","youtube.com"];
        const isGoogle = googleDomains.some(d => host === d || host.endsWith("." + d));
        if (isGoogle) {
            if (urlObj.pathname.match(/\/u\/\d+\//)) {
                urlObj.pathname = urlObj.pathname.replace(/\/u\/\d+\//, `/u/${authNo}/`);
            } else {
                urlObj.searchParams.set('authuser', authNo);
            }
            return urlObj.toString();
        }
    } catch(e) {}
    return url;
}

let currentEditType = "";
let currentEditIndex = -1;
let dragType = null;
let dragIndex = null;

const DEFAULT_FAVICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%238ab4f8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='2' y1='12' x2='22' y2='12'%3E%3C/line%3E%3Cpath d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'%3E%3C/path%3E%3C/svg%3E`;

const getFavicon = (url) => {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            let cleanPath = url.split('?')[0].split('#')[0];
            if (!cleanPath.endsWith('/')) cleanPath += '/';
            return `${cleanPath}favicon.svg`;
        }
        // Önbellekten kontrol et
        const cached = getCachedFavicon(hostname);
        if (cached) return cached;
        return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
    } catch(e) {
        return DEFAULT_FAVICON_SVG;
    }
};

// Favicon yükleme yardımcısı (önbellekleme + fallback)
function setupFaviconImg(img, url, size = 20) {
    img.style.width = size + 'px';
    img.style.height = size + 'px';
    img.src = getFavicon(url);
    img.alt = "";

    let triedDuckDuckGo = false;
    img.onerror = () => {
        if (!triedDuckDuckGo) {
            triedDuckDuckGo = true;
            try {
                const urlObj = new URL(url);
                img.src = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
            } catch(e) {
                img.src = DEFAULT_FAVICON_SVG;
                img.onerror = null;
            }
        } else {
            img.src = DEFAULT_FAVICON_SVG;
            img.onerror = null;
        }
    };

    img.onload = () => {
        if (img.src !== DEFAULT_FAVICON_SVG) {
            try {
                const urlObj = new URL(url);
                cacheFavicon(urlObj.hostname, img.src);
            } catch(e) {}
        }
    };
}

// =============================================
// v2.0: MARKDOWN PARSER
// =============================================
function parseMarkdown(text) {
    if (!text) return '';
    // XSS koruması: önce HTML karakterlerini escape et
    let safe = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Başlıklar: # Başlık
    safe = safe.replace(/^# (.+)$/gm, '<h4>$1</h4>');
    // Kalın: **text**
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    // İtalik: *text*
    safe = safe.replace(/\*(.+?)\*/g, '<em>$1</em>');
    // Kod: `code`
    safe = safe.replace(/`(.+?)`/g, '<code>$1</code>');
    // Liste: - item
    safe = safe.replace(/^- (.+)$/gm, '<li>$1</li>');
    safe = safe.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
        return '<ul>' + match + '</ul>';
    });
    // Satır sonu
    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

function hasMarkdown(text) {
    return /(\*\*|\*|^#|^-|`)/m.test(text);
}

// =============================================
// VERİ YÖNETİMİ
// =============================================
function migrateItem(item) {
    if (!item) return;
    if (!item.type) item.type = 'link';
    if (item.type === 'folder' && !item.children) item.children = [];
    if (item.children) {
        item.children = item.children.filter(c => c !== null);
        item.children.forEach(migrateItem);
    }
}

function loadData() {
    loadFaviconCache();
    const data = localStorage.getItem("kokpit_data");
    if (data) {
        Object.assign(kokpitData, JSON.parse(data));
    } else {
        const oldSidebar = localStorage.getItem("kokpit_sidebar");
        const oldShortcuts = localStorage.getItem("kokpit_shortcuts");
        if (oldSidebar && oldShortcuts) {
            kokpitData.profiles = [{ name: "Varsayılan", sidebar: JSON.parse(oldSidebar), shortcuts: JSON.parse(oldShortcuts), notes: [] }];
            kokpitData.currentProfileName = "Varsayılan";
            localStorage.removeItem("kokpit_sidebar");
            localStorage.removeItem("kokpit_shortcuts");
        }
    }

    kokpitData.profiles.forEach(p => {
        if (!p.notes) p.notes = [];
        if (p.sidebar) { p.sidebar = p.sidebar.filter(i => i !== null); p.sidebar.forEach(migrateItem); }
        if (p.shortcuts) { p.shortcuts = p.shortcuts.filter(i => i !== null); p.shortcuts.forEach(migrateItem); }
    });

    if (!kokpitData.authUsers) kokpitData.authUsers = [{ no: "0", label: "Varsayılan Hesap" }];
    if (kokpitData.globalActiveAuthNo === undefined) kokpitData.globalActiveAuthNo = "0";
    if (!kokpitData.widgets) kokpitData.widgets = { crypto: { enabled: true, currency: "usd", coins: "bitcoin,ethereum,solana" }, rss: { enabled: true, feeds: "https://feeds.bbci.co.uk/news/world/rss.xml", count: 10 } };
    if (!kokpitData.background) kokpitData.background = "none";

    if (kokpitData.leftSidebarHidden) {
        document.querySelector(".sidebar")?.classList.add("hidden");
        document.getElementById('leftResizer')?.classList.add("hidden");
    }
    if (kokpitData.rightSidebarHidden) {
        document.querySelector(".right-sidebar")?.classList.add("hidden");
        document.getElementById('rightResizer')?.classList.add("hidden");
    }

    applyTheme(kokpitData.activeTheme || "dark");
    updateAuthSectionUI();
    renderAll();

    // Arka plan ve widget'ları başlat
    if (kokpitData.background && kokpitData.background !== 'none') {
        setBackground(kokpitData.background);
    }
    initWidgets();
}

function cleanupOrphanedFolderStates() {
    const validKeys = new Set();
    function collect(items, parentPath = "") {
        if (!items) return;
        items.forEach((item, i) => {
            const p = parentPath === "" ? `${i}` : `${parentPath}-${i}`;
            if (item.type === 'folder') { validKeys.add(`folder_${p}_open`); if (item.children) collect(item.children, p); }
        });
    }
    kokpitData.profiles.forEach(p => { if (p.sidebar) collect(p.sidebar); });
    Object.keys(kokpitData).forEach(k => { if (k.startsWith("folder_") && k.endsWith("_open") && !validKeys.has(k)) delete kokpitData[k]; });
}

function saveData() {
    cleanupOrphanedFolderStates();
    localStorage.setItem("kokpit_data", JSON.stringify(kokpitData));
    renderAll();
}

function renderAll() {
    renderSidebar();
    renderGrid();
    renderAuthUsers();
    renderNotes();
    applyTheme(kokpitData.activeTheme || 'dark');
    updateBgOptionUI();
    updateWidgetVisibility();

    const profileBtn = document.getElementById("profileBtn");
    const activeProfile = getActiveProfile();
    if (profileBtn && activeProfile) {
        const spans = profileBtn.querySelectorAll("span");
        if (spans.length > 1) spans[1].textContent = activeProfile.name;
    }
}

// =============================================
// TEMA YÖNETİMİ
// =============================================
function applyTheme(themeName) {
    document.body.setAttribute("data-theme", themeName);
    kokpitData.activeTheme = themeName;
    document.querySelectorAll(".theme-option").forEach(opt => {
        opt.classList.toggle("active", opt.dataset.theme === themeName);
    });
}

function updateThemeUI() { applyTheme(kokpitData.activeTheme || 'dark'); }

function openThemeModal() {
    sounds.playHologram();
    updateBgOptionUI();
    document.getElementById("themeModal").style.display = "flex";
}

function closeThemeModal() {
    sounds.playCancel();
    document.getElementById("themeModal").style.display = "none";
}

// =============================================
// v2.0: ANİMASYONLU ARKA PLAN
// =============================================
let bgAnimFrame = null;
let bgCanvas = null;
let bgCtx = null;

function initBgCanvas() {
    bgCanvas = document.getElementById('bg-canvas');
    if (!bgCanvas) return false;
    bgCtx = bgCanvas.getContext('2d');
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
    window.addEventListener('resize', () => {
        if (!bgCanvas) return;
        bgCanvas.width = window.innerWidth;
        bgCanvas.height = window.innerHeight;
    });
    return true;
}

function stopBgAnimation() {
    if (bgAnimFrame) { cancelAnimationFrame(bgAnimFrame); bgAnimFrame = null; }
    if (bgCtx && bgCanvas) bgCtx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
}

function setBackground(type) {
    stopBgAnimation();
    kokpitData.background = type;
    if (type === 'none') { updateBgOptionUI(); return; }
    if (!bgCanvas) { if (!initBgCanvas()) return; }
    if (type === 'particles') startParticles();
    else if (type === 'matrix') startMatrix();
    else if (type === 'stars') startStars();
    updateBgOptionUI();
}

function updateBgOptionUI() {
    document.querySelectorAll(".bg-option").forEach(opt => {
        opt.classList.toggle("active", opt.dataset.bg === (kokpitData.background || 'none'));
    });
}

// Parçacık Sistemi
function startParticles() {
    const W = () => bgCanvas.width, H = () => bgCanvas.height;
    const particles = Array.from({ length: 70 }, () => ({
        x: Math.random() * W(), y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5
    }));

    function draw() {
        bgCtx.clearRect(0, 0, W(), H());
        particles.forEach((p, i) => {
            particles.slice(i + 1).forEach(q => {
                const dx = p.x - q.x, dy = p.y - q.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130) {
                    bgCtx.beginPath();
                    bgCtx.strokeStyle = `rgba(138,180,248,${0.12 * (1 - dist / 130)})`;
                    bgCtx.lineWidth = 0.5;
                    bgCtx.moveTo(p.x, p.y); bgCtx.lineTo(q.x, q.y);
                    bgCtx.stroke();
                }
            });
            bgCtx.beginPath();
            bgCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            bgCtx.fillStyle = 'rgba(138,180,248,0.5)';
            bgCtx.fill();
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > W()) p.vx *= -1;
            if (p.y < 0 || p.y > H()) p.vy *= -1;
        });
        bgAnimFrame = requestAnimationFrame(draw);
    }
    draw();
}

// Matrix Yağmuru
function startMatrix() {
    const cols = () => Math.floor(bgCanvas.width / 18);
    let drops = Array(cols()).fill(1);
    const chars = 'アイウエオカキクケコ0123456789ABCDEF';

    function draw() {
        bgCtx.fillStyle = 'rgba(0,0,0,0.04)';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        bgCtx.font = '13px monospace';
        const c = cols();
        if (drops.length !== c) drops = Array(c).fill(1);
        drops.forEach((y, i) => {
            const char = chars[Math.floor(Math.random() * chars.length)];
            const alpha = Math.random() * 0.4 + 0.15;
            bgCtx.fillStyle = `rgba(0,255,65,${alpha})`;
            bgCtx.fillText(char, i * 18, y * 18);
            if (y * 18 > bgCanvas.height && Math.random() > 0.975) drops[i] = 0;
            drops[i]++;
        });
        bgAnimFrame = requestAnimationFrame(draw);
    }
    draw();
}

// Yıldız Alanı
function startStars() {
    const stars = Array.from({ length: 180 }, () => ({
        x: Math.random() * bgCanvas.width, y: Math.random() * bgCanvas.height,
        z: Math.random() * bgCanvas.width, pz: bgCanvas.width
    }));

    function draw() {
        bgCtx.fillStyle = 'rgba(0,0,0,0.08)';
        bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
        const cx = bgCanvas.width / 2, cy = bgCanvas.height / 2;
        stars.forEach(s => {
            s.pz = s.z; s.z -= 2;
            if (s.z <= 0) {
                s.x = Math.random() * bgCanvas.width; s.y = Math.random() * bgCanvas.height;
                s.z = bgCanvas.width; s.pz = s.z;
            }
            const sx = (s.x - cx) * (bgCanvas.width / s.z) + cx;
            const sy = (s.y - cy) * (bgCanvas.width / s.z) + cy;
            const spx = (s.x - cx) * (bgCanvas.width / s.pz) + cx;
            const spy = (s.y - cy) * (bgCanvas.width / s.pz) + cy;
            const size = (1 - s.z / bgCanvas.width) * 2.5;
            const alpha = 1 - s.z / bgCanvas.width;
            bgCtx.beginPath();
            bgCtx.strokeStyle = `rgba(255,255,255,${alpha})`;
            bgCtx.lineWidth = size;
            bgCtx.moveTo(spx, spy); bgCtx.lineTo(sx, sy);
            bgCtx.stroke();
        });
        bgAnimFrame = requestAnimationFrame(draw);
    }
    draw();
}

// =============================================
// v2.0: KRİPTO / BORSA WİDGET
// =============================================
let cryptoCacheData = null;
let cryptoCacheTime = 0;
const CRYPTO_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

async function fetchCryptoPrices(forceRefresh = false) {
    const cfg = kokpitData.widgets.crypto;
    if (!cfg.enabled) return;

    const now = Date.now();
    if (!forceRefresh && cryptoCacheData && (now - cryptoCacheTime < CRYPTO_CACHE_TTL)) {
        renderCryptoWidget(cryptoCacheData);
        return;
    }

    const body = document.getElementById('crypto-body');
    if (body) body.innerHTML = '<div class="widget-loading">⏳ Güncelleniyor...</div>';

    const coins = cfg.coins || 'bitcoin,ethereum,solana';
    const currency = cfg.currency || 'usd';
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=${currency}&include_24hr_change=true`;

    try {
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('API hatası');
        const data = await resp.json();
        cryptoCacheData = { data, currency };
        cryptoCacheTime = Date.now();
        renderCryptoWidget(cryptoCacheData);
    } catch(e) {
        if (body) body.innerHTML = `<div class="widget-error">⚠️ Veri alınamadı<br><small>${e.message}</small></div>`;
    }
}

const CURRENCY_SYMBOLS = { usd: '$', try: '₺', eur: '€', btc: '₿' };

function formatPrice(price, currency) {
    const sym = CURRENCY_SYMBOLS[currency] || currency.toUpperCase();
    if (price >= 1000) return sym + price.toLocaleString('tr-TR', { maximumFractionDigits: 0 });
    if (price >= 1) return sym + price.toLocaleString('tr-TR', { maximumFractionDigits: 2 });
    return sym + price.toLocaleString('tr-TR', { maximumFractionDigits: 6 });
}

const COIN_TICKERS = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', binancecoin: 'BNB',
    ripple: 'XRP', cardano: 'ADA', dogecoin: 'DOGE', polkadot: 'DOT',
    avalanche: 'AVAX', chainlink: 'LINK', litecoin: 'LTC', uniswap: 'UNI'
};

function renderCryptoWidget({ data, currency }) {
    const body = document.getElementById('crypto-body');
    if (!body) return;
    body.innerHTML = '';

    Object.entries(data).forEach(([coinId, prices]) => {
        const price = prices[currency];
        const change = prices[`${currency}_24h_change`];
        if (price === undefined) return;

        const item = document.createElement('div');
        item.className = 'crypto-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'crypto-name';
        nameSpan.textContent = COIN_TICKERS[coinId] || coinId.substring(0, 5).toUpperCase();
        item.appendChild(nameSpan);

        const priceSpan = document.createElement('span');
        priceSpan.className = 'crypto-price';
        priceSpan.textContent = formatPrice(price, currency);
        item.appendChild(priceSpan);

        const changeSpan = document.createElement('span');
        changeSpan.className = 'crypto-change ' + (change >= 0 ? 'up' : 'down');
        changeSpan.textContent = (change >= 0 ? '▲' : '▼') + ' ' + Math.abs(change).toFixed(2) + '%';
        item.appendChild(changeSpan);

        body.appendChild(item);
    });

    if (body.children.length === 0) {
        body.innerHTML = '<div class="widget-error">Veri bulunamadı. Coin ID\'lerini kontrol edin.</div>';
    }
}

// =============================================
// v2.0: RSS / HABER WİDGET
// =============================================
let rssCacheData = null;
let rssCacheTime = 0;
const RSS_CACHE_TTL = 10 * 60 * 1000; // 10 dakika

async function fetchRSSFeeds(forceRefresh = false) {
    const cfg = kokpitData.widgets.rss;
    if (!cfg.enabled) return;

    const now = Date.now();
    if (!forceRefresh && rssCacheData && (now - rssCacheTime < RSS_CACHE_TTL)) {
        renderRSSWidget(rssCacheData);
        return;
    }

    const body = document.getElementById('rss-body');
    if (body) body.innerHTML = '<div class="widget-loading">⏳ Haberler yükleniyor...</div>';

    const feedUrls = (cfg.feeds || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (feedUrls.length === 0) {
        if (body) body.innerHTML = '<div class="widget-error">RSS feed URL\'si girilmedi.</div>';
        return;
    }

    const count = parseInt(cfg.count) || 10;
    const allItems = [];

    for (const feedUrl of feedUrls.slice(0, 3)) { // max 3 feed
        try {
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(feedUrl)}`;
            const resp = await fetch(proxyUrl);
            const json = await resp.json();
            const xml = new DOMParser().parseFromString(json.contents, 'text/xml');
            const items = xml.querySelectorAll('item');
            const source = xml.querySelector('channel > title')?.textContent || new URL(feedUrl).hostname;

            items.forEach(item => {
                const title = item.querySelector('title')?.textContent?.trim();
                const link = item.querySelector('link')?.textContent?.trim() || 
                             item.querySelector('guid')?.textContent?.trim();
                if (title && link) allItems.push({ title, link, source });
            });
        } catch(e) {
            console.warn('RSS fetch error:', feedUrl, e.message);
        }
    }

    rssCacheData = { items: allItems.slice(0, count) };
    rssCacheTime = Date.now();
    renderRSSWidget(rssCacheData);
}

function renderRSSWidget({ items }) {
    const body = document.getElementById('rss-body');
    if (!body) return;
    body.innerHTML = '';

    if (!items || items.length === 0) {
        body.innerHTML = '<div class="widget-error">Haber bulunamadı veya feed erişilemiyor.</div>';
        return;
    }

    items.forEach(({ title, link, source }) => {
        const a = document.createElement('a');
        a.className = 'rss-item';
        a.href = link;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';

        const dot = document.createElement('span');
        dot.className = 'rss-dot';
        dot.textContent = '●';
        a.appendChild(dot);

        const titleSpan = document.createElement('span');
        titleSpan.className = 'rss-title';
        titleSpan.textContent = title;
        a.appendChild(titleSpan);

        const sourceSpan = document.createElement('span');
        sourceSpan.className = 'rss-source';
        sourceSpan.textContent = source;
        a.appendChild(sourceSpan);

        body.appendChild(a);
    });
}

function initWidgets() {
    updateWidgetVisibility();
    if (kokpitData.widgets.crypto.enabled) fetchCryptoPrices();
    if (kokpitData.widgets.rss.enabled) fetchRSSFeeds();
}

function updateWidgetVisibility() {
    const strip = document.getElementById('widget-strip');
    const cryptoCard = document.getElementById('crypto-widget');
    const rssCard = document.getElementById('rss-widget');
    if (!strip) return;

    const cfg = kokpitData.widgets;
    const cryptoOn = cfg.crypto && cfg.crypto.enabled;
    const rssOn = cfg.rss && cfg.rss.enabled;

    if (cryptoCard) cryptoCard.style.display = cryptoOn ? '' : 'none';
    if (rssCard) rssCard.style.display = rssOn ? '' : 'none';
    strip.style.display = (cryptoOn || rssOn) ? '' : 'none';
}

// Widget Ayarları Modal
function openWidgetSettingsModal() {
    sounds.playHologram();
    const cfg = kokpitData.widgets;
    const el = (id) => document.getElementById(id);

    el('cryptoEnabled').checked = cfg.crypto.enabled;
    el('cryptoCurrency').value = cfg.crypto.currency || 'usd';
    el('cryptoCoins').value = cfg.crypto.coins || 'bitcoin,ethereum,solana';
    el('rssEnabled').checked = cfg.rss.enabled;
    el('rssFeeds').value = cfg.rss.feeds || '';
    el('rssCount').value = cfg.rss.count || 10;

    // İlk sekmeyi aktif yap
    switchWsTab('crypto');
    el('widgetSettingsModal').style.display = 'flex';
}

function closeWidgetSettingsModal() {
    sounds.playCancel();
    document.getElementById('widgetSettingsModal').style.display = 'none';
}

function saveWidgetSettings() {
    const el = (id) => document.getElementById(id);
    kokpitData.widgets.crypto.enabled = el('cryptoEnabled').checked;
    kokpitData.widgets.crypto.currency = el('cryptoCurrency').value;
    kokpitData.widgets.crypto.coins = el('cryptoCoins').value.trim();
    kokpitData.widgets.rss.enabled = el('rssEnabled').checked;
    kokpitData.widgets.rss.feeds = el('rssFeeds').value.trim();
    kokpitData.widgets.rss.count = parseInt(el('rssCount').value);
    sounds.playSave();
    saveData();

    // Önbellekleri temizle ve yeniden çek
    cryptoCacheData = null; rssCacheData = null;
    closeWidgetSettingsModal();
    initWidgets();
}

function switchWsTab(tab) {
    document.querySelectorAll('.ws-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('ws-tab-crypto').style.display = tab === 'crypto' ? '' : 'none';
    document.getElementById('ws-tab-rss').style.display = tab === 'rss' ? '' : 'none';
}

// =============================================
// AuthUser & Profil
// =============================================
function updateAuthSectionUI() {
    const section = document.querySelector(".auth-section");
    const toggle = document.getElementById("toggleAuthSection");
    if (section && toggle) {
        if (kokpitData.authSectionCollapsed) {
            section.classList.add("collapsed");
            section.style.height = "";
            section.style.flex = "";
            toggle.textContent = "📁";
        } else {
            section.classList.remove("collapsed");
            toggle.textContent = "📂";
        }
    }
}

function renderProfileList() {
    const list = document.getElementById("profile-list");
    list.innerHTML = "";
    kokpitData.profiles.forEach(profile => {
        const item = document.createElement("div");
        item.className = "profile-list-item";
        if (profile.name === kokpitData.currentProfileName) item.classList.add("active");

        const nameSpan = document.createElement("span");
        nameSpan.textContent = profile.name + " ";
        if (profile.authUserEmail) {
            const small = document.createElement("small");
            small.style.cssText = "color:#888; font-size: 0.8em; margin-left: 5px;";
            small.textContent = `(${profile.authUserEmail})`;
            nameSpan.appendChild(small);
        }
        item.appendChild(nameSpan);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "profile-actions";

        const renameBtn = document.createElement("button");
        renameBtn.innerHTML = "✏️";
        renameBtn.title = "Profili Düzenle";
        renameBtn.addEventListener("click", (e) => { e.stopPropagation(); openEditProfileModal(profile.name); });
        actionsDiv.appendChild(renameBtn);

        if (profile.name !== kokpitData.currentProfileName) {
            item.addEventListener("click", () => switchProfile(profile.name));
            const deleteBtn = document.createElement("button");
            deleteBtn.innerHTML = "🗑️";
            deleteBtn.title = "Profili Sil";
            deleteBtn.addEventListener("click", (e) => { e.stopPropagation(); deleteProfile(profile.name); });
            actionsDiv.appendChild(deleteBtn);
        }

        item.appendChild(actionsDiv);
        list.appendChild(item);
    });
}

let profileBeingEdited = null;

function openEditProfileModal(profileName) {
    sounds.playHologram();
    const profile = kokpitData.profiles.find(p => p.name === profileName);
    if (!profile) return;
    profileBeingEdited = profileName;
    document.getElementById("editProfileName").value = profile.name;
    document.getElementById("editProfileAuthNo").value = profile.authUserNo !== undefined ? profile.authUserNo : "";
    document.getElementById("editProfileAuthEmail").value = profile.authUserEmail || "";
    document.getElementById("editProfileModal").style.display = "flex";
}

function closeEditProfileModal() {
    sounds.playCancel();
    document.getElementById("editProfileModal").style.display = "none";
    profileBeingEdited = null;
}

function saveProfileEdit() {
    if (!profileBeingEdited) return;
    const newName = document.getElementById("editProfileName").value.trim();
    const newAuthNo = document.getElementById("editProfileAuthNo").value.trim();
    const newAuthEmail = document.getElementById("editProfileAuthEmail").value.trim();
    if (!newName) { alert("Profil adı boş olamaz."); return; }
    if (newName !== profileBeingEdited && kokpitData.profiles.some(p => p.name === newName)) { alert("Bu isimde profil var."); return; }
    sounds.playSave();
    const profile = kokpitData.profiles.find(p => p.name === profileBeingEdited);
    if (profile) { profile.name = newName; profile.authUserNo = newAuthNo; profile.authUserEmail = newAuthEmail; }
    if (kokpitData.currentProfileName === profileBeingEdited) kokpitData.currentProfileName = newName;
    saveData();
    renderProfileList();
    closeEditProfileModal();
}

function switchProfile(profileName) {
    sounds.playClick();
    kokpitData.currentProfileName = profileName;
    saveData();
    closeProfileModal();
}

function addProfile() {
    const input = document.getElementById("newProfileName");
    const newName = input.value.trim();
    if (!newName) { alert("Lütfen bir profil adı girin."); return; }
    if (kokpitData.profiles.some(p => p.name === newName)) { alert("Bu isimde profil var."); return; }
    kokpitData.profiles.push({ name: newName, authUserNo: "", authUserEmail: "", sidebar: [], shortcuts: [], notes: [] });
    input.value = "";
    renderProfileList();
    saveData();
}

function deleteProfile(profileName) {
    if (kokpitData.profiles.length <= 1) { alert("Son profili silemezsiniz!"); return; }
    if (confirm(`"${profileName}" profilini silmek istediğinizden emin misiniz?`)) {
        sounds.playDelete();
        kokpitData.profiles = kokpitData.profiles.filter(p => p.name !== profileName);
        renderProfileList();
        saveData();
    }
}

function openProfileModal() {
    sounds.playHologram();
    renderProfileList();
    document.getElementById("profileModal").style.display = "flex";
}

function closeProfileModal() {
    sounds.playCancel();
    document.getElementById("profileModal").style.display = "none";
}

let currentEditAuthUserIndex = -1;

function renderAuthUsers() {
    const container = document.getElementById("authuser-items");
    container.innerHTML = "";

    const disableBtn = document.getElementById("btnDisableAuthUser");
    if (disableBtn) {
        disableBtn.style.color = kokpitData.globalActiveAuthNo === null ? "#8ab4f8" : "";
        disableBtn.style.fontWeight = kokpitData.globalActiveAuthNo === null ? "bold" : "";
    }

    kokpitData.authUsers.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "auth-item" + (kokpitData.globalActiveAuthNo === item.no ? " active" : "");

        const labelDiv = document.createElement("div");
        labelDiv.className = "auth-label";
        const bubble = document.createElement("div");
        bubble.className = "auth-no-bubble";
        bubble.textContent = item.no;
        labelDiv.appendChild(bubble);
        labelDiv.append(document.createTextNode(item.label || 'İsimsiz'));
        div.appendChild(labelDiv);

        div.addEventListener("click", () => { sounds.playClick(); kokpitData.globalActiveAuthNo = item.no; saveData(); });

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn-auth";
        editBtn.innerText = "✏️";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openAuthUserModal(index); });
        div.appendChild(editBtn);
        container.appendChild(div);
    });
}

function openAuthUserModal(index) {
    sounds.playHologram();
    currentEditAuthUserIndex = index;
    document.getElementById("authUserModal").style.display = "flex";
    if (index === -1) {
        document.getElementById("authUserModalTitle").innerText = "Hesap Ekle";
        document.getElementById("authObjNo").value = "";
        document.getElementById("authObjLabel").value = "";
        document.getElementById("btnDeleteAuthUser").style.display = "none";
    } else {
        document.getElementById("authUserModalTitle").innerText = "Hesabı Düzenle";
        document.getElementById("authObjNo").value = kokpitData.authUsers[index].no;
        document.getElementById("authObjLabel").value = kokpitData.authUsers[index].label;
        document.getElementById("btnDeleteAuthUser").style.display = "block";
    }
}

function closeAuthUserModal() { sounds.playCancel(); document.getElementById("authUserModal").style.display = "none"; }

function saveAuthUser() {
    const no = document.getElementById("authObjNo").value.trim();
    const label = document.getElementById("authObjLabel").value.trim();
    if (!no) { alert("Lütfen hesap numarası girin."); return; }
    if (currentEditAuthUserIndex === -1) {
        if (kokpitData.authUsers.some(a => a.no === no)) { alert("Bu numaraya ait hesap var."); return; }
        sounds.playSave();
        kokpitData.authUsers.push({ no, label });
        kokpitData.globalActiveAuthNo = no;
    } else {
        const oldNo = kokpitData.authUsers[currentEditAuthUserIndex].no;
        if (oldNo !== no && kokpitData.authUsers.some(a => a.no === no)) { alert("Bu numaraya ait hesap var."); return; }
        sounds.playSave();
        kokpitData.authUsers[currentEditAuthUserIndex] = { no, label };
        if (kokpitData.globalActiveAuthNo === oldNo) kokpitData.globalActiveAuthNo = no;
    }
    saveData();
    closeAuthUserModal();
}

function deleteAuthUser() {
    if (!confirm("Bu hesabı silmek istediğinize emin misiniz?")) return;
    sounds.playDelete();
    const oldNo = kokpitData.authUsers[currentEditAuthUserIndex].no;
    kokpitData.authUsers.splice(currentEditAuthUserIndex, 1);
    if (kokpitData.globalActiveAuthNo === oldNo) kokpitData.globalActiveAuthNo = null;
    saveData();
    closeAuthUserModal();
}

// =============================================
// AĞAÇ YAPISI YARDIMCILARI
// =============================================
function getParentArrayAndIndexPairs(pathStr, rootArray) {
    if (typeof pathStr === 'number' || !String(pathStr).includes('-')) return { array: rootArray, index: parseInt(pathStr) };
    const indices = String(pathStr).split('-').map(Number);
    let currentArray = rootArray;
    for (let i = 0; i < indices.length - 1; i++) {
        if (!currentArray[indices[i]].children) currentArray[indices[i]].children = [];
        currentArray = currentArray[indices[i]].children;
    }
    return { array: currentArray, index: indices[indices.length - 1] };
}

function addDragAndDropHandlers(div, type, pathStr, isFolder) {
    div.draggable = true;

    div.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        dragType = type; dragIndex = String(pathStr);
        setTimeout(() => div.classList.add("dragging"), 0);
    });

    div.addEventListener("dragenter", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (dragType === type && dragIndex !== String(pathStr)) {
            if (type === 'sidebar' && String(pathStr).startsWith(dragIndex + "-")) return;
            div.classList.add("drag-over");
        }
    });

    div.addEventListener("dragover", (e) => { e.preventDefault(); e.stopPropagation(); });
    div.addEventListener("dragleave", (e) => { e.stopPropagation(); div.classList.remove("drag-over"); });

    div.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation();
        div.classList.remove("drag-over");
        if (dragType === type && dragIndex !== null && dragIndex !== String(pathStr)) {
            if (type === 'sidebar' && String(pathStr).startsWith(dragIndex + "-")) { alert("Klasörü kendi içine taşıyamazsınız!"); return; }
            const ap = getActiveProfile(); if (!ap) return;
            const rootArray = type === 'sidebar' ? ap.sidebar : ap.shortcuts;
            const sourceInfo = getParentArrayAndIndexPairs(dragIndex, rootArray);
            let targetInfo = getParentArrayAndIndexPairs(pathStr, rootArray);
            const draggedItem = sourceInfo.array[sourceInfo.index];
            if (type === 'sidebar' && isFolder && targetInfo.array[targetInfo.index].type === 'folder') {
                const targetDepth = String(pathStr).split('-').length;
                if (targetDepth >= 3 && draggedItem.type === 'folder') { alert("Klasör derinliği en fazla 3 kademe!"); return; }
                sourceInfo.array.splice(sourceInfo.index, 1);
                const tFolder = getParentArrayAndIndexPairs(pathStr, rootArray);
                if (!tFolder.array[tFolder.index].children) tFolder.array[tFolder.index].children = [];
                tFolder.array[tFolder.index].children.push(draggedItem);
                kokpitData[`folder_${pathStr}_open`] = true;
            } else {
                sourceInfo.array.splice(sourceInfo.index, 1);
                targetInfo = getParentArrayAndIndexPairs(pathStr, rootArray);
                targetInfo.array.splice(targetInfo.index, 0, draggedItem);
            }
            saveData();
        }
    });

    div.addEventListener("dragend", (e) => { e.stopPropagation(); div.classList.remove("dragging"); dragType = null; dragIndex = null; });
}

// =============================================
// SIDEBAR RENDER
// =============================================
function renderSidebar() {
    const container = document.getElementById("sidebar-items");
    container.innerHTML = "";
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;

    function buildNode(item, pathStr, depth, parentContainer) {
        const div = document.createElement("div");

        if (item.type === 'splitter') {
            div.className = "sidebar-splitter";
            addDragAndDropHandlers(div, 'sidebar', pathStr, false);
            const wrapper = document.createElement("div");
            wrapper.style.position = "relative";
            const editBtn = document.createElement("button");
            editBtn.className = "edit-btn"; editBtn.innerText = "⋮";
            editBtn.style.top = "-12px"; editBtn.style.right = "5px";
            editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('sidebar', pathStr); });
            wrapper.appendChild(div); wrapper.appendChild(editBtn);
            wrapper.addEventListener("mouseenter", () => editBtn.style.display = "flex");
            wrapper.addEventListener("mouseleave", () => editBtn.style.display = "none");
            parentContainer.appendChild(wrapper);
            return;
        }

        div.className = "sidebar-item folder-depth-" + Math.min(depth, 3);
        if (item.type === 'folder') div.classList.add("sidebar-folder");
        else div.style.cursor = "pointer";

        div.addEventListener('mouseenter', () => sounds.playBeep());

        const infoDiv = document.createElement("div");
        infoDiv.style.cssText = "display:flex; align-items:center; gap:12px; pointer-events: none; width: 85%;";

        if (item.type === 'folder') {
            const icon = document.createElement("span");
            icon.className = "folder-icon";
            icon.textContent = kokpitData[`folder_${pathStr}_open`] ? "📂" : "📁";
            infoDiv.appendChild(icon);
        } else if (item.customIcon) {
            // v2.0: Özel emoji ikon
            const emojiSpan = document.createElement("span");
            emojiSpan.className = "sidebar-emoji-icon";
            emojiSpan.textContent = item.customIcon;
            infoDiv.appendChild(emojiSpan);
        } else {
            const img = document.createElement("img");
            setupFaviconImg(img, item.url, 20);
            img.style.pointerEvents = "none";
            infoDiv.appendChild(img);
        }

        const nameText = document.createElement("span");
        nameText.style.cssText = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
        nameText.textContent = item.name;
        infoDiv.appendChild(nameText);
        div.appendChild(infoDiv);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn"; editBtn.innerText = "⋮";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('sidebar', pathStr); });
        div.appendChild(editBtn);

        addDragAndDropHandlers(div, 'sidebar', pathStr, item.type === 'folder');

        if (item.type === 'folder') {
            const contentDiv = document.createElement("div");
            contentDiv.className = "folder-content";
            const stateKey = `folder_${pathStr}_open`;
            if (kokpitData[stateKey]) { div.classList.add("open"); contentDiv.classList.add("open"); }
            div.addEventListener("click", (e) => {
                sounds.playClick();
                if (e.target === editBtn) return;
                div.classList.toggle("open"); contentDiv.classList.toggle("open");
                kokpitData[stateKey] = div.classList.contains("open");
                const icon = div.querySelector(".folder-icon");
                if (icon) icon.textContent = kokpitData[stateKey] ? "📂" : "📁";
            });
            parentContainer.appendChild(div);
            if (item.children) item.children.forEach((child, i) => buildNode(child, pathStr + "-" + i, depth + 1, contentDiv));
            parentContainer.appendChild(contentDiv);
        } else {
            div.addEventListener("click", (e) => {
                sounds.playClick();
                if (e.target === editBtn) return;
                const finalUrl = modifyUrlWithAuthUser(item.url);
                if (e.ctrlKey || e.metaKey) window.open(finalUrl, '_blank');
                else window.location.href = finalUrl;
            });
            div.addEventListener("auxclick", (e) => { sounds.playClick(); if (e.button === 1) window.open(modifyUrlWithAuthUser(item.url), '_blank'); });
            parentContainer.appendChild(div);
        }
    }

    if (activeProfile.sidebar) activeProfile.sidebar.forEach((item, i) => buildNode(item, i.toString(), 0, container));
}

// =============================================
// GRID RENDER
// =============================================
function renderGrid() {
    const container = document.getElementById("grid-container");
    container.innerHTML = "";
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;

    activeProfile.shortcuts.forEach((item, index) => {
        const div = document.createElement("div");
        div.className = "shortcut";

        div.addEventListener("click", (e) => {
            sounds.playClick();
            const finalUrl = modifyUrlWithAuthUser(item.url);
            if (e.ctrlKey || e.metaKey) window.open(finalUrl, '_blank');
            else window.location.href = finalUrl;
        });
        div.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
        div.addEventListener("auxclick", (e) => { sounds.playClick(); if (e.button === 1) window.open(modifyUrlWithAuthUser(item.url), '_blank'); });
        div.addEventListener('mouseenter', () => sounds.playBeep());

        addDragAndDropHandlers(div, 'grid', index);

        // v2.0: Özel emoji ikon veya favicon
        if (item.customIcon) {
            const emojiSpan = document.createElement("span");
            emojiSpan.className = "shortcut-emoji";
            emojiSpan.textContent = item.customIcon;
            div.appendChild(emojiSpan);
        } else {
            const img = document.createElement("img");
            img.style.pointerEvents = "none";
            setupFaviconImg(img, item.url, 56);
            img.style.width = "56px";
            img.style.height = "56px";
            div.appendChild(img);
        }

        const span = document.createElement("span");
        span.style.pointerEvents = "none";
        span.textContent = item.name;
        div.appendChild(span);

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn"; editBtn.innerText = "⋮";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('grid', index); });
        editBtn.addEventListener("auxclick", (e) => e.stopPropagation());
        editBtn.addEventListener("mousedown", (e) => e.stopPropagation());
        div.appendChild(editBtn);

        container.appendChild(div);
    });

    const addBtn = document.createElement("div");
    addBtn.className = "shortcut add-new";
    addBtn.innerHTML = `<span style="font-size: 24px; pointer-events:none">+</span><span style="pointer-events:none">Ekle</span>`;
    addBtn.addEventListener("click", () => openModal('grid', -1));
    container.appendChild(addBtn);
}

// =============================================
// DÜZENLEME MODALI
// =============================================
function openModal(type, indexOrPath) {
    sounds.playHologram();
    currentEditType = type;
    currentEditIndex = indexOrPath;

    const modal = document.getElementById("editModal");
    const title = document.getElementById("modalTitle");
    const inputName = document.getElementById("itemName");
    const inputUrl = document.getElementById("itemUrl");
    const inputIcon = document.getElementById("itemIcon");
    const btnDelete = document.getElementById("btnDelete");
    const btnCopyMove = document.getElementById("btnCopyMove");
    const typeGroup = document.getElementById("itemTypeGroup");
    const typeSelect = document.getElementById("itemType");

    if (type === 'sidebar') {
        if (typeGroup) typeGroup.style.display = "flex";
    } else {
        if (typeGroup) typeGroup.style.display = "none";
        if (typeSelect) typeSelect.value = "link";
    }

    if (indexOrPath === -1) {
        title.innerText = type === 'sidebar' ? "Yan Menüye Ekle" : "Kısayol Ekle";
        inputName.value = ""; inputUrl.value = "";
        if (inputIcon) inputIcon.value = "";
        if (typeSelect) typeSelect.value = "link";
        btnDelete.style.display = "none";
        if (btnCopyMove) btnCopyMove.style.display = "none";
    } else {
        title.innerText = "Düzenle";
        const ap = getActiveProfile(); if (!ap) return;
        const rootArray = type === 'sidebar' ? ap.sidebar : ap.shortcuts;
        const itemInfo = getParentArrayAndIndexPairs(indexOrPath, rootArray);
        const item = itemInfo.array[itemInfo.index];
        inputName.value = item.name || "";
        inputUrl.value = item.url || "";
        if (inputIcon) inputIcon.value = item.customIcon || "";
        if (typeSelect) typeSelect.value = item.type || "link";
        btnDelete.style.display = "block";
        // Kopyala/Taşı sadece mevcut öğeler için ve birden fazla profil varsa göster
        if (btnCopyMove) btnCopyMove.style.display = (kokpitData.profiles.length > 1 && type !== 'sidebar') ? "inline-flex" : "none";
    }

    if (typeSelect) typeSelect.dispatchEvent(new Event('change'));
    modal.style.display = "flex";
    if (!typeSelect || typeSelect.value !== 'splitter') inputName.focus();
}

function closeModal() {
    sounds.playCancel();
    document.getElementById("editModal").style.display = "none";
}

function saveItem() {
    const typeSelectEl = document.getElementById("itemType");
    const typeSelect = typeSelectEl ? typeSelectEl.value : 'link';
    const name = document.getElementById("itemName").value.trim();
    let url = document.getElementById("itemUrl").value.trim();
    const customIcon = document.getElementById("itemIcon")?.value.trim() || "";

    if (currentEditType === 'sidebar') {
        if (typeSelect === 'link' && (!name || !url)) { alert("Lütfen isim ve URL giriniz."); return; }
        if (typeSelect === 'folder' && !name) { alert("Lütfen klasör ismi giriniz."); return; }
    } else {
        if (!name || !url) { alert("Lütfen isim ve URL giriniz."); return; }
    }

    if (typeSelect === 'link' && url && !/^https?:\/\//i.test(url)) url = 'https://' + url;

    const ap = getActiveProfile(); if (!ap) return;
    sounds.playSave();
    const rootArray = currentEditType === 'sidebar' ? ap.sidebar : ap.shortcuts;

    const newItem = { name, url, type: currentEditType === 'sidebar' ? typeSelect : 'link' };
    if (customIcon) newItem.customIcon = customIcon;
    if (newItem.type === 'folder') newItem.children = [];
    if (newItem.type === 'splitter') { delete newItem.url; delete newItem.name; }

    if (currentEditIndex === -1) {
        rootArray.push(newItem);
    } else {
        const itemInfo = getParentArrayAndIndexPairs(currentEditIndex, rootArray);
        if (newItem.type === 'folder' && itemInfo.array[itemInfo.index].children) newItem.children = itemInfo.array[itemInfo.index].children;
        itemInfo.array[itemInfo.index] = newItem;
    }

    saveData();
    closeModal();
}

function deleteItem() {
    const ap = getActiveProfile(); if (!ap) return;
    const rootArray = currentEditType === 'sidebar' ? ap.sidebar : ap.shortcuts;
    const itemInfo = getParentArrayAndIndexPairs(currentEditIndex, rootArray);
    sounds.playDelete();
    itemInfo.array.splice(itemInfo.index, 1);
    saveData();
    closeModal();
}

// =============================================
// v2.0: PROFİLLER ARASI KOPYALA / TAŞI
// =============================================
let copyMoveAction = 'copy'; // 'copy' | 'move'

function openCopyMoveModal() {
    sounds.playHologram();
    const list = document.getElementById('copyMoveProfileList');
    list.innerHTML = '';
    const title = document.getElementById('copyMoveTitle');
    title.textContent = 'Kısayolu Kopyala / Taşı';

    kokpitData.profiles.forEach(profile => {
        if (profile.name === kokpitData.currentProfileName) return;

        const item = document.createElement('div');
        item.className = 'profile-list-item';
        item.textContent = profile.name;

        const actDiv = document.createElement('div');
        actDiv.className = 'profile-actions';
        actDiv.style.display = 'flex';
        actDiv.style.gap = '6px';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋 Kopyala';
        copyBtn.style.cssText = 'background: var(--bg-item-hover); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;';
        copyBtn.addEventListener('click', (e) => { e.stopPropagation(); executeShortcutTransfer(profile.name, 'copy'); });

        const moveBtn = document.createElement('button');
        moveBtn.textContent = '✂️ Taşı';
        moveBtn.style.cssText = 'background: var(--bg-item-hover); border: 1px solid var(--border-color); color: var(--text-main); padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 11px;';
        moveBtn.addEventListener('click', (e) => { e.stopPropagation(); executeShortcutTransfer(profile.name, 'move'); });

        actDiv.appendChild(copyBtn);
        actDiv.appendChild(moveBtn);
        item.appendChild(actDiv);
        list.appendChild(item);
    });

    if (list.children.length === 0) {
        const msg = document.createElement('p');
        msg.style.cssText = 'color: var(--text-dim); font-size: 13px; text-align: center; padding: 20px;';
        msg.textContent = 'Başka profil yok.';
        list.appendChild(msg);
    }

    document.getElementById('copyMoveModal').style.display = 'flex';
}

function closeCopyMoveModal() {
    sounds.playCancel();
    document.getElementById('copyMoveModal').style.display = 'none';
}

function executeShortcutTransfer(targetProfileName, action) {
    const sourceProfile = getActiveProfile();
    const targetProfile = kokpitData.profiles.find(p => p.name === targetProfileName);
    if (!sourceProfile || !targetProfile) return;

    const rootArray = currentEditType === 'sidebar' ? sourceProfile.sidebar : sourceProfile.shortcuts;
    const itemInfo = getParentArrayAndIndexPairs(currentEditIndex, rootArray);
    const item = JSON.parse(JSON.stringify(itemInfo.array[itemInfo.index])); // derin kopya

    const targetArray = currentEditType === 'sidebar' ? targetProfile.sidebar : targetProfile.shortcuts;
    targetArray.push(item);

    if (action === 'move') {
        itemInfo.array.splice(itemInfo.index, 1);
    }

    sounds.playSave();
    saveData();
    closeCopyMoveModal();
    closeModal();
    alert(`"${item.name}" ${action === 'copy' ? 'kopyalandı' : 'taşındı'}: ${targetProfileName}`);
}

// =============================================
// NOTLAR
// =============================================
let currentNoteIndex = -1;
let currentNoteColor = "default";
let noteSearchQuery = "";
let noteSortBy = "date";

function renderNotes() {
    const container = document.getElementById("notes-items");
    if (!container) return;
    container.innerHTML = "";

    const activeProfile = getActiveProfile();
    if (!activeProfile || !activeProfile.notes) return;

    // Arama & sıralama uygulaması
    let notes = activeProfile.notes.map((note, originalIndex) => ({ ...note, originalIndex }));

    // Arama filtresi
    if (noteSearchQuery) {
        const q = noteSearchQuery.toLowerCase();
        notes = notes.filter(n => n.text.toLowerCase().includes(q));
    }

    // Sıralama
    if (noteSortBy === 'pinned') {
        notes.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    } else if (noteSortBy === 'color') {
        const colorOrder = { default: 0, blue: 1, green: 2, yellow: 3, orange: 4, pink: 5, purple: 6 };
        notes.sort((a, b) => {
            if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            return (colorOrder[a.color] || 0) - (colorOrder[b.color] || 0);
        });
    } else {
        // date: sabitlenenler üstte, rest by date desc
        notes.sort((a, b) => {
            if (b.pinned !== a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
            return (b.id || 0) - (a.id || 0);
        });
    }

    notes.forEach((note) => {
        const originalIndex = note.originalIndex;
        const div = document.createElement("div");
        div.className = "note-item";
        if (note.color && note.color !== 'default') div.classList.add(note.color);

        const contentWrapper = document.createElement("div");
        contentWrapper.style.cssText = "display: flex; align-items: flex-start; gap: 8px; width: calc(100% - 24px);";

        const dot = document.createElement("span");
        dot.className = "note-dot";
        dot.textContent = note.pinned ? "📌" : "●";
        contentWrapper.appendChild(dot);

        const textDiv = document.createElement("div");
        textDiv.className = "note-text";

        // v2.0: Markdown render
        if (hasMarkdown(note.text)) {
            textDiv.innerHTML = parseMarkdown(note.text);
        } else {
            textDiv.textContent = note.text;
        }
        contentWrapper.appendChild(textDiv);
        div.appendChild(contentWrapper);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "note-actions";

        const editBtn = document.createElement("button");
        editBtn.className = "note-btn";
        editBtn.textContent = "✏️";
        editBtn.onclick = (e) => { e.stopPropagation(); openNoteModal(originalIndex); };
        actionsDiv.appendChild(editBtn);
        div.appendChild(actionsDiv);

        div.addEventListener("dblclick", () => openNoteModal(originalIndex));
        div.addEventListener('mouseenter', () => sounds.playBeep());
        div.addEventListener('click', () => sounds.playClick());

        container.appendChild(div);
    });

    if (notes.length === 0 && noteSearchQuery) {
        const msg = document.createElement('div');
        msg.style.cssText = 'text-align:center; color: var(--text-dim); font-size: 12px; padding: 16px;';
        msg.textContent = '🔍 Sonuç bulunamadı';
        container.appendChild(msg);
    }
}

function renderNoteList() { renderNotes(); } // alias

function openNoteModal(index) {
    sounds.playHologram();
    currentNoteIndex = index;
    const contentInput = document.getElementById("noteContent");
    const btnDelete = document.getElementById("btnDeleteNote");
    const btnPin = document.getElementById("btnPinNote");
    const title = document.getElementById("noteModalTitle");

    if (index === -1) {
        title.innerText = "Yeni Not Ekle";
        contentInput.value = "";
        currentNoteColor = "default";
        btnDelete.style.display = "none";
        if (btnPin) { btnPin.textContent = "📌 Sabitle"; btnPin.classList.remove('pinned'); }
    } else {
        title.innerText = "Notu Düzenle";
        const ap = getActiveProfile();
        contentInput.value = ap.notes[index].text;
        currentNoteColor = ap.notes[index].color || "default";
        btnDelete.style.display = "block";
        if (btnPin) {
            const pinned = ap.notes[index].pinned;
            btnPin.textContent = pinned ? "📌 Sabiti Kaldır" : "📌 Sabitle";
            btnPin.classList.toggle('pinned', !!pinned);
        }
    }

    document.querySelectorAll("#noteColorPicker .color-dot").forEach(dot => {
        dot.classList.toggle("active", dot.dataset.color === currentNoteColor);
    });

    document.getElementById("noteModal").style.display = "flex";
    contentInput.focus();
}

function closeNoteModal() {
    sounds.playCancel();
    document.getElementById("noteModal").style.display = "none";
}

function toggleNotePin() {
    const ap = getActiveProfile();
    if (!ap || currentNoteIndex === -1) return;
    ap.notes[currentNoteIndex].pinned = !ap.notes[currentNoteIndex].pinned;
    const pinned = ap.notes[currentNoteIndex].pinned;
    const btnPin = document.getElementById("btnPinNote");
    if (btnPin) {
        btnPin.textContent = pinned ? "📌 Sabiti Kaldır" : "📌 Sabitle";
        btnPin.classList.toggle('pinned', pinned);
    }
    sounds.playSave();
    saveData();
    // Modalı kapatmadan güncelle
}

function saveNote() {
    const text = document.getElementById("noteContent").value.trim();
    if (!text) { alert("Not içeriği boş olamaz."); return; }
    const ap = getActiveProfile(); if (!ap) return;
    if (!ap.notes) ap.notes = [];
    sounds.playSave();
    if (currentNoteIndex === -1) {
        ap.notes.push({ text, id: Date.now(), color: currentNoteColor, pinned: false });
    } else {
        ap.notes[currentNoteIndex].text = text;
        ap.notes[currentNoteIndex].color = currentNoteColor;
    }
    saveData();
    closeNoteModal();
}

function deleteNote() {
    if (confirm("Bu notu silmek istediğinize emin misiniz?")) {
        const ap = getActiveProfile(); if (!ap) return;
        sounds.playDelete();
        ap.notes.splice(currentNoteIndex, 1);
        saveData();
        closeNoteModal();
    }
}

// v2.0: Not dışa aktarma
function openExportNotesModal() {
    sounds.playHologram();
    document.getElementById('exportNotesModal').style.display = 'flex';
}

function closeExportNotesModal() {
    sounds.playCancel();
    document.getElementById('exportNotesModal').style.display = 'none';
}

function exportNotes(format) {
    const ap = getActiveProfile();
    if (!ap || !ap.notes || ap.notes.length === 0) { alert("Dışa aktarılacak not yok."); return; }

    let content = '';
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;

    if (format === 'md') {
        content = `# ${ap.name} — Notlar\n_Dışa aktarma tarihi: ${dateStr}_\n\n---\n\n`;
        ap.notes.forEach((note, i) => {
            const colorLabel = note.color && note.color !== 'default' ? ` [${note.color}]` : '';
            const pinLabel = note.pinned ? ' 📌' : '';
            content += `## Not ${i + 1}${colorLabel}${pinLabel}\n\n${note.text}\n\n---\n\n`;
        });
    } else {
        content = `${ap.name} — NOTLAR\nDışa aktarma tarihi: ${dateStr}\n${'='.repeat(40)}\n\n`;
        ap.notes.forEach((note, i) => {
            const pinLabel = note.pinned ? ' [SABİTLENMİŞ]' : '';
            content += `[Not ${i + 1}]${pinLabel}\n${note.text}\n\n${'-'.repeat(30)}\n\n`;
        });
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kokpit_notlar_${ap.name}_${dateStr}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
    sounds.playSave();
    closeExportNotesModal();
}

// =============================================
// YEDEKLEME
// =============================================
function exportData() {
    const now = new Date();
    const ts = `${now.getFullYear()}_${String(now.getMonth()+1).padStart(2,'0')}_${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const blob = new Blob([JSON.stringify(kokpitData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    sounds.playSave();
    const a = document.createElement("a");
    a.href = url; a.download = `kokpit_yedek_${ts}.json`; a.click();
    URL.revokeObjectURL(url);
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.profiles && data.currentProfileName) {
                Object.assign(kokpitData, data);
                saveData(); sounds.playSave();
                alert("Yedek başarıyla yüklendi!");
            } else if (data.sidebar && data.shortcuts) {
                const ap = getActiveProfile();
                if (ap) { ap.sidebar = data.sidebar; ap.shortcuts = data.shortcuts; saveData(); alert(`Eski format yüklendi: "${ap.name}" profiline uygulandı.`); }
            } else { alert("Geçersiz yedek dosyası!"); }
        } catch(err) { alert("Dosya okunamadı!"); }
        event.target.value = "";
    };
    reader.readAsText(file);
}

// =============================================
// DOMContentLoaded
// =============================================
document.addEventListener("DOMContentLoaded", () => {
    loadData();

    const leftSidebar = document.querySelector(".sidebar");
    const rightSidebar = document.querySelector(".right-sidebar");
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    const middleResizer = document.getElementById('middleResizer');
    const authSection = document.querySelector('.auth-section');

    if (kokpitData.leftSidebarWidth && leftSidebar) {
        leftSidebar.style.width = kokpitData.leftSidebarWidth + "px";
        leftSidebar.style.minWidth = kokpitData.leftSidebarWidth + "px";
    }
    if (kokpitData.rightSidebarWidth && rightSidebar) {
        rightSidebar.style.width = kokpitData.rightSidebarWidth + "px";
        rightSidebar.style.minWidth = kokpitData.rightSidebarWidth + "px";
    }
    if (kokpitData.authSectionHeight && authSection) {
        authSection.style.flex = "0 0 " + kokpitData.authSectionHeight + "px";
    }

    let isResizingLeft = false, isResizingRight = false, isResizingMiddle = false;

    if (leftResizer) leftResizer.addEventListener('mousedown', () => { isResizingLeft = true; leftResizer.classList.add('resizing'); document.body.classList.add('resizing'); });
    if (rightResizer) rightResizer.addEventListener('mousedown', () => { isResizingRight = true; rightResizer.classList.add('resizing'); document.body.classList.add('resizing'); });
    if (middleResizer) middleResizer.addEventListener('mousedown', () => { isResizingMiddle = true; middleResizer.classList.add('resizing'); document.body.classList.add('resizing-h'); });

    document.addEventListener('mousemove', (e) => {
        if (!isResizingLeft && !isResizingRight && !isResizingMiddle) return;
        if (isResizingLeft && leftSidebar) {
            let w = Math.max(150, Math.min(600, e.clientX));
            leftSidebar.style.width = w + "px"; leftSidebar.style.minWidth = w + "px";
            kokpitData.leftSidebarWidth = w;
        }
        if (isResizingRight && rightSidebar) {
            let w = Math.max(150, Math.min(600, document.body.clientWidth - e.clientX));
            rightSidebar.style.width = w + "px"; rightSidebar.style.minWidth = w + "px";
            kokpitData.rightSidebarWidth = w;
        }
        if (isResizingMiddle && authSection && rightSidebar) {
            let newH = e.clientY - rightSidebar.getBoundingClientRect().top;
            newH = Math.max(100, Math.min(rightSidebar.clientHeight - 100, newH));
            authSection.style.flex = "0 0 " + newH + "px";
            kokpitData.authSectionHeight = newH;
        }
    });

    document.addEventListener('mouseup', () => {
        if (isResizingLeft || isResizingRight || isResizingMiddle) {
            isResizingLeft = isResizingRight = isResizingMiddle = false;
            leftResizer?.classList.remove('resizing');
            rightResizer?.classList.remove('resizing');
            middleResizer?.classList.remove('resizing');
            document.body.classList.remove('resizing');
            document.body.classList.remove('resizing-h');
            saveData();
        }
    });

    document.getElementById("toggleLeftSidebar")?.addEventListener("click", () => {
        leftSidebar?.classList.toggle("hidden");
        leftResizer?.classList.toggle("hidden");
        kokpitData.leftSidebarHidden = leftSidebar?.classList.contains("hidden");
        saveData();
    });

    document.getElementById("toggleRightSidebar")?.addEventListener("click", () => {
        rightSidebar?.classList.toggle("hidden");
        rightResizer?.classList.toggle("hidden");
        kokpitData.rightSidebarHidden = rightSidebar?.classList.contains("hidden");
        saveData();
    });

    document.getElementById("btnNewIncognito")?.addEventListener("click", () => {
        if (typeof chrome !== 'undefined' && chrome.windows) chrome.windows.create({ incognito: true });
    });

    document.getElementById("btnNewPersonalTab")?.addEventListener("click", () => {
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.create({ url: "chrome://extensions/?id=fnkhlplohchiopnookamaicdfnfibakg" });
        }
    });

    // Düzenleme Modalı
    document.getElementById("addSidebarBtn")?.addEventListener("click", () => openModal('sidebar', -1));
    document.getElementById("btnDelete")?.addEventListener("click", deleteItem);
    document.getElementById("btnCancel")?.addEventListener("click", closeModal);
    document.getElementById("btnSave")?.addEventListener("click", saveItem);
    document.getElementById("btnCopyMove")?.addEventListener("click", openCopyMoveModal);

    const itemTypeSelect = document.getElementById("itemType");
    if (itemTypeSelect) {
        itemTypeSelect.addEventListener("change", (e) => {
            const type = e.target.value;
            const uG = document.getElementById("itemUrlGroup");
            const nG = document.getElementById("itemNameGroup");
            const iG = document.getElementById("itemIconGroup");
            if (type === 'splitter') {
                if (uG) uG.style.display = 'none';
                if (nG) nG.style.display = 'none';
                if (iG) iG.style.display = 'none';
            } else if (type === 'folder') {
                if (uG) uG.style.display = 'none';
                if (nG) nG.style.display = 'flex';
                if (iG) iG.style.display = 'none'; // klasörler için emoji gereksiz
            } else {
                if (uG) uG.style.display = 'flex';
                if (nG) nG.style.display = 'flex';
                if (iG) iG.style.display = 'flex';
            }
        });
    }

    document.getElementById("itemUrl")?.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); saveItem(); } });
    document.getElementById("itemName")?.addEventListener("keypress", (e) => { if (e.key === "Enter") { e.preventDefault(); saveItem(); } });

    // Notlar
    document.getElementById("addNoteBtn")?.addEventListener("click", () => openNoteModal(-1));
    document.getElementById("btnCancelNote")?.addEventListener("click", closeNoteModal);
    document.getElementById("btnSaveNote")?.addEventListener("click", saveNote);
    document.getElementById("btnDeleteNote")?.addEventListener("click", deleteNote);
    document.getElementById("btnPinNote")?.addEventListener("click", toggleNotePin);
    document.getElementById("btnExportNotes")?.addEventListener("click", openExportNotesModal);
    document.getElementById("btnCloseExportNotes")?.addEventListener("click", closeExportNotesModal);
    document.getElementById("btnExportTxt")?.addEventListener("click", () => exportNotes('txt'));
    document.getElementById("btnExportMd")?.addEventListener("click", () => exportNotes('md'));

    // Not arama
    const noteSearch = document.getElementById("noteSearch");
    if (noteSearch) {
        noteSearch.addEventListener("input", (e) => {
            noteSearchQuery = e.target.value.trim();
            renderNotes();
        });
    }

    // Not sıralama
    const noteSort = document.getElementById("noteSort");
    if (noteSort) {
        noteSort.addEventListener("change", (e) => {
            noteSortBy = e.target.value;
            renderNotes();
        });
    }

    // Renk Seçer
    document.querySelectorAll("#noteColorPicker .color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            document.querySelectorAll("#noteColorPicker .color-dot").forEach(d => d.classList.remove("active"));
            dot.classList.add("active");
            currentNoteColor = dot.dataset.color;
        });
    });

    // Tema & Arka Plan
    document.getElementById("btnTheme")?.addEventListener("click", openThemeModal);
    document.getElementById("btnCloseThemeModal")?.addEventListener("click", closeThemeModal);

    document.querySelectorAll(".theme-option").forEach(option => {
        option.addEventListener("click", () => { applyTheme(option.dataset.theme); saveData(); });
    });

    document.querySelectorAll(".bg-option").forEach(option => {
        option.addEventListener("click", () => {
            setBackground(option.dataset.bg);
            saveData();
        });
    });

    // Widget Ayarları
    document.getElementById("btnWidgets")?.addEventListener("click", openWidgetSettingsModal);
    document.getElementById("btnCloseWidgetSettings")?.addEventListener("click", closeWidgetSettingsModal);
    document.getElementById("btnSaveWidgetSettings")?.addEventListener("click", saveWidgetSettings);
    document.getElementById("cryptoRefreshBtn")?.addEventListener("click", () => fetchCryptoPrices(true));
    document.getElementById("rssRefreshBtn")?.addEventListener("click", () => fetchRSSFeeds(true));

    // Widget sekme geçişi
    document.querySelectorAll(".ws-tab").forEach(tab => {
        tab.addEventListener("click", () => switchWsTab(tab.dataset.tab));
    });

    // Kopyala/Taşı Modal
    document.getElementById("btnCloseCopyMove")?.addEventListener("click", closeCopyMoveModal);

    // Profil
    document.getElementById("profileBtn")?.addEventListener("click", openProfileModal);
    document.getElementById("btnCloseProfileModal")?.addEventListener("click", closeProfileModal);
    document.getElementById("btnAddProfile")?.addEventListener("click", addProfile);
    document.getElementById("btnCancelEditProfile")?.addEventListener("click", closeEditProfileModal);
    document.getElementById("btnSaveEditProfile")?.addEventListener("click", saveProfileEdit);

    // AuthUser
    document.getElementById("addAuthUserBtn")?.addEventListener("click", () => openAuthUserModal(-1));
    document.getElementById("btnCancelAuthUser")?.addEventListener("click", closeAuthUserModal);
    document.getElementById("btnSaveAuthUser")?.addEventListener("click", saveAuthUser);
    document.getElementById("btnDeleteAuthUser")?.addEventListener("click", deleteAuthUser);

    document.getElementById("toggleAuthSection")?.addEventListener("click", () => {
        kokpitData.authSectionCollapsed = !kokpitData.authSectionCollapsed;
        updateAuthSectionUI();
        saveData();
    });

    document.getElementById("btnDisableAuthUser")?.addEventListener("click", () => {
        kokpitData.globalActiveAuthNo = null;
        saveData();
    });

    // Ses
    document.getElementById("btnSound")?.addEventListener("click", toggleSound);

    // Dışa/İçe Aktar
    document.getElementById("btnExport")?.addEventListener("click", exportData);
    document.getElementById("btnImport")?.addEventListener("click", () => document.getElementById("importFile")?.click());
    document.getElementById("importFile")?.addEventListener("change", importData);

    // Başlangıç
    updateThemeUI();
    updateAuthSectionUI();
    updateSoundUI();
    updateBgOptionUI();
    renderSidebar();
    renderGrid();
    renderNoteList();
});

// Modal dışına tıklama ile kapat
window.addEventListener("click", (event) => {
    const modals = [
        ["editModal", closeModal],
        ["profileModal", closeProfileModal],
        ["editProfileModal", closeEditProfileModal],
        ["authUserModal", closeAuthUserModal],
        ["themeModal", closeThemeModal],
        ["widgetSettingsModal", closeWidgetSettingsModal],
        ["copyMoveModal", closeCopyMoveModal],
        ["exportNotesModal", closeExportNotesModal],
    ];
    modals.forEach(([id, fn]) => {
        const modal = document.getElementById(id);
        if (event.target === modal) fn();
    });
});
