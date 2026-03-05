/**
 * tarihUtils.js — Türkçe tarih biçimlendirme yardımcıları
 */

/**
 * ISO tarih string'ini (YYYY-MM-DD) Türkçe formatına çevirir: GG.AA.YYYY
 * @param {string|Date} tarih
 * @returns {string}
 */
function trFormat(tarih) {
  if (!tarih) return '';
  try {
    const str = tarih instanceof Date
      ? tarih.toISOString().split('T')[0]
      : String(tarih).split('T')[0];
    const [yil, ay, gun] = str.split('-');
    if (!yil || !ay || !gun) return tarih;
    return `${gun}.${ay}.${yil}`;
  } catch {
    return tarih || '';
  }
}

/**
 * Türkçe tarih (GG.AA.YYYY) → ISO (YYYY-MM-DD)
 * @param {string} tarih
 * @returns {string}
 */
function isoFormat(tarih) {
  if (!tarih) return '';
  const m = tarih.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : tarih;
}

module.exports = { trFormat, isoFormat };
