// Ground truth: GeoJSON name_db values
// 47 official Bacoor barangays after the 2023 merger.

export const CURRENT_BARANGAYS = [
  "ANIBAN I",
  "ANIBAN II",
  "BAYANAN",
  "DULONG BAYAN",
  "HABAY I",
  "HABAY II",

  "KAINGIN DIGMAN",

  "LIGAS I",
  "LIGAS II",

  "MABOLO",
  "MALIKSI I",
  "MALIKSI II",

  "MAMBOG I",
  "MAMBOG II",
  "MAMBOG III",
  "MAMBOG IV",

  "MOLINO I",
  "MOLINO II",
  "MOLINO III",
  "MOLINO IV",
  "MOLINO V",
  "MOLINO VI",
  "MOLINO VII",

  "NIOG",

  "P.F. ESPIRITU I (PANAPAAN)",
  "P.F. ESPIRITU II",
  "P.F. ESPIRITU III",
  "P.F. ESPIRITU IV",
  "P.F. ESPIRITU V",
  "P.F. ESPIRITU VI",
  "POBLACION",

  "QUEENS ROW CENTRAL",
  "QUEENS ROW EAST",
  "QUEENS ROW WEST",

  "REAL",

  "SALINAS I",
  "SALINAS II",

  "SAN NICOLAS I",
  "SAN NICOLAS II",
  "SAN NICOLAS III",

  "SINBANALI",

  "TALABA I",
  "TALABA II",
  "TALABA III",

  "ZAPOTE I",
  "ZAPOTE II",
  "ZAPOTE III",
];

// Old/pre-2023 barangay names → current barangay.
//
// These are only for legacy records/imports.
// Current names remain in CURRENT_BARANGAYS.

export const LEGACY_BARANGAY_OPTIONS = [
  // SINBANALI
  { label: "Alima (→ Sinbanali)", value: "SINBANALI" },
  { label: "Banalo (→ Sinbanali)", value: "SINBANALI" },
  { label: "Sineguelasan (→ Sinbanali)", value: "SINBANALI" },

  // POBLACION
  { label: "Camposanto (→ Poblacion)", value: "POBLACION" },
  { label: "Campo Santo (→ Poblacion)", value: "POBLACION" },
  { label: "Daang Bukid (→ Poblacion)", value: "POBLACION" },
  { label: "Tabing Dagat (→ Poblacion)", value: "POBLACION" },

  // KAINGIN DIGMAN
  { label: "Kaingin (→ Kaingin Digman)", value: "KAINGIN DIGMAN" },
  { label: "Digman (→ Kaingin Digman)", value: "KAINGIN DIGMAN" },

  // P.F. ESPIRITU
  {
    label: "Panapaan (→ P.F. Espiritu I)",
    value: "P.F. ESPIRITU I (PANAPAAN)",
  },
  { label: "Panapaan 2 (→ P.F. Espiritu II)", value: "P.F. ESPIRITU II" },
  { label: "Panapaan 3 (→ P.F. Espiritu II)", value: "P.F. ESPIRITU II" },
  { label: "Panapaan 4 (→ P.F. Espiritu IV)", value: "P.F. ESPIRITU IV" },
  { label: "Panapaan 5 (→ P.F. Espiritu V)", value: "P.F. ESPIRITU V" },
  { label: "Panapaan 6 (→ P.F. Espiritu VI)", value: "P.F. ESPIRITU VI" },

  // ANIBAN
  { label: "Aniban 3 (→ Aniban I)", value: "ANIBAN I" },
  { label: "Aniban 4 (→ Aniban II)", value: "ANIBAN II" },
  { label: "Aniban 5 (→ Aniban I)", value: "ANIBAN I" },

  // MABOLO
  { label: "Mabolo 1 (→ Mabolo)", value: "MABOLO" },
  { label: "Mabolo 2 (→ Mabolo)", value: "MABOLO" },
  { label: "Mabolo 3 (→ Mabolo)", value: "MABOLO" },

  // MALIKSI
  { label: "Maliksi 3 (→ Maliksi II)", value: "MALIKSI II" },

  // MAMBOG
  { label: "Mambog 5 (→ Mambog II)", value: "MAMBOG II" },

  // NIOG
  { label: "Niog 2 (→ Niog)", value: "NIOG" },
  { label: "Niog 3 (→ Niog)", value: "NIOG" },

  // REAL
  { label: "Real 2 (→ Real)", value: "REAL" },

  // SALINAS
  { label: "Salinas 3 (→ Salinas II)", value: "SALINAS II" },
  { label: "Salinas 4 (→ Salinas II)", value: "SALINAS II" },

  // TALABA
  { label: "Talaba 4 (→ Talaba III)", value: "TALABA III" },
  { label: "Talaba 5 (→ Talaba III)", value: "TALABA III" },
  { label: "Talaba 6 (→ Talaba III)", value: "TALABA III" },
  { label: "Talaba 7 (→ Talaba I)", value: "TALABA I" },

  // ZAPOTE
  { label: "Zapote 4 (→ Zapote II)", value: "ZAPOTE II" },
  { label: "Zapote V (→ Zapote III)", value: "ZAPOTE III" },
];

// Optional helper for legacy lookup.
// Keeps the second file's naming convention intact.

export const LEGACY_BARANGAY_MAP = Object.fromEntries(
  LEGACY_BARANGAY_OPTIONS.map(({ label, value }) => {
    const legacyName = label
      .replace(/\s*\(→.*\)$/, "")
      .trim()
      .toUpperCase();

    return [legacyName, value];
  }),
);
