import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Loader, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { api } from '../../lib/api';
import type { EdoDocument } from '../../lib/types';
import { ApprovalStatusTabs, type ApprovalStats } from '../../components/edo/ApprovalStatusTabs';
import { QrScannerModal } from '../../components/edo/QrScannerModal';
import { Avatar } from '../../components/Avatar';
import { cn, formatDate } from '../../lib/utils';

export type ApprovalStatusFilter = 'approved' | 'pending' | 'rejected' | 'partially_approved';

export function EdoApprovalPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeStatus, setActiveStatus] = useState<ApprovalStatusFilter>('pending');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch approval stats (all statuses)
  const { data: allStats = { total: 0, approved: 0, rejected: 0, pending: 0 } } = useQuery({
    queryKey: ['approval-stats-all'],
    queryFn: async () => {
      try {
        const res = await api.get<ApprovalStats>('/documents/approval-status');
        return res.data;
      } catch {
        return { total: 0, approved: 0, rejected: 0, pending: 0 };
      }
    },
  });

  // Fetch filtered documents
  const {
    data: docData,
    isLoading: docsLoading,
    error: docsError,
  } = useQuery({
    queryKey: ['approval-status-filter', activeStatus],
    queryFn: async () => {
      const res = await api.get<{
        data: EdoDocument[];
        total: number;
      }>('/documents/approval-status/filter', {
        params: { status: activeStatus, limit: 50, offset: 0 },
      });
      return res.data;
    },
  });

  // Approve with QR
  const approveWithQr = useMutation({
    mutationFn: async (vars: { documentId: string; qrCode: string; participantId: string }) =>
      api.patch(`/documents/${vars.documentId}/approve-with-qr`, {
        qrCode: vars.qrCode,
        participantId: vars.participantId,
      }),
    onSuccess: () => {
      setSuccessMessage('Hujjat muvaffaqiyatli tasdiqlandi! ✓');
      setShowQrScanner(false);
      setSelectedDocId(null);
      queryClient.invalidateQueries({ queryKey: ['approval-status-filter'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats-all'] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  // Reject with QR
  const rejectWithQr = useMutation({
    mutationFn: async (vars: {
      documentId: string;
      qrCode: string;
      participantId: string;
      reason: string;
    }) =>
      api.patch(`/documents/${vars.documentId}/reject-with-qr`, {
        qrCode: vars.qrCode,
        participantId: vars.participantId,
        reason: vars.reason,
      }),
    onSuccess: () => {
      setSuccessMessage('Hujjat rad etildi!');
      setShowQrScanner(false);
      setSelectedDocId(null);
      queryClient.invalidateQueries({ queryKey: ['approval-status-filter'] });
      queryClient.invalidateQueries({ queryKey: ['approval-stats-all'] });
      setTimeout(() => setSuccessMessage(null), 3000);
    },
  });

  const docs = docData?.data || [];

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Hujjat Tasdiqlash</h1>
          <p className="text-slate-600">
            Sizga yuborilgan hujjatlarni qabul qiling yoki rad eting
          </p>
        </div>

        {/* Success Message */}
        {successMessage && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 size={20} className="text-green-600" />
            <p className="text-green-700 font-medium">{successMessage}</p>
          </div>
        )}

        {/* Approval Status Tabs */}
        <ApprovalStatusTabs
          stats={allStats}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
          isLoading={docsLoading}
        />

        {/* Error State */}
        {docsError && (
          <div className="p-6 bg-red-50 border border-red-200 rounded-lg flex items-start gap-4 mb-6">
            <AlertCircle size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-900 mb-1">Xato yuz berdi</h3>
              <p className="text-red-700 text-sm">
                Hujjatlarni yuklashda muammo. Iltimos qayta urinib ko'ring.
              </p>
            </div>
          </div>
        )}

        {/* Loading State */}
        {docsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader size={32} className="animate-spin text-brand-600" />
          </div>
        )}

        {/* Empty State */}
        {!docsLoading && docs.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              {activeStatus === 'pending' && 'Tasdiqlanishi kerak bo\'lgan hujjat yo\'q'}
              {activeStatus === 'approved' && 'Tasdiqlangan hujjat yo\'q'}
              {activeStatus === 'rejected' && 'Rad etilgan hujjat yo\'q'}
              {activeStatus === 'partially_approved' && 'Qisman tasdiqlangan hujjat yo\'q'}
            </h3>
            <p className="text-slate-600">
              {activeStatus === 'pending'
                ? 'Siz uchun hozir tasdiqlanishi kerak bo\'lgan hujjat yo\'q'
                : 'Bu kategoriyada hujjat topilmadi'}
            </p>
          </div>
        )}

        {/* Documents List */}
        <div className="space-y-4">
          {docs.map((doc) => (
            <DocumentApprovalCard
              key={doc.id}
              doc={doc}
              onApprove={() => {
                setSelectedDocId(doc.id);
                setShowQrScanner(true);
              }}
              isLoading={
                approveWithQr.isPending || rejectWithQr.isPending || selectedDocId === doc.id
              }
            />
          ))}
        </div>
      </div>

      {/* QR Scanner Modal */}
      <QrScannerModal
        isOpen={showQrScanner}
        onClose={() => setShowQrScanner(false)}
        onScan={(qrCode) => {
          if (selectedDocId) {
            approveWithQr.mutate({
              documentId: selectedDocId,
              qrCode,
              participantId: '', // This would come from the document data
            });
          }
        }}
        isLoading={approveWithQr.isPending}
      />
    </div>
  );
}

interface DocumentApprovalCardProps {
  doc: EdoDocument;
  onApprove: () => void;
  isLoading?: boolean;
}

function DocumentApprovalCard({ doc, onApprove, isLoading = false }: DocumentApprovalCardProps) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        {/* Left: Document Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <h3 className="text-lg font-semibold text-slate-900">{doc.subject}</h3>
            <span className="px-3 py-1 bg-brand-100 text-brand-700 text-xs font-semibold rounded-full">
              {doc.number}
            </span>
          </div>

          <p className="text-sm text-slate-600 mb-4 line-clamp-2">{doc.shortInfo}</p>

          {/* Creator Info */}
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Avatar
              src={doc.createdBy.avatarPath}
              fallback={doc.createdBy.fullName[0]}
              size="sm"
            />
            <span>
              <strong>{doc.createdBy.fullName}</strong> tomonidan yuborildi
            </span>
            <span className="text-slate-400">•</span>
            <span>{formatDate(doc.createdAt)}</span>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onApprove}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
              isLoading
                ? 'bg-slate-200 text-slate-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700 text-white',
            )}
          >
            {isLoading && <Loader size={16} className="animate-spin" />}
            Tasdiqlash
          </button>
          <button
            disabled={isLoading}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2',
              isLoading ? 'bg-slate-200 text-slate-600 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-200',
            )}
          >
            {isLoading && <Loader size={16} className="animate-spin" />}
            Rad etish
          </button>
        </div>
      </div>
    </div>
  );
}
