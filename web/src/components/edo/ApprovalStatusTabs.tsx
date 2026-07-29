import { CheckCircle2, Clock, XCircle, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';

export interface ApprovalStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface ApprovalStatusTabsProps {
  stats: ApprovalStats;
  activeStatus: 'approved' | 'pending' | 'rejected' | 'partially_approved';
  onStatusChange: (status: 'approved' | 'pending' | 'rejected' | 'partially_approved') => void;
  isLoading?: boolean;
}

export function ApprovalStatusTabs({
  stats,
  activeStatus,
  onStatusChange,
  isLoading = false,
}: ApprovalStatusTabsProps) {
  const { t } = useTranslation();
  const tabs = [
    {
      id: 'pending' as const,
      label: t('edo.approval_tabs.pending'),
      icon: Clock,
      count: stats.pending,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
      borderColor: 'border-yellow-200',
    },
    {
      id: 'partially_approved' as const,
      label: t('edo.approval_tabs.partially'),
      icon: BarChart3,
      count: stats.approved > 0 && stats.pending > 0 ? stats.approved : 0,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      id: 'approved' as const,
      label: t('edo.approval_tabs.approved'),
      icon: CheckCircle2,
      count: stats.approved,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      id: 'rejected' as const,
      label: t('edo.approval_tabs.rejected'),
      icon: XCircle,
      count: stats.rejected,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeStatus === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onStatusChange(tab.id)}
            disabled={isLoading}
            className={cn(
              'p-4 rounded-lg border-2 transition-all duration-200 text-left',
              isActive
                ? `${tab.bgColor} ${tab.borderColor} border-2 shadow-md`
                : 'bg-white border-slate-200 hover:border-slate-300',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            <div className="flex items-start justify-between mb-2">
              <Icon className={cn('w-5 h-5', tab.color)} />
              <span
                className={cn(
                  'text-xs font-bold px-2 py-1 rounded',
                  isActive ? 'bg-white' : 'bg-slate-100',
                )}
              >
                {tab.count}
              </span>
            </div>
            <div className={cn('text-sm font-semibold', isActive ? tab.color : 'text-slate-700')}>
              {tab.label}
            </div>
          </button>
        );
      })}
    </div>
  );
}
