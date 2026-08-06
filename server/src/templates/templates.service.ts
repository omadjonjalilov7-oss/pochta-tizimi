import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as mammoth from 'mammoth';
import JSZip from 'jszip';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeRichHtml } from '../common/sanitize';
import { CreateTemplateDto, UpdateTemplateDto } from './dto/template.dto';

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

// Tayyor hujjat A4 varag'ining ichki (padding'siz) kengligi ~698px. Word
// jadvalini shu kenglikka moslab (proporsiyalarini saqlab) piksel kengligini
// beramiz — natijada jadval A4 ramkasidan chiqib ketmaydi.
const A4_CONTENT_PX = 690;

// .docx (zip) ichidagi word/document.xml dan har bir jadvalning ustun
// kengliklarini (w:tblGrid > w:gridCol w:w=..., dxa) tartib bo'yicha oladi.
async function extractTblGrids(buffer: Buffer): Promise<number[][]> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const file = zip.file('word/document.xml');
    if (!file) return [];
    const xml = await file.async('string');
    const grids: number[][] = [];
    const gridRe = /<w:tblGrid\b[^>]*>([\s\S]*?)<\/w:tblGrid>/g;
    let g: RegExpExecArray | null;
    while ((g = gridRe.exec(xml)) !== null) {
      const cols: number[] = [];
      const colRe = /<w:gridCol\b[^>]*?\bw:w="(\d+)"/g;
      let c: RegExpExecArray | null;
      while ((c = colRe.exec(g[1])) !== null) cols.push(parseInt(c[1], 10));
      grids.push(cols);
    }
    return grids;
  } catch {
    return [];
  }
}

// Mammoth chiqargan HTML jadvallariga (kenglik bermaydi) Word gridiga mos
// <colgroup> qo'shadi — ustun kengliklari A4 ramkasiga proporsional sig'adi,
// table-layout:fixed bo'lgani uchun kataklar o'zgarmaydi, matn faqat pastga tushadi.
function applyTableWidths(html: string, grids: number[][]): string {
  let idx = 0;
  return html.replace(/<table\b[^>]*>/g, (full) => {
    const grid = grids[idx++];
    if (!grid || grid.length === 0) return full;
    const sum = grid.reduce((a, b) => a + b, 0) || 1;
    const cols = grid
      .map((w) => {
        const px = Math.max(6, Math.round((w / sum) * A4_CONTENT_PX));
        return `<col style="width:${px}px" />`;
      })
      .join('');
    return `<table style="width:${A4_CONTENT_PX}px"><colgroup>${cols}</colgroup>`;
  });
}

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
// Rasm (img) saqlanadi — firmenniy blanka sarlavha rasmi uchun zarur.
function sanitizeBody(html: string): string {
  return sanitizeRichHtml(html);
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
    // Word jadval ustunlari kengligini o'qib, HTMLga proporsional colgroup
    // qo'shamiz — jadval A4 ramkasidan chiqmaydi.
    const grids = await extractTblGrids(buffer);
    const withWidths = grids.length ? applyTableWidths(raw, grids) : raw;
    const html = sanitizeBody(withWidths);
    return { html, placeholders: extractPlaceholders(html) };
  }
}
