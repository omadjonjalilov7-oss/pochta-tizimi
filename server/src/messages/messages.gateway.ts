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
