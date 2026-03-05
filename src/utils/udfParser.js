const fs   = require('fs');
const zlib = require('zlib');

class UDFParser {

  parse(filePaths) {
    const paths = Array.isArray(filePaths) ? filePaths : [filePaths];
    let gonderme = null, gorev = null;
    for (const p of paths) {
      const c = this._dosyaOku(p);
      if (this._isGorevlendirme(c)) gorev    = c;
      else                           gonderme = c;
    }
    return { dosya: this._parseDosya(gonderme, gorev), kisiler: gonderme ? this._parseKisiler(gonderme) : [] };
  }

  _dosyaOku(fp) {
    const raw = fs.readFileSync(fp);
    if (raw[0] === 0x50 && raw[1] === 0x4B) {
      try { return this._zipOku(raw); } catch(e) { console.error('ZIP err:', e.message); return ''; }
    }
    let t = raw.toString('utf-8');
    if (t.charCodeAt(0) === 0xFEFF) t = t.slice(1);
    return t;
  }

  _zipOku(raw) {
    let cdOff = -1, cdSz = -1;
    for (let i = raw.length - 22; i >= 0; i--) {
      if (raw[i]===0x50 && raw[i+1]===0x4B && raw[i+2]===0x05 && raw[i+3]===0x06) {
        cdSz = raw.readUInt32LE(i+12); cdOff = raw.readUInt32LE(i+16); break;
      }
    }
    let pos = cdOff;
    while (pos < cdOff + cdSz) {
      if (raw[pos]===0x50 && raw[pos+1]===0x4B && raw[pos+2]===0x01 && raw[pos+3]===0x02) {
        const cs  = raw.readUInt32LE(pos+20), nl = raw.readUInt16LE(pos+28);
        const el  = raw.readUInt16LE(pos+30), cl = raw.readUInt16LE(pos+32);
        const lo  = raw.readUInt32LE(pos+42);
        const nm  = raw.slice(pos+46, pos+46+nl).toString('utf-8');
        if (nm === 'content.xml') {
          const lnl = raw.readUInt16LE(lo+26), lel = raw.readUInt16LE(lo+28);
          const buf = zlib.inflateRawSync(raw.slice(lo+30+lnl+lel, lo+30+lnl+lel+cs));
          const xml = buf.toString('utf-8');
          const m = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
          return m ? m[1] : xml;
        }
        pos += 46 + nl + el + cl;
      } else break;
    }
    throw new Error('content.xml bulunamadı');
  }

  _isGorevlendirme(c) {
    return /UZLAŞTIRMACI\s+GÖREVLENDİRME/i.test(c) || /dosyaNo1/i.test(c);
  }

  // ─── DOSYA BİLGİLERİ ────────────────────────────────────────
  _parseDosya(g, gr) {
    const d = { adliye:'', sorusturmaNo:'', uzlastirmaNo:'', suc:'', gorevlendirmeTarihi:'' };
    if (!g) return d;

    const lines = g.replace(/\r/g,'').split('\n').map(l => l.trim()).filter(Boolean);

    // ── Adliye: Python mantığı — T.C. → sonraki satır → CUMHURİYET ──
    // Önce: aynı satırda "X CUMHURİYET BAŞSAVCILIĞI"
    for (let i = 0; i < Math.min(lines.length, 15); i++) {
      if (/CUMHURİYET\s+(?:BAŞ)?SAVCILIĞI/i.test(lines[i]) && lines[i].length < 100) {
        const mm = lines[i].match(/^(.+?)\s+CUMHURİYET\s+(?:BAŞ)?SAVCILIĞI/i);
        if (mm) { d.adliye = this._basHarf(mm[1]); break; }
      }
    }
    // Sonra: T.C. → bir sonraki anlamlı satır → CUMHURİYET ayrı satırda
    if (!d.adliye) {
      for (let i = 0; i < lines.length - 2; i++) {
        if (/^T\.?C\.?$/i.test(lines[i])) {
          // İkinci satır adliye, üçüncü satır CUMHURİYET olabilir
          if (/CUMHURİYET/i.test(lines[i+2])) {
            d.adliye = this._basHarf(lines[i+1]);
            break;
          }
          // Ya da hemen sonraki CUMHURİYET
          if (/CUMHURİYET/i.test(lines[i+1])) {
            const mm = lines[i+1].match(/^(.+?)\s+CUMHURİYET/i);
            if (mm) { d.adliye = this._basHarf(mm[1]); break; }
          }
        }
      }
    }

    // ── Soruşturma / Uzlaştırma No ──
    for (const l of lines) {
      if (!d.sorusturmaNo) {
        const mm = l.match(/Soruşturma\s+No\s*[\t:]+\s*(.+)/i)
                || l.match(/SORUŞTURMA\s*NO\s*[:\-]?\s*([0-9]{4}\/[0-9]+)/i);
        if (mm) d.sorusturmaNo = mm[1].trim();
      }
      if (!d.uzlastirmaNo) {
        const mm = l.match(/Uzlaştırma\s+No\s*[\t:]+\s*(.+)/i)
                || l.match(/UZLAŞ[TŞ]TIRMA\s*NO\s*[:\-]?\s*([0-9]{4}\/[0-9]+)/i);
        if (mm && !/dosyaNo/i.test(mm[1])) d.uzlastirmaNo = mm[1].trim();
      }
      if (!d.suc) {
        const mm = l.match(/^SUÇ\s*[\t:]+\s*(.+)/i);
        if (mm) d.suc = mm[1].replace(/\s*\(S\.\s*M\/M\s*:.*?\)/gi,'')
                              .split('(')[0].trim();
      }
    }

    // ── Görevlendirme belgesi ──
    if (gr && !/dosyaNo/i.test(gr)) {
      const unm = gr.match(/Uzlaştırma\s+No\s*[\t:]+\s*(.+)/i);
      if (unm) d.uzlastirmaNo = unm[1].trim();
      const tm = gr.match(/tebliğ\s+olunur\.?\s+(\d{2}\/\d{2}\/\d{4})/i);
      if (tm) d.gorevlendirmeTarihi = this._tarihCevir(tm[1]);
    }

    return d;
  }

  // ─── KİŞİLER ────────────────────────────────────────────────
  _parseKisiler(content) {
    // Python'daki iki aşamalı yaklaşım:
    // 1) Satır bazlı (orijinal JS mantığı) — numaralı satırlar için güvenilir
    // 2) Blok bazlı (Python'daki header_pat) — kalan kişileri yakalar
    const kisiler = [];
    const seen = new Set(); // TC no veya ad bazlı tekilleştirme

    // Aşama 1: Satır bazlı parse (orijinal, güvenilir)
    this._parseKisilerSatir(content, kisiler, seen);

    // Aşama 2: Blok bazlı parse — Aşama 1'in kaçırdıklarını yakala
    this._parseKisilerBlok(content, kisiler, seen);

    return kisiler;
  }

  _parseKisilerSatir(content, kisiler, seen) {
    const lines = content.replace(/\r/g,'').split('\n');

    const SIFAT_MAP = [
      ['MÜŞTEKİ ŞÜPHELİLER',      'Müşteki/Şüpheli'],
      ['MÜŞTEKİ/ŞÜPHELİ',         'Müşteki/Şüpheli'],
      ['SUÇA SÜRÜKLENEN ÇOCUK',    'Suça Sürüklenen Çocuk'],
      ['TARAF İLE İLGİLİ TARAF',   'Tarafla İlgili Taraf'],
      ['KANUNİ TEMSİLCİ',          'Kanuni Temsilci'],
      ['MAĞDUR',                   'Mağdur'],
      ['MÜŞTEKİ',                  'Müşteki'],
      ['ŞÜPHELİ',                  'Şüpheli'],
      ['MÜDAFİİ',                  'Müdafii'],
      ['VASİ',                     'Vasi'],
    ];

    const devamPat = /^[\t ]+\d+[-–]\s*[A-ZÇĞİÖŞÜ]/;
    let aktifSifat = null;

    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], lTr = l.trim();
      let eslesti = false;

      for (const [anahtar, goster] of SIFAT_MAP) {
        const pat = new RegExp(`^${anahtar.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[\\t ]*:(.*)`, 'i');
        const mm  = lTr.match(pat);
        if (mm) {
          aktifSifat = goster;
          const deger = mm[1].trim().replace(/^\d+[-–]\s*/, '');
          if (deger) {
            const k = this._kisiParse(goster, deger);
            if (k.adSoyad || k.tcNo) {
              const key = k.tcNo || k.adSoyad;
              if (!seen.has(key)) { seen.add(key); kisiler.push(k); }
            }
          }
          eslesti = true;
          break;
        }
      }
      if (eslesti) continue;

      if (aktifSifat && devamPat.test(l)) {
        const temiz = lTr.replace(/^\d+[-–]\s*/, '').trim();
        if (temiz) {
          const k = this._kisiParse(aktifSifat, temiz);
          if (k.adSoyad || k.tcNo) {
            const key = k.tcNo || k.adSoyad;
            if (!seen.has(key)) { seen.add(key); kisiler.push(k); }
          }
        }
        continue;
      }

      if (/^(SORUŞTURMA EVRAKI|KARAR:|HUKUKİ NİTELENDİRME|TÜM DOSYA|DAVACI)/i.test(lTr)) {
        aktifSifat = null;
      }
    }
  }

  _parseKisilerBlok(content, kisiler, seen) {
    // Python'daki header_pat mantığı: sıfat bloğunu yakala, içini parse et
    const SIFAT_BLOK = [
      [/MÜŞTEKİ(?:LER)?\s*\/\s*ŞÜPHELİ(?:LER)?/i,  'Müşteki/Şüpheli'],
      [/MÜŞTEKİ\s+ŞÜPHELİLER/i,                      'Müşteki/Şüpheli'],
      [/SUÇA\s+SÜRÜKLENEN\s+ÇOCUK(?:LAR)?/i,          'Suça Sürüklenen Çocuk'],
      [/KANUNİ\s+TEMSİLCİ(?:LER)?/i,                  'Kanuni Temsilci'],
      [/MAĞDUR(?:LAR)?/i,                              'Mağdur'],
      [/MÜŞTEKİ(?:LER)?/i,                             'Müşteki'],
      [/ŞÜPHELİ(?:LER)?/i,                             'Şüpheli'],
      [/VASİ/i,                                         'Vasi'],
    ];

    // Tüm sıfat başlıklarının konumlarını bul
    const lines = content.replace(/\r/g, '').split('\n');
    const bloklar = []; // { sifat, satirlar[] }

    let aktif = null;
    for (let i = 0; i < lines.length; i++) {
      const lTr = lines[i].trim();

      // Yeni sıfat başlığı mı?
      let yeniSifat = null;
      for (const [pat, goster] of SIFAT_BLOK) {
        if (new RegExp(`^(?:${pat.source})\\s*:`, 'i').test(lTr)) {
          yeniSifat = goster; break;
        }
      }

      if (yeniSifat) {
        if (aktif) bloklar.push(aktif);
        aktif = { sifat: yeniSifat, satirlar: [] };
        // Aynı satırdaki içeriği de ekle
        const icerik = lTr.replace(/^[^:]+:\s*/, '').trim();
        if (icerik) aktif.satirlar.push(icerik);
      } else if (aktif) {
        // Yeni büyük başlık gelirse bitir
        if (/^(SORUŞTURMA EVRAKI|KARAR:|HUKUKİ NİTELENDİRME|TÜM DOSYA)/i.test(lTr) && lTr.length < 60) {
          bloklar.push(aktif); aktif = null;
        } else if (lTr) {
          aktif.satirlar.push(lTr);
        }
      }
    }
    if (aktif) bloklar.push(aktif);

    // Her bloğu işle
    for (const { sifat, satirlar } of bloklar) {
      const blokMetin = satirlar.join('\n');

      // Numaralı kişileri ayır: "1- AD SOYAD..." veya "2- AD SOYAD..."
      const parcalar = blokMetin.split(/\n?\s*\d+[-–]\s+(?=[A-ZÇĞİÖŞÜ])/);

      for (const parca of parcalar) {
        const temiz = parca.trim();
        if (!temiz) continue;

        const k = this._kisiParseBlok(sifat, temiz);
        if (!k.adSoyad && !k.tcNo) continue;

        const key = k.tcNo || k.adSoyad;
        if (!seen.has(key)) { seen.add(key); kisiler.push(k); }
      }
    }
  }

  // ─── KİŞİ PARSE: Satır formatı (TC: parantez içinde) ───────
  _kisiParse(sifat, deger) {
    const k = { sifat, tcNo:'', adSoyad:'', babaAdi:'', anneAdi:'', dogumTarihi:'', adres:'', telefon:'', notlar:'' };

    // TC parantez içinde: "AD SOYAD (TC: 12345678901)"
    const tcM = deger.match(/^(.+?)\s*\(TC:\s*(\d{10,11})\)/i);
    if (tcM) {
      k.adSoyad = this._temizAd(tcM[1]);
      k.tcNo    = tcM[2].trim();
    } else {
      const v = deger.indexOf(',');
      k.adSoyad = this._temizAd(v > -1 ? deger.slice(0,v) : deger);
      if (v > -1) k.notlar = deger.slice(v+1).replace(/\s*ikamet\s+eder\.?\s*$/i,'').trim();
      return k;
    }

    // Baba / Anne: "X Oğlu/Kızı Y'den olma"
    this._parseBabaAnne(deger, k);

    // Doğum tarihi
    const dogM = deger.match(/(\d{2}\/\d{2}\/\d{4})\s+doğumlu/i);
    if (dogM) k.dogumTarihi = this._tarihCevir(dogM[1]);

    // Adres
    if (!k.adres) {
      k.adres = this._adresCikar(deger);
    }

    return k;
  }

  // ─── KİŞİ PARSE: Blok formatı (Python'dan port) ─────────────
  _kisiParseBlok(sifat, metin) {
    const k = { sifat, tcNo:'', adSoyad:'', babaAdi:'', anneAdi:'', dogumTarihi:'', adres:'', telefon:'', notlar:'' };

    // TC no
    const tcM = metin.match(/TC\s*[:\s]*([0-9]{11})/i)
             || metin.match(/\(TC:\s*([0-9]{10,11})\)/i);
    if (tcM) k.tcNo = tcM[1];

    // Ad soyad: TC'den önce, parantezden önce ya da ilk büyük harf bloğu
    const adM = metin.match(/^(.+?)\s*(?:\(TC|TC\s*:)/i)
             || metin.match(/^([A-ZÇĞİÖŞÜ\s]{3,}?)(?=\s+\d{2}\/|\s+[a-zçğışöü]|,|$)/m);
    if (adM) k.adSoyad = this._temizAd(adM[1]);

    // Baba / Anne
    this._parseBabaAnne(metin, k);

    // Doğum tarihi
    const dogM = metin.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dogM) k.dogumTarihi = this._tarihCevir(dogM[1]);

    // Adres — önce "kayıtlı", yoksa "doğumlu"
    if (!k.adres) {
      k.adres = this._adresCikar(metin);
    }

    return k;
  }

  // ─── YARDIMCI: Baba / Anne parse ────────────────────────────
  _parseBabaAnne(metin, k) {
    // "X Oğlu/Kızı Y'den olma" veya "X oğlu Y'den doğma"
    const ebM = metin.match(
      /([A-ZÇĞİÖŞÜa-zçğışöü\s]+?)\s+(?:Oğlu|Kızı|oğlu|kızı)\s+([A-ZÇĞİÖŞÜa-zçğışöü\s]+?)\s*['']?(?:den|dan|ten|tan)\s+(?:olma|doğma)/i
    );
    if (ebM) {
      const babaAdaylari = ebM[1].trim().split(/\s+/);
      k.babaAdi = babaAdaylari[babaAdaylari.length - 1]; // son kelime baba adı
      k.anneAdi = ebM[2].trim();
    }
  }

  // ─── YARDIMCI: Temiz ad ──────────────────────────────────────
  _temizAd(s) {
    if (!s) return '';
    return s.trim()
      .replace(/^\d+[-–]\s*/, '')   // baştaki numara
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ─── YARDIMCI: Adres çıkar ──────────────────────────────────
  // Önce "kayıtlı" ara → yoksa "doğumlu" ara
  // Son kelime şehir adıdır (büyük harf, "/" öncesi veya sonu)
  _adresCikar(metin) {
    let ham = '';

    // 1) "nüfusa kayıtlı" veya sadece "kayıtlı" — sonrasından al
    const kayitliM = metin.match(/(?:nüfusa\s+)?kayıtlı\s+(.+)/i);
    if (kayitliM) {
      ham = kayitliM[1];
    } else {
      // 2) "doğumlu" — sonrasından al
      const dogumluM = metin.match(/doğumlu,?\s*(.+)/i);
      if (dogumluM) ham = dogumluM[1];
    }

    if (!ham) return '';

    // Gereksiz sonu temizle: "ikamet eder", UETS kodu, satır sonu fazlalıkları
    ham = ham
      .replace(/\s+ikamet\s+eder\.?\s*$/i, '')
      .replace(/\bUETS\b.*/i, '')
      .replace(/\.?\s*$/, '')
      .replace(/\s+/g, ' ')
      .trim();

    // "ili, ilçesi, köy/mahallesi, cilt, aile sıra no, sıra no'da nüfusa kayıtlı"
    // gibi nüfus cümlesini at — gerçek sokak adresi bundan sonra gelir
    // Örnek: "...sıra no'da nüfusa kayıtlı Şahindere Mah. 29240 Sk..."
    const nufusKayitliM = ham.match(/(?:sıra\s+no['']?da\s+)?nüfusa\s+kayıtlı\s+(.+)/i);
    if (nufusKayitliM) {
      ham = nufusKayitliM[1].trim();
    }

    // Son kelime şehir adı: "Edremit/Balıkesir" veya "Osmangazi/BURSA" veya "BURSA"
    // "/" içeriyorsa tümü şehir kısmıdır, son token al
    // Adres: son "/" içeren token'a kadar + o token
    // Strateji: son boşlukla ayrılmış token şehir
    const tokenlar = ham.split(/\s+/);
    // Son token şehir: "/" veya sadece büyük harf il adı
    // Adres son şehir tokenını da içermeli — kullanıcı zaten bunu istiyor
    // Dolayısıyla ham'ı olduğu gibi döndürüyoruz, sadece nüfus cümlesi temizlendi
    return ham;
  }

  _tarihCevir(t) {
    const m = t && t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : (t||'');
  }

  _basHarf(s) {
    if (!s) return '';
    return s.trim()
      .toLowerCase()
      .replace(/i̇/g, 'i')
      .replace(/(^|\s)(\w)/g, (_, sp, ch) => sp + ch.toUpperCase());
  }
}

module.exports = UDFParser;
