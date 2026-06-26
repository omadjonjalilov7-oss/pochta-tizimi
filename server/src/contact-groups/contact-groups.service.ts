import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const USER_SELECT = {
  id: true,
  fullName: true,
  login: true,
  avatarPath: true,
  position: { select: { name: true } },
  department: { select: { name: true } },
};

@Injectable()
export class ContactGroupsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Barcha guruhlarni qaytarish (a'zolari bilan) ─────────────────────────
  async findAll(userId: string) {
    return this.prisma.contactGroup.findMany({
      where: { ownerId: userId },
      include: {
        members: {
          include: { member: { select: USER_SELECT } },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ── Yangi guruh yaratish ──────────────────────────────────────────────────
  async create(userId: string, name: string, color?: string) {
    try {
      return await this.prisma.contactGroup.create({
        data: { ownerId: userId, name: name.trim(), color },
        include: { members: true },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`"${name}" nomli guruh allaqachon mavjud`);
      }
      throw e;
    }
  }

  // ── Guruhni yangilash ─────────────────────────────────────────────────────
  async update(userId: string, groupId: string, name?: string, color?: string) {
    await this.requireOwner(userId, groupId);
    try {
      return await this.prisma.contactGroup.update({
        where: { id: groupId },
        data: {
          ...(name !== undefined && { name: name.trim() }),
          ...(color !== undefined && { color }),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`"${name}" nomli guruh allaqachon mavjud`);
      }
      throw e;
    }
  }

  // ── Guruhni o'chirish ─────────────────────────────────────────────────────
  async remove(userId: string, groupId: string) {
    await this.requireOwner(userId, groupId);
    await this.prisma.contactGroup.delete({ where: { id: groupId } });
    return { ok: true };
  }

  // ── A'zo qo'shish ─────────────────────────────────────────────────────────
  async addMember(userId: string, groupId: string, memberId: string) {
    await this.requireOwner(userId, groupId);
    if (memberId === userId) {
      throw new ConflictException("O'zingizni guruhga qo'sha olmaysiz");
    }
    await this.prisma.contactGroupMember.upsert({
      where: { groupId_memberId: { groupId, memberId } },
      create: { groupId, memberId },
      update: {},
    });
    return { ok: true };
  }

  // ── A'zoni o'chirish ──────────────────────────────────────────────────────
  async removeMember(userId: string, groupId: string, memberId: string) {
    await this.requireOwner(userId, groupId);
    await this.prisma.contactGroupMember.deleteMany({
      where: { groupId, memberId },
    });
    return { ok: true };
  }

  // ── Foydalanuvchining guruh teglamalari (compose recipientda ishlatish uchun) ──
  async getGroupsForContacts(userId: string): Promise<Record<string, string[]>> {
    const groups = await this.prisma.contactGroup.findMany({
      where: { ownerId: userId },
      select: { name: true, members: { select: { memberId: true } } },
    });
    // { contactUserId: ['Rahbarlar', 'Do\'stlarim'] }
    const result: Record<string, string[]> = {};
    for (const g of groups) {
      for (const m of g.members) {
        if (!result[m.memberId]) result[m.memberId] = [];
        result[m.memberId].push(g.name);
      }
    }
    return result;
  }

  // ── Ichki yordamchi ────────────────────────────────────────────────────────
  private async requireOwner(userId: string, groupId: string) {
    const g = await this.prisma.contactGroup.findUnique({
      where: { id: groupId },
    });
    if (!g) throw new NotFoundException('Guruh topilmadi');
    if (g.ownerId !== userId) throw new ForbiddenException("Ruxsat yo'q");
    return g;
  }
}
