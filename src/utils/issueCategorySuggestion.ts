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

export type IssueDuplicateFeedbackType = 'MATCH' | 'NO_MATCH';

export interface IssueDuplicateFeedbackExample {
  inputTitle: string;
  normalizedInputTitle?: string;
  feedbackType: IssueDuplicateFeedbackType;
  actorUserId?: number | null;
}

export interface IssueDuplicateMatchExplanation {
  sharedKeywords: string[];
  summary: string;
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
const MIN_DUPLICATE_FEEDBACK_TITLE_SIMILARITY = 58;
const DUPLICATE_FEEDBACK_MATCH_BOOST = 12;
const DUPLICATE_FEEDBACK_NO_MATCH_PENALTY = 18;
const DUPLICATE_FEEDBACK_MAX_BOOST = 26;
const DUPLICATE_FEEDBACK_MAX_PENALTY = 36;
const ISSUE_DUPLICATE_STOPWORDS = new Set([
  'adalah',
  'agar',
  'akan',
  'bagi',
  'baharu',
  'berkaitan',
  'boleh',
  'dan',
  'dengan',
  'dalam',
  'daripada',
  'diantara',
  'hendaklah',
  'ialah',
  'ini',
  'isu',
  'jabatan',
  'kepada',
  'kerana',
  'mesti',
  'mesyuarat',
  'oleh',
  'pada',
  'perkara',
  'perlu',
  'sahaja',
  'sebagai',
  'semasa',
  'semua',
  'supaya',
  'telah',
  'terhadap',
  'untuk',
  'yang',
]);

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

const getMeaningfulSuggestionTokens = (value: string) =>
  getSuggestionTokens(value).filter((token) => !ISSUE_DUPLICATE_STOPWORDS.has(token));

const clampSimilarityScore = (value: number, max = 100) =>
  Math.min(max, Math.max(0, Math.round(value)));

const clampSignedNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Math.round(value)));

const getUniqueTokenIntersectionCount = (leftTokens: string[], rightTokens: string[]) => {
  const rightSet = new Set(rightTokens);
  return Array.from(new Set(leftTokens)).filter((token) => rightSet.has(token)).length;
};

const getUniqueTokenJaccardScore = (leftTokens: string[], rightTokens: string[]) => {
  const leftSet = new Set(leftTokens);
  const rightSet = new Set(rightTokens);
  const intersectionCount = getUniqueTokenIntersectionCount(leftTokens, rightTokens);
  const unionCount = new Set([...leftSet, ...rightSet]).size;

  if (intersectionCount === 0 || unionCount === 0) {
    return 0;
  }

  return intersectionCount / unionCount;
};

const getMultisetDiceScore = (leftItems: string[], rightItems: string[]) => {
  if (leftItems.length === 0 || rightItems.length === 0) {
    return 0;
  }

  const rightCounts = new Map<string, number>();
  rightItems.forEach((item) => {
    rightCounts.set(item, (rightCounts.get(item) || 0) + 1);
  });

  let matches = 0;
  leftItems.forEach((item) => {
    const currentCount = rightCounts.get(item) || 0;
    if (currentCount > 0) {
      matches += 1;
      rightCounts.set(item, currentCount - 1);
    }
  });

  if (matches === 0) {
    return 0;
  }

  return (2 * matches) / (leftItems.length + rightItems.length);
};

const getAdjacentTokenPairs = (tokens: string[]) =>
  tokens.slice(0, -1).map((token, index) => `${token} ${tokens[index + 1]}`);

const getCharacterNgrams = (value: string, size = 2) => {
  const compactValue = value.replace(/\s+/g, '');
  if (compactValue.length === 0) {
    return [];
  }
  if (compactValue.length <= size) {
    return [compactValue];
  }

  const ngrams: string[] = [];
  for (let index = 0; index <= compactValue.length - size; index += 1) {
    ngrams.push(compactValue.slice(index, index + size));
  }
  return ngrams;
};

const getSortedTokenSignature = (tokens: string[]) =>
  [...tokens].sort((left, right) => left.localeCompare(right)).join(' ');

const getFeedbackWeightFromSimilarity = (similarityScore: number) => {
  if (similarityScore >= 95) {
    return 1.1;
  }
  if (similarityScore >= 85) {
    return 1;
  }
  return Math.max(0.65, similarityScore / 100);
};

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

export const calculateIssueDuplicateSimilarity = (leftTitle: string, rightTitle: string) => {
  const normalizedLeft = normalizeSuggestionText(leftTitle);
  const normalizedRight = normalizeSuggestionText(rightTitle);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  const leftTokens = getSuggestionTokens(normalizedLeft);
  const rightTokens = getSuggestionTokens(normalizedRight);
  const leftMeaningfulTokens = getMeaningfulSuggestionTokens(normalizedLeft);
  const rightMeaningfulTokens = getMeaningfulSuggestionTokens(normalizedRight);
  const comparisonLeftTokens = leftMeaningfulTokens.length > 0 ? leftMeaningfulTokens : leftTokens;
  const comparisonRightTokens = rightMeaningfulTokens.length > 0 ? rightMeaningfulTokens : rightTokens;

  if (comparisonLeftTokens.length === 0 || comparisonRightTokens.length === 0) {
    const charOnlyScore = getMultisetDiceScore(
      getCharacterNgrams(normalizedLeft),
      getCharacterNgrams(normalizedRight)
    );
    return clampSimilarityScore(charOnlyScore * 60, 85);
  }

  const uniqueTokenScore = getUniqueTokenJaccardScore(comparisonLeftTokens, comparisonRightTokens);
  const sharedUniqueTokenCount = getUniqueTokenIntersectionCount(comparisonLeftTokens, comparisonRightTokens);
  const tokenFrequencyScore = getMultisetDiceScore(comparisonLeftTokens, comparisonRightTokens);
  const tokenOrderScore = getMultisetDiceScore(
    getAdjacentTokenPairs(comparisonLeftTokens),
    getAdjacentTokenPairs(comparisonRightTokens)
  );
  const characterScore = getMultisetDiceScore(
    getCharacterNgrams(normalizedLeft),
    getCharacterNgrams(normalizedRight)
  );

  const hasSameTokenBag =
    comparisonLeftTokens.length === comparisonRightTokens.length &&
    getSortedTokenSignature(comparisonLeftTokens) === getSortedTokenSignature(comparisonRightTokens);

  if (hasSameTokenBag) {
    const reorderedScore = 88 + tokenOrderScore * 4 + characterScore * 4;
    return clampSimilarityScore(reorderedScore, 96);
  }

  const isContainmentMatch =
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft);

  let score =
    uniqueTokenScore * 34 +
    tokenFrequencyScore * 28 +
    tokenOrderScore * 18 +
    characterScore * 20;

  if (isContainmentMatch) {
    score = Math.max(score, 78 + tokenFrequencyScore * 8 + characterScore * 6);
  }

  if (sharedUniqueTokenCount >= 2) {
    score = Math.max(
      score,
      40 + sharedUniqueTokenCount * 4 + tokenFrequencyScore * 6 + characterScore * 6
    );
  }

  if (uniqueTokenScore >= 0.8 && tokenOrderScore < 0.25) {
    score = Math.min(score, 89);
  }

  if (uniqueTokenScore < 0.4 && characterScore < 0.55) {
    score *= 0.85;
  }

  return clampSimilarityScore(score, 99);
};

export const explainIssueDuplicateMatch = (
  leftTitle: string,
  rightTitle: string
): IssueDuplicateMatchExplanation => {
  const normalizedLeft = normalizeSuggestionText(leftTitle);
  const normalizedRight = normalizeSuggestionText(rightTitle);
  const leftTokens = getSuggestionTokens(normalizedLeft);
  const rightTokens = getSuggestionTokens(normalizedRight);
  const leftMeaningfulTokens = getMeaningfulSuggestionTokens(normalizedLeft);
  const rightMeaningfulTokens = getMeaningfulSuggestionTokens(normalizedRight);
  const comparisonLeftTokens = leftMeaningfulTokens.length > 0 ? leftMeaningfulTokens : leftTokens;
  const comparisonRightTokens = rightMeaningfulTokens.length > 0 ? rightMeaningfulTokens : rightTokens;
  const sharedKeywords = Array.from(
    new Set(comparisonLeftTokens.filter((token) => comparisonRightTokens.includes(token)))
  ).slice(0, 5);
  const hasSameTokenBag =
    comparisonLeftTokens.length === comparisonRightTokens.length &&
    getSortedTokenSignature(comparisonLeftTokens) === getSortedTokenSignature(comparisonRightTokens);
  const isContainmentMatch =
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft);

  if (normalizedLeft && normalizedLeft === normalizedRight) {
    return {
      sharedKeywords,
      summary: 'Teks ini sepadan hampir sepenuhnya selepas normalisasi sistem.',
    };
  }

  if (hasSameTokenBag) {
    return {
      sharedKeywords,
      summary: 'Kata utama adalah sama, tetapi susunan ayat berbeza.',
    };
  }

  if (isContainmentMatch) {
    return {
      sharedKeywords,
      summary: 'Sebahagian besar frasa utama terkandung antara kedua-dua rekod.',
    };
  }

  if (sharedKeywords.length >= 3) {
    return {
      sharedKeywords,
      summary: 'Beberapa kata utama yang penting bertindih dengan kuat.',
    };
  }

  if (sharedKeywords.length >= 1) {
    return {
      sharedKeywords,
      summary: 'Terdapat pertindihan pada beberapa kata utama rekod.',
    };
  }

  return {
    sharedKeywords,
    summary: 'Padanan ini lebih dipengaruhi oleh corak ejaan dan struktur frasa yang hampir serupa.',
  };
};

export const summarizeIssueDuplicateFeedback = (
  requestedTitle: string,
  feedbackExamples: IssueDuplicateFeedbackExample[],
  currentUserId?: number | null
) => {
  const normalizedRequestedTitle = normalizeSuggestionText(requestedTitle);
  if (!normalizedRequestedTitle || feedbackExamples.length === 0) {
    return {
      adjustment: 0,
      relevantCount: 0,
      matchCount: 0,
      noMatchCount: 0,
      dominantFeedbackType: null as IssueDuplicateFeedbackType | null,
      currentUserFeedbackType: null as IssueDuplicateFeedbackType | null,
    };
  }

  let weightedMatchSupport = 0;
  let weightedNoMatchSupport = 0;
  let matchCount = 0;
  let noMatchCount = 0;
  let currentUserFeedbackType: IssueDuplicateFeedbackType | null = null;

  feedbackExamples.forEach((example) => {
    const normalizedInputTitle = example.normalizedInputTitle || normalizeSuggestionText(example.inputTitle);
    const titleSimilarity = normalizedInputTitle === normalizedRequestedTitle
      ? 100
      : calculateIssueSuggestionSimilarity(requestedTitle, example.inputTitle);

    if (titleSimilarity < MIN_DUPLICATE_FEEDBACK_TITLE_SIMILARITY) {
      return;
    }

    const weight = getFeedbackWeightFromSimilarity(titleSimilarity);
    if (example.feedbackType === 'MATCH') {
      weightedMatchSupport += weight;
      matchCount += 1;
    } else {
      weightedNoMatchSupport += weight;
      noMatchCount += 1;
    }

    if (
      currentUserId &&
      Number(example.actorUserId) === Number(currentUserId) &&
      normalizedInputTitle === normalizedRequestedTitle
    ) {
      currentUserFeedbackType = example.feedbackType;
    }
  });

  const boost = Math.min(DUPLICATE_FEEDBACK_MAX_BOOST, weightedMatchSupport * DUPLICATE_FEEDBACK_MATCH_BOOST);
  const penalty = Math.min(DUPLICATE_FEEDBACK_MAX_PENALTY, weightedNoMatchSupport * DUPLICATE_FEEDBACK_NO_MATCH_PENALTY);
  const dominantFeedbackType =
    weightedMatchSupport === weightedNoMatchSupport
      ? null
      : weightedMatchSupport > weightedNoMatchSupport
        ? 'MATCH'
        : 'NO_MATCH';

  return {
    adjustment: clampSignedNumber(boost - penalty, -DUPLICATE_FEEDBACK_MAX_PENALTY, DUPLICATE_FEEDBACK_MAX_BOOST),
    relevantCount: matchCount + noMatchCount,
    matchCount,
    noMatchCount,
    dominantFeedbackType,
    currentUserFeedbackType,
  };
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
