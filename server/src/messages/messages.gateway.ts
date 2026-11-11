import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/realtime',
})
export class MessagesGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(MessagesGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(@ConnectedSocket() client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.headers.authorization?.replace('Bearer ', '') as string);

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwt.verifyAsync(token);
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        client.disconnect(true);
        return;
      }

      client.data.userId = user.id;
      client.join(`user:${user.id}`);
      this.logger.log(`Foydalanuvchi ulandi: ${user.login}`);
    } catch (e) {
      this.logger.warn(`Auth xato: ${e.message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: Socket) {
    if (client.data.userId) {
      this.logger.log(`Foydalanuvchi uzildi: ${client.data.userId}`);
    }
  }

  // Chatda "yozmoqda..." holatini suhbatdoshga real-vaqt uzatamiz.
  @SubscribeMessage('chat_typing')
  handleChatTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { toUserId?: string; typing?: boolean },
  ) {
    const fromUserId = client.data.userId as string | undefined;
    if (!fromUserId || !data?.toUserId) return;
    this.server.to(`user:${data.toUserId}`).emit('chat_typing', {
      type: 'chat_typing',
      payload: { fromUserId, typing: !!data.typing },
    });
  }

  // ─── Qo'ng'iroq (WebRTC) signalizatsiyasi ────────────────────────────────
  // Barcha qo'ng'iroq eventlari shu yerda faqat UZATILADI (relay) — ovoz/video
  // oqimi serverdan o'tmaydi, u to'g'ridan-to'g'ri ikki brauzer orasida yuriladi.

  // Umumiy uzatuvchi: suhbatdoshga (toUserId) eventni yuboradi, fromUserId qo'shadi.
  private relayCall(client: Socket, event: string, data: any) {
    const fromUserId = client.data.userId as string | undefined;
    if (!fromUserId || !data?.toUserId) return;
    this.server.to(`user:${data.toUserId}`).emit(event, {
      ...data,
      fromUserId,
    });
  }

  // Qo'ng'iroq taklifi (jiringlash). Suhbatdosh online bo'lmasa — chaqiruvchiga
  // "band emas/ulanmagan" signalini qaytaramiz.
  @SubscribeMessage('call:invite')
  async onCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { toUserId?: string; callId?: string; video?: boolean; fromName?: string },
  ) {
    const fromUserId = client.data.userId as string | undefined;
    if (!fromUserId || !data?.toUserId || !data?.callId) return;
    const sockets = await this.server
      .in(`user:${data.toUserId}`)
      .fetchSockets()
      .catch(() => []);
    if (!sockets || sockets.length === 0) {
      client.emit('call:peer_unavailable', { callId: data.callId });
      return;
    }
    this.server.to(`user:${data.toUserId}`).emit('call:incoming', {
      fromUserId,
      callId: data.callId,
      video: !!data.video,
      fromName: data.fromName || '',
    });
  }

  @SubscribeMessage('call:offer')
  onCallOffer(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:offer', d);
  }

  @SubscribeMessage('call:answer')
  onCallAnswer(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:answer', d);
  }

  @SubscribeMessage('call:ice')
  onCallIce(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:ice', d);
  }

  @SubscribeMessage('call:accept')
  onCallAccept(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:accept', d);
  }

  @SubscribeMessage('call:reject')
  onCallReject(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:reject', d);
  }

  @SubscribeMessage('call:hangup')
  onCallHangup(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:hangup', d);
  }

  @SubscribeMessage('call:busy')
  onCallBusy(@ConnectedSocket() c: Socket, @MessageBody() d: any) {
    this.relayCall(c, 'call:busy', d);
  }

  // Foydalanuvchi hozir ulangan (online)mi — push yubormaslik/ikki marta
  // bo'lmasligi uchun (ilova ochiq bo'lsa socket banner chiqadi).
  async isOnline(userId: string): Promise<boolean> {
    try {
      const sockets = await this.server.in(`user:${userId}`).fetchSockets();
      return sockets.length > 0;
    } catch {
      return false;
    }
  }

  notifyNewMessage(recipientIds: string[], message: any) {
    for (const userId of recipientIds) {
      this.server.to(`user:${userId}`).emit('new_message', {
        type: 'new_message',
        payload: message,
      });
    }
  }

  notifyMessageRecalled(recipientIds: string[], messageId: string, subject: string) {
    for (const userId of recipientIds) {
      this.server.to(`user:${userId}`).emit('message_recalled', {
        type: 'message_recalled',
        payload: { messageId, subject },
      });
    }
  }
}
