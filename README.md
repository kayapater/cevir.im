# Çevirici - Tarayıcı Tabanlı Dosya ve Kodek Dönüştürücü

Bu uygulama, video, ses, görsel ve belgelerinizi sunucuya yüklemeden **tamamen tarayıcı üzerinde (WebAssembly - FFmpeg WASM)** dönüştürmenize olanak tanıyan modern, güvenli ve yüksek performanslı bir dosya çeviricidir.

## Özellikler
- **%100 Güvenli & Yerel:** Dosyalarınız hiçbir uzak sunucuya yüklenmez, doğrudan kendi cihazınızda işlenir.
- **Zengin Format Desteği:** 
  - **Video:** MP4, MKV, WebM, AVI, MOV (H.264, H.265, VP9, Apple ProRes 422 ve PCM ses desteği).
  - **Ses:** MP3, WAV, AAC, FLAC, OGG, M4A, Opus.
  - **Görsel:** WebP, JPEG, PNG, BMP, GIF, ICO.
  - **Belge:** Markdown (.md) veya Text (.txt) dosyalarını PDF ve HTML'e dönüştürme.
- **Hazır Şablonlar (Presets):** Premiere Pro kurgu optimizasyonu, YouTube, Reels/TikTok, Discord ve daha fazlası için ön ayarlar.
- **Sunucusuz (Serverless) Çalışma:** Cloudflare Pages veya herhangi bir statik web sunucusunda barındırılabilir.

---

## Kurulum ve Yerel Çalıştırma

Projeyi yerel bilgisayarınızda çalıştırmak veya geliştirmek için aşağıdaki adımları takip edebilirsiniz:

### 1. Bağımlılıkların Yüklenmesi
Uygulama, root, frontend ve backend olmak üzere 3 katmandan oluşur. Tüm bağımlılıkları tek bir komutla yüklemek için root dizininde şu komutu çalıştırmanız yeterlidir:

```bash
npm run install-all
```

*Bu komut sırasıyla kök dizini, `/client` (frontend) ve `/server` (static host) klasörlerindeki paketleri otomatik olarak kuracaktır.*

### 2. Geliştirme Sunucusunun Başlatılması
Geliştirme aşamasında hem frontend (Vite) hem de backend (statik servis) sunucularını aynı anda başlatmak için:

```bash
npm run dev
```

- Frontend Arayüzü: `http://localhost:5173` adresinde çalışacaktır.
- Statik Servis Sunucusu: `http://localhost:5000` adresinde çalışacaktır.

---

## Sunucuda Barındırma & Cloudflare Pages Deploy

Uygulama tamamen tarayıcı üzerinde çalıştığından, herhangi bir sunucu mimarisine ihtiyaç duymadan **Cloudflare Pages**, Netlify veya Vercel gibi statik barındırma platformlarında yayınlanabilir.

### SharedArrayBuffer Gereksinimi (Önemli)
FFmpeg WebAssembly modülünün tarayıcıda çalışabilmesi için sunucunuzun yanıt başlıklarında (headers) aşağıdaki güvenlik kurallarını göndermesi zorunludur:

```http
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **Cloudflare Pages:** Projedeki `client/public/_headers` dosyası bu yönlendirmeyi Cloudflare üzerinde otomatik olarak yapacaktır.
- **Node.js/Express:** `/server/index.js` içerisindeki middleware bu başlıkları otomatik olarak enjekte eder.

---

## Lisans
Bu proje MIT lisansı ile korunmaktadır. Özgürce kullanabilir, değiştirebilir ve dağıtabilirsiniz.
