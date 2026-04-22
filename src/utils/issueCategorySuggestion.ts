const CATEGORY_MATCHERS = [
  {
    aliases: ['Kewangan', 'Kewangan dan Kemudahan', 'Kewangan dan kemudahan'],
    keywords: ['bajet', 'peruntukan', 'kewangan', 'bayaran', 'tuntutan', 'elaun', 'perbelanjaan', 'resit', 'bil'],
  },
  {
    aliases: ['Infrastruktur dan Fasiliti', 'Infrastruktur'],
    keywords: [
      'kemudahan',
      'fasiliti',
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
      'naik taraf',
      'bekalan elektrik',
      'rangkaian',
    ],
  },
  {
    aliases: ['Sumber Manusia', 'Sumber manusia', 'Perjawatan'],
    keywords: [
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
  },
  {
    aliases: ['Kebajikan/Pembudayaan Nilai', 'Kebajikan'],
    keywords: [
      'kebajikan',
      'nilai',
      'pembudayaan',
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
  },
  {
    aliases: ['Inovasi dan Produktiviti', 'Inovasi dan produktivi'],
    keywords: [
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
  },
  {
    aliases: ['Lain-lain'],
    keywords: ['lain', 'pelbagai', 'umum'],
  },
] as const;

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

const findAvailableCategory = (availableCategories: string[], aliases: readonly string[]) => {
  const normalizedAliases = aliases.map((alias) => normalizeText(alias));

  return (
    availableCategories.find((category) => normalizedAliases.includes(normalizeText(category))) ||
    availableCategories.find((category) =>
      normalizedAliases.some((alias) => normalizeText(category).includes(alias) || alias.includes(normalizeText(category)))
    ) ||
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

  CATEGORY_MATCHERS.forEach(({ aliases, keywords }) => {
    const availableCategory = findAvailableCategory(availableCategories, aliases);
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
