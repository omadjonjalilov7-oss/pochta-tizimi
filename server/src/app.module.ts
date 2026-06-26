import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join } from 'path';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DepartmentsModule } from './departments/departments.module';
import { PositionsModule } from './positions/positions.module';
import { MessagesModule } from './messages/messages.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ExternalMailModule } from './external-mail/external-mail.module';
import { DocumentsModule } from './documents/documents.module';
import { TemplatesModule } from './templates/templates.module';
import { ChatModule } from './chat/chat.module';
import { ContactGroupsModule } from './contact-groups/contact-groups.module';

const avatarsDir = process.env.AVATARS_DIR || 'C:\\D\\pochta\\storage\\avatars';

const staticImports = [
  // avatar fayllari hamma vaqt ochiq (LAN ichida)
  ServeStaticModule.forRoot({
    rootPath: avatarsDir,
    serveRoot: '/avatars',
    serveStaticOptions: { fallthrough: true, index: false },
  }),
  ...(process.env.SERVE_STATIC === 'true'
    ? [
        ServeStaticModule.forRoot({
          rootPath: process.env.STATIC_DIR || join(__dirname, '..', '..', 'web', 'dist'),
          exclude: ['/api/{*test}', '/socket.io/{*test}', '/avatars/{*test}'],
        }),
      ]
    : []),
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { ttl: 60_000, limit: 100 }, // har bir IP minutiga 100 so'rov
    ]),
    ...staticImports,
    PrismaModule,
    AuthModule,
    UsersModule,
    DepartmentsModule,
    PositionsModule,
    MessagesModule,
    AttachmentsModule,
    ExternalMailModule,
    DocumentsModule,
    TemplatesModule,
    ChatModule,
    ContactGroupsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
