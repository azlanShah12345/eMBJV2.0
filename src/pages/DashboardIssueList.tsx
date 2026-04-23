import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import DashboardIssueExplorer from '../components/DashboardIssueExplorer';
import { DashboardIssueFilters, User } from '../types';

interface DashboardIssueListProps {
  user: User;
}

export default function DashboardIssueList({ user }: DashboardIssueListProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters: DashboardIssueFilters = {
    department_id: searchParams.get('department_id') || undefined,
    year: searchParams.get('year') || undefined,
    bil_mesyuarat: searchParams.get('bil_mesyuarat') || undefined,
    category: searchParams.get('category') || undefined,
    keyword: searchParams.get('keyword') || undefined,
    status: (searchParams.get('status') as DashboardIssueFilters['status']) || undefined,
    issue_age_bucket: (searchParams.get('issue_age_bucket') as DashboardIssueFilters['issue_age_bucket']) || undefined,
  };

  const handleFiltersChange = (filters: DashboardIssueFilters) => {
    const nextParams = new URLSearchParams();
    if (user.role === 'ADMIN' && filters.department_id) nextParams.set('department_id', filters.department_id);
    if (filters.year) nextParams.set('year', filters.year);
    if (filters.bil_mesyuarat) nextParams.set('bil_mesyuarat', filters.bil_mesyuarat);
    if (filters.category) nextParams.set('category', filters.category);
    if (filters.keyword) nextParams.set('keyword', filters.keyword);
    if (filters.status) nextParams.set('status', filters.status);
    if (filters.issue_age_bucket) nextParams.set('issue_age_bucket', filters.issue_age_bucket);
    setSearchParams(nextParams, { replace: true });
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-emerald-600"
        >
          <ArrowLeft size={16} />
          Kembali ke papan pemuka
        </Link>
      </div>
      <DashboardIssueExplorer
        user={user}
        initialFilters={initialFilters}
        onFiltersChange={handleFiltersChange}
      />
    </div>
  );
}
