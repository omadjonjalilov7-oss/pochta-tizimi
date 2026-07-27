import { Injectable } from '@nestjs/common';
import { MessagesGateway } from '../messages/messages.gateway';

/**
 * Chat gateway — mavjud MessagesGateway'ning WebSocket serveridan foydalanadi.
 * Alohida namespace ochmasdan, `/realtime` namespace'iga chat eventlarini qo'shamiz.
 */
@Injectable()
export class ChatGateway {
  constructor(private readonly ws: MessagesGateway) {}

  /** Yangi chat xabari — qabul qiluvchiga real-vaqt yuborish */
  emitChatMessage(recipientId: string, message: any) {
    this.ws.server.to(`user:${recipientId}`).emit('chat_message', {
      type: 'chat_message',
      payload: message,
    });
  }

  /** O'qildi bildirishnomai — yuboruvchiga checkmark o'zgartirish uchun */
  emitChatRead(senderId: string, readByUserId: string) {
    this.ws.server.to(`user:${senderId}`).emit('chat_read', {
      type: 'chat_read',
      payload: { readByUserId },
    });
  }

  /** Xabar tahrirlandi — suhbatdoshga real-vaqt yangilash */
  emitChatEdited(recipientId: string, message: any) {
    this.ws.server.to(`user:${recipientId}`).emit('chat_message_edited', {
      type: 'chat_message_edited',
      payload: message,
    });
  }

  /** Xabar o'chirildi (hamma uchun) — suhbatdoshga real-vaqt yangilash */
  emitChatDeleted(recipientId: string, messageId: string, peerId: string) {
    this.ws.server.to(`user:${recipientId}`).emit('chat_message_deleted', {
      type: 'chat_message_deleted',
      payload: { messageId, peerId },
    });
  }

  // ─── Guruh chat eventlari ────────────────────────────────────────────────
  private emitToMembers(memberIds: string[], event: string, payload: any) {
    for (const uid of memberIds) {
      this.ws.server.to(`user:${uid}`).emit(event, { type: event, payload });
    }
  }

  /** Yangi guruh yaratildi — a'zolar ro'yxatini yangilash */
  emitGroupCreated(memberIds: string[], groupId: string) {
    this.emitToMembers(memberIds, 'chat_group_created', { groupId });
  }

  /** Guruhga yangi xabar */
  emitGroupMessage(memberIds: string[], message: any) {
    this.emitToMembers(memberIds, 'chat_group_message', message);
  }

  /** Guruh xabari tahrirlandi */
  emitGroupEdited(memberIds: string[], message: any) {
    this.emitToMembers(memberIds, 'chat_group_message_edited', message);
  }

  /** Guruh xabari o'chirildi */
  emitGroupDeleted(memberIds: string[], groupId: string, messageId: string) {
    this.emitToMembers(memberIds, 'chat_group_message_deleted', {
      groupId,
      messageId,
    });
  }

  /** Guruh a'zolari yoki nomi o'zgardi */
  emitGroupUpdated(memberIds: string[], groupId: string) {
    this.emitToMembers(memberIds, 'chat_group_updated', { groupId });
  }
}
