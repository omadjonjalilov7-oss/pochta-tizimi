import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { EdoDocument } from '../lib/types';

export interface ApprovalStats {
  total: number;
  approved: number;
  rejected: number;
  pending: number;
}

export interface DocumentWithStats extends EdoDocument {
  approvalStats: ApprovalStats;
}

export type ApprovalStatusFilter = 'approved' | 'pending' | 'rejected' | 'partially_approved';

export function useApprovalStatus(
  status: ApprovalStatusFilter = 'pending',
  limit: number = 50,
  offset: number = 0,
) {
  return useQuery({
    queryKey: ['approval-status-filter', status, limit, offset],
    queryFn: async () => {
      const res = await api.get<{
        data: DocumentWithStats[];
        total: number;
      }>('/documents/approval-status/filter', {
        params: { status, limit, offset },
      });
      return res.data;
    },
  });
}

export function useDocumentApprovalStatus(documentId: string | undefined) {
  return useQuery({
    queryKey: ['document-approval-status', documentId],
    queryFn: async () => {
      if (!documentId) return null;
      const res = await api.get<ApprovalStats>(`/documents/${documentId}/approval-status`);
      return res.data;
    },
    enabled: !!documentId,
  });
}
