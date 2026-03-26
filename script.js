const isFirefox = () => typeof browser !== 'undefined';

const kokpitData = {
    currentProfileName: "Varsayılan",
    activeTheme: "dark", // v1.1 Yeni Özellik: Tema Desteği
    profiles: [
        {
            name: "Varsayılan",
            sidebar: [
                { name: "Gmail", url: "https://mail.google.com" },
                { name: "Google Drive", url: "https://drive.google.com" }
            ],
            shortcuts: [
                { name: "GitHub", url: "https://github.com" },
                { name: "Stack Overflow", url: "https://stackoverflow.com" },
                { name: "ChatGPT", url: "https://chat.openai.com" }
            ]
        }
    ]
};

// Aktif profilin verilerine kolayca erişmek için yardımcı fonksiyon
function getActiveProfile() {
    return kokpitData.profiles.find(p => p.name === kokpitData.currentProfileName);
}

// URL'yi authUser parametresi ile güncelleyen fonksiyon
function modifyUrlWithAuthUser(url) {
    const authNo = kokpitData.globalActiveAuthNo;
    if (authNo === null || authNo === undefined || authNo === "") return url;
    
    try {
        const urlObj = new URL(url);
        const host = urlObj.hostname;
        const googleDomains = ["mail.google.com", "drive.google.com", "docs.google.com", "calendar.google.com", "meet.google.com", "contacts.google.com", "keep.google.com", "youtube.com"];
        
        const isGoogleDomain = googleDomains.some(domain => host === domain || host.endsWith("." + domain));
        
        if (isGoogleDomain) {
            if (urlObj.pathname.match(/\/u\/\d+\//)) {
                urlObj.pathname = urlObj.pathname.replace(/\/u\/\d+\//, `/u/${authNo}/`);
            } else {
                urlObj.searchParams.set('authuser', authNo);
            }
            return urlObj.toString();
        }
    } catch (e) {
        return url;
    }
    return url;
}

let currentEditType = ""; 
let currentEditIndex = -1;

// Sürükle-Bırak (Drag & Drop) için global değişkenler
let dragType = null; // 'sidebar' veya 'grid'
let dragIndex = null;

// Varsayılan SVG favicon (Dünya simgesi)
const DEFAULT_FAVICON_SVG = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' viewBox='0 0 24 24' fill='none' stroke='%238ab4f8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='10'%3E%3C/circle%3E%3Cline x1='2' y1='12' x2='22' y2='12'%3E%3C/line%3E%3Cpath d='M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'%3E%3C/path%3E%3C/svg%3E`;

// Akıllı Favicon Çekici (Localhost Destekli)
const getFavicon = (url) => {
    try {
        const urlObj = new URL(url);
        
        if (urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
            let cleanPath = url.split('?')[0].split('#')[0];
            if (!cleanPath.endsWith('/')) cleanPath += '/';
            
            // İlk olarak SVG denemesi yapalım (modern standart)
            return `${cleanPath}favicon.svg`;
        }
        
        return `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
    } catch (e) {
        // Hata durumunda (geçersiz URL vb.) varsayılan SVG döndür
        return DEFAULT_FAVICON_SVG;
    }
};


function migrateItem(item) {
    if(!item) return;
    if(!item.type) item.type = 'link';
    if(item.type === 'folder' && !item.children) item.children = [];
    if(item.children) {
        item.children = item.children.filter(child => child !== null);
        item.children.forEach(migrateItem);
    }
}

function loadData() {
    const data = localStorage.getItem("kokpit_data");
    if (data) {
        Object.assign(kokpitData, JSON.parse(data));
    } else {
        // Eski veriyi migrate et
        const oldSidebar = localStorage.getItem("kokpit_sidebar");
        const oldShortcuts = localStorage.getItem("kokpit_shortcuts");
        if (oldSidebar && oldShortcuts) {
            console.log("Eski veri bulundu, yeni profil yapısına migrate ediliyor...");
            kokpitData.profiles = [{
                name: "Varsayılan",
                sidebar: JSON.parse(oldSidebar),
                shortcuts: JSON.parse(oldShortcuts),
                notes: []
            }];
            kokpitData.currentProfileName = "Varsayılan";
            localStorage.removeItem("kokpit_sidebar");
            localStorage.removeItem("kokpit_shortcuts");
        }
    }
    
    kokpitData.profiles.forEach(p => {
        if (!p.notes) p.notes = [];
        if (p.sidebar) {
            p.sidebar = p.sidebar.filter(item => item !== null);
            p.sidebar.forEach(migrateItem);
        }
    });
    
    // AuthUser initial ayarları
    if (!kokpitData.authUsers) kokpitData.authUsers = [{no: "0", label: "Varsayılan Hesap"}];
    if (kokpitData.globalActiveAuthNo === undefined) kokpitData.globalActiveAuthNo = "0";

    // Sidebar states
    if (kokpitData.leftSidebarHidden) {
        document.querySelector(".sidebar").classList.add("hidden");
        const leftResizer = document.getElementById('leftResizer');
        if (leftResizer) leftResizer.classList.add("hidden");
    }
    if (kokpitData.rightSidebarHidden) {
        document.querySelector(".right-sidebar").classList.add("hidden");
        const rightResizer = document.getElementById('rightResizer');
        if (rightResizer) rightResizer.classList.add("hidden");
    }

    // Arayüz ayarlarını uygula
    if (kokpitData.activeTheme) {
        applyTheme(kokpitData.activeTheme);
    } else {
        applyTheme("dark");
    }

    renderAll();
}

function cleanupOrphanedFolderStates() {
    const validKeys = new Set();
    
    function collectFolderKeys(items, parentPath = "") {
        if (!items) return;
        items.forEach((item, index) => {
            const currentPath = parentPath === "" ? `${index}` : `${parentPath}-${index}`;
            if (item.type === 'folder') {
                validKeys.add(`folder_${currentPath}_open`);
                if (item.children) collectFolderKeys(item.children, currentPath);
            }
        });
    }

    // Mevcut tüm profillerdeki klasör yollarını topla
    kokpitData.profiles.forEach(profile => {
        if (profile.sidebar) collectFolderKeys(profile.sidebar);
    });

    // KokpitData içindeki tüm folder_..._open anahtarlarını kontrol et ve artık olmayanları sil
    Object.keys(kokpitData).forEach(key => {
        if (key.startsWith("folder_") && key.endsWith("_open")) {
            if (!validKeys.has(key)) {
                delete kokpitData[key];
            }
        }
    });
}

function saveData() {
    cleanupOrphanedFolderStates();
    localStorage.setItem("kokpit_data", JSON.stringify(kokpitData));
    renderAll();
}

// Tema Yönetimi Fonksiyonları (Global Kapsam)
function applyTheme(themeName) {
    document.body.setAttribute("data-theme", themeName);
    kokpitData.activeTheme = themeName;
    
    // Modal içindeki aktif durumu güncelle
    document.querySelectorAll(".theme-option").forEach(opt => {
        if (opt.dataset.theme === themeName) {
            opt.classList.add("active");
        } else {
            opt.classList.remove("active");
        }
    });
}

function openThemeModal() {
    const modal = document.getElementById("themeModal");
    if (modal) modal.style.display = "flex";
}

function closeThemeModal() {
    const modal = document.getElementById("themeModal");
    if (modal) modal.style.display = "none";
}

function renderAll() {
    renderSidebar();
    renderGrid();
    renderAuthUsers();
    renderNotes();
    
    // Temayı uygula (DOM elemanları render edildikten sonra modal durumunu güncellemek için)
    if (kokpitData.activeTheme) applyTheme(kokpitData.activeTheme);

    const profileBtn = document.getElementById("profileBtn");
    const activeProfile = getActiveProfile();
    if (profileBtn && activeProfile) {
        const spans = profileBtn.querySelectorAll("span");
        if (spans.length > 1) {
            spans[1].textContent = activeProfile.name;
        } else if (spans.length === 1) {
            spans[0].textContent = activeProfile.name;
        }
    }
}

function renderProfileList() {
    const list = document.getElementById("profile-list");
    list.innerHTML = "";
    kokpitData.profiles.forEach(profile => {
        const item = document.createElement("div");
        item.className = "profile-list-item";
        if (profile.name === kokpitData.currentProfileName) {
            item.classList.add("active");
        }

        const nameSpan = document.createElement("span");
        nameSpan.textContent = profile.name + " ";
        if (profile.authUserEmail) {
            const small = document.createElement("small");
            small.style.cssText = "color:#888; font-size: 0.8em; margin-left: 5px;";
            small.textContent = `(${profile.authUserEmail})`;
            nameSpan.appendChild(small);
        } else if (profile.authUserNo !== undefined && profile.authUserNo !== "") {
            const small = document.createElement("small");
            small.style.cssText = "color:#888; font-size: 0.8em; margin-left: 5px;";
            small.textContent = `(Hesap: ${profile.authUserNo})`;
            nameSpan.appendChild(small);
        }
        item.appendChild(nameSpan);

        const actionsDiv = document.createElement("div");
        actionsDiv.className = "profile-actions";

        const renameBtn = document.createElement("button");
        renameBtn.innerHTML = "✏️";
        renameBtn.title = "Profili Düzenle";
        renameBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openEditProfileModal(profile.name);
        });
        actionsDiv.appendChild(renameBtn);

        // Aktif olmayan profillere geçiş ve silme butonu ekle
        if (profile.name !== kokpitData.currentProfileName) {
            item.addEventListener("click", () => switchProfile(profile.name));
            
            const deleteBtn = document.createElement("button");
            deleteBtn.innerHTML = "🗑️";
            deleteBtn.title = "Profili Sil";
            deleteBtn.addEventListener("click", (e) => {
                e.stopPropagation(); // Üstteki tıklama olayını tetiklemesin
                deleteProfile(profile.name);
            });
            actionsDiv.appendChild(deleteBtn);
        }
        
        item.appendChild(actionsDiv);
        list.appendChild(item);
    });
}

let profileBeingEdited = null;

function openEditProfileModal(profileName) {
    const profile = kokpitData.profiles.find(p => p.name === profileName);
    if (!profile) return;
    
    profileBeingEdited = profileName;
    document.getElementById("editProfileName").value = profile.name;
    document.getElementById("editProfileAuthNo").value = profile.authUserNo !== undefined ? profile.authUserNo : "";
    document.getElementById("editProfileAuthEmail").value = profile.authUserEmail || "";
    
    document.getElementById("editProfileModal").style.display = "flex";
}

function closeEditProfileModal() {
    document.getElementById("editProfileModal").style.display = "none";
    profileBeingEdited = null;
}

function saveProfileEdit() {
    if (!profileBeingEdited) return;
    
    const newName = document.getElementById("editProfileName").value.trim();
    const newAuthNo = document.getElementById("editProfileAuthNo").value.trim();
    const newAuthEmail = document.getElementById("editProfileAuthEmail").value.trim();
    
    if (!newName) {
        alert("Profil adı boş olamaz.");
        return;
    }
    
    if (newName !== profileBeingEdited && kokpitData.profiles.some(p => p.name === newName)) {
        alert("Bu isimde bir profil zaten var.");
        return;
    }
    
    const profile = kokpitData.profiles.find(p => p.name === profileBeingEdited);
    if (profile) {
        profile.name = newName;
        profile.authUserNo = newAuthNo;
        profile.authUserEmail = newAuthEmail;
    }
    
    if (kokpitData.currentProfileName === profileBeingEdited) {
        kokpitData.currentProfileName = newName;
    }
    
    saveData();
    renderProfileList();
    closeEditProfileModal();
}

function switchProfile(profileName) {
    kokpitData.currentProfileName = profileName;
    saveData();
    closeProfileModal();
}

function addProfile() {
    const input = document.getElementById("newProfileName");
    const newName = input.value.trim();
    if (!newName) {
        alert("Lütfen bir profil adı girin.");
        return;
    }
    if (kokpitData.profiles.some(p => p.name === newName)) {
        alert("Bu isimde bir profil zaten var.");
        return;
    }

    kokpitData.profiles.push({
        name: newName,
        authUserNo: "",
        authUserEmail: "",
        sidebar: [],
        shortcuts: [],
        notes: []
    });
    input.value = "";
    renderProfileList();
    saveData();
}

function deleteProfile(profileName) {
    if (kokpitData.profiles.length <= 1) {
        alert("Son profili silemezsiniz!");
        return;
    }
    if (confirm(`"${profileName}" profilini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) {
        kokpitData.profiles = kokpitData.profiles.filter(p => p.name !== profileName);
        renderProfileList();
        saveData();
    }
}

function openProfileModal() {
    renderProfileList();
    document.getElementById("profileModal").style.display = "flex";
}

let currentEditAuthUserIndex = -1;

function renderAuthUsers() {
    const container = document.getElementById("authuser-items");
    container.innerHTML = "";
    
    const disableBtn = document.getElementById("btnDisableAuthUser");
    if (disableBtn) {
        if (kokpitData.globalActiveAuthNo === null) {
            disableBtn.style.color = "#8ab4f8";
            disableBtn.style.fontWeight = "bold";
        } else {
            disableBtn.style.color = "";
            disableBtn.style.fontWeight = "";
        }
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
        
        div.addEventListener("click", () => {
            kokpitData.globalActiveAuthNo = item.no;
            saveData();
        });

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn-auth";
        editBtn.innerText = "✏️";
        editBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            openAuthUserModal(index);
        });
        
        div.appendChild(editBtn);
        container.appendChild(div);
    });
}

function openAuthUserModal(index) {
    currentEditAuthUserIndex = index;
    document.getElementById("authUserModal").style.display = "flex";
    
    if(index === -1) {
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

function closeAuthUserModal() {
    document.getElementById("authUserModal").style.display = "none";
}

function saveAuthUser() {
    const no = document.getElementById("authObjNo").value.trim();
    const label = document.getElementById("authObjLabel").value.trim();
    
    if(!no) {
        alert("Lütfen bir hesap numarası (0, 1, 2) girin.");
        return;
    }
    
    if(currentEditAuthUserIndex === -1) {
        if(kokpitData.authUsers.some(a => a.no === no)) {
            alert("Bu numaraya ait bir hesap zaten var.");
            return;
        }
        kokpitData.authUsers.push({no, label});
        kokpitData.globalActiveAuthNo = no;
    } else {
        const oldNo = kokpitData.authUsers[currentEditAuthUserIndex].no;
        if(oldNo !== no && kokpitData.authUsers.some(a => a.no === no)) {
            alert("Bu numaraya ait bir hesap zaten var.");
            return;
        }
        kokpitData.authUsers[currentEditAuthUserIndex] = {no, label};
        if(kokpitData.globalActiveAuthNo === oldNo) {
            kokpitData.globalActiveAuthNo = no;
        }
    }
    
    saveData();
    closeAuthUserModal();
}

function deleteAuthUser() {
    const oldNo = kokpitData.authUsers[currentEditAuthUserIndex].no;
    kokpitData.authUsers.splice(currentEditAuthUserIndex, 1);
    
    if(kokpitData.globalActiveAuthNo === oldNo) {
        kokpitData.globalActiveAuthNo = null; 
    }
    saveData();
    closeAuthUserModal();
}

function closeProfileModal() {
    document.getElementById("profileModal").style.display = "none";
}

// Ağaç Yapısında İndeks Bulma Yardımcısı
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

// Sürükle-Bırak Olaylarını Bağlayan Yardımcı Fonksiyon
function addDragAndDropHandlers(div, type, pathStr, isFolder) {
    div.draggable = true; // Öğeyi sürüklenebilir yapar

    div.addEventListener("dragstart", (e) => {
        e.stopPropagation();
        dragType = type;
        dragIndex = String(pathStr);
        setTimeout(() => div.classList.add("dragging"), 0);
    });

    div.addEventListener("dragenter", (e) => {
        e.preventDefault(); e.stopPropagation();
        if (dragType === type && dragIndex !== String(pathStr)) {
            // Kendi içine taşıma koruması
            if (type === 'sidebar' && String(pathStr).startsWith(dragIndex + "-")) return;
            div.classList.add("drag-over");
        }
    });

    div.addEventListener("dragover", (e) => {
        e.preventDefault(); e.stopPropagation();
    });

    div.addEventListener("dragleave", (e) => {
        e.stopPropagation();
        div.classList.remove("drag-over");
    });

    div.addEventListener("drop", (e) => {
        e.preventDefault(); e.stopPropagation();
        div.classList.remove("drag-over");

        if (dragType === type && dragIndex !== null && dragIndex !== String(pathStr)) {
            if (type === 'sidebar' && String(pathStr).startsWith(dragIndex + "-")) {
                alert("Bir klasörü kendi içine taşıyamazsınız!");
                return;
            }

            const activeProfile = getActiveProfile();
            if (!activeProfile) return;
            const rootArray = type === 'sidebar' ? activeProfile.sidebar : activeProfile.shortcuts;
            
            const sourceInfo = getParentArrayAndIndexPairs(dragIndex, rootArray);
            let targetInfo = getParentArrayAndIndexPairs(pathStr, rootArray);
            
            const draggedItem = sourceInfo.array[sourceInfo.index];
            
            // Eğer hedef bir klasörse ve üzerine bırakılıyorsa içine ekle
            if (type === 'sidebar' && isFolder && targetInfo.array[targetInfo.index].type === 'folder') {
                const targetDepth = String(pathStr).split('-').length;
                if (targetDepth >= 3 && draggedItem.type === 'folder') {
                    alert("Klasör derinliği en fazla 3 kademe olabilir!");
                    return;
                }
                sourceInfo.array.splice(sourceInfo.index, 1);
                
                // Kaynaktan sildikten sonra hedef referansını yeniden al
                const tFolder = getParentArrayAndIndexPairs(pathStr, rootArray);
                if (!tFolder.array[tFolder.index].children) tFolder.array[tFolder.index].children = [];
                tFolder.array[tFolder.index].children.push(draggedItem);
                
                // Klasörü otomatik aç
                kokpitData[`folder_${pathStr}_open`] = true;
            } else {
                // Swap/Insert Before mantığı
                sourceInfo.array.splice(sourceInfo.index, 1);
                targetInfo = getParentArrayAndIndexPairs(pathStr, rootArray);
                targetInfo.array.splice(targetInfo.index, 0, draggedItem);
            }
            
            saveData(); // Kaydet ve ekranı yeniden çiz
        }
    });

    div.addEventListener("dragend", (e) => {
        e.stopPropagation();
        div.classList.remove("dragging");
        dragType = null;
        dragIndex = null;
    });
}

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
            
            const editBtn = document.createElement("button");
            editBtn.className = "edit-btn";
            editBtn.innerText = "⋮";
            editBtn.style.top = "-12px"; // ince çizgi olduğu için biraz yukarı kaydır
            editBtn.style.right = "5px";
            editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('sidebar', pathStr); });
            
            const wrapper = document.createElement("div");
            wrapper.style.position = "relative";
            wrapper.appendChild(div);
            wrapper.appendChild(editBtn);
            
            wrapper.addEventListener("mouseenter", () => editBtn.style.display="flex");
            wrapper.addEventListener("mouseleave", () => editBtn.style.display="none");
            
            parentContainer.appendChild(wrapper);
            return;
        }

        div.className = "sidebar-item folder-depth-" + Math.min(depth, 3);
        if(item.type === 'folder') div.classList.add("sidebar-folder");
        else div.style.cursor = "pointer";

        const infoDiv = document.createElement("div");
        infoDiv.style.cssText = "display:flex; align-items:center; gap:12px; pointer-events: none; width: 85%;";
        
        if (item.type === 'folder') {
            const icon = document.createElement("span");
            icon.className = "folder-icon";
            const stateKey = `folder_${pathStr}_open`;
            icon.textContent = kokpitData[stateKey] ? "📂" : "📁";
            infoDiv.appendChild(icon);
        } else {
            const img = document.createElement("img");
            img.src = getFavicon(item.url);
            img.alt = "";
            img.style.width = "20px";
            img.style.height = "20px";
            infoDiv.appendChild(img);
        }
        
        const nameText = document.createElement("span");
        nameText.style.cssText = "white-space: nowrap; overflow: hidden; text-overflow: ellipsis;";
        nameText.textContent = item.name;
        infoDiv.appendChild(nameText);
        
        div.appendChild(infoDiv);
        
        if (item.type !== 'folder') {
            const img = div.querySelector('img');
            if (img) {
                img.onerror = () => {
                    if (!img.src.includes('icons.duckduckgo.com')) {
                        try {
                            const urlObj = new URL(item.url);
                            img.src = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
                        } catch (e) {
                            img.src = DEFAULT_FAVICON_SVG;
                            img.onerror = null;
                        }
                    } else {
                        img.src = DEFAULT_FAVICON_SVG;
                        img.onerror = null;
                    }
                };
            }
        }

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.innerText = "⋮";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('sidebar', pathStr); });
        div.appendChild(editBtn);

        addDragAndDropHandlers(div, 'sidebar', pathStr, item.type === 'folder');

        if (item.type === 'folder') {
            const contentDiv = document.createElement("div");
            contentDiv.className = "folder-content";
            
            const stateKey = `folder_${pathStr}_open`;
            if (kokpitData[stateKey]) {
                div.classList.add("open");
                contentDiv.classList.add("open");
            }
            
            div.addEventListener("click", (e) => {
                if(e.target === editBtn) return;
                div.classList.toggle("open");
                contentDiv.classList.toggle("open");
                kokpitData[stateKey] = div.classList.contains("open");
                
                // İkonu güncelle
                const icon = div.querySelector(".folder-icon");
                if (icon) {
                    icon.textContent = kokpitData[stateKey] ? "📂" : "📁";
                }
            });
            
            parentContainer.appendChild(div);
            
            if (item.children) {
                item.children.forEach((child, i) => buildNode(child, pathStr + "-" + i, depth + 1, contentDiv));
            }
            parentContainer.appendChild(contentDiv);
        } else {
            div.addEventListener("click", (e) => {
                if(e.target === editBtn) return;
                const finalUrl = modifyUrlWithAuthUser(item.url);
                if (e.ctrlKey || e.metaKey) window.open(finalUrl, '_blank'); 
                else window.location.href = finalUrl;
            });
            div.addEventListener("auxclick", (e) => { 
                if (e.button === 1) window.open(modifyUrlWithAuthUser(item.url), '_blank'); 
            });
            parentContainer.appendChild(div);
        }
    }

    if(activeProfile.sidebar) activeProfile.sidebar.forEach((item, i) => buildNode(item, i.toString(), 0, container));
}

function renderGrid() {
    const container = document.getElementById("grid-container");
    container.innerHTML = "";
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;

    activeProfile.shortcuts.forEach((item, index) => {
        const div = document.createElement("div"); 
        div.className = "shortcut";
        
        // Tıklama olayları
        div.addEventListener("click", (e) => {
            const finalUrl = modifyUrlWithAuthUser(item.url);
            if (e.ctrlKey || e.metaKey) window.open(finalUrl, '_blank'); 
            else window.location.href = finalUrl;
        });
        div.addEventListener("mousedown", (e) => { if (e.button === 1) e.preventDefault(); });
        div.addEventListener("auxclick", (e) => { 
            if (e.button === 1) window.open(modifyUrlWithAuthUser(item.url), '_blank'); 
        });

        // Sürükle Bırak Olaylarını Ekle
        addDragAndDropHandlers(div, 'grid', index);

        const img = document.createElement("img");
        img.src = getFavicon(item.url);
        img.alt = "";
        img.style.pointerEvents = "none";
        
        const span = document.createElement("span");
        span.style.pointerEvents = "none";
        span.textContent = item.name;
        
        div.appendChild(img);
        div.appendChild(span);
        
        if (img) {
            img.onerror = () => {
                if (!img.src.includes('icons.duckduckgo.com')) {
                    try {
                        const urlObj = new URL(item.url);
                        img.src = `https://icons.duckduckgo.com/ip3/${urlObj.hostname}.ico`;
                    } catch (e) {
                        img.src = DEFAULT_FAVICON_SVG;
                        img.onerror = null;
                    }
                } else {
                    img.src = DEFAULT_FAVICON_SVG;
                    img.onerror = null;
                }
            };
        }

        const editBtn = document.createElement("button");
        editBtn.className = "edit-btn";
        editBtn.innerText = "⋮";
        editBtn.addEventListener("click", (e) => { e.stopPropagation(); openModal('grid', index); });
        editBtn.addEventListener("auxclick", (e) => e.stopPropagation());
        editBtn.addEventListener("mousedown", (e) => e.stopPropagation());

        div.appendChild(editBtn);
        container.appendChild(div);
    });

    // Artı (+) Butonu (Bunu sürüklemeye dahil etmiyoruz)
    const addBtn = document.createElement("div");
    addBtn.className = "shortcut add-new";
    addBtn.innerHTML = `<span style="font-size: 24px;">+</span><span>Ekle</span>`;
    addBtn.addEventListener("click", () => openModal('grid', -1));
    container.appendChild(addBtn);
}

function openModal(type, indexOrPath) {
    currentEditType = type;
    currentEditIndex = indexOrPath;

    const modal = document.getElementById("editModal");
    const title = document.getElementById("modalTitle");
    const inputName = document.getElementById("itemName");
    const inputUrl = document.getElementById("itemUrl");
    const btnDelete = document.getElementById("btnDelete");
    
    const typeGroup = document.getElementById("itemTypeGroup");
    const typeSelect = document.getElementById("itemType");

    if (type === 'sidebar') {
        if(typeGroup) typeGroup.style.display = "flex";
    } else {
        if(typeGroup) typeGroup.style.display = "none";
        if(typeSelect) typeSelect.value = "link";
    }

    if (indexOrPath === -1) {
        title.innerText = type === 'sidebar' ? "Yan Menüye Ekle" : "Kısayol Ekle";
        inputName.value = "";
        inputUrl.value = "";
        if (typeSelect) typeSelect.value = "link";
        btnDelete.style.display = "none";
    } else {
        title.innerText = "Düzenle";
        const activeProfile = getActiveProfile();
        if (!activeProfile) return;
        const rootArray = type === 'sidebar' ? activeProfile.sidebar : activeProfile.shortcuts;
        const itemInfo = getParentArrayAndIndexPairs(indexOrPath, rootArray);
        const item = itemInfo.array[itemInfo.index];
        
        inputName.value = item.name || "";
        inputUrl.value = item.url || "";
        if (typeSelect) typeSelect.value = item.type || "link";
        btnDelete.style.display = "block";
    }

    if(typeSelect) typeSelect.dispatchEvent(new Event('change'));
    modal.style.display = "flex";
    if (!typeSelect || typeSelect.value !== 'splitter') inputName.focus();
}

function closeModal() {
    document.getElementById("editModal").style.display = "none";
}

function saveItem() {
    const typeSelectEl = document.getElementById("itemType");
    const typeSelect = typeSelectEl ? typeSelectEl.value : 'link';
    const name = document.getElementById("itemName").value.trim();
    let url = document.getElementById("itemUrl").value.trim();

    if (currentEditType === 'sidebar') {
        if (typeSelect === 'link' && (!name || !url)) { alert("Lütfen isim ve URL giriniz."); return; }
        if (typeSelect === 'folder' && !name) { alert("Lütfen klasör ismi giriniz."); return; }
    } else {
        if (!name || !url) { alert("Lütfen isim ve URL giriniz."); return; }
    }

    if (typeSelect === 'link' && url && !/^https?:\/\//i.test(url)) {
        url = 'https://' + url;
    }

    const activeProfile = getActiveProfile();
    if (!activeProfile) return;
    const rootArray = currentEditType === 'sidebar' ? activeProfile.sidebar : activeProfile.shortcuts;

    const newItem = { name, url, type: currentEditType === 'sidebar' ? typeSelect : 'link' };
    if(newItem.type === 'folder') newItem.children = [];
    if(newItem.type === 'splitter') { delete newItem.url; delete newItem.name; }

    if (currentEditIndex === -1) {
        rootArray.push(newItem);
    } else {
        const itemInfo = getParentArrayAndIndexPairs(currentEditIndex, rootArray);
        if(newItem.type === 'folder' && itemInfo.array[itemInfo.index].children) {
            newItem.children = itemInfo.array[itemInfo.index].children;
        }
        itemInfo.array[itemInfo.index] = newItem;
    }

    saveData();
    closeModal();
}

function deleteItem() {
    const activeProfile = getActiveProfile();
    if (!activeProfile) return;
    const rootArray = currentEditType === 'sidebar' ? activeProfile.sidebar : activeProfile.shortcuts;
    const itemInfo = getParentArrayAndIndexPairs(currentEditIndex, rootArray);
    itemInfo.array.splice(itemInfo.index, 1);
    saveData();
    closeModal();
}

// ------ NOTES ------
let currentNoteIndex = -1;
let currentNoteColor = "default";

function renderNotes() {
    const container = document.getElementById("notes-items");
    if(!container) return;
    container.innerHTML = "";
    
    const activeProfile = getActiveProfile();
    if (!activeProfile || !activeProfile.notes) return;

    activeProfile.notes.forEach((note, index) => {
        const div = document.createElement("div");
        div.className = "note-item";
        if(note.color && note.color !== 'default') div.classList.add(note.color);
        
        const textDiv = document.createElement("div");
        textDiv.className = "note-text";
        textDiv.textContent = note.text;
        div.appendChild(textDiv);
        
        const actionsDiv = document.createElement("div");
        actionsDiv.className = "note-actions";
        
        const editBtn = document.createElement("button");
        editBtn.className = "note-btn";
        editBtn.innerHTML = "✏️";
        editBtn.onclick = (e) => { e.stopPropagation(); openNoteModal(index); };
        
        actionsDiv.appendChild(editBtn);
        div.appendChild(actionsDiv);
        
        div.addEventListener("dblclick", () => openNoteModal(index));
        
        container.appendChild(div);
    });
}

function openNoteModal(index) {
    currentNoteIndex = index;
    const modal = document.getElementById("noteModal");
    const contentInput = document.getElementById("noteContent");
    const btnDelete = document.getElementById("btnDeleteNote");
    const title = document.getElementById("noteModalTitle");
    
    if(index === -1) {
        title.innerText = "Yeni Not Ekle";
        contentInput.value = "";
        currentNoteColor = "default";
        btnDelete.style.display = "none";
    } else {
        title.innerText = "Notu Düzenle";
        const activeProfile = getActiveProfile();
        contentInput.value = activeProfile.notes[index].text;
        currentNoteColor = activeProfile.notes[index].color || "default";
        btnDelete.style.display = "block";
    }
    
    // Aktif renk noktasını işaretle
    document.querySelectorAll("#noteColorPicker .color-dot").forEach(dot => {
        dot.classList.toggle("active", dot.dataset.color === currentNoteColor);
    });
    
    modal.style.display = "flex";
    contentInput.focus();
}

function closeNoteModal() {
    document.getElementById("noteModal").style.display = "none";
}

function saveNote() {
    const text = document.getElementById("noteContent").value.trim();
    if(!text) { alert("Not içeriği boş olamaz."); return; }
    
    const activeProfile = getActiveProfile();
    if(!activeProfile) return;
    if(!activeProfile.notes) activeProfile.notes = [];
    
    if(currentNoteIndex === -1) {
        activeProfile.notes.push({ text, id: Date.now(), color: currentNoteColor });
    } else {
        activeProfile.notes[currentNoteIndex].text = text;
        activeProfile.notes[currentNoteIndex].color = currentNoteColor;
    }
    
    saveData();
    closeNoteModal();
}

function deleteNote() {
    if(confirm("Bu notu silmek istediğinize emin misiniz?")) {
        const activeProfile = getActiveProfile();
        if(!activeProfile) return;
        activeProfile.notes.splice(currentNoteIndex, 1);
        saveData();
        closeNoteModal();
    }
}

// --- YEDEKLEME (Dışa Aktar) ---
function exportData() {
    // Zaman damgası oluşturma (YYYY_MM_DD_HHNN)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timestamp = `${year}_${month}_${day}_${hours}${minutes}`;

    // Veriyi JSON formatına çevir ve Blob oluştur
    const blob = new Blob([JSON.stringify(kokpitData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    // Gizli bir link oluşturup tıklatarak indirme işlemini başlat
    const a = document.createElement("a");
    a.href = url;
    a.download = `kokpit_yedek_${timestamp}.json`; // Zaman damgalı dosya adı
    a.click();
    
    URL.revokeObjectURL(url); // Belleği temizle
}

// --- YÜKLEME (İçe Aktar) ---
function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            // Yeni formatı kontrol et (kokpitData objesi)
            if (data.profiles && data.currentProfileName) {
                Object.assign(kokpitData, data);
                saveData();
                alert("Yedek başarıyla yüklendi!");
            } 
            // Eski formatı kontrol et (sidebar ve shortcuts)
            else if (data.sidebar && data.shortcuts) {
                const activeProfile = getActiveProfile();
                if (activeProfile) {
                    activeProfile.sidebar = data.sidebar;
                    activeProfile.shortcuts = data.shortcuts;
                    saveData();
                    alert(`Eski formatta yedek yüklendi ve mevcut "${activeProfile.name}" profiline uygulandı!`);
                } else {
                    alert("Aktif profil bulunamadı. Yedek yüklenemedi.");
                }
            } else {
                alert("Geçersiz yedek dosyası yapısı!");
            }
        } catch (err) {
            alert("Dosya okunamadı veya bozuk JSON!");
        }
        // Aynı dosyayı tekrar seçebilmek için input'u sıfırla
        event.target.value = "";
    };
    reader.readAsText(file);
}

document.addEventListener("DOMContentLoaded", () => {
    loadData();

    // Sidebar ve Resizer Objeleri
    const toggleLeftBtn = document.getElementById("toggleLeftSidebar");
    const toggleRightBtn = document.getElementById("toggleRightSidebar");
    const leftSidebar = document.querySelector(".sidebar");
    const rightSidebar = document.querySelector(".right-sidebar");
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    const middleResizer = document.getElementById('middleResizer');
    const authSection = document.querySelector('.auth-section');
    
    // LocalStorage Genişlik Ayarlarını Yükle
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
    
    // Panel Resizer (Genişletme/Daraltma) Mantığı
    let isResizingLeft = false;
    let isResizingRight = false;
    let isResizingMiddle = false;
    
    if (leftResizer) {
        leftResizer.addEventListener('mousedown', (e) => {
            isResizingLeft = true;
            leftResizer.classList.add('resizing');
            document.body.classList.add('resizing');
        });
    }
    if (rightResizer) {
        rightResizer.addEventListener('mousedown', (e) => {
            isResizingRight = true;
            rightResizer.classList.add('resizing');
            document.body.classList.add('resizing');
        });
    }

    if (middleResizer) {
        middleResizer.addEventListener('mousedown', (e) => {
            isResizingMiddle = true;
            middleResizer.classList.add('resizing');
            document.body.classList.add('resizing-h');
        });
    }
    
    document.addEventListener('mousemove', (e) => {
        if (!isResizingLeft && !isResizingRight && !isResizingMiddle) return;
        
        if (isResizingLeft && leftSidebar) {
            let newWidth = e.clientX;
            if (newWidth < 150) newWidth = 150;
            if (newWidth > 600) newWidth = 600;
            leftSidebar.style.width = newWidth + "px";
            leftSidebar.style.minWidth = newWidth + "px";
            kokpitData.leftSidebarWidth = newWidth;
        }
        
        if (isResizingRight && rightSidebar) {
            let newWidth = document.body.clientWidth - e.clientX;
            if (newWidth < 150) newWidth = 150;
            if (newWidth > 600) newWidth = 600;
            rightSidebar.style.width = newWidth + "px";
            rightSidebar.style.minWidth = newWidth + "px";
            kokpitData.rightSidebarWidth = newWidth;
        }

        if (isResizingMiddle && authSection && rightSidebar) {
            let offsetTop = rightSidebar.getBoundingClientRect().top;
            let newHeight = e.clientY - offsetTop;
            
            // Limit and ensure minimums
            if (newHeight < 100) newHeight = 100;
            let maxH = rightSidebar.clientHeight - 100;
            if (newHeight > maxH) newHeight = maxH;
            
            authSection.style.flex = "0 0 " + newHeight + "px";
            kokpitData.authSectionHeight = newHeight;
        }
    });
    
    document.addEventListener('mouseup', () => {
        if (isResizingLeft || isResizingRight || isResizingMiddle) {
            isResizingLeft = false;
            isResizingRight = false;
            isResizingMiddle = false;
            if(leftResizer) leftResizer.classList.remove('resizing');
            if(rightResizer) rightResizer.classList.remove('resizing');
            if(middleResizer) middleResizer.classList.remove('resizing');
            document.body.classList.remove('resizing');
            document.body.classList.remove('resizing-h');
            saveData();
        }
    });

    if (toggleLeftBtn && leftSidebar) {
        toggleLeftBtn.addEventListener("click", () => {
            leftSidebar.classList.toggle("hidden");
            if (leftResizer) leftResizer.classList.toggle("hidden");
            kokpitData.leftSidebarHidden = leftSidebar.classList.contains("hidden");
            saveData();
        });
    }

    if (toggleRightBtn && rightSidebar) {
        toggleRightBtn.addEventListener("click", () => {
            rightSidebar.classList.toggle("hidden");
            if (rightResizer) rightResizer.classList.toggle("hidden");
            kokpitData.rightSidebarHidden = rightSidebar.classList.contains("hidden");
            saveData();
        });
    }

    document.getElementById("btnNewIncognito").addEventListener("click", () => {
        if (chrome && chrome.windows) {
            chrome.windows.create({ incognito: true });
        } else {
            console.log("Incognito window could not be opened. This is likely because you are not running this as a Chrome extension.");
        }
    });

    const btnNewPersonalTab = document.getElementById("btnNewPersonalTab");
    if (btnNewPersonalTab) {
        btnNewPersonalTab.addEventListener("click", () => {
            if (chrome && chrome.tabs) {
                chrome.tabs.create({ url: "chrome://extensions/?id=fnkhlplohchiopnookamaicdfnfibakg" });
            } else {
                window.open("chrome://extensions/?id=fnkhlplohchiopnookamaicdfnfibakg", "_blank");
            }
        });
    }

    document.getElementById("addSidebarBtn").addEventListener("click", () => openModal('sidebar', -1));
    document.getElementById("btnDelete").addEventListener("click", deleteItem);
    document.getElementById("btnCancel").addEventListener("click", closeModal);
    document.getElementById("btnSave").addEventListener("click", saveItem);
    
    const itemTypeSelect = document.getElementById("itemType");
    if (itemTypeSelect) {
        itemTypeSelect.addEventListener("change", (e) => {
            const type = e.target.value;
            const uG = document.getElementById("itemUrlGroup");
            const nG = document.getElementById("itemNameGroup");
            
            if (type === 'splitter') {
                if(uG) uG.style.display = 'none';
                if(nG) nG.style.display = 'none';
            } else if (type === 'folder') {
                if(uG) uG.style.display = 'none';
                if(nG) nG.style.display = 'flex';
            } else {
                if(uG) uG.style.display = 'flex';
                if(nG) nG.style.display = 'flex';
            }
        });
    }

    const addNoteBtn = document.getElementById("addNoteBtn");
    if(addNoteBtn) addNoteBtn.addEventListener("click", () => openNoteModal(-1));
    const btnCancelNote = document.getElementById("btnCancelNote");
    if(btnCancelNote) btnCancelNote.addEventListener("click", closeNoteModal);
    const btnSaveNote = document.getElementById("btnSaveNote");
    if(btnSaveNote) btnSaveNote.addEventListener("click", saveNote);
    const btnDeleteNote = document.getElementById("btnDeleteNote");
    if(btnDeleteNote) btnDeleteNote.addEventListener("click", deleteNote);

    // Renk Seçer Event Listener'ları
    document.querySelectorAll("#noteColorPicker .color-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            document.querySelectorAll("#noteColorPicker .color-dot").forEach(d => d.classList.remove("active"));
            dot.classList.add("active");
            currentNoteColor = dot.dataset.color;
        });
    });

    const btnTheme = document.getElementById("btnTheme");
    if (btnTheme) btnTheme.addEventListener("click", openThemeModal);
    
    const btnCloseThemeModal = document.getElementById("btnCloseThemeModal");
    if (btnCloseThemeModal) btnCloseThemeModal.addEventListener("click", closeThemeModal);

    document.querySelectorAll(".theme-option").forEach(option => {
        option.addEventListener("click", () => {
            const theme = option.dataset.theme;
            applyTheme(theme);
            saveData();
        });
    });

    document.getElementById("itemUrl").addEventListener("keypress", function(event) {
        if (event.key === "Enter") { event.preventDefault(); saveItem(); }
    });
    document.getElementById("itemName").addEventListener("keypress", function(event) {
        if (event.key === "Enter") { event.preventDefault(); saveItem(); }
    });
	
	// Dışa / İçe Aktar Event Listener'ları
    document.getElementById("btnExport").addEventListener("click", exportData);
    
    // Yükle butonuna basınca gizli file input'u tetikle
    document.getElementById("btnImport").addEventListener("click", () => {
        document.getElementById("importFile").click();
    });
    
    // Dosya seçildiğinde import fonksiyonunu çalıştır
    document.getElementById("importFile").addEventListener("change", importData);

    // Profil Modalı Event Listener'ları
    document.getElementById("profileBtn").addEventListener("click", openProfileModal);
    document.getElementById("btnCloseProfileModal").addEventListener("click", closeProfileModal);
    document.getElementById("btnAddProfile").addEventListener("click", addProfile);

    // Profil Düzenleme Event Listener'ları
    document.getElementById("btnCancelEditProfile").addEventListener("click", closeEditProfileModal);
    document.getElementById("btnSaveEditProfile").addEventListener("click", saveProfileEdit);

    // AuthUser Modalı Event Listener'ları
    document.getElementById("addAuthUserBtn").addEventListener("click", () => openAuthUserModal(-1));
    document.getElementById("btnCancelAuthUser").addEventListener("click", closeAuthUserModal);
    document.getElementById("btnSaveAuthUser").addEventListener("click", saveAuthUser);
    document.getElementById("btnDeleteAuthUser").addEventListener("click", deleteAuthUser);
    
    // AuthUser Kapalı Butonu
    const disableBtn = document.getElementById("btnDisableAuthUser");
    if (disableBtn) {
        disableBtn.addEventListener("click", () => {
            kokpitData.globalActiveAuthNo = null;
            saveData();
        });
    }
});

window.addEventListener("click", function(event) {
    const editModal = document.getElementById("editModal");
    if (event.target === editModal) closeModal();
    
    const profileModal = document.getElementById("profileModal");
    if (event.target === profileModal) closeProfileModal();

    const editProfileModal = document.getElementById("editProfileModal");
    if (event.target === editProfileModal) closeEditProfileModal();

    const authUserModal = document.getElementById("authUserModal");
    if (event.target === authUserModal) closeAuthUserModal();

    const themeModal = document.getElementById("themeModal");
    if (event.target === themeModal) closeThemeModal();
});
