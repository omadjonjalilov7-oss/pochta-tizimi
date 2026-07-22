import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ImapFlow, FetchMessageObject } from 'imapflow';
import { simpleParser } from 'mailparser';
import { MessageFolder, RecipientKind } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagesGateway } from '../messages/messages.gateway';
import { decryptSecret } from './crypto.util';

/**
 * IMAP polling — har 15 sekundda ulangan foydalanuvchilarning
 * Billur (asaka-motors.uz) inbox'ini tekshiradi va yangi xabarlarni ichkariga import qiladi.
 *
 * Xususiyatlari:
 * - Har bir foydalanuvchi alohida ishlovchi tsiklda (bir foydalanuvchidagi xato boshqalarni to'xtatmaydi)
 * - Bir vaqtning o'zida bitta poll bir foydalanuvchi uchun (mutex)
 * - \Seen flag IMAP'dan Pochta'ga sinxronlanadi (yangi xabar yuklab olinganda)
 * - Dedup `externalMessageId` orqali (RFC822 Message-ID)
 */
@Injectable()
export class ImapPollService implements OnModuleInit {
  private readonly logger = new Logger(ImapPollService.name);
  private readonly inFlight = new Set<string>(); // userId mutex
  private intervalHandle: NodeJS.Timeout | null = null;
  private shuttingDown = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: MessagesGateway,
  ) {}

  onModuleInit() {
    const seconds = Number(process.env.EXTERNAL_MAIL_POLL_SECONDS || 15);
    const ms = Math.max(5, seconds) * 1000;
    this.logger.log(`IMAP polling har ${ms / 1000} sekundda boshlanadi`);
    // Birinchi tick — 10 sekunddan keyin (server to'liq ko'tarilishini kutamiz)
    setTimeout(() => this.tick(), 10_000);
    this.intervalHandle = setInterval(() => this.tick(), ms);
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.intervalHandle) clearInterval(this.intervalHandle);
  }

  private async tick() {
    if (this.shuttingDown) return;
    try {
      const users = await this.prisma.user.findMany({
        where: { externalMailEnabled: true, isActive: true },
        select: { id: true },
      });
      // Hammasini parallel ishlatamiz — har biri o'z mutex'i bilan himoyalangan
      await Promise.allSettled(users.map((u) => this.pollUserSafely(u.id)));
    } catch (err) {
      this.logger.error('Tick xato', err as any);
    }
  }

  /**
   * Foydalanuvchi pochtaga kirganda — darhol bitta poll ishga tushiriladi
   * (15 sekundlik tsiklni kutmasdan). Mutex bilan himoyalangan.
   */
  async syncNow(userId: string): Promise<{ ok: boolean }> {
    await this.pollUserSafely(userId);
    return { ok: true };
  }

  private async pollUserSafely(userId: string) {
    if (this.inFlight.has(userId)) return; // o'tgan tsikl hali tugamagan
    this.inFlight.add(userId);
    try {
      await this.pollUser(userId);
    } catch (err: any) {
      this.logger.warn(`Poll xato (user ${userId}): ${err?.message || err}`);
    } finally {
      this.inFlight.delete(userId);
    }
  }

  private async pollUser(userId: string) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        externalMailLogin: true,
        externalMailPasswordEnc: true,
        externalMailEnabled: true,
        externalMailLastUid: true,
      },
    });
    if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) return;

    let password: string;
    try {
      password = decryptSecret(u.externalMailPasswordEnc);
    } catch {
      this.logger.error(`Parolni dekriptlab bo'lmadi (user ${userId})`);
      return;
    }

    const client = new ImapFlow({
      host: process.env.EXTERNAL_MAIL_IMAP_HOST || 'mail.asaka-motors.uz',
      port: Number(process.env.EXTERNAL_MAIL_IMAP_PORT || 993),
      secure: true,
      auth: { user: u.externalMailLogin, pass: password },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      // INBOX va Sent folder'larni sinx qil
      await Promise.all([
        this.pollFolder(client, userId, 'INBOX', MessageFolder.inbox),
        this.pollFolder(client, userId, '[Gmail]/Sent Mail', MessageFolder.sent).catch(() =>
          // Gmail standart "Sent" papkasi yo'q bo'lsa, fallback
          this.pollFolder(client, userId, 'Sent', MessageFolder.sent).catch(() => {})
        ),
      ]);
      return;
    } finally {
      await client.close();
    }
  }

  private async pollFolder(client: ImapFlow, userId: string, folderName: string, targetFolder: MessageFolder) {
    const lock = await client.getMailboxLock(folderName);
    try {
      const u = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          externalMailLogin: true,
          externalMailPasswordEnc: true,
          externalMailEnabled: true,
          externalMailLastUid: true,
        },
      });
      if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) return;

      const lastUid = targetFolder === MessageFolder.inbox ? (u.externalMailLastUid || 0) : 0;
        const mbox = client.mailbox as any;
        const totalExists = mbox?.exists || 0;
        const uidNext = mbox?.uidNext;
        const INITIAL_SYNC = Number(process.env.EXTERNAL_MAIL_INITIAL_SYNC || 200);

        // Yangi xabarlarni qidiramiz (UID > lastUid)
        // Birinchi sinxronizatsiyada — oxirgi INITIAL_SYNC (default: 200) ta xabarni olamiz
        let searchRange: string;
        if (lastUid > 0 && targetFolder === MessageFolder.inbox) {
          // INBOX uchun: oxirgi synced UID'dan keyin
          searchRange = `${lastUid + 1}:*`;
        } else {
          // Sent folder yoki birinchi sync: oxirgi N ta xabar
          const syncCount = targetFolder === MessageFolder.sent ? 100 : INITIAL_SYNC;
          if (totalExists === 0) {
            await this.prisma.user.update({
              where: { id: userId },
              data: { externalMailLastSyncAt: new Date(), externalMailLastUid: targetFolder === MessageFolder.inbox ? 0 : u.externalMailLastUid },
            });
            return;
          }
          const startSeq = Math.max(1, totalExists - (syncCount - 1));
          searchRange = `${startSeq}:*`;
          if (targetFolder === MessageFolder.inbox && lastUid === 0) {
            this.logger.log(
              `User ${userId} birinchi sinxronizatsiya: ${targetFolder} jami ${totalExists} ta xabar, oxirgi ${Math.min(totalExists, syncCount)} tasini olamiz`,
            );
          }
        }

        // MUHIM: bu yerda `source` (xabar to'liq mazmuni + biriktirmalar) YUKLANMAYDI.
        // Faqat envelope + flags olinadi (kichik). To'liq mazmun pastda faqat YANGI
        // xabar uchun alohida yuklab olinadi. Aks holda har poll'da 100 ta Sent xabar
        // qayta yuklanib, kuniga gigabaytlab trafik ketardi.
        const fetched: FetchMessageObject[] = [];
        for await (const msg of client.fetch(
          searchRange,
          { uid: true, envelope: true, flags: true },
          { uid: lastUid > 0 },
        )) {
          fetched.push(msg);
        }

        // Diagnostika — har bir poll tsikli uchun
        if (lastUid > 0) {
          this.logger.debug(
            `User ${userId} poll: INBOX exists=${totalExists}, UIDNEXT=${uidNext}, lastUid=${lastUid}, fetched=${fetched.length}`,
          );
        }
        // UID bo'yicha saralab, eng yangini oxiriga qo'yamiz
        fetched.sort((a, b) => (a.uid || 0) - (b.uid || 0));

        let importedCount = 0;
        let statusSyncCount = 0;
        let maxUid = lastUid;

        for (const m of fetched) {
          const uid = m.uid || 0;
          if (uid <= lastUid) continue;
          if (uid > maxUid) maxUid = uid;

          const messageIdHeader = m.envelope?.messageId || null;
          const seen = (m.flags as Set<string> | undefined)?.has('\\Seen') || false;

          // Dedup tekshiruvi
          let existing: { id: string; isRead: boolean } | null = null;

          // INBOX uchun: Message-ID orqali qidirish
          if (targetFolder === MessageFolder.inbox && messageIdHeader) {
            const found = await this.prisma.messageRecipient.findFirst({
              where: {
                userId,
                message: { externalMessageId: messageIdHeader, isExternal: true }
              },
              select: { messageId: true, isRead: true },
            });
            if (found) existing = { id: found.messageId, isRead: found.isRead };
          }

          // Sent folder uchun: O'z mesajlarni topish uchun subject + date bo'yicha
          if (!existing && targetFolder === MessageFolder.sent && messageIdHeader) {
            const subject = m.envelope?.subject || '';
            const sentDate = m.envelope?.date || new Date();
            const dateRange = { gte: new Date(sentDate.getTime() - 5 * 60000), lte: new Date(sentDate.getTime() + 5 * 60000) };

            const found = await this.prisma.messageRecipient.findFirst({
              where: {
                userId,
                message: {
                  AND: [
                    { subject: { contains: subject.slice(0, 50) } },
                    { sentAt: { gte: dateRange.gte, lte: dateRange.lte } },
                    { NOT: { fromUserId: null } } // Ichki yuborilgan xabar
                  ]
                }
              },
              select: { messageId: true, isRead: true },
            });
            if (found) existing = { id: found.messageId, isRead: found.isRead };
          }

          if (!existing) {
            // Yangi xabar — to'liq mazmunini (source) FAQAT shu payt yuklab olamiz
            const full = await client.fetchOne(String(uid), { source: true }, { uid: true });
            const source = full && (full as any).source;
            if (!source) continue;
            const parsed = await simpleParser(source as Buffer);
            const fromEmail =
              parsed.from?.value?.[0]?.address ||
              m.envelope?.from?.[0]?.address ||
              'unknown@external';
            const fromName =
              parsed.from?.value?.[0]?.name ||
              m.envelope?.from?.[0]?.name ||
              fromEmail.split('@')[0];
            const subject = parsed.subject || m.envelope?.subject || '(mavzu yo\'q)';
            const body =
              parsed.html ||
              parsed.textAsHtml ||
              (parsed.text ? `<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(parsed.text)}</pre>` : '<i>(bo\'sh xabar)</i>');
            const sentAt = parsed.date || m.envelope?.date || new Date();

            const created = await this.prisma.message.create({
              data: {
                fromUserId: null,
                subject: subject.slice(0, 510),
                body: body.slice(0, 5_000_000),
                importance: 'normal',
                isExternal: true,
                sentAt,
                externalFromEmail: fromEmail.slice(0, 254),
                externalFromName: fromName.slice(0, 254),
                externalMessageId: messageIdHeader ? messageIdHeader.slice(0, 510) : null,
                externalImapUid: uid,
              },
            });
            existing = { id: created.id, isRead: false };
          }

          // MessageRecipient — status yangilash (upsert)
          const recipient = await this.prisma.messageRecipient.upsert({
            where: {
              messageId_userId: { messageId: existing.id, userId },
            },
            create: {
              messageId: existing.id,
              userId,
              folder: targetFolder,
              kind: RecipientKind.to,
              isRead: seen,
              readAt: seen ? new Date() : null,
            },
            update: {
              // Agar IMAP'da \Seen bo'lsa — DB'ni ham yangilash
              isRead: seen ? true : undefined,
              readAt: seen && !existing.isRead ? new Date() : undefined,
            },
          });

          // Statusni yangilagan bo'lsak, hisobla
          if (seen && !existing.isRead) {
            statusSyncCount++;
          }

          importedCount++;
        }

        // Oxirgi UID va sinx vaqtini saqlash
        await this.prisma.user.update({
          where: { id: userId },
          data: {
            externalMailLastSyncAt: new Date(),
            externalMailLastUid: maxUid,
          },
        });

        // Agar Sent folder bo'lsa — tashqi qabul qiluvchilar uchun read receipts'ni update qil
        if (targetFolder === MessageFolder.sent) {
          await this.syncSentFolderReadReceipts(fetched, userId);
        }

        // Mavjud xabarlar \Seen flag sinxronlash (Pochta UI siz tashqarida o'qigan bo'lsa)
        await this.syncSeenFromImap(client, userId);

        if (importedCount > 0) {
          // Diagnostika: import qilingan eng yangi 5 ta xabarning yuboruvchilarini ham logga yozamiz
          const sampleSenders = fetched
            .slice(-5)
            .map((m) => {
              const from = m.envelope?.from?.[0]?.address || '?';
              const date = m.envelope?.date
                ? new Date(m.envelope.date).toISOString().slice(0, 16).replace('T', ' ')
                : '?';
              const seen = (m.flags as Set<string> | undefined)?.has('\\Seen') ? '✓' : '';
              return `${from} @ ${date} ${seen}`;
            })
            .join('; ');
          this.logger.log(
            `[IMPORT] User ${userId}, ${targetFolder}: ${importedCount} xabar import qilindi` +
            (statusSyncCount > 0 ? ` (+${statusSyncCount} status yangilandi)` : '') +
            ` [maxUid=${maxUid}] (oxirgilari: ${sampleSenders})`,
          );
          this.gateway.notifyNewMessage([userId], { type: 'external_mail_synced' });
        }
    } finally {
      lock.release();
    }
  }

  /**
   * Sent folder'dagi emaillar bilan ExternalReadReceipt'ni sinxronlash.
   * Agar Sent folder'dagi email \Seen flag'i bilan belgilangan bo'lsa —
   * o'sha emaildagi barcha tashqi qabul qiluvchilari "o'qilgan" deb belgilanadi.
   *
   * Use case: Billur (@asaka-motors.uz) pochtasiga yuborilgan emailni
   * foydalanuvchi o'qisa, Sent folder'da \Seen flag'i qo'yiladi.
   * Shu flag'ini ExternalReadReceipt'da o'rni ham belgilash uchun ushbu metod.
   */
  private async syncSentFolderReadReceipts(
    fetched: FetchMessageObject[],
    userId: string,
  ): Promise<void> {
    let syncedCount = 0;
    const now = new Date();

    for (const m of fetched) {
      const seen = (m.flags as Set<string> | undefined)?.has('\\Seen') || false;
      if (!seen) continue; // Faqat o'qilgan emaillar

      // To va CC manzillarini extract qil
      const toAddresses = (m.envelope?.to || []).map((addr: any) => addr.address?.toLowerCase()).filter(Boolean);
      const ccAddresses = (m.envelope?.cc || []).map((addr: any) => addr.address?.toLowerCase()).filter(Boolean);
      const allRecipients = [...toAddresses, ...ccAddresses];

      if (allRecipients.length === 0) continue;

      // Bu emailni bizdaki Message model'ida topish
      const messageIdHeader = m.envelope?.messageId || null;
      if (!messageIdHeader) continue;

      const msg = await this.prisma.message.findFirst({
        where: { externalMessageId: messageIdHeader },
        select: { id: true },
      });
      if (!msg) continue;

      // Shu xabarning external read receipts'larini o'qilgan deb belgilash
      for (const email of allRecipients) {
        const updated = await this.prisma.externalReadReceipt.updateMany({
          where: {
            messageId: msg.id,
            email,
            readAt: null, // Allaqachon o'qilgan deb belgilangan bo'lsa o'zgarmaymiz
          },
          data: {
            readAt: now,
            readMethod: 'imap', // ← IMAP \Seen flag orqali o'qildi
          },
        });
        syncedCount += updated.count;
      }
    }

    if (syncedCount > 0) {
      this.logger.log(
        `[SENT SYNC] User ${userId}: ${syncedCount} ta qabul qiluvchi Sent folder'dagi \Seen flag'dan o'qilgan deb belgilandi`,
      );
    }
  }

  /**
   * Pochta'da yuklangan BARCHA tashqi xabarlar uchun IMAP'dagi \Seen flagini olib,
   * database'dagi isRead statusni sinxronlash. IMAP -> Pochta yo'nalishi.
   * (Pochta -> IMAP yo'nalishi markRead'da real-time ishlaydi).
   */
  private async syncSeenFromImap(client: ImapFlow, userId: string) {
    try {
      // Shu foydalanuvchining barcha external xabarlarini olish
      const allMessages = await this.prisma.messageRecipient.findMany({
        where: {
          userId,
          message: { isExternal: true, externalImapUid: { not: null } },
        },
        select: {
          id: true,
          isRead: true,
          message: { select: { externalImapUid: true } }
        },
      });

      if (allMessages.length === 0) return;

      const uids = allMessages.map((r) => r.message.externalImapUid!).filter(Boolean);
      if (uids.length === 0) return;

      // IMAP'dan barcha xabarlar uchun flags'ni fetch qil
      const imapStatusMap = new Map<number, { seen: boolean }>();
      for await (const m of client.fetch(uids, { uid: true, flags: true }, { uid: true })) {
        const uid = m.uid || 0;
        const seen = (m.flags as Set<string> | undefined)?.has('\\Seen') || false;
        imapStatusMap.set(uid, { seen });
      }

      // Database vs IMAP'ni solishtir va farqlarni yangilash
      const toUpdate: { id: string; isRead: boolean; readAt: Date | null }[] = [];
      let syncedCount = 0;

      for (const msg of allMessages) {
        const uid = msg.message.externalImapUid!;
        const imapStatus = imapStatusMap.get(uid);

        if (!imapStatus) continue;

        // Agar IMAP'da \Seen bo'lsa lekin DB'da o'qilmagan deb yozilgan bo'lsa — yangilash
        if (imapStatus.seen && !msg.isRead) {
          toUpdate.push({
            id: msg.id,
            isRead: true,
            readAt: new Date(),
          });
          syncedCount++;
        }
      }

      // Batch update — performance optimized
      if (toUpdate.length > 0) {
        for (const update of toUpdate) {
          await this.prisma.messageRecipient.update({
            where: { id: update.id },
            data: { isRead: update.isRead, readAt: update.readAt },
          });
        }
        this.logger.log(
          `[IMAP SYNC] User ${userId}: ${syncedCount} xabar \Seen flagdan o'qilgan deb belgilandi`,
        );
      }
    } catch (err: any) {
      this.logger.warn(`[IMAP SYNC] \\Seen sync xato: ${err?.message || err}`);
    }
  }

  /**
   * Diagnostika — IMAP serverdagi barcha papkalarni va har bir papkadagi
   * oxirgi 20 ta xabarni qaytaradi. Bugungi xabarlar qaysi papkada
   * ekanligini tekshirish uchun ishlatiladi.
   */
  async debugInspect(userId: string): Promise<{
    folders: { path: string; specialUse?: string; exists?: number; uidNext?: number }[];
    recentByFolder: Record<
      string,
      { uid: number | undefined; from: string; subject: string; date: string; seen: boolean }[]
    >;
    user: { lastUid: number | null; lastSyncAt: Date | null };
  }> {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        externalMailLogin: true,
        externalMailPasswordEnc: true,
        externalMailEnabled: true,
        externalMailLastUid: true,
        externalMailLastSyncAt: true,
      },
    });
    if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) {
      throw new Error('Tashqi pochta ulanmagan');
    }
    const password = decryptSecret(u.externalMailPasswordEnc);
    const client = new ImapFlow({
      host: process.env.EXTERNAL_MAIL_IMAP_HOST || 'mail.asaka-motors.uz',
      port: Number(process.env.EXTERNAL_MAIL_IMAP_PORT || 993),
      secure: true,
      auth: { user: u.externalMailLogin, pass: password },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    const folders: { path: string; specialUse?: string; exists?: number; uidNext?: number }[] = [];
    const recentByFolder: Record<
      string,
      { uid: number | undefined; from: string; subject: string; date: string; seen: boolean }[]
    > = {};

    try {
      await client.connect();
      // Barcha papkalarni listing
      const list = await client.list();
      for (const f of list) {
        // Faqat haqiqiy papkalar (\Noselect bayrog'i yo'q)
        const flags = (f.flags as any) || new Set();
        const isNoselect = flags instanceof Set ? flags.has('\\Noselect') : Array.isArray(flags) ? flags.includes('\\Noselect') : false;
        if (isNoselect) continue;

        try {
          const lock = await client.getMailboxLock(f.path);
          try {
            const mbox = client.mailbox as any;
            const exists = mbox?.exists || 0;
            folders.push({
              path: f.path,
              specialUse: (f as any).specialUse,
              exists,
              uidNext: mbox?.uidNext,
            });

            // Oxirgi 20 xabarni olish (sequence raqami bo'yicha eng yuqorisi)
            if (exists > 0) {
              const startSeq = Math.max(1, exists - 19);
              const items: any[] = [];
              for await (const m of client.fetch(`${startSeq}:*`, {
                uid: true,
                envelope: true,
                flags: true,
              })) {
                items.push({
                  uid: m.uid,
                  from:
                    m.envelope?.from?.[0]?.address ||
                    (m.envelope?.from?.[0] as any)?.name ||
                    '?',
                  subject: (m.envelope?.subject || '').slice(0, 100),
                  date: m.envelope?.date
                    ? new Date(m.envelope.date).toISOString().slice(0, 16).replace('T', ' ')
                    : '?',
                  seen: (m.flags as Set<string> | undefined)?.has('\\Seen') || false,
                });
              }
              // Eng yangisi yuqorida bo'lsin
              items.sort((a, b) => (b.uid || 0) - (a.uid || 0));
              recentByFolder[f.path] = items;
            } else {
              recentByFolder[f.path] = [];
            }
          } finally {
            lock.release();
          }
        } catch (err: any) {
          this.logger.warn(`Folder ${f.path} debug xato: ${err?.message || err}`);
        }
      }
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }

    return {
      folders,
      recentByFolder,
      user: {
        lastUid: u.externalMailLastUid,
        lastSyncAt: u.externalMailLastSyncAt,
      },
    };
  }

  /**
   * Pochta UI'da xabar o'qilganda — IMAP serverda ham \Seen flagini qo'yamiz.
   * Bu MessagesService.markRead'dan chaqiriladi.
   */
  async markSeenOnImap(userId: string, externalImapUid: number) {
    const u = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        externalMailLogin: true,
        externalMailPasswordEnc: true,
        externalMailEnabled: true,
      },
    });
    if (!u?.externalMailEnabled || !u.externalMailLogin || !u.externalMailPasswordEnc) return;

    let password: string;
    try {
      password = decryptSecret(u.externalMailPasswordEnc);
    } catch {
      return;
    }

    const client = new ImapFlow({
      host: process.env.EXTERNAL_MAIL_IMAP_HOST || 'mail.asaka-motors.uz',
      port: Number(process.env.EXTERNAL_MAIL_IMAP_PORT || 993),
      secure: true,
      auth: { user: u.externalMailLogin, pass: password },
      logger: false,
      tls: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');
      try {
        await client.messageFlagsAdd(externalImapUid, ['\\Seen'], { uid: true });
      } finally {
        lock.release();
      }
    } catch (err: any) {
      this.logger.warn(`markSeenOnImap xato: ${err?.message || err}`);
    } finally {
      try {
        await client.logout();
      } catch {
        // ignore
      }
    }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
