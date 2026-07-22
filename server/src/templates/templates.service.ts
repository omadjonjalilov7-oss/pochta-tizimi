import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as mammoth from 'mammoth';
import sanitizeHtml from 'sanitize-html';
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

// Shablon HTML'ini xavfsiz teglar bilan cheklaymiz (XSS oldini olish).
// Rasm (img) tashlab yuboriladi — Word rasmlarni base64 qilib bazani shishiradi.
const SANITIZE_OPTS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'ul', 'ol', 'li', 'blockquote', 'hr',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'span', 'div', 'a',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan'],
    '*': ['style'],
  },
  allowedStyles: {
    '*': {
      'text-align': [/^(left|right|center|justify)$/],
      'font-weight': [/^(bold|bolder|[1-9]00)$/],
      'font-style': [/^(italic|normal)$/],
      'text-decoration': [/^(underline|line-through|none)$/],
    },
  },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer',
    }),
  },
};

function sanitizeBody(html: string): string {
  return sanitizeHtml(html ?? '', SANITIZE_OPTS).trim();
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
        bodyTemplate: sanitizeBody(dto.bodyTemplate),
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
        ...(dto.bodyTemplate !== undefined
          ? { bodyTemplate: sanitizeBody(dto.bodyTemplate) }
          : {}),
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

  // Word (.docx) faylni HTMLga aylantiradi — saqlamaydi, faqat muharrirga qaytaradi
  async importDocx(buffer: Buffer) {
    if (!buffer || buffer.length === 0) {
      throw new BadRequestException("Fayl bo'sh");
    }
    let raw: string;
    try {
      const result = await mammoth.convertToHtml({ buffer });
      raw = result.value;
    } catch {
      throw new BadRequestException(
        "Faylni o'qib bo'lmadi. To'g'ri .docx ekaniga ishonch hosil qiling",
      );
    }
    const html = sanitizeBody(raw);
    return { html, placeholders: extractPlaceholders(html) };
  }
}
