import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { MessagesModule } from '../messages/messages.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MessagesModule],
  providers: [ChatService, ChatGateway],
  controllers: [ChatController],
  exports: [ChatService],
})
export class ChatModule {}
