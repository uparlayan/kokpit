# Kokpit Kurulum Rehberi / Installation Guide

Bu belge, Kokpit eklentisini Chrome ve Firefox tarayıcılarına nasıl kuracağınızı adım adım açıklamaktadır.

---

## 🇹🇷 Türkçe Kurulum Talimatları

### 1. Chrome Kurulumu (Geliştirici Modu)
Chrome mağazasında olmayan eklentileri yüklemek için bu yöntem kullanılır:

1.  **Dosyaları İndirin:** Bu depoyu ZIP olarak indirin ve bir klasöre çıkartın.
2.  **Uzantılar Sayfasını Açın:** Chrome adres çubuğuna `chrome://extensions/` yazın ve Enter'a basın.
3.  **Geliştirici Modunu Açın:** Sağ üst köşedeki **"Geliştirici modu"** anahtarını açık konuma getirin.
4.  **Eklentiyi Yükleyin:** Sol üstte çıkan **"Paketlenmemiş öğe yükle"** butonuna tıklayın.
5.  **Klasörü Seçin:** Eklenti dosyalarının (manifest.json dosyasının olduğu klasör) bulunduğu klasörü seçin ve "Tamam" deyin.
6.  **Yeni Sekme:** Artık yeni bir sekme açtığınızda Kokpit karşınıza gelecektir.

### 2. Firefox Kurulumu

#### A. Geçici Kurulum (Geliştirme İçin)
Tarayıcıyı kapatana kadar geçerlidir:
1.  Firefox'ta adres çubuğuna `about:debugging#/runtime/this-firefox` yazın.
2.  **"Geçici eklentiyi yükle..."** (Load Temporary Add-on) butonuna tıklayın.
3.  Eklenti klasöründeki **manifest.json** dosyasını seçin.

#### B. Kalıcı Kurulum (İmzalanmış .xpi ile)
Firefox'ta eklentinin kalıcı olması için Mozilla tarafından imzalanması gerekir:
1.  [Mozilla Add-on Developer Hub](https://addons.mozilla.org/developers/) sayfasına gidin.
2.  Eklenti dosyalarınızı ZIP yapıp yükleyin (Kendi başıma dağıtacağım seçeneğini seçin).
3.  Doğrulama sonrası size verilen **`.xpi`** dosyasını indirin.
4.  Bu dosyayı Firefox penceresine sürükleyip bırakın ve "Ekle" deyin.

---

## 🇬🇧 English Installation Instructions

### 1. Chrome Installation (Developer Mode)
1.  **Download Files:** Download this repo as a ZIP and extract it to a folder.
2.  **Open Extensions:** Navigate to `chrome://extensions/` in Chrome.
3.  **Enable Developer Mode:** Toggle the **"Developer mode"** switch in the top right.
4.  **Load Extension:** Click the **"Load unpacked"** button in the top left.
5.  **Select Folder:** Choose the folder containing the project files (where `manifest.json` is located).

### 2. Firefox Installation

#### A. Temporary Installation
1.  Navigate to `about:debugging#/runtime/this-firefox` in Firefox.
2.  Click **"Load Temporary Add-on..."**.
3.  Select the **manifest.json** file from the project folder.

#### B. Permanent Installation (Signed .xpi)
1.  Upload your project as a ZIP to the [Mozilla Developer Hub](https://addons.mozilla.org/developers/).
2.  Choose the **"On your own"** distribution option.
3.  After validation, download the signed **`.xpi`** file.
4.  Drag and drop the `.xpi` file into any Firefox window to install permanently.

---

### 💡 İpucu / Tip
**Firefox İlk Açılış:** Firefox ilk açıldığında Kokpit'in gelmesini istiyorsanız, Ayarlar -> Giriş -> Giriş Sayfası kısmını "Özel URL" yapıp eklentinin adresini yapıştırın.
