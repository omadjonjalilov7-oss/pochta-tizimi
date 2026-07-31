import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ServeStaticModule } from '@nestjs/serve-static';
import { APP_GUARD } from '@nestjs/core';
import { join, dirname } from 'path';

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
import { StatsModule } from './stats/stats.module';
import { SettingsModule } from './settings/settings.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { JournalsModule } from './journals/journals.module';
import { TranslateModule } from './translate/translate.module';

// Avatar papkasi. AVATARS_DIR ko'rsatilmagan bo'lsa — ishlab turgan
// ATTACHMENTS_DIR yonidagi "avatars" papkasidan foydalanamiz (Linux/Windows
// da bir xil ishlaydi). Bu yozuvchi (UsersService) bilan bir xil bo'lishi shart.
export function resolveAvatarsDir(): string {
  if (process.env.AVATARS_DIR) return process.env.AVATARS_DIR;
  const att = process.env.ATTACHMENTS_DIR;
  if (att) return join(dirname(att), 'avatars');
  return join(process.cwd(), 'storage', 'avatars');
}

const avatarsDir = resolveAvatarsDir();

const staticImports = [
  // Avatar fayllari — /api/avatars ostida beriladi. Shunda ular API bilan bir
  // xil proksidan o'tadi (nginx faqat /api ni backendga yo'naltiradi), demak
  // prodda alohida nginx sozlamasi shart emas.
  ServeStaticModule.forRoot({
    rootPath: avatarsDir,
    serveRoot: '/api/avatars',
    serveStaticOptions: { fallthrough: true, index: false },
  }),
  ...(process.env.SERVE_STATIC === 'true'
    ? [
        ServeStaticModule.forRoot({
          rootPath: process.env.STATIC_DIR || join(__dirname, '..', '..', 'web', 'dist'),
          exclude: ['/api/{*test}', '/socket.io/{*test}'],
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
    StatsModule,
    SettingsModule,
    OrganizationsModule,
    JournalsModule,
    TranslateModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
