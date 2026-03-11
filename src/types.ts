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

export const CATEGORIES = [
  'Kewangan dan Kemudahan',
  'Pentadbiran',
  'Sumber Manusia',
  'Kebajikan',
  'Inovasi dan Produktiviti',
  'Lain-lain'
];
