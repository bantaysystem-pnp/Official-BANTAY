// backend/shared/utils/barangays.js
// Single source of truth for Bacoor barangay names (post-2023 merger, 47 barangays).
// Every feature (blotter, dashboard, ai-assessment) should import from here
// instead of keeping its own copy — update names in ONE place.

const VALID_BARANGAYS = [
  "ANIBAN I", "ANIBAN II", "BAYANAN", "DULONG BAYAN",
  "HABAY I", "HABAY II", "POBLACION",
  "KAINGIN DIGMAN",
  "LIGAS I", "LIGAS II",
  "MABOLO", "MALIKSI I", "MALIKSI II",
  "MAMBOG I", "MAMBOG II", "MAMBOG III", "MAMBOG IV",
  "MOLINO I", "MOLINO II", "MOLINO III", "MOLINO IV",
  "MOLINO V", "MOLINO VI", "MOLINO VII",
  "NIOG",
  "P.F. ESPIRITU I (PANAPAAN)", "P.F. ESPIRITU II",
  "P.F. ESPIRITU III", "P.F. ESPIRITU IV",
  "P.F. ESPIRITU V", "P.F. ESPIRITU VI",
  "QUEENS ROW CENTRAL", "QUEENS ROW EAST", "QUEENS ROW WEST",
  "REAL",
  "SALINAS I", "SALINAS II",
  "SAN NICOLAS I", "SAN NICOLAS II", "SAN NICOLAS III",
  "SINBANALI",
  "TALABA I", "TALABA II", "TALABA III",
  "ZAPOTE I", "ZAPOTE II", "ZAPOTE III",
];

const BARANGAY_ALIASES = {
  ALIMA: "SINBANALI",
  BANALO: "SINBANALI",
  SINEGUELASAN: "SINBANALI",
  CAMPOSANTO: "POBLACION",
  "DAANG BUKID": "POBLACION",
  "TABING DAGAT": "POBLACION",
  "KAINGIN (POB.)": "POBLACION",
  DIGMAN: "KAINGIN DIGMAN",
  KAINGIN: "KAINGIN DIGMAN",
  PANAPAAN: "P.F. ESPIRITU I (PANAPAAN)",
  "PANAPAAN 1": "P.F. ESPIRITU I (PANAPAAN)",
  "PANAPAAN 2": "P.F. ESPIRITU II",
  "PANAPAAN 3": "P.F. ESPIRITU II",
  "PANAPAAN 4": "P.F. ESPIRITU IV",
  "PANAPAAN 5": "P.F. ESPIRITU V",
  "PANAPAAN 6": "P.F. ESPIRITU VI",
  "PANAPAAN I": "P.F. ESPIRITU I (PANAPAAN)",
  "PANAPAAN II": "P.F. ESPIRITU II",
  "PANAPAAN III": "P.F. ESPIRITU II",
  "PANAPAAN IV": "P.F. ESPIRITU IV",
  "PANAPAAN V": "P.F. ESPIRITU V",
  "PANAPAAN VI": "P.F. ESPIRITU VI",
  "P.F. ESPIRITU 1 (PANAPAAN)": "P.F. ESPIRITU I (PANAPAAN)",
  "P.F. ESPIRITU 2": "P.F. ESPIRITU II",
  "P.F. ESPIRITU 3": "P.F. ESPIRITU III",
  "P.F. ESPIRITU 4": "P.F. ESPIRITU IV",
  "P.F. ESPIRITU 5": "P.F. ESPIRITU V",
  "P.F. ESPIRITU 6": "P.F. ESPIRITU VI",
  "ANIBAN 1": "ANIBAN I",
  "ANIBAN 2": "ANIBAN II",
  "ANIBAN 3": "ANIBAN I",
  "ANIBAN 4": "ANIBAN II",
  "ANIBAN 5": "ANIBAN I",
  "HABAY 1": "HABAY I",
  "HABAY 2": "HABAY II",
  "LIGAS 1": "LIGAS I",
  "LIGAS 2": "LIGAS II",
  "MABOLO 1": "MABOLO",
  "MABOLO 2": "MABOLO",
  "MABOLO 3": "MABOLO",
  "MABOLO I": "MABOLO",
  "MABOLO II": "MABOLO",
  "MABOLO III": "MABOLO",
  "MALIKSI 1": "MALIKSI I",
  "MALIKSI 2": "MALIKSI II",
  "MALIKSI 3": "MALIKSI II",
  "MALIKSI III": "MALIKSI II",
  "MAMBOG 1": "MAMBOG I",
  "MAMBOG 2": "MAMBOG II",
  "MAMBOG 3": "MAMBOG III",
  "MAMBOG 4": "MAMBOG IV",
  "MAMBOG 5": "MAMBOG II",
  "MAMBOG V": "MAMBOG II",
  "MOLINO 1": "MOLINO I",
  "MOLINO 2": "MOLINO II",
  "MOLINO 3": "MOLINO III",
  "MOLINO 4": "MOLINO IV",
  "MOLINO 5": "MOLINO V",
  "MOLINO 6": "MOLINO VI",
  "MOLINO 7": "MOLINO VII",
  "NIOG 1": "NIOG",
  "NIOG 2": "NIOG",
  "NIOG 3": "NIOG",
  "NIOG I": "NIOG",
  "NIOG II": "NIOG",
  "NIOG III": "NIOG",
  "REAL 1": "REAL",
  "REAL 2": "REAL",
  "REAL I": "REAL",
  "REAL II": "REAL",
  "SALINAS 1": "SALINAS I",
  "SALINAS 2": "SALINAS II",
  "SALINAS 3": "SALINAS II",
  "SALINAS 4": "SALINAS II",
  "SALINAS III": "SALINAS II",
  "SALINAS IV": "SALINAS II",
  "SAN NICOLAS 1": "SAN NICOLAS I",
  "SAN NICOLAS 2": "SAN NICOLAS II",
  "SAN NICOLAS 3": "SAN NICOLAS III",
  "TALABA 1": "TALABA I",
  "TALABA 2": "TALABA II",
  "TALABA 3": "TALABA III",
  "TALABA 4": "TALABA III",
  "TALABA 5": "TALABA III",
  "TALABA 6": "TALABA III",
  "TALABA 7": "TALABA I",
  "TALABA IV": "TALABA III",
  "TALABA V": "TALABA III",
  "TALABA VI": "TALABA III",
  "TALABA VII": "TALABA I",
  "ZAPOTE 1": "ZAPOTE I",
  "ZAPOTE 2": "ZAPOTE II",
  "ZAPOTE 3": "ZAPOTE III",
  "ZAPOTE 4": "ZAPOTE II",
  "ZAPOTE IV": "ZAPOTE II",
};

const REVERSE_BARANGAY_ALIASES = {};
Object.entries(BARANGAY_ALIASES).forEach(([legacy, current]) => {
  if (!REVERSE_BARANGAY_ALIASES[current]) REVERSE_BARANGAY_ALIASES[current] = [];
  REVERSE_BARANGAY_ALIASES[current].push(legacy);
});

function normalizeBarangay(raw) {
  if (!raw) return null;
  const cleaned = raw.trim().toUpperCase();
  return BARANGAY_ALIASES[cleaned] || cleaned;
}

function expandBarangays(names) {
  if (!names || names.length === 0) return [];
  const expanded = new Set();
  names.forEach((name) => {
    const upper = name.trim().toUpperCase();
    expanded.add(upper);
    (REVERSE_BARANGAY_ALIASES[upper] || []).forEach((alias) => expanded.add(alias));
  });
  return [...expanded];
}

module.exports = {
  VALID_BARANGAYS,
  BARANGAY_ALIASES,
  REVERSE_BARANGAY_ALIASES,
  normalizeBarangay,
  expandBarangays,
};