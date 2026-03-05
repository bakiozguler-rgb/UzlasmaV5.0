/**
 * reminderManager.js — Otomatik hatırlatma kuralları
 */
const { trFormat } = require('./tarihUtils');

class ReminderManager {
  constructor(db) {
    this.db = db;
    this.interval = null;
  }

  _toDate(str) {
    if (!str) return null;
    const trMatch = str.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (trMatch) return new Date(`${trMatch[3]}-${trMatch[2]}-${trMatch[1]}T00:00:00`);
    const d = new Date(str.split('T')[0] + 'T00:00:00');
    return isNaN(d) ? null : d;
  }

  _gunFarki(d1, d2) {
    const msPerGun = 24 * 60 * 60 * 1000;
    return Math.floor((d2 - d1) / msPerGun);
  }

  // Otomatik uyarıyı kalıcı olarak kapat — DB'ye yaz
  otomatikKapat(mesaj) {
    this.db.otomatikHatirlatmaKapat(mesaj);
  }

  _gonder(mainWindow, mesaj, hatirlatmaId = null, dosyaId = null) {
    // Otomatik uyarılar (id=null) daha önce kapatılmışsa tekrar gösterme
    if (hatirlatmaId === null && this.db.otomatikHatirlatmaKapatildiMi(mesaj)) return;
    mainWindow.webContents.send('hatirlatma:goster', { hatirlatmaId, mesaj, dosyaId });
  }

  checkReminders(mainWindow) {
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    try {
      this._manuelKontrol(mainWindow, bugun);
      const dosyalar = this.db.dosyaListele(0);
      for (const dosya of dosyalar) {
        const kisiler = this.db.kisiListele(dosya.id);
        const label = `${dosya.adliye || ''}/${dosya.uzlastirma_no || ''}`;
        this._gorevlendirmeKontrol(mainWindow, bugun, dosya, label);
        this._tebligatKontrol(mainWindow, bugun, dosya, label, kisiler);
        this._talimatKontrol(mainWindow, bugun, dosya, label, kisiler);
        this._ekSureKontrol(mainWindow, bugun, dosya, label);
        this._sscYasKontrol(mainWindow, dosya, label, kisiler);
      }
    } catch (e) {
      console.error('[ReminderManager] Hata:', e.message);
    }
  }

  _manuelKontrol(mainWindow, bugun) {
    const hatirlatmalar = this.db.hatirlatmaListele();
    hatirlatmalar.forEach(h => {
      if (!h.tarih) return;
      const tarih = this._toDate(h.tarih);
      if (!tarih) return;
      tarih.setHours(0, 0, 0, 0);
      if (tarih <= bugun) this._gonder(mainWindow, h.mesaj, h.id, h.dosya_id);
    });
  }

  _gorevlendirmeKontrol(mainWindow, bugun, dosya, label) {
    if (!dosya.gorevlendirme_tarihi) return;
    const gorev = this._toDate(dosya.gorevlendirme_tarihi);
    if (!gorev) return;
    gorev.setHours(0, 0, 0, 0);
    const gecenGun = this._gunFarki(gorev, bugun);
    if (gecenGun >= 20 && gecenGun <= 30) {
      this._gonder(mainWindow, `${label} sayılı dosyada 10 gününüz kaldı.`, null, dosya.id);
    }
  }

  _tebligatKontrol(mainWindow, bugun, dosya, label, kisiler) {
    const tebligatlar = this.db.tebligatListele(dosya.id);
    tebligatlar.forEach(t => {
      if (!t.tarih) return;
      const tarih = this._toDate(t.tarih);
      if (!tarih) return;
      tarih.setHours(0, 0, 0, 0);
      const gecenGun = this._gunFarki(tarih, bugun);
      if (gecenGun >= 7 && gecenGun <= 14) {
        const kisi = kisiler.find(k => k.id === t.kisi_id) || {};
        this._gonder(mainWindow, `${label}/${kisi.sifat || ''}/${kisi.ad_soyad || ''} için Tebligat Talebinizi Kontrol Edin`, null, dosya.id);
      }
    });
  }

  _talimatKontrol(mainWindow, bugun, dosya, label, kisiler) {
    const talimatlar = this.db.talimatListele(dosya.id);
    talimatlar.forEach(t => {
      if (!t.tarih) return;
      const tarih = this._toDate(t.tarih);
      if (!tarih) return;
      tarih.setHours(0, 0, 0, 0);
      const gecenGun = this._gunFarki(tarih, bugun);
      if (gecenGun >= 7 && gecenGun <= 14) {
        const kisi = kisiler.find(k => k.id === t.kisi_id) || {};
        this._gonder(mainWindow, `${label}/${kisi.sifat || ''}/${kisi.ad_soyad || ''} için Talimat Talebinizi Kontrol Edin`, null, dosya.id);
      }
    });
  }

  _ekSureKontrol(mainWindow, bugun, dosya, label) {
    const ekSureler = this.db.ekSureListele(dosya.id);
    ekSureler.forEach(e => {
      if (!e.tarih) return;
      const tarih = this._toDate(e.tarih);
      if (!tarih) return;
      tarih.setHours(0, 0, 0, 0);
      const gecenGun = this._gunFarki(tarih, bugun);
      if (gecenGun >= 15 && gecenGun <= 20) {
        this._gonder(mainWindow, `${label} sayılı dosyada 5 gününüz kaldı. (${e.tur})`, null, dosya.id);
      }
    });
  }

  _sscYasKontrol(mainWindow, dosya, label, kisiler) {
    const sscler = kisiler.filter(k =>
      k.sifat && k.sifat.normalize('NFC').trim().toLowerCase() === 'suça sürüklenen çocuk'
    );
    const bugun = new Date();
    bugun.setHours(0, 0, 0, 0);
    sscler.forEach(k => {
      if (!k.dogum_tarihi) return;
      const dogum = this._toDate(k.dogum_tarihi);
      if (!dogum) return;
      const yas18 = new Date(dogum);
      yas18.setFullYear(yas18.getFullYear() + 18);
      yas18.setHours(0, 0, 0, 0);
      if (bugun >= yas18) {
        this._gonder(mainWindow, `${label}/${k.sifat}/${k.ad_soyad} 18 yaşını doldurmuştur.`, null, dosya.id);
      }
    });
  }

  checkRemindersSync(mainWindow) { this.checkReminders(mainWindow); }

  baslat(mainWindow, intervalMs = 60 * 60 * 1000) {
    this.checkReminders(mainWindow);
    this.interval = setInterval(() => this.checkReminders(mainWindow), intervalMs);
  }

  durdur() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }
}

module.exports = ReminderManager;
