const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Kewangan dan Kemudahan': [
    'bajet',
    'peruntukan',
    'kewangan',
    'bayaran',
    'tuntutan',
    'elaun',
    'kemudahan',
    'aset',
    'peralatan',
    'penyelenggaraan',
    'kerosakan',
    'bangunan',
    'bilik',
    'ruang pejabat',
    'kenderaan',
    'komputer',
    'printer',
    'internet',
    'projektor',
    'penghawa dingin',
  ],
  Pentadbiran: [
    'pentadbiran',
    'surat',
    'dokumen',
    'fail',
    'rekod',
    'urusetia',
    'urus setia',
    'prosedur',
    'tatacara',
    'sop',
    'kelulusan',
    'mesyuarat',
    'jadual',
    'tindakan susulan',
    'pekeliling',
    'memo',
  ],
  'Sumber Manusia': [
    'sumber manusia',
    'pegawai',
    'kakitangan',
    'staf',
    'perjawatan',
    'latihan',
    'kursus',
    'cuti',
    'prestasi',
    'disiplin',
    'tatatertib',
    'kehadiran',
    'penempatan',
    'kenaikan pangkat',
    'perkhidmatan',
  ],
  Kebajikan: [
    'kebajikan',
    'kesihatan',
    'keselamatan',
    'sokongan',
    'bantuan',
    'kesejahteraan',
    'makanan',
    'surau',
    'tandas',
    'parkir',
    'tempat letak kereta',
    'pengangkutan',
    'kecemasan',
    'ergonomik',
  ],
  'Inovasi dan Produktiviti': [
    'inovasi',
    'produktiviti',
    'digital',
    'sistem',
    'automasi',
    'integrasi',
    'dashboard',
    'analitik',
    'data',
    'proses kerja',
    'penambahbaikan',
    'kecekapan',
    'aplikasi',
    'teknologi',
  ],
  'Lain-lain': [
    'lain',
    'pelbagai',
    'umum',
  ],
};

export interface IssueCategorySuggestion {
  category: string;
  matchedKeywords: string[];
  score: number;
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const findAvailableCategory = (availableCategories: string[], targetCategory: string) => {
  const normalizedTarget = normalizeText(targetCategory);

  return (
    availableCategories.find((category) => normalizeText(category) === normalizedTarget) ||
    availableCategories.find((category) => normalizeText(category).includes(normalizedTarget)) ||
    null
  );
};

export const getSuggestedIssueCategory = (
  issueTitle: string,
  availableCategories: string[]
): IssueCategorySuggestion | null => {
  const normalizedTitle = normalizeText(issueTitle);
  if (!normalizedTitle || availableCategories.length === 0) {
    return null;
  }

  let bestSuggestion: IssueCategorySuggestion | null = null;

  Object.entries(CATEGORY_KEYWORDS).forEach(([canonicalCategory, keywords]) => {
    const availableCategory = findAvailableCategory(availableCategories, canonicalCategory);
    if (!availableCategory) {
      return;
    }

    const matchedKeywords = keywords.filter((keyword) => normalizedTitle.includes(normalizeText(keyword)));
    if (matchedKeywords.length === 0) {
      return;
    }

    const score = matchedKeywords.reduce((total, keyword) => total + Math.max(4, normalizeText(keyword).length), 0);
    const suggestion = {
      category: availableCategory,
      matchedKeywords,
      score,
    };

    if (!bestSuggestion || suggestion.score > bestSuggestion.score) {
      bestSuggestion = suggestion;
    }
  });

  return bestSuggestion;
};
