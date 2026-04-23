import type { IssueCategorySuggestion } from '../types';

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

export interface IssueCategoryLearningExample {
  title: string;
  category: string;
  departmentId?: number | null;
}

type AggregatedLearningSignal = {
  category: string;
  totalScore: number;
  supportCount: number;
  strongMatchCount: number;
  exactMatchCount: number;
  departmentIds: Set<number>;
};

const MIN_LEARNING_SIMILARITY_SCORE = 45;
const STRONG_LEARNING_SIMILARITY_SCORE = 78;

export const normalizeSuggestionText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const getSuggestionTokens = (value: string) =>
  normalizeSuggestionText(value)
    .split(' ')
    .filter((token) => token.length >= 3);

export const calculateIssueSuggestionSimilarity = (leftTitle: string, rightTitle: string) => {
  const normalizedLeft = normalizeSuggestionText(leftTitle);
  const normalizedRight = normalizeSuggestionText(rightTitle);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  if (normalizedLeft.includes(normalizedRight) || normalizedRight.includes(normalizedLeft)) {
    return 92;
  }

  const leftTokens = Array.from(new Set(getSuggestionTokens(normalizedLeft)));
  const rightTokens = Array.from(new Set(getSuggestionTokens(normalizedRight)));
  if (leftTokens.length === 0 || rightTokens.length === 0) {
    return 0;
  }

  const rightTokenSet = new Set(rightTokens);
  const intersectionCount = leftTokens.filter((token) => rightTokenSet.has(token)).length;
  if (intersectionCount === 0) {
    return 0;
  }

  const unionCount = new Set([...leftTokens, ...rightTokens]).size;
  const overlapScore = intersectionCount / Math.min(leftTokens.length, rightTokens.length);
  const jaccardScore = intersectionCount / unionCount;

  return Math.min(100, Math.max(0, Math.round((overlapScore * 70 + jaccardScore * 30) * 100)));
};

const findAvailableCategory = (availableCategories: string[], aliases: readonly string[]) => {
  const normalizedAliases = aliases.map((alias) => normalizeSuggestionText(alias));

  return (
    availableCategories.find((category) => normalizedAliases.includes(normalizeSuggestionText(category))) ||
    availableCategories.find((category) =>
      normalizedAliases.some((alias) => {
        const normalizedCategory = normalizeSuggestionText(category);
        return normalizedCategory.includes(alias) || alias.includes(normalizedCategory);
      })
    ) ||
    null
  );
};

const resolveAvailableCategory = (availableCategories: string[], categoryLabel: string) => {
  const normalizedCategoryLabel = normalizeSuggestionText(categoryLabel);
  const directMatch = availableCategories.find(
    (availableCategory) => normalizeSuggestionText(availableCategory) === normalizedCategoryLabel
  );

  if (directMatch) {
    return directMatch;
  }

  const matchedFamily = CATEGORY_MATCHERS.find(({ aliases }) =>
    aliases.some((alias) => normalizeSuggestionText(alias) === normalizedCategoryLabel)
  );

  if (!matchedFamily) {
    return null;
  }

  return findAvailableCategory(availableCategories, matchedFamily.aliases);
};

const toKeywordSuggestion = (
  category: string,
  matchedKeywords: string[],
  score: number
): IssueCategorySuggestion => ({
  category,
  matched_keywords: matchedKeywords,
  score,
  source: 'keyword',
  support_count: 0,
  department_support_count: 0,
  confidence: score >= 18 ? 'tinggi' : 'sederhana',
});

export const getKeywordIssueCategorySuggestion = (
  issueTitle: string,
  availableCategories: string[]
): IssueCategorySuggestion | null => {
  const normalizedTitle = normalizeSuggestionText(issueTitle);
  if (!normalizedTitle || availableCategories.length === 0) {
    return null;
  }

  let bestSuggestion: IssueCategorySuggestion | null = null;

  CATEGORY_MATCHERS.forEach(({ aliases, keywords }) => {
    const availableCategory = findAvailableCategory(availableCategories, aliases);
    if (!availableCategory) {
      return;
    }

    const matchedKeywords = keywords.filter((keyword) => normalizedTitle.includes(normalizeSuggestionText(keyword)));
    if (matchedKeywords.length === 0) {
      return;
    }

    const score = matchedKeywords.reduce((total, keyword) => total + Math.max(4, normalizeSuggestionText(keyword).length), 0);
    const suggestion = toKeywordSuggestion(availableCategory, matchedKeywords, score);

    if (!bestSuggestion || suggestion.score > bestSuggestion.score) {
      bestSuggestion = suggestion;
    }
  });

  return bestSuggestion;
};

export const getLearnedIssueCategorySuggestion = (
  issueTitle: string,
  availableCategories: string[],
  learningExamples: IssueCategoryLearningExample[]
): IssueCategorySuggestion | null => {
  const normalizedTitle = normalizeSuggestionText(issueTitle);
  if (!normalizedTitle || availableCategories.length === 0 || learningExamples.length === 0) {
    return null;
  }

  const learningSignals = new Map<string, AggregatedLearningSignal>();

  learningExamples.forEach((example) => {
    const resolvedCategory = resolveAvailableCategory(availableCategories, example.category);
    if (!resolvedCategory) {
      return;
    }

    const similarityScore = calculateIssueSuggestionSimilarity(issueTitle, example.title);
    if (similarityScore < MIN_LEARNING_SIMILARITY_SCORE) {
      return;
    }

    const currentSignal = learningSignals.get(resolvedCategory) || {
      category: resolvedCategory,
      totalScore: 0,
      supportCount: 0,
      strongMatchCount: 0,
      exactMatchCount: 0,
      departmentIds: new Set<number>(),
    };

    currentSignal.totalScore += similarityScore;
    currentSignal.supportCount += 1;
    if (similarityScore >= STRONG_LEARNING_SIMILARITY_SCORE) {
      currentSignal.strongMatchCount += 1;
    }
    if (similarityScore === 100) {
      currentSignal.exactMatchCount += 1;
    }
    if (typeof example.departmentId === 'number' && Number.isFinite(example.departmentId)) {
      currentSignal.departmentIds.add(example.departmentId);
    }

    learningSignals.set(resolvedCategory, currentSignal);
  });

  const rankedSignals = Array.from(learningSignals.values()).sort((left, right) => {
    if (right.totalScore !== left.totalScore) {
      return right.totalScore - left.totalScore;
    }
    if (right.strongMatchCount !== left.strongMatchCount) {
      return right.strongMatchCount - left.strongMatchCount;
    }
    if (right.supportCount !== left.supportCount) {
      return right.supportCount - left.supportCount;
    }
    if (right.exactMatchCount !== left.exactMatchCount) {
      return right.exactMatchCount - left.exactMatchCount;
    }
    return right.departmentIds.size - left.departmentIds.size;
  });

  const bestSignal = rankedSignals[0];
  if (!bestSignal) {
    return null;
  }

  const runnerUpSignal = rankedSignals[1];
  const hasReliableSupport =
    bestSignal.supportCount >= 2 ||
    bestSignal.strongMatchCount >= 2 ||
    (bestSignal.exactMatchCount >= 1 && !runnerUpSignal);

  if (!hasReliableSupport) {
    return null;
  }

  const hasClearLead =
    !runnerUpSignal ||
    bestSignal.totalScore >= runnerUpSignal.totalScore * 1.15 ||
    bestSignal.supportCount >= runnerUpSignal.supportCount + 1 ||
    bestSignal.strongMatchCount > runnerUpSignal.strongMatchCount;

  if (!hasClearLead || bestSignal.totalScore < 90) {
    return null;
  }

  return {
    category: bestSignal.category,
    matched_keywords: [],
    score: bestSignal.totalScore,
    source: 'data',
    support_count: bestSignal.supportCount,
    department_support_count: bestSignal.departmentIds.size,
    confidence:
      bestSignal.supportCount >= 3 || bestSignal.departmentIds.size >= 2 || bestSignal.strongMatchCount >= 3
        ? 'tinggi'
        : 'sederhana',
  };
};

export const getSuggestedIssueCategory = (
  issueTitle: string,
  availableCategories: string[],
  learningExamples: IssueCategoryLearningExample[] = []
): IssueCategorySuggestion | null =>
  getLearnedIssueCategorySuggestion(issueTitle, availableCategories, learningExamples) ||
  getKeywordIssueCategorySuggestion(issueTitle, availableCategories);
