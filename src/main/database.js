/**
 * database.js — sql.js tabanlı SQLite katmanı
 * better-sqlite3 yerine sql.js kullanır (derleme gerektirmez)
 */
const path = require('path');
const fs   = require('fs');

class DB {
  constructor(dbPath) {
    this.dbPath = dbPath;
    // sql.js'i lazy yükle
    const initSqlJs = require('sql.js');
    // Senkron başlatma için wrapper
    this._ready = initSqlJs().then(SQL => {
      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }
      // Diske kaydetme yardımcısı
      this._save = () => {
        const data = this.db.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
      };
    });
  }

  // Tüm public metodları çağırmadan önce await db.ready() yapılmalı
  async ready() {
    await this._ready;
    return this;
  }

  _run(sql, params = []) {
    this.db.run(sql, params);
    // _save() last_insert_rowid()'yi sıfırladığı için ÖNCE okuyoruz
    const res = this.db.exec('SELECT last_insert_rowid()');
    this._lastInsertId = (res && res[0] && res[0].values[0]) ? Number(res[0].values[0][0]) : 0;
    this._save();
  }

  _get(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      stmt.free();
      return row;
    }
    stmt.free();
    return null;
  }

  _all(sql, params = []) {
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  _lastId() {
    return this._lastInsertId || 0;
  }

  async initialize() {
    await this._ready;  // sql.js hazır olana kadar bekle
    const sql = `
      CREATE TABLE IF NOT EXISTS kullanici (
        id INTEGER PRIMARY KEY DEFAULT 1,
        ad_soyad TEXT, sicil_no TEXT, adres TEXT, telefon TEXT
      );
      CREATE TABLE IF NOT EXISTS dosyalar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        adliye TEXT,
        sorusturma_no TEXT, uzlastirma_no TEXT, suc TEXT,
        gorevlendirme_tarihi TEXT,
        arsiv INTEGER DEFAULT 0,
        olusturma_tarihi TEXT DEFAULT (date('now')),
        notlar TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS kisiler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER,
        sifat TEXT, tc_no TEXT, ad_soyad TEXT,
        baba_adi TEXT, anne_adi TEXT, dogum_tarihi TEXT,
        adres TEXT, telefon TEXT, notlar TEXT DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS tebligatlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER,
        kisi_id INTEGER, tur TEXT,
        tarih TEXT DEFAULT (date('now'))
      );
      CREATE TABLE IF NOT EXISTS talimatlar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER,
        kisi_id INTEGER, adliye TEXT, icerik TEXT,
        tarih TEXT DEFAULT (date('now'))
      );
      CREATE TABLE IF NOT EXISTS ek_sureler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER,
        tur TEXT, tarih TEXT DEFAULT (date('now'))
      );
      CREATE TABLE IF NOT EXISTS hatirlatmalar (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dosya_id INTEGER,
        mesaj TEXT, tarih TEXT,
        tekrar INTEGER DEFAULT 1, kapali INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS kayit_notlari (
        kayit_key TEXT PRIMARY KEY,
        icerik TEXT DEFAULT ''
      );
    `;
    this.db.exec(sql);
    this._save();
  }

  // ─── KULLANICI ──────────────────────────────────────────────
  kullaniciGetir() {
    return this._get('SELECT * FROM kullanici WHERE id = 1') || {};
  }
  kullaniciKaydet(data) {
    const mevcut = this.kullaniciGetir();
    if (mevcut.id) {
      this._run('UPDATE kullanici SET ad_soyad=?, sicil_no=?, adres=?, telefon=? WHERE id=1',
        [data.adSoyad, data.sicilNo, data.adres, data.telefon]);
    } else {
      this._run('INSERT INTO kullanici (id, ad_soyad, sicil_no, adres, telefon) VALUES (1,?,?,?,?)',
        [data.adSoyad, data.sicilNo, data.adres, data.telefon]);
    }
    return true;
  }

  // ─── DOSYALAR ───────────────────────────────────────────────
  dosyaListele(arsiv = 0) {
    return this._all('SELECT * FROM dosyalar WHERE arsiv = ? ORDER BY olusturma_tarihi DESC', [arsiv ? 1 : 0]);
  }
  dosyaGetir(id) {
    return this._get('SELECT * FROM dosyalar WHERE id = ?', [id]);
  }
  dosyaKaydet(data) {
    this._run(
      'INSERT INTO dosyalar (adliye, sorusturma_no, uzlastirma_no, suc, gorevlendirme_tarihi) VALUES (?,?,?,?,?)',
      [data.adliye, data.sorusturmaNo, data.uzlastirmaNo, data.suc, data.gorevlendirmeTarihi]
    );
    const newId = this._lastId();
    if (data.kisiler) {
      data.kisiler.forEach(k => this.kisiKaydet({ ...k, dosyaId: newId }));
    }
    return newId;
  }
  dosyaGuncelle(data) {
    this._run(
      'UPDATE dosyalar SET adliye=?, sorusturma_no=?, uzlastirma_no=?, suc=?, gorevlendirme_tarihi=? WHERE id=?',
      [data.adliye, data.sorusturmaNo, data.uzlastirmaNo, data.suc, data.gorevlendirmeTarihi, data.id]
    );
    return true;
  }
  dosyaDurumDegistir(id, arsiv) {
    this._run('UPDATE dosyalar SET arsiv = ? WHERE id = ?', [arsiv ? 1 : 0, id]);
    return true;
  }
  dosyaSil(id) {
    // Dosyaya bağlı tüm kayıtları sil
    this._run('DELETE FROM kisiler WHERE dosya_id = ?', [id]);
    this._run('DELETE FROM tebligatlar WHERE dosya_id = ?', [id]);
    this._run('DELETE FROM talimatlar WHERE dosya_id = ?', [id]);
    this._run('DELETE FROM ek_sureler WHERE dosya_id = ?', [id]);
    this._run('DELETE FROM hatirlatmalar WHERE dosya_id = ?', [id]);
    this._run('DELETE FROM dosyalar WHERE id = ?', [id]);
    return true;
  }
  dosyaAra(sorgu) {
    const q = `%${sorgu}%`;
    return this._all(`
      SELECT d.*,
        CASE WHEN d.arsiv = 1 THEN 'Arşiv' ELSE 'Derdest' END AS durum
      FROM dosyalar d
      LEFT JOIN kisiler k ON k.dosya_id = d.id
      WHERE d.adliye LIKE ? OR d.uzlastirma_no LIKE ? OR d.sorusturma_no LIKE ? OR k.ad_soyad LIKE ?
      GROUP BY d.id
      ORDER BY d.olusturma_tarihi DESC
    `, [q, q, q, q]);
  }

  // ─── KİŞİLER ────────────────────────────────────────────────
  kisiListele(dosyaId) {
    return this._all('SELECT * FROM kisiler WHERE dosya_id = ?', [dosyaId]);
  }
  kisiGetir(id) {
    return this._get('SELECT * FROM kisiler WHERE id = ?', [id]);
  }
  kisiKaydet(data) {
    this._run(
      'INSERT INTO kisiler (dosya_id, sifat, tc_no, ad_soyad, baba_adi, anne_adi, dogum_tarihi, adres, telefon) VALUES (?,?,?,?,?,?,?,?,?)',
      [data.dosyaId, data.sifat, data.tcNo, data.adSoyad, data.babaAdi, data.anneAdi, data.dogumTarihi, data.adres, data.telefon]
    );
    return this._lastId();
  }
  kisiGuncelle(data) {
    this._run(
      'UPDATE kisiler SET sifat=?, tc_no=?, ad_soyad=?, baba_adi=?, anne_adi=?, dogum_tarihi=?, adres=?, telefon=? WHERE id=?',
      [data.sifat, data.tcNo, data.adSoyad, data.babaAdi, data.anneAdi, data.dogumTarihi, data.adres, data.telefon, data.id]
    );
    return true;
  }
  kisiSil(id) {
    this._run('DELETE FROM kisiler WHERE id = ?', [id]);
    return true;
  }

  // ─── TEBLİGAT / TALİMAT / EK SÜRE ──────────────────────────
  tebligatEkle(data) {
    this._run('INSERT INTO tebligatlar (dosya_id, kisi_id, tur) VALUES (?,?,?)',
      [data.dosyaId, data.kisiId, data.tur]);
    return this._lastId();
  }
  tebligatListele(dosyaId) {
    return this._all(`
      SELECT t.*, k.ad_soyad, k.sifat FROM tebligatlar t
      LEFT JOIN kisiler k ON k.id = t.kisi_id
      WHERE t.dosya_id = ?`, [dosyaId]);
  }
  talimatEkle(data) {
    this._run('INSERT INTO talimatlar (dosya_id, kisi_id, adliye, icerik) VALUES (?,?,?,?)',
      [data.dosyaId, data.kisiId, data.adliye, data.icerik]);
    return this._lastId();
  }
  talimatListele(dosyaId) {
    return this._all(`
      SELECT t.*, k.ad_soyad, k.sifat FROM talimatlar t
      LEFT JOIN kisiler k ON k.id = t.kisi_id
      WHERE t.dosya_id = ?`, [dosyaId]);
  }
  ekSureEkle(data) {
    this._run('INSERT INTO ek_sureler (dosya_id, tur) VALUES (?,?)', [data.dosyaId, data.tur]);
    return this._lastId();
  }
  ekSureListele(dosyaId) {
    return this._all('SELECT * FROM ek_sureler WHERE dosya_id = ?', [dosyaId]);
  }
  tebligatSil(id) {
    this._run('DELETE FROM tebligatlar WHERE id = ?', [id]);
    return true;
  }
  talimatSil(id) {
    this._run('DELETE FROM talimatlar WHERE id = ?', [id]);
    return true;
  }
  ekSureSil(id) {
    this._run('DELETE FROM ek_sureler WHERE id = ?', [id]);
    return true;
  }

  // ─── NOTLAR ─────────────────────────────────────────────────
  notKaydet(id, tur, icerik) {
    if (tur === 'dosya') {
      this._run('UPDATE dosyalar SET notlar = ? WHERE id = ?', [icerik, id]);
    } else if (tur === 'kisi') {
      this._run('UPDATE kisiler SET notlar = ? WHERE id = ?', [icerik, id]);
    } else {
      // kayit türü: id = "tebligat_5" gibi bileşik key, notlar tablosuna yaz
      this._run(
        'INSERT INTO kayit_notlari (kayit_key, icerik) VALUES (?,?) ON CONFLICT(kayit_key) DO UPDATE SET icerik=excluded.icerik',
        [String(id), icerik]
      );
    }
    return true;
  }
  notGetir(id, tur) {
    if (tur === 'dosya') {
      const r = this._get('SELECT notlar FROM dosyalar WHERE id = ?', [id]);
      return r ? r.notlar : '';
    } else if (tur === 'kisi') {
      const r = this._get('SELECT notlar FROM kisiler WHERE id = ?', [id]);
      return r ? r.notlar : '';
    } else {
      // kayit türü
      const r = this._get('SELECT icerik FROM kayit_notlari WHERE kayit_key = ?', [String(id)]);
      return r ? r.icerik : '';
    }
  }

  // ─── HATIRLATMALAR ──────────────────────────────────────────
  hatirlatmaEkle(data) {
    this._run('INSERT INTO hatirlatmalar (dosya_id, mesaj, tarih) VALUES (?,?,?)',
      [data.dosyaId, data.mesaj, data.tarih]);
    return this._lastId();
  }
  hatirlatmaListele() {
    return this._all('SELECT * FROM hatirlatmalar WHERE kapali = 0');
  }
  hatirlatmaKapat(id) {
    this._run('UPDATE hatirlatmalar SET kapali = 1 WHERE id = ?', [id]);
    return true;
  }

  // Otomatik uyarılar için: mesaj daha önce kapatıldı mı?
  otomatikHatirlatmaKapatildiMi(mesaj) {
    const r = this._get('SELECT id FROM hatirlatmalar WHERE mesaj = ? AND kapali = 1 AND dosya_id IS NULL', [mesaj]);
    return !!r;
  }

  // Otomatik uyarıyı kalıcı olarak kapat (DB'ye yaz)
  otomatikHatirlatmaKapat(mesaj) {
    const mevcut = this._get('SELECT id FROM hatirlatmalar WHERE mesaj = ? AND dosya_id IS NULL', [mesaj]);
    if (mevcut) {
      this._run('UPDATE hatirlatmalar SET kapali = 1 WHERE id = ?', [mevcut.id]);
    } else {
      this._run("INSERT INTO hatirlatmalar (dosya_id, mesaj, tarih, kapali) VALUES (NULL, ?, date('now'), 1)", [mesaj]);
    }
    return true;
  }

  tumAktifVeriler() {
    return {
      dosyalar:   this._all('SELECT * FROM dosyalar WHERE arsiv = 0'),
      tebligatlar: this._all('SELECT * FROM tebligatlar'),
      talimatlar:  this._all('SELECT * FROM talimatlar'),
      ekSureler:   this._all('SELECT * FROM ek_sureler'),
      kisiler:     this._all("SELECT * FROM kisiler WHERE lower(trim(sifat)) = lower(trim('Suça Sürüklenen Çocuk'))")
    };
  }
}

module.exports = DB;
