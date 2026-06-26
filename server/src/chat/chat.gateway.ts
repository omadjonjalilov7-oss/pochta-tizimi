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
}
