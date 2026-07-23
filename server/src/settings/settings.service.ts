import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const INTERNAL_DEADLINE_DAYS = 'internal_deadline_days';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  private async getRaw(key: string): Promise<string | null> {
    const row = await this.prisma.appSetting.findUnique({ where: { key } });
    return row?.value ?? null;
  }

  private async setRaw(key: string, value: string | null): Promise<void> {
    if (value === null) {
      await this.prisma.appSetting.deleteMany({ where: { key } });
      return;
    }
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }

  // Ichki hujjatlar uchun standart muddat (kun). null => xodim o'zi tanlaydi.
  async getInternalDeadlineDays(): Promise<number | null> {
    const raw = await this.getRaw(INTERNAL_DEADLINE_DAYS);
    if (raw === null || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
  }

  async setInternalDeadlineDays(days: number | null): Promise<number | null> {
    const value = days && days > 0 ? String(Math.floor(days)) : null;
    await this.setRaw(INTERNAL_DEADLINE_DAYS, value);
    return this.getInternalDeadlineDays();
  }

  async getDocumentDefaults() {
    return { internalDeadlineDays: await this.getInternalDeadlineDays() };
  }
}
