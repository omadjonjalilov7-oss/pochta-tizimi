export type Importance = 'normal' | 'important' | 'urgent';
export type MessageFolder = 'inbox' | 'sent' | 'trash' | 'archive';

export interface Department {
  id: string;
  name: string;
  code?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Position {
  id: string;
  name: string;
  rank: number;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  login: string;
  fullName: string;
  phone?: string | null;
  email?: string | null;
  avatarPath?: string | null;
  departmentId?: string | null;
  positionId?: string | null;
  managerId?: string | null;
  canSendExternal: boolean;
  canSignExternal: boolean;
  isActive: boolean;
  isAdmin: boolean;
  notifyEdo?: boolean;
  hasApprovalPin?: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  department?: Department | null;
  position?: Position | null;
}

export interface AttachmentSummary {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType?: string;
}

export interface Message {
  id: string;
  fromUserId: string | null;
  subject: string;
  body: string;
  importance: Importance;
  isExternal: boolean;
  sentAt: string;
  recalledAt?: string | null;
  externalFromEmail?: string | null;
  externalFromName?: string | null;
  externalToEmails?: string[] | null;
  externalMessageId?: string | null;
  externalImapUid?: number | null;
  fromUser?: (Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'> & {
    position?: Pick<Position, 'name' | 'rank'> | null;
    department?: Pick<Department, 'name'> | null;
  }) | null;
  attachments?: AttachmentSummary[];
  recipients?: Array<{
    user: Pick<User, 'id' | 'fullName' | 'login'>;
  }>;
  _count?: { recipients: number };
}

export interface MessageRecipientItem {
  id: string;
  messageId: string;
  folder: MessageFolder;
  isRead: boolean;
  readAt?: string | null;
  isStarred: boolean;
  message: Message;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// ── Hujjat aylanmasi (EDO) ────────────────────────────────────────────

export type DocumentType = 'internal' | 'incoming' | 'outgoing';
export type DocumentStatus =
  | 'draft'
  | 'in_review'
  | 'in_progress'
  | 'done'
  | 'rejected'
  | 'overdue';
export type ParticipantRole = 'creator' | 'approver' | 'executor' | 'observer';
export type ParticipantStatus = 'pending' | 'approved' | 'rejected' | 'done';

type ShortUser = Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'> & {
  position?: Pick<Position, 'name' | 'rank'> | null;
  department?: Pick<Department, 'name'> | null;
};

export interface EdoParticipant {
  id: string;
  documentId: string;
  userId: string;
  role: ParticipantRole;
  order: number;
  status: ParticipantStatus;
  deadline?: string | null;
  actedAt?: string | null;
  rejectReason?: string | null;
  user: ShortUser;
}

export interface EdoComment {
  id: string;
  documentId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
}

export interface EdoAuditEntry {
  id: string;
  documentId: string;
  actorId: string | null;
  action: string;
  payload?: any;
  createdAt: string;
  actor?: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'> | null;
}

export type EdoTaskStatus = 'pending' | 'in_progress' | 'done' | 'overdue';

export interface EdoResolutionTarget {
  id: string;
  resolutionId: string;
  userId: string;
  deadline?: string | null;
  status: EdoTaskStatus;
  doneAt?: string | null;
  doneNote?: string | null;
  user: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
}

export interface EdoResolution {
  id: string;
  documentId: string;
  authorId: string;
  text: string;
  createdAt: string;
  author: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
  targets: EdoResolutionTarget[];
}

export interface EdoSignature {
  id: string;
  documentId: string;
  signerId: string;
  certSerial: string;
  certSubject: string;
  certIssuer?: string | null;
  certValidFrom?: string | null;
  certValidTo?: string | null;
  signatureHash: string;
  signedAt: string;
  verified: boolean;
  verifiedAt?: string | null;
  verifyError?: string | null;
  signer: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
}

export interface EdoTemplate {
  id: string;
  name: string;
  category: string;
  bodyTemplate: string;
  isShared: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
  placeholders: string[];
}

export interface EdoAttachment {
  id: string;
  documentId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'>;
}

export interface EdoDocument {
  id: string;
  number: string;
  numberCategory: string;
  year: number;
  type: DocumentType;
  subject: string;
  shortInfo?: string | null;
  body: string;
  status: DocumentStatus;
  isExternal: boolean;
  externalRecipient?: string | null;
  createdById: string;
  currentHolderId?: string | null;
  numberDeptId?: string | null;
  targetDeptId?: string | null;
  deadline?: string | null;
  signatureChainPosition: number;
  isSigned: boolean;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  createdBy: ShortUser;
  currentHolder?: ShortUser | null;
  numberDept?: { id: string; name: string; code?: string | null } | null;
  targetDept?: { id: string; name: string; code?: string | null } | null;
  participants: EdoParticipant[];
  comments: EdoComment[];
  audit: EdoAuditEntry[];
  attachments?: EdoAttachment[];
  resolutions?: EdoResolution[];
  signatures?: EdoSignature[];
}
