import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function extractPlaceholders(body: string): string[] {
  const set = new Set<string>();
  let m: RegExpExecArray | null;
  PLACEHOLDER_RE.lastIndex = 0;
  while ((m = PLACEHOLDER_RE.exec(body)) !== null) {
    set.add(m[1]);
  }
  return Array.from(set);
}

const AUTHOR_SELECT = {
  id: true,
  fullName: true,
  login: true,
  avatarPath: true,
};

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const items = await this.prisma.documentTemplate.findMany({
      where: {
        OR: [{ isShared: true }, { createdById: userId }],
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: { createdBy: { select: AUTHOR_SELECT } },
    });
    return items.map((t) => ({
      ...t,
      placeholders: extractPlaceholders(t.bodyTemplate),
    }));
  }

  async findOne(userId: string, id: string) {
    const t = await this.prisma.documentTemplate.findUnique({
      where: { id },
      include: { createdBy: { select: AUTHOR_SELECT } },
    });
    if (!t) throw new NotFoundException('Shablon topilmadi');
    if (!t.isShared && t.createdById !== userId) {
      throw new ForbiddenException('Bu shablon sizga ochiq emas');
    }
    return { ...t, placeholders: extractPlaceholders(t.bodyTemplate) };
  }

  async create(userId: string, dto: CreateTemplateDto) {
    const created = await this.prisma.documentTemplate.create({
      data: {
        name: dto.name.trim(),
        category: dto.category.trim(),
        bodyTemplate: dto.bodyTemplate,
        isShared: dto.isShared ?? true,
        createdById: userId,
      },
      include: { createdBy: { select: AUTHOR_SELECT } },
    });
    return {
      ...created,
      placeholders: extractPlaceholders(created.bodyTemplate),
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateTemplateDto,
    isAdmin: boolean,
  ) {
    const t = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Shablon topilmadi');
    if (t.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('Bu shablonni faqat muallifi tahrirlaydi');
    }
    const updated = await this.prisma.documentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.category !== undefined ? { category: dto.category.trim() } : {}),
        ...(dto.bodyTemplate !== undefined ? { bodyTemplate: dto.bodyTemplate } : {}),
        ...(dto.isShared !== undefined ? { isShared: dto.isShared } : {}),
      },
      include: { createdBy: { select: AUTHOR_SELECT } },
    });
    return {
      ...updated,
      placeholders: extractPlaceholders(updated.bodyTemplate),
    };
  }

  async remove(userId: string, id: string, isAdmin: boolean) {
    const t = await this.prisma.documentTemplate.findUnique({ where: { id } });
    if (!t) throw new NotFoundException('Shablon topilmadi');
    if (t.createdById !== userId && !isAdmin) {
      throw new ForbiddenException('Bu shablonni faqat muallifi o\'chiradi');
    }
    await this.prisma.documentTemplate.delete({ where: { id } });
    return { success: true };
  }
}
