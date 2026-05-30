#!/usr/bin/env node
/**
 * WebRunner Build Setup
 * Jalankan: node build.js
 * Ini akan init Capacitor Android project jika belum ada
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', ...opts });
}

console.log('╔═══════════════════════════════╗');
console.log('║   WebRunner Build Setup       ║');
console.log('╚═══════════════════════════════╝\n');

// 1. Install deps
if (!fs.existsSync('node_modules')) {
  run('npm install');
}

// 2. Add Android platform if not exists
if (!fs.existsSync('android')) {
  console.log('\n📱 Adding Android platform...');
  run('npx cap add android');
}

// 3. Add FilePicker plugin
run('npm install @capawesome-team/capacitor-file-picker');

// 4. Sync
run('npx cap sync android');

// 5. Apply patches
console.log('\n🔧 Applying patches...');

// Manifest
const manifestDest = path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml');
fs.copyFileSync(path.join('android-patch', 'AndroidManifest.xml'), manifestDest);
console.log('  ✓ AndroidManifest.xml patched');

// file_paths.xml
const xmlDir = path.join('android', 'app', 'src', 'main', 'res', 'xml');
fs.mkdirSync(xmlDir, { recursive: true });
fs.copyFileSync(path.join('android-patch', 'file_paths.xml'), path.join(xmlDir, 'file_paths.xml'));
console.log('  ✓ file_paths.xml patched');

// MainActivity
const javaDir = path.join('android', 'app', 'src', 'main', 'java', 'com', 'webrunner', 'app');
fs.mkdirSync(javaDir, { recursive: true });
fs.copyFileSync(path.join('android-patch', 'MainActivity.java'), path.join(javaDir, 'MainActivity.java'));
console.log('  ✓ MainActivity.java patched');

// FolderPickerPlugin
fs.copyFileSync(path.join('android-patch', 'FolderPickerPlugin.java'), path.join(javaDir, 'FolderPickerPlugin.java'));
console.log('  ✓ FolderPickerPlugin.java patched');

console.log('\n✅ Setup selesai!');
console.log('\nLangkah selanjutnya:');
console.log('  npx cap open android     → buka di Android Studio');
console.log('  atau push ke GitHub → Actions akan build APK otomatis\n');
