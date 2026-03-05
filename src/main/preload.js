const { contextBridge, ipcRenderer } = require('electron');

// Renderer'a güvenli API köprüsü
contextBridge.exposeInMainWorld('api', {
  // Kullanıcı
  kullaniciGetir: () => ipcRenderer.invoke('kullanici:getir'),
  kullaniciKaydet: (data) => ipcRenderer.invoke('kullanici:kaydet', data),

  // UDF
  udfYukle: () => ipcRenderer.invoke('dosya:udfYukle'),

  // Dosya
  dosyaListele: (arsiv) => ipcRenderer.invoke('dosya:listele', arsiv),
  dosyaGetir: (id) => ipcRenderer.invoke('dosya:getir', id),
  dosyaKaydet: (data) => ipcRenderer.invoke('dosya:kaydet', data),
  dosyaGuncelle: (data) => ipcRenderer.invoke('dosya:guncelle', data),
  dosyaDurumDegistir: (id, arsiv) => ipcRenderer.invoke('dosya:durumDegistir', id, arsiv),
  dosyaSil: (id) => ipcRenderer.invoke('dosya:sil', id),
  dosyaAra: (sorgu) => ipcRenderer.invoke('dosya:ara', sorgu),

  // Kişi
  kisiListele: (dosyaId) => ipcRenderer.invoke('kisi:listele', dosyaId),
  kisiGetir: (id) => ipcRenderer.invoke('kisi:getir', id),
  kisiKaydet: (data) => ipcRenderer.invoke('kisi:kaydet', data),
  kisiGuncelle: (data) => ipcRenderer.invoke('kisi:guncelle', data),
  kisiSil: (id) => ipcRenderer.invoke('kisi:sil', id),

  // Tebligat / Talimat / Ek Süre
  tebligatEkle: (data) => ipcRenderer.invoke('tebligat:ekle', data),
  tebligatListele: (dosyaId) => ipcRenderer.invoke('tebligat:listele', dosyaId),
  talimatEkle: (data) => ipcRenderer.invoke('talimat:ekle', data),
  talimatListele: (dosyaId) => ipcRenderer.invoke('talimat:listele', dosyaId),
  ekSureEkle: (data) => ipcRenderer.invoke('ekSure:ekle', data),
  ekSureListele: (dosyaId) => ipcRenderer.invoke('ekSure:listele', dosyaId),

  // Notlar
  notKaydet: (id, tur, icerik) => ipcRenderer.invoke('not:kaydet', { id, tur, icerik }),
  notGetir: (id, tur) => ipcRenderer.invoke('not:getir', { id, tur }),

  // Hatırlatma
  hatirlatmaEkle: (data) => ipcRenderer.invoke('hatirlatma:ekle', data),
  hatirlatmaListele: () => ipcRenderer.invoke('hatirlatma:listele'),
  hatirlatmaKapat: (id) => ipcRenderer.invoke('hatirlatma:kapat', id),

  // Kayıt sil
  kayitSil: (tur, id) => ipcRenderer.invoke('kayit:sil', tur, id),

  // Belge
  belgeUret: (params) => ipcRenderer.invoke('belge:uret', params),

  // Pencere
  minimize: () => ipcRenderer.invoke('pencere:minimize'),
  maximize: () => ipcRenderer.invoke('pencere:maximize'),
  kapat: () => ipcRenderer.invoke('pencere:kapat'),

  // Hatırlatma uyarıları (main'den renderer'a)
  onHatirlatma: (callback) => ipcRenderer.on('hatirlatma:goster', (_, data) => callback(data)),
  hatirlatmaOtomatikKapat: (mesaj) => ipcRenderer.invoke('hatirlatma:otomatikKapat', mesaj),

  // Yedekleme
  yedekAl: () => ipcRenderer.invoke('yedek:al'),
  yedekYukle: () => ipcRenderer.invoke('yedek:yukle'),

  // Otomatik yedekleme
  autoYedekAyarlariGetir: () => ipcRenderer.invoke('autoYedek:ayarlariGetir'),
  autoYedekKaydet: (ayarlar) => ipcRenderer.invoke('autoYedek:kaydet', ayarlar),
  autoYedekKlasorSec: () => ipcRenderer.invoke('autoYedek:klasorSec'),

  // Ödemeler
  odemelerAc: () => ipcRenderer.invoke('odemeler:ac')
});
