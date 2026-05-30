# WebRunner 🚀

Aplikasi Android untuk menjalankan file HTML/CSS/JS lokal dari storage — layaknya aplikasi native, tanpa address bar, tanpa browser UI.

## Fitur

- 🗂️ **File Picker** — pilih file HTML dari mana saja di storage
- 🔗 **Full Asset Resolution** — CSS, JS, gambar, font lokal otomatis ter-load via `<base>` tag injection
- ⛶ **Mode Full Screen** — tanpa status bar & navigation bar
- ▣ **Mode Normal** — dengan status bar di atas
- 📂 **Recent Files** — 5 file terakhir tersimpan
- 🔧 **Floating Toolbar** — long press untuk munculkan tombol back/reload/toggle mode

## Cara Build

### Opsi A: GitHub Actions (Otomatis)

1. Fork / clone repo ini ke GitHub kamu
2. Push ke branch `main` atau `master`
3. Buka tab **Actions** → tunggu build selesai
4. Download APK dari **Artifacts**

### Opsi B: Lokal

```bash
# Install deps
npm install

# Setup & build Android project
node build.js

# Buka di Android Studio
npx cap open android
```

Lalu di Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**

## Build Release (Signed APK)

Untuk release APK yang bisa diinstall tanpa "unknown sources":

1. Generate keystore:
```bash
keytool -genkey -v -keystore webrunner.jks -keyalg RSA -keysize 2048 -validity 10000 -alias webrunner
```

2. Tambah secrets di GitHub repo (Settings → Secrets):
   - `KEYSTORE_BASE64` — hasil `base64 webrunner.jks`
   - `KEYSTORE_PASSWORD` — password keystore
   - `KEY_ALIAS` — alias (misal: `webrunner`)
   - `KEY_PASSWORD` — password key

3. Push → Actions akan build release APK otomatis ✓

## Cara Pakai di HP

1. Install APK
2. Buka WebRunner
3. Pilih mode tampilan (Full Screen / Normal)
4. Tap **Pilih File HTML**
5. Izinkan akses storage saat diminta
6. Pilih file `.html` dari storage
7. File terbuka seperti aplikasi native!

**Tip**: Long press di layar untuk munculkan toolbar (back / reload / toggle mode)

## Struktur Project

```
webrunner/
├── www/
│   ├── index.html      # Launcher UI
│   ├── style.css       # Launcher styles
│   ├── app.js          # Launcher logic
│   └── viewer.html     # Viewer (render HTML user)
├── android-patch/
│   ├── AndroidManifest.xml   # Full storage permissions
│   ├── file_paths.xml        # FileProvider paths
│   └── MainActivity.java     # Immersive mode support
├── .github/workflows/
│   └── build.yml       # GitHub Actions build
├── build.js            # Setup script
├── capacitor.config.ts
└── package.json
```

## Catatan

- PHP tidak didukung (file HTML/CSS/JS only)
- Internet permission aktif — HTML yang kamu buka bisa load CDN/font eksternal
- File picker menggunakan `@capawesome-team/capacitor-file-picker`
