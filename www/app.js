let selectedMode = 'fullscreen';
let recentFiles = [];
let lastHtml = null;

document.addEventListener('DOMContentLoaded', async () => {
  loadPrefs();
  renderRecent();
  if (window.Capacitor) await applyMode(selectedMode);

  let pressTimer;
  document.addEventListener('touchstart', (e) => {
    if (document.getElementById('toolbar').contains(e.target)) return;
    pressTimer = setTimeout(showToolbar, 600);
  }, { passive: true });
  document.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
  document.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });

  if (window.Capacitor) {
    Capacitor.Plugins.App?.addListener('backButton', () => {
      if (document.getElementById('screenViewer').classList.contains('active')) closeViewer();
    });
  }
});

// ══════════════════════════════════
//  BUKA FOLDER — pakai native plugin
// ══════════════════════════════════
async function openFile() {
  try {
    showViewer('Pilih folder...');
    setProgress(5);

    // Panggil native plugin — buka folder picker Android
    const { FolderPicker } = Capacitor.Plugins;
    const result = await FolderPicker.pickFolder();

    setLabel('Membaca file...');
    setProgress(20);

    // result.files = array of { path, name, type, content, mime }
    const files = result.files;
    if (!files || files.length === 0) {
      showToast('Folder kosong.');
      closeViewer();
      return;
    }

    // Cari HTML utama
    const htmlEntry =
      files.find(f => f.name.toLowerCase() === 'index.html') ||
      files.find(f => /\.html?$/i.test(f.name));

    if (!htmlEntry) {
      showToast('Tidak ada file .html di folder ini.');
      closeViewer();
      return;
    }

    console.log('Files di folder: ' + files.map(f => f.path).join(', '));

    // Buat fileMap: path → content (string atau data URL)
    const fileMap = {};
    for (const f of files) {
      let content;
      if (f.type === 'text') {
        content = f.content;
      } else {
        // Binary → data URL
        content = `data:${f.mime || 'application/octet-stream'};base64,${f.content}`;
      }
      fileMap[f.path] = content;   // path lengkap: "css/main.css"
      fileMap[f.name] = content;   // nama saja: "main.css"
    }

    setProgress(40);
    await processAndRender(fileMap, htmlEntry);

  } catch (err) {
    console.error('Error: ' + err.message);
    if (err.message && err.message.includes('batal')) {
      closeViewer();
    } else {
      showToast('Error: ' + err.message);
      closeViewer();
    }
  }
}

// ══════════════════════════════════
//  PROSES & RENDER
// ══════════════════════════════════
async function processAndRender(fileMap, htmlEntry) {
  let html = htmlEntry.type === 'text' ? htmlEntry.content : fileMap[htmlEntry.name];

  setLabel('Inline CSS...');
  html = await replaceAsync(html,
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*\/?>/gi,
    async (match, href) => {
      if (/^https?:\/\//i.test(href)) return match;
      const content = getAsset(href, fileMap);
      if (!content) { console.warn('CSS tidak ketemu: ' + href); return match; }
      return `<style>\n${content}\n</style>`;
    }
  );
  setProgress(55);

  setLabel('Inline JS...');
  html = await replaceAsync(html,
    /<script\b([^>]*)\bsrc=["']([^"'#?]+)["']([^>]*)><\/script>/gi,
    async (match, b, src, a) => {
      if (/^https?:\/\//i.test(src)) return match;
      const content = getAsset(src, fileMap);
      if (!content) { console.warn('JS tidak ketemu: ' + src); return match; }
      return `<script${b}${a}>\n${content}\n</script>`;
    }
  );
  setProgress(70);

  setLabel('Inline gambar...');
  html = await replaceAsync(html,
    /<img\b([^>]*)\bsrc=["']([^"']+)["']([^>]*?)>/gi,
    async (match, b, src, a) => {
      if (/^https?:\/\//i.test(src) || src.startsWith('data:')) return match;
      const content = getAsset(src, fileMap);
      return content ? `<img${b} src="${content}"${a}>` : match;
    }
  );

  html = await replaceAsync(html,
    /url\(["']?(?!https?:\/\/|data:)([^"')]+)["']?\)/gi,
    async (match, src) => {
      const content = getAsset(src.trim(), fileMap);
      return content ? `url("${content}")` : match;
    }
  );
  setProgress(90);

  lastHtml = html;
  addToRecent(htmlEntry.name);
  injectToFrame(html);
}

function getAsset(src, fileMap) {
  const clean = src.split('?')[0].split('#')[0].trim().replace(/^\.\//, '');
  // Coba path lengkap dulu, lalu nama file saja
  const keys = [clean, clean.split('/').pop()];
  for (const k of keys) {
    if (fileMap[k]) return fileMap[k];
    const found = Object.keys(fileMap).find(fk => fk.toLowerCase() === k.toLowerCase());
    if (found) return fileMap[found];
  }
  return null;
}

// ══════════════════════════════════
//  IFRAME
// ══════════════════════════════════
function injectToFrame(html) {
  setLabel('Merender...');
  const frame = document.getElementById('frame');
  frame.onload = () => {
    setProgress(100);
    setTimeout(() => document.getElementById('loadingOverlay').classList.add('hidden'), 300);
  };
  frame.srcdoc = html;
}

function reloadViewer() {
  if (!lastHtml) return;
  document.getElementById('loadingOverlay').classList.remove('hidden');
  setProgress(0);
  setTimeout(() => injectToFrame(lastHtml), 100);
  hideToolbar();
}

// ══════════════════════════════════
//  NAVIGASI
// ══════════════════════════════════
function showViewer(label) {
  document.getElementById('screenViewer').classList.add('active');
  document.getElementById('loadingOverlay').classList.remove('hidden');
  setProgress(0);
  setLabel(label || 'Memuat...');
  if (window.Capacitor && selectedMode === 'fullscreen') {
    try { Capacitor.Plugins.StatusBar?.hide(); } catch(e) {}
  }
}

function closeViewer() {
  document.getElementById('screenViewer').classList.remove('active');
  document.getElementById('frame').srcdoc = '';
  hideToolbar();
  if (window.Capacitor) {
    try {
      Capacitor.Plugins.StatusBar?.show();
      Capacitor.Plugins.StatusBar?.setBackgroundColor({ color: '#080810' });
    } catch(e) {}
  }
}

function showToolbar() {
  const tb = document.getElementById('toolbar');
  tb.classList.add('visible');
  clearTimeout(tb._t);
  tb._t = setTimeout(hideToolbar, 4000);
}

function hideToolbar() {
  document.getElementById('toolbar').classList.remove('visible');
}

// ══════════════════════════════════
//  UTILS
// ══════════════════════════════════
async function replaceAsync(str, regex, fn) {
  const promises = [];
  str.replace(regex, (m, ...a) => { promises.push(fn(m, ...a)); return m; });
  const results = await Promise.all(promises);
  return str.replace(regex, () => results.shift());
}

function setProgress(pct) { document.getElementById('loadBar').style.width = pct + '%'; }
function setLabel(txt) { document.getElementById('loadLabel').textContent = txt; }

function selectMode(mode) {
  selectedMode = mode;
  ['Fullscreen','Normal'].forEach(m => {
    document.getElementById('mode'+m).classList.toggle('active', mode === m.toLowerCase());
  });
  localStorage.setItem('wr_mode', mode);
}

async function applyMode(mode) {
  if (!window.Capacitor) return;
  try {
    const { StatusBar } = Capacitor.Plugins;
    if (mode === 'fullscreen') { await StatusBar?.hide(); }
    else {
      await StatusBar?.show();
      await StatusBar?.setStyle({ style: 'Dark' });
      await StatusBar?.setBackgroundColor({ color: '#080810' });
    }
  } catch(e) {}
}

function loadPrefs() {
  try {
    recentFiles = JSON.parse(localStorage.getItem('wr_recent') || '[]');
    selectedMode = localStorage.getItem('wr_mode') || 'fullscreen';
    selectMode(selectedMode);
  } catch { recentFiles = []; }
}

function addToRecent(name) {
  recentFiles = recentFiles.filter(f => f.name !== name);
  recentFiles.unshift({ name, time: Date.now() });
  if (recentFiles.length > 5) recentFiles = recentFiles.slice(0, 5);
  localStorage.setItem('wr_recent', JSON.stringify(recentFiles));
  renderRecent();
}

function removeFromRecent(name) {
  recentFiles = recentFiles.filter(f => f.name !== name);
  localStorage.setItem('wr_recent', JSON.stringify(recentFiles));
  renderRecent();
}

function renderRecent() {
  const section = document.getElementById('recentSection');
  const list = document.getElementById('recentList');
  if (!recentFiles.length) { section.style.display = 'none'; return; }
  section.style.display = 'block';
  list.innerHTML = recentFiles.map(f => `
    <div class="recent-item">
      <div class="recent-dot"></div>
      <div class="recent-info">
        <div class="recent-name">${escHtml(f.name)}</div>
        <div class="recent-path">${timeAgo(f.time)}</div>
      </div>
      <button class="recent-del" onclick="removeFromRecent('${escHtml(f.name)}')" aria-label="Hapus">✕</button>
    </div>
  `).join('');
}

function timeAgo(ts) {
  const d = Date.now() - ts, m = Math.floor(d/60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return m + ' menit lalu';
  const h = Math.floor(m/60);
  if (h < 24) return h + ' jam lalu';
  return Math.floor(h/24) + ' hari lalu';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3000);
}
