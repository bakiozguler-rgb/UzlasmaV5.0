# Uzlaştırma Dosya Yönetim Sistemi

## Kurulum

```bash
npm install
npm start
```

## Gereksinimler
- Node.js 18+
- Electron 29+
- PDF üretimi için: LibreOffice (opsiyonel)

## Klasör Yapısı

```
uzlastirma/
├── package.json
├── src/
│   ├── main/
│   │   ├── main.js           # Electron ana süreç
│   │   ├── preload.js        # Güvenli köprü (contextBridge)
│   │   └── database.js       # SQLite veritabanı katmanı
│   ├── renderer/
│   │   ├── index.html        # Ana arayüz
│   │   ├── app.js            # UI mantığı
│   │   └── styles/
│   │       └── main.css      # Tasarım
│   └── utils/
│       ├── udfParser.js      # UDF dosya ayrıştırıcı
│       ├── documentGenerator.js  # Belge üretici (docxtemplater)
│       ├── reminderManager.js    # Hatırlatma motoru
│       └── tarihUtils.js     # Tarih yardımcıları
├── templates/                # docx şablonları (sizin hazırlayacağınız)
│   ├── teklif_formu.docx
│   ├── uzlastirma_raporu.docx
│   ├── ek_sure_talebi.docx
│   ├── talimat_talebi.docx
│   └── ust_yazi.docx
└── database/                 # (runtime'da userData'ya taşınır)
```

## Şablon Değişkenleri (docxtemplater)

Tüm şablonlarda geçerli:
`{{ADLIYE}}` `{{UZLASTIRMA_NO}}` `{{SORUSTURMA_NO}}` `{{SUC}}`
`{{GOREVLENDIRME_TARIHI}}` `{{BUGUN_TARIHI}}`
`{{UZL_AD_SOYAD}}` `{{UZL_SICIL_NO}}` `{{UZL_ADRES}}` `{{UZL_TELEFON}}`

Tekil taraf (Teklif Formu):
`{{TARAF_SIFAT}}` `{{TARAF_AD_SOYAD}}` `{{TARAF_TC_NO}}`
`{{TARAF_BABA_ADI}}` `{{TARAF_ANNE_ADI}}` `{{TARAF_DOGUM_TARIHI}}`
`{{TARAF_ADRES}}` `{{TARAF_TELEFON}}`

Taraf döngüsü (Rapor):
`{#TARAFLAR}` `{{SIFAT}}` `{{AD_SOYAD}}` ... `{/TARAFLAR}`

Rapor özgü:
`{{UZLASMA_TURU}}` `{{UZLASTIRMA_SONUCU}}` `{{EDIM_SEKLI_ZAMANI}}`

Ek Süre: `{{EK_SURE_TURU}}` `{{EK_SURE_ICERIK}}`
Talimat: `{{TALIMAT_ADLIYE}}` `{{TALIMAT_TARAF_AD_SOYAD}}` `{{TALIMAT_ICERIK}}`
Üst Yazı: `{{UST_YAZI_ICERIK}}`
