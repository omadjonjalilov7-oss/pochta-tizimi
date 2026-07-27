import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatGroupService } from './chat-group.service';
import { ChatGroupController } from './chat-group.controller';
import { MessagesModule } from '../messages/messages.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, MessagesModule],
  providers: [ChatService, ChatGateway, ChatGroupService],
  controllers: [ChatController, ChatGroupController],
  exports: [ChatService],
})
export class ChatModule {}
