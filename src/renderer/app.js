/**
 * Uzlaştırma Dosya Yönetimi - Ana Renderer
 * Tüm UI mantığı burada yönetilir.
 */

// ─── DURUM ────────────────────────────────────────────────────
const state = {
  arsivModu: false,
  seciliDosyaId: null,
  seciliDosya: null,
  acikKart: null // 'dosya' | 'kisi'
};

const SIFATLAR = [
  'Müşteki', 'Şüpheli', 'Müşteki/Şüpheli', 'Mağdur',
  'Suça Sürüklenen Çocuk', 'Vasi', 'Kanuni Temsilci',
  'Müdafii', 'Tarafla İlgili Taraf'
];

// ─── BAŞLANGIÇ ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await baslatUygulamayi();
  baglaOlaylar();
  hatirlatmalariDinle();
});

async function baslatUygulamayi() {
  const kullanici = await window.api.kullaniciGetir();
  const hosgeldin = document.getElementById('hosgeldin-kullanici');
  if (kullanici?.ad_soyad) {
    hosgeldin.textContent = `Hoş geldiniz, ${kullanici.ad_soyad}`;
  } else {
    hosgeldin.textContent = 'Lütfen kullanıcı bilgilerinizi girin (👤)';
  }
  await dosyaListesiniYenile();
}

// ─── OLAY BAĞLAMALARI ─────────────────────────────────────────
function baglaOlaylar() {
  document.getElementById('btn-dosya-ekle').addEventListener('click', dosyaEkleModal);
  document.getElementById('btn-arsiv-toggle').addEventListener('click', arsivToggle);
  document.getElementById('btn-dosya-kapat').addEventListener('click', dosyaKapatAc);
  document.getElementById('btn-belge-uret').addEventListener('click', belgeUretModal);
  document.getElementById('btn-hatirlatici').addEventListener('click', hatirlaticiEkleModal);
  document.getElementById('btn-kullanici').addEventListener('click', kullaniciBilgileriModal);
  document.getElementById('btn-yedekle').addEventListener('click', yedekleModal);
  document.getElementById('btn-search').addEventListener('click', aramayiCalistir);
  const searchInput = document.getElementById('search-input');
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') aramayiCalistir();
  });
  searchInput.addEventListener('input', () => {
    const xBtn = document.getElementById('search-clear-btn');
    if (xBtn) xBtn.style.display = searchInput.value ? 'inline-block' : 'none';
    if (!searchInput.value) dosyaListesiniYenile();
  });
  // X butonu oluştur
  const xBtn = document.createElement('button');
  xBtn.id = 'search-clear-btn';
  xBtn.textContent = '✕';
  xBtn.title = 'Temizle';
  xBtn.style.cssText = 'display:none;position:absolute;right:70px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--text-dim);cursor:pointer;font-size:14px;padding:2px 6px;';
  xBtn.addEventListener('click', () => {
    searchInput.value = '';
    xBtn.style.display = 'none';
    dosyaListesiniYenile();
  });
  searchInput.parentElement.style.position = 'relative';
  searchInput.parentElement.appendChild(xBtn);
}

// ─── DOSYA LİSTESİ ────────────────────────────────────────────
async function dosyaListesiniYenile() {
  const dosyalar = await window.api.dosyaListele(state.arsivModu ? 1 : 0);
  const liste = document.getElementById('dosya-listesi');
  const sayac = document.getElementById('dosya-sayisi');
  document.getElementById('liste-baslik').textContent = state.arsivModu ? 'Arşiv Dosyaları' : 'Derdest Dosyalar';
  document.getElementById('btn-arsiv-toggle').textContent = state.arsivModu ? '📂 Derdest' : '📁 Arşiv';

  sayac.textContent = `${dosyalar.length} dosya`;
  liste.innerHTML = '';

  dosyalar.forEach(d => {
    const li = document.createElement('li');
    li.dataset.id = d.id;
    li.className = state.arsivModu ? 'arsiv-item' : '';
    li.innerHTML = `
      <div class="dosya-item-uzlno">${d.uzlastirma_no || '—'}</div>
      <div class="dosya-item-adliye">${d.adliye || ''}</div>
      <div class="dosya-item-suc">${d.suc || ''}</div>
    `;
    li.addEventListener('click', () => dosyaSec(d.id, li));
    li.addEventListener('dblclick', () => dosyaKartiAc(d.id));
    liste.appendChild(li);
  });
}

async function dosyaSec(id, li) {
  // Eski seçimi temizle
  document.querySelectorAll('#dosya-listesi li.selected').forEach(el => el.classList.remove('selected'));
  li.classList.add('selected');
  state.seciliDosyaId = id;
  state.seciliDosya = await window.api.dosyaGetir(id);

  // Butonları etkinleştir
  document.getElementById('btn-dosya-kapat').disabled = false;
  document.getElementById('btn-dosya-kapat').textContent = state.arsivModu ? '🔓 Aç' : '🔒 Kapat';
  document.getElementById('btn-belge-uret').disabled = false;

  // Taraf özeti göster
  const kisiler = await window.api.kisiListele(id);
  const ozet = document.getElementById('taraf-ozet');
  const tarafListesi = document.getElementById('taraf-listesi-ozet');
  ozet.style.display = 'block';
  tarafListesi.innerHTML = '';
  kisiler.forEach(k => {
    const li = document.createElement('li');
    li.textContent = `${k.sifat} — ${k.ad_soyad}`;
    li.addEventListener('click', () => kisiKartiAc(k.id));
    tarafListesi.appendChild(li);
  });
}

async function dosyaKartiAc(id) {
  const dosya = await window.api.dosyaGetir(id);
  const kisiler = await window.api.kisiListele(id);
  const tebligatlar = await window.api.tebligatListele(id);
  const talimatlar = await window.api.talimatListele(id);
  const ekSureler = await window.api.ekSureListele(id);
  const notlar = await window.api.notGetir(id, 'dosya');
  state.acikKart = 'dosya';
  state.seciliDosyaId = id;
  state.seciliDosya = dosya;

  const content = document.getElementById('content');
  content.innerHTML = `
    <div id="dosya-aksiyonlar">
      <button class="btn btn-secondary" onclick="tebligatEkleModal(${id})">📮 Tebligat Ekle</button>
      <button class="btn btn-secondary" onclick="talimatEkleModal(${id})">📋 Talimat Ekle</button>
      <button class="btn btn-secondary" onclick="ekSureEkleModal(${id})">⏱ Ek Süre</button>
      <button class="btn btn-secondary" onclick="notlariGoster(${id}, 'dosya')">📝 Notlar</button>
      <button class="btn btn-secondary" onclick="taraflariGoster(${id})">👥 Taraflar</button>
      <button class="btn btn-primary" onclick="tarafEkleModal(${id})">+ Taraf Ekle</button>
      <button class="btn btn-danger" onclick="dosyaSilOnay(${id})">🗑 Dosyayı Sil</button>
    </div>

    <div class="kart">
      <div class="kart-baslik">Dosya Bilgileri</div>
      <div class="form-row uclu">
        <div class="form-grup">
          <label>ADLİYE</label>
          <input id="f-adliye" value="${dosya.adliye || ''}" />
        </div>
        <div class="form-grup">
          <label>SORUŞTURMA NO</label>
          <input id="f-sorusturma-no" value="${dosya.sorusturma_no || ''}" />
        </div>
        <div class="form-grup">
          <label>UZLAŞTIRMA NO</label>
          <input id="f-uzlastirma-no" value="${dosya.uzlastirma_no || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-grup">
          <label>SUÇ</label>
          <input id="f-suc" value="${dosya.suc || ''}" />
        </div>
        <div class="form-grup">
          <label>GÖREVLENDİRME TARİHİ</label>
          <input id="f-gorev-tarihi" type="date" value="${dosya.gorevlendirme_tarihi || ''}" />
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px">
        <button class="btn btn-primary" onclick="dosyaBilgileriniKaydet(${id})">Kaydet</button>
      </div>
    </div>

    ${tebligatlar.length ? `
    <div class="kart">
      <div class="kart-baslik">Tebligat Talepleri</div>
      ${tebligatlar.map(t => `
        <div class="kayit-satiri" style="align-items:center;gap:8px">
          <span class="tarih" style="flex-shrink:0">${trFormatJS(t.tarih)}</span>
          <span class="etiket" style="flex-shrink:0">${t.tur}</span>
          <span style="flex-shrink:0">${t.ad_soyad || ''}</span>
          <input type="text" class="kayit-not-input"
            data-key="tebligat_${t.id}"
            placeholder="Not..."
            style="flex:1;min-width:80px;background:var(--bg-dark);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;color:var(--text-main)"
            onchange="kayitNotKaydet(this)"
          />
          <button class="btn btn-danger" style="flex-shrink:0;padding:2px 8px;font-size:11px"
            onclick="kayitSil('tebligat',${t.id},${id})">SİL</button>
        </div>
      `).join('')}
    </div>` : ''}

    ${talimatlar.length ? `
    <div class="kart">
      <div class="kart-baslik">Talimat Talepleri</div>
      ${talimatlar.map(t => `
        <div class="kayit-satiri" style="align-items:center;gap:8px">
          <span class="tarih" style="flex-shrink:0">${trFormatJS(t.tarih)}</span>
          <span class="etiket" style="flex-shrink:0">${t.adliye || ''}</span>
          <span style="flex-shrink:0">${t.ad_soyad || ''}</span>
          <input type="text" class="kayit-not-input"
            data-key="talimat_${t.id}"
            placeholder="Not..."
            style="flex:1;min-width:80px;background:var(--bg-dark);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;color:var(--text-main)"
            onchange="kayitNotKaydet(this)"
          />
          <button class="btn btn-danger" style="flex-shrink:0;padding:2px 8px;font-size:11px"
            onclick="kayitSil('talimat',${t.id},${id})">SİL</button>
        </div>
      `).join('')}
    </div>` : ''}

    ${ekSureler.length ? `
    <div class="kart">
      <div class="kart-baslik">Ek Süre Talepleri</div>
      ${ekSureler.map(e => `
        <div class="kayit-satiri" style="align-items:center;gap:8px">
          <span class="tarih" style="flex-shrink:0">${trFormatJS(e.tarih)}</span>
          <span class="etiket" style="flex-shrink:0">${e.tur}</span>
          <input type="text" class="kayit-not-input"
            data-key="eksure_${e.id}"
            placeholder="Not..."
            style="flex:1;min-width:80px;background:var(--bg-dark);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;color:var(--text-main)"
            onchange="kayitNotKaydet(this)"
          />
          <button class="btn btn-danger" style="flex-shrink:0;padding:2px 8px;font-size:11px"
            onclick="kayitSil('eksure',${e.id},${id})">SİL</button>
        </div>
      `).join('')}
    </div>` : ''}
  `;
  // Kayıt notlarını yükle
  await kayitNotlariYukle();
}

// Kayıt satırı - not kaydet (mevcut notlar API'sini kullanır)
async function kayitNotKaydet(input) {
  const key = input.dataset.key; // örn: "tebligat_5"
  await window.api.notKaydet(key, 'kayit', input.value);
}

// Kayıt satırı - notları yükle (dosya kartı açılınca)
async function kayitNotlariYukle() {
  const inputs = document.querySelectorAll('.kayit-not-input');
  for (const input of inputs) {
    const not = await window.api.notGetir(input.dataset.key, 'kayit');
    if (not) input.value = not;
  }
}

// Kayıt sil
async function kayitSil(tur, kayitId, dosyaId) {
  if (!confirm('Bu kaydı silmek istediğinizden emin misiniz?')) return;
  await window.api.kayitSil(tur, kayitId);
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Kayıt silindi.');
}

async function kisiKartiAc(id) {
  const kisi = await window.api.kisiGetir(id);
  const notlar = await window.api.notGetir(id, 'kisi');
  state.acikKart = 'kisi';

  const content = document.getElementById('content');
  content.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px">
      <button class="btn btn-secondary" onclick="dosyaKartiAc(${kisi.dosya_id})">← Dosyaya Dön</button>
      <h2 style="font-size:16px; color:var(--text-sec)">${kisi.sifat} — ${kisi.ad_soyad}</h2>
      <button class="btn btn-danger" style="margin-left:auto" onclick="kisiSilOnay(${kisi.id}, ${kisi.dosya_id})">🗑 Kişiyi Sil</button>
    </div>

    <div class="kart">
      <div class="kart-baslik">Kişi Bilgileri</div>
      <div class="form-row">
        <div class="form-grup">
          <label>SIFAT</label>
          <input id="k-sifat" list="k-sifat-list" value="${kisi.sifat || ''}" placeholder="Seçin veya yazın..."/>
          <datalist id="k-sifat-list">
            ${SIFATLAR.map(s => `<option value="${s}">`).join('')}
          </datalist>
        </div>
        <div class="form-grup">
          <label>TC NO</label>
          <input id="k-tc" value="${kisi.tc_no || ''}" maxlength="11" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-grup">
          <label>AD SOYAD</label>
          <input id="k-ad" value="${kisi.ad_soyad || ''}" />
        </div>
        <div class="form-grup">
          <label>DOĞUM TARİHİ</label>
          <input id="k-dogum" type="date" value="${kisi.dogum_tarihi || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-grup">
          <label>BABA ADI</label>
          <input id="k-baba" value="${kisi.baba_adi || ''}" />
        </div>
        <div class="form-grup">
          <label>ANNE ADI</label>
          <input id="k-anne" value="${kisi.anne_adi || ''}" />
        </div>
      </div>
      <div class="form-row">
        <div class="form-grup">
          <label>ADRES</label>
          <input id="k-adres" value="${kisi.adres || ''}" />
        </div>
        <div class="form-grup">
          <label>TELEFON</label>
          <input id="k-tel" value="${kisi.telefon || ''}" />
        </div>
      </div>
      <div style="display:flex; justify-content:flex-end; margin-top:8px">
        <button class="btn btn-primary" onclick="kisiBilgileriniKaydet(${id})">Kaydet</button>
      </div>
    </div>

    <div class="kart">
      <div class="kart-baslik">Notlar (otomatik kaydedilir)</div>
      <textarea class="notlar-alan" id="kisi-notlar" placeholder="Kişiye ait notlar...">${notlar || ''}</textarea>
      <div class="autosave-info" id="kisi-not-durum">—</div>
    </div>
  `;

  // Notlar autosave
  let notTimer;
  document.getElementById('kisi-notlar').addEventListener('input', () => {
    document.getElementById('kisi-not-durum').textContent = 'Kaydediliyor...';
    clearTimeout(notTimer);
    notTimer = setTimeout(async () => {
      const icerik = document.getElementById('kisi-notlar').value;
      await window.api.notKaydet(id, 'kisi', icerik);
      document.getElementById('kisi-not-durum').textContent = 'Kaydedildi ✓';
    }, 800);
  });
}

// ─── KAYDET İŞLEVLERİ ─────────────────────────────────────────
async function dosyaBilgileriniKaydet(id) {
  await window.api.dosyaGuncelle({
    id,
    adliye: document.getElementById('f-adliye').value,
    sorusturmaNo: document.getElementById('f-sorusturma-no').value,
    uzlastirmaNo: document.getElementById('f-uzlastirma-no').value,
    suc: document.getElementById('f-suc').value,
    gorevlendirmeTarihi: document.getElementById('f-gorev-tarihi').value
  });
  await dosyaListesiniYenile();
  bildirimGoster('Dosya bilgileri kaydedildi.');
}

async function kisiBilgileriniKaydet(id) {
  await window.api.kisiGuncelle({
    id,
    sifat: document.getElementById('k-sifat').value,
    tcNo: document.getElementById('k-tc').value,
    adSoyad: document.getElementById('k-ad').value,
    dogumTarihi: document.getElementById('k-dogum').value,
    babaAdi: document.getElementById('k-baba').value,
    anneAdi: document.getElementById('k-anne').value,
    adres: document.getElementById('k-adres').value,
    telefon: document.getElementById('k-tel').value
  });
  bildirimGoster('Kişi bilgileri kaydedildi.');
}

// ─── ARŞİV TOGGLE ─────────────────────────────────────────────
function arsivToggle() {
  state.arsivModu = !state.arsivModu;
  state.seciliDosyaId = null;
  document.getElementById('btn-dosya-kapat').disabled = true;
  document.getElementById('btn-belge-uret').disabled = true;
  document.getElementById('taraf-ozet').style.display = 'none';
  document.getElementById('content').innerHTML = '<div id="hosgeldin"><div class="hosgeldin-icon">📁</div></div>';
  dosyaListesiniYenile();
}

async function dosyaSilOnay(id) {
  if (!confirm('Bu dosyayı ve tüm kişi/kayıt bilgilerini kalıcı olarak silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz!')) return;
  await window.api.dosyaSil(id);
  // Sol paneli temizle
  state.seciliDosyaId = null;
  state.seciliDosya = null;
  document.getElementById('content').innerHTML = '<div id="hosgeldin"><div class="hosgeldin-icon">📁</div></div>';
  document.getElementById('taraf-ozet').style.display = 'none';
  document.getElementById('btn-dosya-kapat').disabled = true;
  document.getElementById('btn-belge-uret').disabled = true;
  await dosyaListesiniYenile();
  bildirimGoster('Dosya silindi.');
}

async function kisiSilOnay(kisiId, dosyaId) {
  if (!confirm('Bu kişiyi kalıcı olarak silmek istediğinizden emin misiniz?')) return;
  await window.api.kisiSil(kisiId);
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Kişi silindi.');
}

async function dosyaKapatAc() {
  if (!state.seciliDosyaId) return;
  const arsiveAlinacak = !state.arsivModu;

  await window.api.dosyaDurumDegistir(state.seciliDosyaId, arsiveAlinacak);
  await dosyaListesiniYenile();
  bildirimGoster(arsiveAlinacak ? 'Dosya arşive alındı.' : 'Dosya derdeste alındı.');

  // Sadece arşive alınırken sor
  if (arsiveAlinacak) {
    const cevap = confirm('Ödemeler tablosunu açmak ister misiniz?');
    if (cevap) {
      await window.api.odemelerAc();
    }
  }
}

// ─── ARAMA ────────────────────────────────────────────────────
function trLower(str) {
  return (str || '').replace(/İ/g,'i').replace(/I/g,'ı').replace(/Ğ/g,'ğ')
    .replace(/Ü/g,'ü').replace(/Ş/g,'ş').replace(/Ö/g,'ö').replace(/Ç/g,'ç').toLowerCase();
}

async function aramayiCalistir() {
  const sorgu = document.getElementById('search-input').value.trim();
  if (!sorgu) { await dosyaListesiniYenile(); return; }
  const q = trLower(sorgu);

  // Hem derdest hem arşivdeki dosyaları çek
  const [derdest, arsiv] = await Promise.all([
    window.api.dosyaListele(0),
    window.api.dosyaListele(1)
  ]);
  const tumDosyalar = [
    ...derdest.map(d => ({ ...d, arsivde: false })),
    ...arsiv.map(d => ({ ...d, arsivde: true }))
  ];

  // Tüm dosyaların kişilerini çek ve filtrele
  const eslesen = [];
  for (const d of tumDosyalar) {
    const kisiler = await window.api.kisiListele(d.id);
    const dosyaEslesti = [d.uzlastirma_no, d.sorusturma_no, d.adliye, d.suc]
      .some(f => trLower(f).includes(q));
    const eslesilenKisiler = kisiler.filter(k =>
      [k.ad_soyad, k.tc_no, k.sifat].some(f => trLower(f).includes(q))
    );
    if (dosyaEslesti || eslesilenKisiler.length > 0) {
      eslesen.push({ dosya: d, kisiler: eslesilenKisiler, dosyaEslesti });
    }
  }

  const liste = document.getElementById('dosya-listesi');
  liste.innerHTML = '';
  document.getElementById('dosya-sayisi').textContent = `${eslesen.length} sonuç`;

  if (eslesen.length === 0) {
    liste.innerHTML = '<li style="color:var(--text-dim);padding:12px;font-size:12px;">Sonuç bulunamadı.</li>';
    return;
  }

  eslesen.forEach(({ dosya: d, kisiler: eslesilenKisiler, dosyaEslesti }) => {
    const li = document.createElement('li');
    li.dataset.id = d.id;
    const arsivEtiketi = d.arsivde
      ? '<span style="font-size:10px;background:var(--red);color:#fff;border-radius:3px;padding:1px 5px;margin-left:4px">ARŞİV</span>'
      : '<span style="font-size:10px;background:var(--accent);color:#fff;border-radius:3px;padding:1px 5px;margin-left:4px">AÇIK</span>';
    const kisiSatirlar = eslesilenKisiler.map(k =>
      `<div style="font-size:11px;color:var(--text-sec);padding-left:8px">👤 ${k.sifat} — ${k.ad_soyad}</div>`
    ).join('');
    li.innerHTML = `
      <div class="dosya-item-uzlno">${d.uzlastirma_no || '—'}${arsivEtiketi}</div>
      <div class="dosya-item-adliye">${d.adliye || ''}</div>
      <div class="dosya-item-suc">${d.suc || ''}</div>
      ${kisiSatirlar}
    `;
    li.addEventListener('click', () => { dosyaSec(d.id, li); dosyaKartiAc(d.id); });
    liste.appendChild(li);
  });
}

// ─── MODALLER ─────────────────────────────────────────────────
function modalAc(html) {
  document.getElementById('modal-box').innerHTML = html;
  document.getElementById('modal-overlay').style.display = 'flex';
}
function modalKapat() {
  document.getElementById('modal-overlay').style.display = 'none';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') modalKapat(); });

// Dosya Ekle (UDF'den)
async function dosyaEkleModal() {
  modalAc(`
    <div class="modal-baslik">📂 Yeni Dosya Ekle</div>
    <div style="display:flex; flex-direction:column; gap:12px; margin-top:8px">
      <button class="btn btn-primary" style="padding:16px; font-size:14px" onclick="dosyaEkleUDF()">📄 Belge Yükle (UDF)</button>
      <button class="btn btn-secondary" style="padding:16px; font-size:14px" onclick="dosyaEkleManuel()">✏️ Manuel Kayıt Yap</button>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
    </div>
  `);
}

async function dosyaEkleUDF() {
  modalKapat();
  const veri = await window.api.udfYukle();
  if (!veri) return;
  const d = veri.dosya;
  const kisiler = veri.kisiler;

  modalAc(`
    <div class="modal-baslik">📂 Yeni Dosya — UDF Verisi Düzenle</div>
    <div class="form-row uclu">
      <div class="form-grup"><label>ADLİYE</label><input id="nd-adliye" value="${d.adliye || ''}"/></div>
      <div class="form-grup"><label>SORUŞTURMA NO</label><input id="nd-sno" value="${d.sorusturmaNo || ''}"/></div>
      <div class="form-grup"><label>UZLAŞTIRMA NO</label><input id="nd-uno" value="${d.uzlastirmaNo || ''}"/></div>
    </div>
    <div class="form-row">
      <div class="form-grup"><label>SUÇ</label><input id="nd-suc" value="${d.suc || ''}"/></div>
      <div class="form-grup"><label>GÖREVLENDİRME TARİHİ</label><input id="nd-tarih" type="date" value="${d.gorevlendirmeTarihi || ''}"/></div>
    </div>
    <div style="font-size:12px; color:var(--text-dim); margin:12px 0 4px">Taraflar (${kisiler.length} kişi)</div>
    <div style="font-size:11px; color:var(--text-sec)">
      ${kisiler.map(k => `<span class="taraf-chip">${k.sifat} — ${k.adSoyad}</span>`).join('')}
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="dosyaKaydetUDF()">Kaydet</button>
    </div>
  `);
  window._udfKisiler = kisiler;
}

function dosyaEkleManuel() {
  modalKapat();
  // İçerik alanını temizle, sol paneli sıfırla
  state.seciliDosyaId = null;
  state.seciliDosya = null;
  document.getElementById('content').innerHTML = '<div id="hosgeldin"><div class="hosgeldin-icon">📁</div></div>';
  document.getElementById('taraf-ozet').style.display = 'none';
  document.getElementById('btn-dosya-kapat').disabled = true;
  document.getElementById('btn-belge-uret').disabled = true;
  document.querySelectorAll('#dosya-listesi li.selected').forEach(el => el.classList.remove('selected'));

  modalAc(`
    <div class="modal-baslik">✏️ Manuel Dosya Kaydı</div>
    <div class="form-row uclu">
      <div class="form-grup"><label>ADLİYE</label><input id="nd-adliye" placeholder="Adliye adı"/></div>
      <div class="form-grup"><label>SORUŞTURMA NO</label><input id="nd-sno"/></div>
      <div class="form-grup"><label>UZLAŞTIRMA NO</label><input id="nd-uno"/></div>
    </div>
    <div class="form-row">
      <div class="form-grup"><label>SUÇ</label><input id="nd-suc"/></div>
      <div class="form-grup"><label>GÖREVLENDİRME TARİHİ</label><input id="nd-tarih" type="date"/></div>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="dosyaKaydetManuel()">Kaydet</button>
    </div>
  `);
}

async function dosyaKaydetManuel() {
  const id = await window.api.dosyaKaydet({
    adliye: document.getElementById('nd-adliye').value,
    sorusturmaNo: document.getElementById('nd-sno').value,
    uzlastirmaNo: document.getElementById('nd-uno').value,
    suc: document.getElementById('nd-suc').value,
    gorevlendirmeTarihi: document.getElementById('nd-tarih').value,
    kisiler: []
  });
  modalKapat();
  await dosyaListesiniYenile();
  // Yeni dosyayı otomatik seç ve kartını aç
  const liEl = document.querySelector(`#dosya-listesi li[data-id="${id}"]`);
  if (liEl) await dosyaSec(id, liEl);
  await dosyaKartiAc(id);
  bildirimGoster('Dosya oluşturuldu.');
}

async function dosyaKaydetUDF() {
  const id = await window.api.dosyaKaydet({
    adliye: document.getElementById('nd-adliye').value,
    sorusturmaNo: document.getElementById('nd-sno').value,
    uzlastirmaNo: document.getElementById('nd-uno').value,
    suc: document.getElementById('nd-suc').value,
    gorevlendirmeTarihi: document.getElementById('nd-tarih').value,
    kisiler: window._udfKisiler
  });
  modalKapat();
  await dosyaListesiniYenile();
  bildirimGoster('Dosya oluşturuldu.');
}

// Taraf Ekle
function tarafEkleModal(dosyaId) {
  modalAc(`
    <div class="modal-baslik">👤 Taraf Ekle</div>
    <div class="form-row">
      <div class="form-grup">
        <label>SIFAT</label>
        <input id="ta-sifat" list="ta-sifat-list" placeholder="Seçin veya yazın..."/>
        <datalist id="ta-sifat-list">
          ${SIFATLAR.map(s => `<option value="${s}">`).join('')}
        </datalist>
      </div>
      <div class="form-grup"><label>TC NO</label><input id="ta-tc" maxlength="11"/></div>
    </div>
    <div class="form-row">
      <div class="form-grup"><label>AD SOYAD</label><input id="ta-ad"/></div>
      <div class="form-grup"><label>DOĞUM TARİHİ</label><input id="ta-dogum" type="date"/></div>
    </div>
    <div class="form-row">
      <div class="form-grup"><label>BABA ADI</label><input id="ta-baba"/></div>
      <div class="form-grup"><label>ANNE ADI</label><input id="ta-anne"/></div>
    </div>
    <div class="form-row">
      <div class="form-grup"><label>ADRES</label><input id="ta-adres"/></div>
      <div class="form-grup"><label>TELEFON</label><input id="ta-tel"/></div>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="tarafKaydet(${dosyaId})">Ekle</button>
    </div>
  `);
}

async function tarafKaydet(dosyaId) {
  await window.api.kisiKaydet({
    dosyaId,
    sifat: document.getElementById('ta-sifat').value,
    tcNo: document.getElementById('ta-tc').value,
    adSoyad: document.getElementById('ta-ad').value,
    dogumTarihi: document.getElementById('ta-dogum').value,
    babaAdi: document.getElementById('ta-baba').value,
    anneAdi: document.getElementById('ta-anne').value,
    adres: document.getElementById('ta-adres').value,
    telefon: document.getElementById('ta-tel').value
  });
  modalKapat();
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Taraf eklendi.');
}

// Tebligat
async function tebligatEkleModal(dosyaId) {
  const kisiler = await window.api.kisiListele(dosyaId);
  modalAc(`
    <div class="modal-baslik">📮 Tebligat Ekle</div>
    <div class="checkbox-grup" style="margin-bottom:16px">
      <label class="checkbox-item"><input type="radio" name="tebligat-tur" value="İlk Tebligat" checked> İlk Tebligat</label>
      <label class="checkbox-item"><input type="radio" name="tebligat-tur" value="21/2 Uyarınca Tebligat"> 21/2 Uyarınca Tebligat</label>
    </div>
    <div class="form-grup">
      <label>TARAF</label>
      <select id="teb-kisi">
        ${kisiler.map(k => `<option value="${k.id}">${k.sifat} — ${k.ad_soyad}</option>`).join('')}
      </select>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="tebligatKaydet(${dosyaId})">Tamam</button>
    </div>
  `);
}

async function tebligatKaydet(dosyaId) {
  const tur = document.querySelector('input[name="tebligat-tur"]:checked').value;
  const kisiId = document.getElementById('teb-kisi').value;
  await window.api.tebligatEkle({ dosyaId, kisiId, tur });
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Tebligat talebi eklendi.');
  // Belge üretme modalını otomatik aç, tebligat türü önceden seçili gelsin
  await belgeUretModal('tebligat', kisiId);
}

// Talimat
async function talimatEkleModal(dosyaId) {
  const kisiler = await window.api.kisiListele(dosyaId);
  modalAc(`
    <div class="modal-baslik">📋 Talimat Ekle</div>
    <div class="form-grup" style="margin-bottom:12px">
      <label>ADLİYE</label>
      <input id="tal-adliye" maxlength="15" placeholder="En fazla 15 karakter"/>
    </div>
    <div class="form-grup">
      <label>TARAF</label>
      <select id="tal-kisi">
        ${kisiler.map(k => `<option value="${k.id}">${k.sifat} — ${k.ad_soyad}</option>`).join('')}
      </select>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="talimatKaydet(${dosyaId})">Tamam</button>
    </div>
  `);
}

async function talimatKaydet(dosyaId) {
  const adliye = document.getElementById('tal-adliye').value;
  const kisiId = document.getElementById('tal-kisi').value;
  await window.api.talimatEkle({ dosyaId, kisiId, adliye, icerik: '' });
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Talimat talebi eklendi.');
  // Belge üretme modalını otomatik aç, talimat türü önceden seçili gelsin
  await belgeUretModal('talimat', kisiId);
}

// Ek Süre
function ekSureEkleModal(dosyaId) {
  modalAc(`
    <div class="modal-baslik">⏱ Ek Süre Talebi</div>
    <div class="checkbox-grup" style="margin-bottom:16px">
      <label class="checkbox-item"><input type="radio" name="eksure-tur" value="1. Ek Süre" checked> 1. Ek Süre</label>
      <label class="checkbox-item"><input type="radio" name="eksure-tur" value="2. Ek Süre"> 2. Ek Süre</label>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="ekSureKaydet(${dosyaId})">Tamam</button>
    </div>
  `);
}

async function ekSureKaydet(dosyaId) {
  const tur = document.querySelector('input[name="eksure-tur"]:checked').value;
  await window.api.ekSureEkle({ dosyaId, tur });
  await dosyaKartiAc(dosyaId);
  bildirimGoster('Ek süre talebi eklendi.');
  // Belge üretme modalını otomatik aç, ekSure türü önceden seçili gelsin
  await belgeUretModal('ekSure');
}

// Notlar
async function notlariGoster(id, tur) {
  const notlar = await window.api.notGetir(id, tur);
  modalAc(`
    <div class="modal-baslik">📝 Notlar</div>
    <textarea class="notlar-alan" id="modal-notlar" style="min-height:300px" placeholder="Markdown formatında notlar...">${notlar || ''}</textarea>
    <div class="autosave-info" id="modal-not-durum">—</div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">Kapat</button>
    </div>
  `);
  let timer;
  document.getElementById('modal-notlar').addEventListener('input', () => {
    document.getElementById('modal-not-durum').textContent = 'Kaydediliyor...';
    clearTimeout(timer);
    timer = setTimeout(async () => {
      await window.api.notKaydet(id, tur, document.getElementById('modal-notlar').value);
      document.getElementById('modal-not-durum').textContent = 'Kaydedildi ✓';
    }, 800);
  });
}

// Taraflar dropdown
async function taraflariGoster(dosyaId) {
  const kisiler = await window.api.kisiListele(dosyaId);
  modalAc(`
    <div class="modal-baslik">👥 Taraflar</div>
    <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px">
      ${kisiler.map(k => `
        <div class="kayit-satiri" style="cursor:pointer" onclick="modalKapat(); kisiKartiAc(${k.id})">
          <span class="etiket">${k.sifat}</span>
          <span>${k.ad_soyad}</span>
          <span style="margin-left:auto; color:var(--accent); font-size:11px">Aç →</span>
        </div>
      `).join('')}
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">Kapat</button>
    </div>
  `);
}

// Belge Üret
async function belgeUretModal() {
  if (!state.seciliDosyaId) { alert('Önce bir dosya seçin.'); return; }
  let kisiler = [];
  try {
    kisiler = await window.api.kisiListele(state.seciliDosyaId);
  } catch(e) {
    alert('Hata: ' + e.message);
    return;
  }

  modalAc(`
    <div class="modal-baslik">📄 Belge Üret</div>
    <div class="form-grup" style="margin-bottom:16px">
      <label>BELGE TÜRÜ</label>
      <select id="b-tur" onchange="belgeTuruDegisti()">
        <option value="teklif">Teklif Formu</option>
        <option value="rapor">Uzlaştırma Raporu</option>
        <option value="ekSure">Ek Süre Talebi</option>
        <option value="talimat">Talimat Talebi</option>
        <option value="tebligat">Tebligat Talebi</option>
        <option value="dilekce">Dilekçe</option>
        <option value="ustYazi">Üst Yazı</option>
      </select>
    </div>

    <div id="b-taraf-secim" class="form-grup" style="margin-bottom:16px">
      <label id="b-taraf-label">TARAF/TARAFLAR</label>
      <div id="b-taraf-liste" style="display:flex; flex-wrap:wrap; gap:4px; padding:8px; background:var(--bg-dark); border:1px solid var(--border); border-radius:6px">
        ${kisiler.map(k => `<span class="taraf-chip" data-id="${k.id}" onclick="tarafChipTikla(this)">${k.sifat} — ${k.ad_soyad}</span>`).join('')}
      </div>
    </div>

    <div id="b-uzlasma-secim" style="display:none; margin-bottom:16px">
      <label style="font-size:11px; color:var(--text-dim); font-weight:600">UZLAŞMA TÜRÜ</label>
      <div class="checkbox-grup" style="margin-top:8px">
        <label class="checkbox-item"><input type="radio" name="uzlasma-tur" value="Olumsuz Uzlaşma" checked onchange="uzlasmaTuruDegisti()"> Olumsuz Uzlaşma</label>
        <label class="checkbox-item"><input type="radio" name="uzlasma-tur" value="Olumlu Uzlaşma" onchange="uzlasmaTuruDegisti()"> Olumlu Uzlaşma</label>
        <label class="checkbox-item"><input type="radio" name="uzlasma-tur" value="Olumlu Edimli Uzlaşma" onchange="uzlasmaTuruDegisti()"> Olumlu Edimli Uzlaşma</label>
      </div>
    </div>

    <div id="b-icerik-alan"></div>

    <div class="form-grup" style="margin-bottom:16px">
      <label>FORMAT</label>
      <div class="checkbox-grup" style="flex-direction:row; gap:20px; margin-top:4px">
        <label class="checkbox-item"><input type="radio" name="b-format" value="docx" checked> DOCX</label>
        <label class="checkbox-item"><input type="radio" name="b-format" value="pdf"> PDF</label>
      </div>
    </div>

    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-accent" onclick="belgeUret()">Üret</button>
    </div>
  `);

  belgeTuruDegisti();
}

function belgeTuruDegisti() {
  const tur = document.getElementById('b-tur').value;
  const tarafSecim = document.getElementById('b-taraf-secim');
  const uzlasmaSecim = document.getElementById('b-uzlasma-secim');
  const icerikAlan = document.getElementById('b-icerik-alan');
  const tarafLabel = document.getElementById('b-taraf-label');

  // Taraf seçim paneli: teklif (çoklu), tebligat/talimat (tekli), diğerleri gizli
  const tekliSecim = ['tebligat', 'talimat'].includes(tur);
  tarafSecim.style.display = (tur === 'teklif' || tekliSecim) ? 'block' : 'none';
  tarafLabel.textContent = tekliSecim ? 'TARAF (Tek Seçim)' : 'TARAF/TARAFLAR';

  // Mevcut seçimleri temizle
  document.querySelectorAll('.taraf-chip.secili').forEach(c => c.classList.remove('secili'));

  uzlasmaSecim.style.display = tur === 'rapor' ? 'block' : 'none';

  if (tur === 'rapor') {
    uzlasmaTuruDegisti();
  } else if (['ekSure', 'talimat', 'tebligat', 'ustYazi', 'dilekce'].includes(tur)) {
    icerikAlan.innerHTML = `
      <div class="form-grup" style="margin-bottom:16px">
        <label>İÇERİK</label>
        <textarea id="b-icerik" style="min-height:120px"></textarea>
      </div>
    `;
  } else {
    icerikAlan.innerHTML = '';
  }
}

function tarafChipTikla(el) {
  const tur = document.getElementById('b-tur').value;
  const tekliMod = ['tebligat', 'talimat'].includes(tur);
  if (tekliMod) {
    // Tekli mod: önce tümünü kaldır, sonra tıklanana toggle
    const zatenSecili = el.classList.contains('secili');
    document.querySelectorAll('.taraf-chip.secili').forEach(c => c.classList.remove('secili'));
    if (!zatenSecili) el.classList.add('secili');
  } else {
    el.classList.toggle('secili');
  }
}

function uzlasmaTuruDegisti() {
  const tur = document.querySelector('input[name="uzlasma-tur"]:checked')?.value;
  const alan = document.getElementById('b-icerik-alan');
  if (tur === 'Olumlu Edimli Uzlaşma') {
    alan.innerHTML = `
      <div class="form-grup" style="margin-bottom:12px">
        <label>UZLAŞTIRMA SONUCU</label>
        <textarea id="b-sonuc" style="min-height:100px"></textarea>
      </div>
      <div class="form-grup" style="margin-bottom:16px">
        <label>EDİMİN YERİNE GETİRİLME ŞEKLİ VE ZAMANI</label>
        <textarea id="b-edim" style="min-height:100px"></textarea>
      </div>
    `;
  } else {
    alan.innerHTML = `
      <div class="form-grup" style="margin-bottom:16px">
        <label>UZLAŞTIRMA SONUCU</label>
        <textarea id="b-sonuc" style="min-height:100px"></textarea>
      </div>
    `;
  }
}

async function belgeUret() {
  const tur = document.getElementById('b-tur').value;
  const format = document.querySelector('input[name="b-format"]:checked').value;
  
  const seciliChipler = document.querySelectorAll('.taraf-chip.secili');
  const tarafIds = Array.from(seciliChipler).map(el => parseInt(el.dataset.id));

  // Seçim zorunluluğu: teklif (en az 1), tebligat/talimat (tam 1)
  if (tur === 'teklif' && tarafIds.length === 0) {
    bildirimGoster('Teklif formu için en az bir taraf seçmelisiniz.', 'hata');
    return;
  }
  if (['tebligat', 'talimat'].includes(tur) && tarafIds.length === 0) {
    bildirimGoster('Lütfen bir taraf seçiniz.', 'hata');
    return;
  }

  let icerik = {};
  if (tur === 'rapor') {
    const uzlasmaTuru = document.querySelector('input[name="uzlasma-tur"]:checked')?.value;
    icerik = {
      uzlasmaTuru,
      uzlastirmaSonucu: document.getElementById('b-sonuc')?.value || '',
      edimSekliZamani: document.getElementById('b-edim')?.value || ''
    };
  } else if (['ekSure', 'talimat', 'tebligat', 'ustYazi', 'dilekce'].includes(tur)) {
    icerik = { icerik: document.getElementById('b-icerik')?.value || '' };
  }

  modalKapat();
  try {
    await window.api.belgeUret({
      tur,
      dosyaId: state.seciliDosyaId,
      // Teklif: seçili kişiler; diğer türler: boş array → main.js tüm kişileri alır
      tarafIds: tarafIds.length ? tarafIds : [],
      icerik,
      format
    });
    bildirimGoster('Belge üretildi.');
  } catch (e) {
    bildirimGoster('Hata: ' + e.message, 'hata');
  }
}

// Hatırlatıcı Ekle
function hatirlaticiEkleModal() {
  modalAc(`
    <div class="modal-baslik">🔔 Hatırlatıcı Ekle</div>
    <div class="form-grup" style="margin-bottom:12px">
      <label>TARİH</label>
      <input id="h-tarih" type="date" value="${new Date().toISOString().split('T')[0]}"/>
    </div>
    <div class="form-grup" style="margin-bottom:16px">
      <label>MESAJ</label>
      <textarea id="h-mesaj" style="min-height:80px" placeholder="Hatırlatma metni..."></textarea>
    </div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="hatirlaticiKaydet()">Ekle</button>
    </div>
  `);
}

async function hatirlaticiKaydet() {
  const tarih = document.getElementById('h-tarih').value;
  const mesaj = document.getElementById('h-mesaj').value;
  if (!mesaj.trim()) return;
  await window.api.hatirlatmaEkle({ dosyaId: state.seciliDosyaId, mesaj, tarih });
  modalKapat();
  bildirimGoster('Hatırlatıcı eklendi.');
}

// Kullanıcı Bilgileri
async function yedekleModal() {
  const ayarlar = await window.api.autoYedekAyarlariGetir();
  modalAc(`
    <div class="modal-baslik">💾 Yedekleme</div>

    <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px">
      <button class="btn btn-primary" style="padding:14px; font-size:13px" onclick="yedekAl()">📤 Şimdi Yedekle (Dışa Aktar)</button>
      <button class="btn btn-secondary" style="padding:14px; font-size:13px" onclick="yedekYukle()">📥 Yedekten Yükle (İçe Aktar)</button>
    </div>

    <div style="border-top:1px solid var(--border); padding-top:16px">
      <div style="font-size:12px; font-weight:600; color:var(--text-dim); margin-bottom:12px">OTOMATİK YEDEKLEME</div>

      <div class="form-row" style="margin-bottom:10px">
        <div class="form-grup">
          <label>DURUM</label>
          <select id="ay-aktif">
            <option value="1" ${ayarlar.aktif ? 'selected' : ''}>Açık</option>
            <option value="0" ${!ayarlar.aktif ? 'selected' : ''}>Kapalı</option>
          </select>
        </div>
        <div class="form-grup">
          <label>ARALIK</label>
          <select id="ay-aralik">
            <option value="gunluk" ${ayarlar.aralik === 'gunluk' ? 'selected' : ''}>Her Gün</option>
            <option value="haftalik" ${ayarlar.aralik === 'haftalik' ? 'selected' : ''}>Haftada Bir</option>
            <option value="aylik" ${ayarlar.aralik === 'aylik' ? 'selected' : ''}>Ayda Bir</option>
          </select>
        </div>
        <div class="form-grup">
          <label>MAX YEDEK SAYISI</label>
          <select id="ay-adet">
            ${[3,5,10,20].map(n => `<option value="${n}" ${ayarlar.adet == n ? 'selected' : ''}>${n} adet</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-grup" style="margin-bottom:10px">
        <label>YEDEK KLASÖRÜ</label>
        <div style="display:flex; gap:8px; align-items:center">
          <input id="ay-klasor" value="${ayarlar.klasor || ''}" placeholder="Klasör seçin..." readonly
            style="flex:1; background:var(--bg-dark); border:1px solid var(--border); border-radius:4px; padding:6px 10px; color:var(--text-main); font-size:12px"/>
          <button class="btn btn-secondary" style="white-space:nowrap" onclick="autoYedekKlasorSec()">📁 Seç</button>
        </div>
      </div>
    </div>

    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="autoYedekKaydet()">Ayarları Kaydet</button>
    </div>
  `);
}

async function autoYedekKlasorSec() {
  const klasor = await window.api.autoYedekKlasorSec();
  if (klasor) document.getElementById('ay-klasor').value = klasor;
}

async function autoYedekKaydet() {
  const ayarlar = {
    aktif: document.getElementById('ay-aktif').value === '1',
    aralik: document.getElementById('ay-aralik').value,
    klasor: document.getElementById('ay-klasor').value,
    adet: parseInt(document.getElementById('ay-adet').value)
  };
  await window.api.autoYedekKaydet(ayarlar);
  modalKapat();
  bildirimGoster(ayarlar.aktif ? 'Otomatik yedekleme ayarlandı.' : 'Otomatik yedekleme kapatıldı.');
}

async function yedekAl() {
  modalKapat();
  const sonuc = await window.api.yedekAl();
  if (sonuc) bildirimGoster('Yedek başarıyla kaydedildi.');
}

async function yedekYukle() {
  if (!confirm('Mevcut veriler yedekteki verilerle değiştirilecek. Emin misiniz?')) return;
  modalKapat();
  const sonuc = await window.api.yedekYukle();
  if (sonuc) {
    bildirimGoster('Yedek yüklendi. Uygulama yeniden başlatılıyor...');
    setTimeout(() => location.reload(), 1500);
  }
}

async function kullaniciBilgileriModal() {
  const kullanici = await window.api.kullaniciGetir();
  modalAc(`
    <div class="modal-baslik">👤 Kullanıcı Bilgileri</div>
    <div class="form-row">
      <div class="form-grup"><label>AD SOYAD</label><input id="u-ad" value="${kullanici?.ad_soyad || ''}"/></div>
      <div class="form-grup"><label>SİCİL NO</label><input id="u-sicil" value="${kullanici?.sicil_no || ''}"/></div>
    </div>
    <div class="form-grup" style="margin-bottom:12px"><label>ADRES</label><input id="u-adres" value="${kullanici?.adres || ''}"/></div>
    <div class="form-grup" style="margin-bottom:16px"><label>TELEFON</label><input id="u-tel" value="${kullanici?.telefon || ''}"/></div>
    <div class="modal-aksiyonlar">
      <button class="btn btn-secondary" onclick="modalKapat()">İptal</button>
      <button class="btn btn-primary" onclick="kullaniciKaydet()">Kaydet</button>
    </div>
  `);
}

async function kullaniciKaydet() {
  await window.api.kullaniciKaydet({
    adSoyad: document.getElementById('u-ad').value,
    sicilNo: document.getElementById('u-sicil').value,
    adres: document.getElementById('u-adres').value,
    telefon: document.getElementById('u-tel').value
  });
  modalKapat();
  await baslatUygulamayi();
  bildirimGoster('Kullanıcı bilgileri kaydedildi.');
}

// ─── HATIRLATMA DİNLEYİCİSİ ──────────────────────────────────
function hatirlatmalariDinle() {
  window.api.onHatirlatma(data => {
    const container = document.getElementById('hatirlatma-container');
    const popup = document.createElement('div');
    popup.className = 'hatirlatma-popup';
    popup.dataset.hatirlatmaId = data.hatirlatmaId ?? '';
    popup.dataset.mesaj = data.mesaj ?? '';
    popup.innerHTML = `
      <div class="mesaj">🔔 ${data.mesaj}</div>
      <div class="aksiyonlar">
        <button class="btn btn-secondary" style="font-size:11px" onclick="hatirlatmaTekrarHatirla(this.closest('.hatirlatma-popup'))">Tekrar Hatırlat</button>
        <button class="btn btn-danger" style="font-size:11px" onclick="hatirlatmaKapat(this.closest('.hatirlatma-popup'))">Kapat</button>
      </div>
    `;
    container.appendChild(popup);
  });
}

async function hatirlatmaKapat(el) {
  const id = el?.dataset.hatirlatmaId;
  const mesaj = el?.dataset.mesaj;
  if (id) {
    await window.api.hatirlatmaKapat(id); // Manuel: DB'de kapat
  } else {
    await window.api.hatirlatmaOtomatikKapat(mesaj); // Otomatik: bellekte kapat
  }
  el?.remove();
}

async function hatirlatmaTekrarHatirla(el) {
  // Sadece popup'ı kapat — kapali=0 kalır, program yeniden açıldığında tekrar gösterilir
  el?.remove();
}

// ─── YARDIMCI FONKSİYONLAR ───────────────────────────────────
function trFormatJS(isoTarih) {
  if (!isoTarih) return '';
  const [y, m, d] = isoTarih.split('T')[0].split('-');
  return `${d}.${m}.${y}`;
}

function bildirimGoster(mesaj, tur = 'bilgi') {
  const div = document.createElement('div');
  div.style.cssText = `
    position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
    background: ${tur === 'hata' ? 'var(--red)' : 'var(--green)'};
    color: white; padding: 10px 20px; border-radius: 8px; font-size: 13px;
    font-weight: 600; z-index: 3000; animation: slideIn 0.3s ease;
    box-shadow: var(--shadow);
  `;
  div.textContent = mesaj;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 3000);
}
