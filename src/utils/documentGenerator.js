const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { dialog, shell, app } = require('electron');
const { trFormat } = require('./tarihUtils');

class DocumentGenerator {
  constructor(db, userDataPath) {
    this.db = db;
    // Paketlenmiş (exe) ortamda Templates resources altında, geliştirmede proje kökünde
    this.templatesPath = app.isPackaged
      ? path.join(process.resourcesPath, 'Templates')
      : path.join(__dirname, '../../Templates');
    this.outputPath = path.join(userDataPath, 'belgeler');
    if (!fs.existsSync(this.outputPath)) fs.mkdirSync(this.outputPath, { recursive: true });
  }

  async uret({ tur, dosya, taraflar, icerik, kullanici, format }) {
    // Teklif: seçili her taraf için ayrı dosya üret
    if (tur === 'teklif' && taraflar.length > 1) {
      const paths = [];
      for (const taraf of taraflar) {
        const p = await this._uretTek({ tur, dosya, taraflar: [taraf], icerik, kullanici, format });
        shell.openPath(p);
        paths.push(p);
      }
      return paths[0];
    }

    // Tek taraf için üretim yap
    return await this._uretTek({ tur, dosya, taraflar, icerik, kullanici, format });
  }

  async _uretTek({ tur, dosya, taraflar, icerik, kullanici, format }) {
    const templateMap = {
      'teklif':   'Teklif.docx',
      'rapor':    'Rapor.docx',
      'ekSure':   'eksure.docx',
      'talimat':  'talimat.docx',
      'tebligat': 'tebligat.docx',
      'dilekce':  'dilekce.docx',
      'ustYazi':  'dilekce.docx'
    };

    const templateFile = path.join(this.templatesPath, templateMap[tur]);
    if (!fs.existsSync(templateFile)) {
      throw new Error(`Şablon bulunamadı: ${templateMap[tur]}`);
    }

    const content = fs.readFileSync(templateFile, 'binary');
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });

    const veri = this._veriHazirla(tur, dosya, taraflar, icerik, kullanici);
    doc.render(veri);

    const buf = doc.getZip().generate({ type: 'nodebuffer' });
    const dosyaAdi = this._dosyaAdiOlustur(tur, dosya, taraflar[0]);
    const docxPath = path.join(this.outputPath, dosyaAdi + '.docx');
    fs.writeFileSync(docxPath, buf);

    if (format === 'pdf') {
      return this._docxToPdf(docxPath);
    }
    return docxPath;
  }

  _veriHazirla(tur, dosya, taraflar, icerik, kullanici) {
    const temel = {
      ADLIYE: this._trUpper(dosya.adliye || ''),
      SORUSTURMA_NO: dosya.sorusturma_no || '',
      UZLASTIRMA_NO: dosya.uzlastirma_no || '',
      SUC: dosya.suc || '',
      GOREVLENDIRME_TARIHI: trFormat(dosya.gorevlendirme_tarihi),
      BUGUN_TARIHI: trFormat(new Date().toISOString().split('T')[0]),
      UZL_AD_SOYAD: kullanici?.ad_soyad || '',
      UZL_SICIL_NO: kullanici?.sicil_no || '',
      UZL_ADRES: kullanici?.adres || '',
      UZL_TELEFON: kullanici?.telefon || ''
    };

    if (tur === 'teklif') {
      // Teklif birden fazla kişi için ayrı ayrı üretilir
      // taraflar dizisi loop dışında; her taraf için ayrı render yapılır
      // Bu fonksiyon tek taraf için çağrılır (uret() içinde loop var)
      const taraf = taraflar[0] || {};
      return {
        ...temel,
        TC_NO:        taraf.tc_no || '',
        AD_SOYAD:     taraf.ad_soyad || '',
        BABA_ADI:     taraf.baba_adi || '',
        ANNE_ADI:     taraf.anne_adi || '',
        DOGUM_TARIHI: trFormat(taraf.dogum_tarihi),
        ADRES:        taraf.adres || '',
        TELEFON:      taraf.telefon || ''
      };
    }

    if (tur === 'rapor') {
      return {
        ...temel,
        UZLASMA_TURU: icerik?.uzlasmaTuru || '',
        UZLASTIRMA_SONUCU: icerik?.uzlastirmaSonucu || '',
        EDIM_SEKLI_ZAMANI: icerik?.edimSekliZamani || '',
        TARAFLAR: taraflar.map(k => ({
          SIFAT: k.sifat || '',
          AD_SOYAD: k.ad_soyad || '',
          TC_NO: k.tc_no || '',
          BABA_ADI: k.baba_adi || '',
          ANNE_ADI: k.anne_adi || '',
          DOGUM_TARIHI: trFormat(k.dogum_tarihi),
          ADRES: k.adres || '',
          TELEFON: k.telefon || ''
        }))
      };
    }

    // ekSure, talimat, tebligat, dilekce için ortak yapı
    return {
      ...temel,
      EK_SURE_ICERIK:  icerik?.icerik || '',
      TALIMAT_ICERIK:  icerik?.icerik || '',
      TEBLIGAT_ICERIK: icerik?.icerik || '',
      ICERIK:          icerik?.icerik || ''
    };
  }

  _dosyaAdiOlustur(tur, dosya, kisi) {
    const tarih = new Date().toISOString().split('T')[0];
    const no = (dosya.uzlastirma_no || '').replace(/[/:*?"<>|\\]/g, '_');
    const ad = (kisi && kisi.ad_soyad) ? kisi.ad_soyad.replace(/[/:*?"<>|\\]/g, '_') : '';

    switch (tur) {
      case 'teklif':
        // ad_soyad_teklif_uzlno_tarih
        return ad ? `${ad}_teklif_${no}_${tarih}` : `teklif_${no}_${tarih}`;
      case 'rapor':
        // uzlno_Rapor_tarih
        return `${no}_Rapor_${tarih}`;
      case 'ekSure':
        // uzlno_sure_tarih
        return `${no}_sure_${tarih}`;
      case 'talimat':
        // ad_soyad_uzlno_talimat_tarih
        return ad ? `${ad}_${no}_talimat_${tarih}` : `${no}_talimat_${tarih}`;
      case 'tebligat':
        // ad_soyad_tebligat_uzlno_tarih
        return ad ? `${ad}_tebligat_${no}_${tarih}` : `tebligat_${no}_${tarih}`;
      case 'dilekce':
      case 'ustYazi':
        // uzlno_dilekce_tarih
        return `${no}_dilekce_${tarih}`;
      default:
        return `${tur}_${no}_${tarih}`;
    }
  }

  _trUpper(str) {
    if (!str) return '';
    // Türkçe büyük harf: i→İ, ı→I, diğerleri standard
    return str
      .replace(/i/g, 'İ')
      .replace(/ı/g, 'I')
      .replace(/ğ/g, 'Ğ')
      .replace(/ü/g, 'Ü')
      .replace(/ş/g, 'Ş')
      .replace(/ö/g, 'Ö')
      .replace(/ç/g, 'Ç')
      .toUpperCase();
  }

  _libreOfficePath() {
    const fs = require('fs');
    // Windows'ta olası kurulum yolları
    const windowsPaths = [
      'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
      'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'LibreOffice', 'program', 'soffice.exe'),
    ].filter(Boolean);
    for (const p of windowsPaths) {
      if (fs.existsSync(p)) return `"${p}"`;
    }
    // Mac
    const macPath = '/Applications/LibreOffice.app/Contents/MacOS/soffice';
    if (fs.existsSync(macPath)) return macPath;
    // Linux / PATH'te varsa
    return 'libreoffice';
  }

  _docxToPdf(docxPath) {
    const { execSync } = require('child_process');
    const soffice = this._libreOfficePath();
    try {
      execSync(`${soffice} --headless --convert-to pdf "${docxPath}" --outdir "${path.dirname(docxPath)}"`, {
        timeout: 30000,
        windowsHide: true
      });
      const pdfPath = docxPath.replace('.docx', '.pdf');
      if (!require('fs').existsSync(pdfPath)) {
        throw new Error('PDF dosyası oluşturulamadı.');
      }
      return pdfPath;
    } catch(e) {
      throw new Error(`PDF dönüşümü başarısız: ${e.message}\nLibreOffice kurulu ve erişilebilir olmalıdır.`);
    }
  }
}

module.exports = DocumentGenerator;
