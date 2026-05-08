export type Importance = 'normal' | 'important' | 'urgent';
export type MessageFolder = 'inbox' | 'sent' | 'trash' | 'archive';

export interface Department {
  id: string;
  name: string;
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
  canSendExternal: boolean;
  isActive: boolean;
  isAdmin: boolean;
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
  fromUserId: string;
  subject: string;
  body: string;
  importance: Importance;
  isExternal: boolean;
  sentAt: string;
  fromUser?: Pick<User, 'id' | 'fullName' | 'login' | 'avatarPath'> & {
    position?: Pick<Position, 'name' | 'rank'> | null;
    department?: Pick<Department, 'name'> | null;
  };
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
