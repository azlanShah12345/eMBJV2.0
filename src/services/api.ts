import { User, Department, Meeting, Issue, SimilarIssue, CategoryStats, PengelasanReport, MeetingMessage, MeetingMessageUnreadSummary, AuditLog, DashboardIssue, SystemStatus, IssueCategorySuggestion, Announcement, AnnouncementUnreadSummary, LastYearIncompleteReportItem, ReportSubmissionReminderUnreadSummary } from '../types';

const API_BASE = '/api';

const getHeaders = () => {
  const token = sessionStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const handleResponse = async (res: Response) => {
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Ralat tidak diketahui' }));
    throw new Error(error.error || `Permintaan gagal dengan status ${res.status}`);
  }
  return res.json();
};

export const api = {
  async login(username: string, password: string) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    return handleResponse(res);
  },

  async register(userData: { username: string; password: string; department_id: number }) {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async getDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/departments`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getPublicDepartments(): Promise<Department[]> {
    const res = await fetch(`${API_BASE}/public/departments`);
    return handleResponse(res);
  },

  async getPublicSystemStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/public/system-status`);
    return handleResponse(res);
  },

  async getMeetings(departmentId?: number): Promise<Meeting[]> {
    const url = departmentId ? `${API_BASE}/meetings?department_id=${departmentId}` : `${API_BASE}/meetings`;
    const res = await fetch(url, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getMeeting(id: number): Promise<Meeting> {
    const res = await fetch(`${API_BASE}/meetings/${id}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createMeeting(formData: FormData): Promise<{ id: number }> {
    const token = sessionStorage.getItem('token');
    const res = await fetch(`${API_BASE}/meetings`, {
      method: 'POST',
      headers: {
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    return handleResponse(res);
  },

  async getIssues(meetingId: number): Promise<Issue[]> {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/issues`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getDashboardIssues(params: {
    department_id?: number;
    bil_mesyuarat?: string;
    category?: string;
    keyword?: string;
    year?: number;
    status?: 'Selesai' | 'Belum Selesai';
    issue_age_bucket?: '3_bulan' | '6_bulan' | '1_tahun' | 'lebih_setahun';
    official_only?: boolean;
  }): Promise<DashboardIssue[]> {
    const query = new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = typeof value === 'boolean' ? (value ? '1' : '0') : String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/dashboard/issues${query ? `?${query}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addIssue(meetingId: number, issue: Partial<Issue>): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/issues`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(issue),
    });
    return handleResponse(res);
  },

  async getSimilarIssues(meetingId: number, title: string): Promise<SimilarIssue[]> {
    const query = new URLSearchParams({ title }).toString();
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/similar-issues?${query}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getIssueCategorySuggestion(meetingId: number, title: string): Promise<IssueCategorySuggestion | null> {
    const query = new URLSearchParams({ title }).toString();
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/issue-category-suggestion?${query}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getMeetingMessages(meetingId: number): Promise<MeetingMessage[]> {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/messages`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async addMeetingMessage(meetingId: number, message: string): Promise<{ id: number }> {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/messages`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ message }),
    });
    return handleResponse(res);
  },

  async markMeetingMessagesRead(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/messages/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getMeetingMessageUnreadSummary(): Promise<MeetingMessageUnreadSummary> {
    const res = await fetch(`${API_BASE}/messages/unread-summary`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getAnnouncements(): Promise<Announcement[]> {
    const res = await fetch(`${API_BASE}/announcements`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createAnnouncement(payload: { title: string; message: string }) {
    const res = await fetch(`${API_BASE}/announcements`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse(res);
  },

  async deleteAnnouncement(id: number) {
    const res = await fetch(`${API_BASE}/announcements/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async markAnnouncementRead(id: number) {
    const res = await fetch(`${API_BASE}/announcements/${id}/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getAnnouncementUnreadSummary(): Promise<AnnouncementUnreadSummary> {
    const res = await fetch(`${API_BASE}/announcements/unread-summary`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getLastYearIncompleteReports(year?: number): Promise<LastYearIncompleteReportItem[]> {
    const query = new URLSearchParams(
      Object.entries({ year }).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/admin/report-completeness/last-year${query ? `?${query}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async sendLastYearReportReminder(departmentId: number, year?: number) {
    const query = new URLSearchParams(
      Object.entries({ year }).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null) {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/admin/report-completeness/last-year/${departmentId}/remind${query ? `?${query}` : ''}`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getReportSubmissionReminderUnreadSummary(): Promise<ReportSubmissionReminderUnreadSummary> {
    const res = await fetch(`${API_BASE}/report-submission-reminders/unread-summary`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async markReportSubmissionReminderRead(id: number) {
    const res = await fetch(`${API_BASE}/report-submission-reminders/${id}/read`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getAuditLogs(params: { action?: string; actor?: string; date_from?: string; date_to?: string; limit?: number } = {}): Promise<AuditLog[]> {
    const query = new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/audit-logs${query ? `?${query}` : ''}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async updateIssue(issueId: number, updates: Partial<Issue>) {
    const res = await fetch(`${API_BASE}/issues/${issueId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(updates),
    });
    return handleResponse(res);
  },

  async deleteIssue(issueId: number) {
    const res = await fetch(`${API_BASE}/issues/${issueId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async lockMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/lock`, {
      method: 'PATCH',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async submitMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/submit`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async requestUnlock(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/request-unlock`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async approveUnlock(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/approve-unlock`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async rejectUnlock(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/reject-unlock`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async requestDeleteMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/request-delete`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async approveDeleteMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/approve-delete`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async rejectDeleteMeeting(meetingId: number) {
    const res = await fetch(`${API_BASE}/meetings/${meetingId}/reject-delete`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async getStats(params: { department_id?: number; bil_mesyuarat?: string; category?: string; year?: number }): Promise<CategoryStats[]> {
    const query = new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/stats?${query}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async getPengelasanReport(params: { department_id?: number; bil_mesyuarat?: string; category?: string; year?: number }): Promise<PengelasanReport> {
    const query = new URLSearchParams(
      Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = String(value);
        }
        return acc;
      }, {})
    ).toString();
    const res = await fetch(`${API_BASE}/reports/pengelasan?${query}`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async changePassword(current_password: string, new_password: string) {
    const res = await fetch(`${API_BASE}/change-password`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ current_password, new_password }),
    });
    return handleResponse(res);
  },

  // User Management
  async getUsers(): Promise<User[]> {
    const res = await fetch(`${API_BASE}/users`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createUser(userData: any) {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async approveUser(id: number) {
    const res = await fetch(`${API_BASE}/users/${id}/approve`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async rejectUser(id: number) {
    const res = await fetch(`${API_BASE}/users/${id}/reject`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  async deleteUser(id: number) {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Department Management
  async createDepartment(name: string) {
    const res = await fetch(`${API_BASE}/departments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },

  async deleteDepartment(id: number) {
    const res = await fetch(`${API_BASE}/departments/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },

  // Category Management
  async getCategories(): Promise<{ id: number; name: string }[]> {
    const res = await fetch(`${API_BASE}/categories`, { headers: getHeaders() });
    return handleResponse(res);
  },

  async createCategory(name: string) {
    const res = await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name }),
    });
    return handleResponse(res);
  },

  async deleteCategory(id: number) {
    const res = await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    return handleResponse(res);
  },
};
