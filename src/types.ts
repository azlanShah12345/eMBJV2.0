export interface User {
  id: number;
  username: string;
  role: 'ADMIN' | 'USER';
  department_name: string;
  department_id: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
  requested_at?: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface Meeting {
  id: number;
  bil_mesyuarat: string;
  tarikh_mesyuarat: string;
  minit_path: string | null;
  submission_method?: 'D' | 'E' | null;
  department_id: number;
  department_name: string;
  is_locked: number;
  unlock_requested: number;
  unlock_rejected?: number;
  delete_requested: number;
  delete_rejected?: number;
  created_by: number;
  creator_name: string;
  created_at: string;
  total_issues: number;
  completed_issues: number;
  issue_categories?: string | null;
}

export interface Issue {
  id: number;
  meeting_id: number;
  category: string;
  is_from_previous: number;
  title: string;
  status: 'Selesai' | 'Belum Selesai';
  responsible_officer: string;
  updated_at: string;
}

export interface DashboardIssue extends Issue {
  meeting_label: string;
  meeting_date: string;
  department_id: number;
  department_name: string;
  meeting_is_locked: number;
}

export interface DashboardIssueFilters {
  department_id?: string;
  year?: string;
  bil_mesyuarat?: string;
  category?: string;
  status?: 'Selesai' | 'Belum Selesai' | '';
}

export interface SimilarIssue {
  id: number;
  meeting_id: number;
  meeting_label: string;
  meeting_date: string;
  department_name: string;
  category: string;
  title: string;
  status: 'Selesai' | 'Belum Selesai';
  is_from_previous: number;
  updated_at: string;
  similarity_score: number;
  is_same_meeting: boolean;
}

export interface IssueCategorySuggestion {
  category: string;
  matched_keywords: string[];
  score: number;
  source: 'data' | 'keyword';
  support_count: number;
  department_support_count: number;
  confidence: 'tinggi' | 'sederhana';
}

export interface MeetingMessage {
  id: number;
  meeting_id: number;
  user_id: number;
  username: string;
  user_role: 'ADMIN' | 'USER';
  department_name: string | null;
  message: string;
  created_at: string;
}

export interface MeetingMessageUnreadItem {
  meeting_id: number;
  bil_mesyuarat: string;
  department_name: string;
  unread_count: number;
  last_message_at: string;
  last_message_preview: string;
}

export interface MeetingMessageUnreadSummary {
  total_unread: number;
  items: MeetingMessageUnreadItem[];
}

export interface AuditLog {
  id: number;
  actor_user_id: number | null;
  actor_username: string | null;
  actor_role: 'ADMIN' | 'USER' | null;
  actor_department_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_label: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface CategoryStats {
  category: string;
  total: number;
  selesai: number;
  belum_selesai: number;
}

export interface SystemStatus {
  status: string;
  maintenance_mode: boolean;
  maintenance_title: string;
  maintenance_message: string;
  maintenance_started_at: string | null;
}

export interface PengelasanRow {
  category: string;
  previous_selesai_titles: string[];
  previous_belum_titles: string[];
  new_selesai_titles: string[];
  new_belum_titles: string[];
}

export interface PengelasanReport {
  department_name: string;
  meeting_label: string;
  report_year: number;
  rows: PengelasanRow[];
  totals: {
    previous_selesai: number;
    previous_belum: number;
    new_selesai: number;
    new_belum: number;
    overall: number;
  };
}

export const OFFICIAL_ISSUE_CATEGORIES = [
  'Kewangan',
  'Infrastruktur dan Fasiliti',
  'Sumber Manusia',
  'Kebajikan/Pembudayaan Nilai',
  'Inovasi dan Produktiviti',
  'Lain-lain'
];

export const LEGACY_ISSUE_CATEGORIES = [
  'Pentadbiran',
  'Inovasi dan produktivi',
  'Lain-lain'
];

export const CATEGORIES = OFFICIAL_ISSUE_CATEGORIES;

export const CATEGORY_FAMILY_MAP: Record<string, string[]> = {
  'Kebajikan/Pembudayaan Nilai': ['Kebajikan'],
  'Inovasi dan Produktiviti': ['Inovasi dan produktivi'],
};

const normalizeCategoryFamilyLabel = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

export const getCanonicalCategoryLabel = (value: string) => {
  const normalizedValue = normalizeCategoryFamilyLabel(value);
  const matchedOfficial = Object.keys(CATEGORY_FAMILY_MAP).find((officialCategory) => {
    if (normalizeCategoryFamilyLabel(officialCategory) === normalizedValue) {
      return true;
    }

    return CATEGORY_FAMILY_MAP[officialCategory].some(
      (alias) => normalizeCategoryFamilyLabel(alias) === normalizedValue
    );
  });

  return matchedOfficial || value.trim();
};

export const getCategoryFamilyMembers = (value: string) => {
  const canonical = getCanonicalCategoryLabel(value);
  const aliases = CATEGORY_FAMILY_MAP[canonical] || [];
  return [canonical, ...aliases];
};

export const getGroupedCategoryOptions = (categories: { id: number; name: string }[]) => {
  const seen = new Set<string>();
  const grouped = categories.reduce<{ id: number; name: string }[]>((acc, category) => {
    const canonical = getCanonicalCategoryLabel(category.name);
    const normalizedCanonical = normalizeCategoryFamilyLabel(canonical);
    if (seen.has(normalizedCanonical)) {
      return acc;
    }

    seen.add(normalizedCanonical);
    acc.push({
      id: category.id,
      name: canonical,
    });
    return acc;
  }, []);

  return grouped.sort((left, right) => left.name.localeCompare(right.name, 'ms'));
};
