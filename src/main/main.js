const { app, BrowserWindow, ipcMain, dialog, shell, Menu, clipboard } = require('electron');
const path = require('path');
const Database = require('./database');
const UDFParser = require('../utils/udfParser');
const DocumentGenerator = require('../utils/documentGenerator');
const ReminderManager = require('../utils/reminderManager');

let mainWindow;
let db;
let reminderManager;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hidden',
    frame: false,
    show: false,
    backgroundColor: '#1a1f2e'
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  contextMenuKur(mainWindow);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Renderer tamamen yüklenip ipcRenderer dinleyicileri kurulduktan sonra hatırlatmaları başlat
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(() => {
      reminderManager.baslat(mainWindow);
    }, 1500);
  });
}

app.whenReady().then(async () => {
  db = new Database(path.join(app.getPath('userData'), 'uzlastirma.db'));
  await db.initialize();
  reminderManager = new ReminderManager(db);
  // Otomatik yedeklemeyi başlat
  autoYedekZamanla(autoYedekAyarlariOku());
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC HANDLERS ─────────────────────────────────────────────

// Kullanıcı bilgileri
ipcMain.handle('kullanici:getir', () => db.kullaniciGetir());
ipcMain.handle('kullanici:kaydet', (_, data) => db.kullaniciKaydet(data));

// UDF'den dosya yükle
ipcMain.handle('dosya:udfYukle', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'UDF Dosyaları', extensions: ['udf', 'txt'] }]
  });
  if (!filePaths.length) return null;
  const parser = new UDFParser();
  return parser.parse(filePaths);
});

// Dosya CRUD
ipcMain.handle('dosya:listele', (_, arsiv) => db.dosyaListele(arsiv));
ipcMain.handle('dosya:getir', (_, id) => db.dosyaGetir(id));
ipcMain.handle('dosya:kaydet', (_, data) => {
  console.log('=KAYDET= adliye:[' + data.adliye + '] kisiler:' + (data.kisiler ? data.kisiler.length : 'YOK'));
  if (!data.adliye) data.adliye = '(belirtilmedi)';
  try {
    const id = db.dosyaKaydet(data);
    console.log('=KAYDET= id:' + id + ' kisi:' + db.kisiListele(id).length);
    return id;
  } catch(e) {
    console.error('=KAYDET= HATA:', e.message);
    throw e;
  }
});
ipcMain.handle('dosya:guncelle', (_, data) => db.dosyaGuncelle(data));
ipcMain.handle('dosya:durumDegistir', (_, id, arsiv) => db.dosyaDurumDegistir(id, arsiv));
ipcMain.handle('dosya:sil', (_, id) => db.dosyaSil(id));
ipcMain.handle('dosya:ara', (_, sorgu) => db.dosyaAra(sorgu));

// Kişi CRUD
ipcMain.handle('kisi:listele', (_, dosyaId) => {
  const sonuc = db.kisiListele(dosyaId);
  console.log('kisi:listele dosyaId='+dosyaId+' sonuc='+JSON.stringify(sonuc));
  return sonuc;
});
ipcMain.handle('kisi:getir', (_, id) => db.kisiGetir(id));
ipcMain.handle('kisi:kaydet', (_, data) => {
  const id = db.kisiKaydet(data);
  // Yeni kişi eklendikten sonra hatırlatmaları hemen kontrol et
  setTimeout(() => reminderManager.checkReminders(mainWindow), 500);
  return id;
});
ipcMain.handle('kisi:guncelle', (_, data) => db.kisiGuncelle(data));
ipcMain.handle('kisi:sil', (_, id) => db.kisiSil(id));

// Tebligat / Talimat / Ek Süre
ipcMain.handle('tebligat:ekle', (_, data) => db.tebligatEkle(data));
ipcMain.handle('tebligat:listele', (_, dosyaId) => db.tebligatListele(dosyaId));
ipcMain.handle('talimat:ekle', (_, data) => db.talimatEkle(data));
ipcMain.handle('talimat:listele', (_, dosyaId) => db.talimatListele(dosyaId));
ipcMain.handle('ekSure:ekle', (_, data) => db.ekSureEkle(data));
ipcMain.handle('ekSure:listele', (_, dosyaId) => db.ekSureListele(dosyaId));

// Notlar (markdown autosave)
ipcMain.handle('not:kaydet', (_, { id, tur, icerik }) => db.notKaydet(id, tur, icerik));
ipcMain.handle('not:getir', (_, { id, tur }) => db.notGetir(id, tur));

// Hatırlatma
ipcMain.handle('hatirlatma:ekle', (_, data) => db.hatirlatmaEkle(data));
ipcMain.handle('hatirlatma:listele', () => db.hatirlatmaListele());
ipcMain.handle('hatirlatma:kapat', (_, id) => db.hatirlatmaKapat(id));
// Otomatik uyarı kapatıldığında (id=null olanlar) tekrar gösterme
ipcMain.handle('hatirlatma:otomatikKapat', (_, mesaj) => reminderManager.otomatikKapat(mesaj));

// Belge üretimi
ipcMain.handle('belge:uret', async (_, { tur, dosyaId, tarafIds, icerik, format }) => {
  const generator = new DocumentGenerator(db, app.getPath('userData'));
  const kullanici = db.kullaniciGetir();
  const dosya = db.dosyaGetir(dosyaId);

  // tarafIds: seçili kişi ID'leri (dizi)
  // - Teklif: mutlaka dolu gelir (renderer zaten boşsa engeller)
  // - Diğerleri: boş [] gelirse tüm taraflar alınır
  const taraflar = (tarafIds && tarafIds.length > 0)
    ? tarafIds.map(id => db.kisiGetir(id))
    : db.kisiListele(dosyaId);
  
  const outputPath = await generator.uret({ tur, dosya, taraflar, icerik, kullanici, format });
  if (outputPath) shell.openPath(outputPath);
  return outputPath;
});

// Kayıt sil (tebligat / talimat / ekSure)
ipcMain.handle('kayit:sil', (_, tur, kayitId) => {
  if (tur === 'tebligat') return db.tebligatSil(kayitId);
  if (tur === 'talimat')  return db.talimatSil(kayitId);
  if (tur === 'eksure')   return db.ekSureSil(kayitId);
  throw new Error('Geçersiz kayıt türü: ' + tur);
});

// Yedekleme
ipcMain.handle('yedek:al', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Yedeği Kaydet',
    defaultPath: `uzlastirma_yedek_${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'Veritabanı', extensions: ['db'] }]
  });
  if (!filePath) return false;
  const fs = require('fs');
  const kaynakPath = require('path').join(app.getPath('userData'), 'uzlastirma.db');
  fs.copyFileSync(kaynakPath, filePath);
  return true;
});

ipcMain.handle('yedek:yukle', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Yedek Dosyası Seç',
    filters: [{ name: 'Veritabanı', extensions: ['db'] }],
    properties: ['openFile']
  });
  if (!filePaths || !filePaths.length) return false;
  const fs = require('fs');
  const hedefPath = require('path').join(app.getPath('userData'), 'uzlastirma.db');
  fs.copyFileSync(filePaths[0], hedefPath);
  // DB'yi yeniden yükle
  db = new Database(hedefPath);
  await db.initialize();
  reminderManager = new ReminderManager(db);
  return true;
});

// Sağ tık menüsü — tüm input/textarea alanları için
function contextMenuKur(window) {
  window.webContents.on('context-menu', (_, params) => {
    if (!params.isEditable && !params.selectionText) return;

    const menu = Menu.buildFromTemplate([
      {
        label: 'Kes',
        accelerator: 'CmdOrCtrl+X',
        enabled: params.isEditable && params.selectionText.length > 0,
        click: () => window.webContents.cut()
      },
      {
        label: 'Kopyala',
        accelerator: 'CmdOrCtrl+C',
        enabled: params.selectionText.length > 0,
        click: () => window.webContents.copy()
      },
      {
        label: 'Yapıştır',
        accelerator: 'CmdOrCtrl+V',
        enabled: params.isEditable,
        click: () => window.webContents.paste()
      },
      { type: 'separator' },
      {
        label: 'Tümünü Seç',
        accelerator: 'CmdOrCtrl+A',
        enabled: params.isEditable || params.selectionText.length > 0,
        click: () => window.webContents.selectAll()
      },
      { type: 'separator' },
      {
        label: 'Sil',
        enabled: params.isEditable && params.selectionText.length > 0,
        click: () => window.webContents.delete()
      }
    ]);

    menu.popup({ window });
  });
}

// ─── ÖDEMELER DOSYASI ────────────────────────────────────────
ipcMain.handle('odemeler:ac', () => {
  const odemelerPath = app.isPackaged
    ? require('path').join(process.resourcesPath, 'Templates', 'OdemeTakip.html')
    : require('path').join(__dirname, '../../Templates', 'OdemeTakip.html');
  shell.openPath(odemelerPath);
  return true;
});

// ─── OTOMATİK YEDEKLEME ──────────────────────────────────────
const fs = require('fs');
const autoYedekPath = () => require('path').join(app.getPath('userData'), 'auto_yedek_ayar.json');

function autoYedekAyarlariOku() {
  try {
    if (fs.existsSync(autoYedekPath())) {
      return JSON.parse(fs.readFileSync(autoYedekPath(), 'utf8'));
    }
  } catch(e) {}
  return { aktif: false, aralik: 'haftalik', klasor: '', adet: 5 };
}

function autoYedekAyarlariYaz(ayarlar) {
  fs.writeFileSync(autoYedekPath(), JSON.stringify(ayarlar), 'utf8');
}

function autoYedekAl(ayarlar) {
  if (!ayarlar.aktif || !ayarlar.klasor) return;
  if (!fs.existsSync(ayarlar.klasor)) return;

  const tarih = new Date().toISOString().replace(/[:.]/g, '-').split('T');
  const dosyaAdi = `uzlastirma_oto_${tarih[0]}.db`;
  const hedef = require('path').join(ayarlar.klasor, dosyaAdi);
  const kaynak = require('path').join(app.getPath('userData'), 'uzlastirma.db');

  try {
    fs.copyFileSync(kaynak, hedef);
    console.log('[AutoYedek] Yedek alındı:', hedef);

    // Eski yedekleri temizle (en fazla `adet` kadar tut)
    const dosyalar = fs.readdirSync(ayarlar.klasor)
      .filter(f => f.startsWith('uzlastirma_oto_') && f.endsWith('.db'))
      .sort();
    while (dosyalar.length > ayarlar.adet) {
      fs.unlinkSync(require('path').join(ayarlar.klasor, dosyalar.shift()));
    }
  } catch(e) {
    console.error('[AutoYedek] Hata:', e.message);
  }
}

function autoYedekZamanla(ayarlar) {
  if (global._autoYedekTimer) clearInterval(global._autoYedekTimer);
  if (!ayarlar.aktif || !ayarlar.klasor) return;

  const araliklarMs = {
    'gunluk':   24 * 60 * 60 * 1000,
    'haftalik':  7 * 24 * 60 * 60 * 1000,
    'aylik':    30 * 24 * 60 * 60 * 1000
  };
  const ms = araliklarMs[ayarlar.aralik] || araliklarMs['haftalik'];
  // Açılışta bir kez al, sonra periyodik
  autoYedekAl(ayarlar);
  global._autoYedekTimer = setInterval(() => autoYedekAl(ayarlar), ms);
}

ipcMain.handle('autoYedek:ayarlariGetir', () => autoYedekAyarlariOku());
ipcMain.handle('autoYedek:kaydet', (_, ayarlar) => {
  autoYedekAyarlariYaz(ayarlar);
  autoYedekZamanla(ayarlar);
  return true;
});
ipcMain.handle('autoYedek:klasorSec', async () => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Otomatik Yedek Klasörü Seç',
    properties: ['openDirectory']
  });
  return filePaths && filePaths.length ? filePaths[0] : null;
});

// Pencere kontrolleri (frameless window için)
ipcMain.handle('pencere:minimize', () => mainWindow.minimize());
ipcMain.handle('pencere:maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.handle('pencere:kapat', () => mainWindow.close());
