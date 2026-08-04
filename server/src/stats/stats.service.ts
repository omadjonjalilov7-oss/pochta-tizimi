import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type TaskRow = {
  status: 'pending' | 'in_progress' | 'done' | 'overdue';
  deadline: Date | null;
  doneAt: Date | null;
  user: {
    id: string;
    fullName: string;
    departmentId: string | null;
    department: { id: string; name: string } | null;
    position: { name: string } | null;
  };
};

function emptyBucket() {
  return {
    total: 0,
    pending: 0,
    inProgress: 0,
    done: 0,
    doneLate: 0,
    overdue: 0,
  };
}

function classify(bucket: ReturnType<typeof emptyBucket>, row: { status: string; deadline: Date | null; doneAt: Date | null }) {
  bucket.total += 1;
  switch (row.status) {
    case 'pending':
      bucket.pending += 1;
      break;
    case 'in_progress':
      bucket.inProgress += 1;
      break;
    case 'overdue':
      bucket.overdue += 1;
      break;
    case 'done':
      bucket.done += 1;
      if (row.doneAt && row.deadline && row.doneAt.getTime() > row.deadline.getTime()) {
        bucket.doneLate += 1;
      }
      break;
  }
}

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  private dateRange(from?: string, to?: string) {
    const gte = from ? new Date(from) : undefined;
    let lte: Date | undefined;
    if (to) {
      lte = new Date(to);
      lte.setHours(23, 59, 59, 999);
    }
    if (!gte && !lte) return undefined;
    return {
      ...(gte && !isNaN(gte.getTime()) ? { gte } : {}),
      ...(lte && !isNaN(lte.getTime()) ? { lte } : {}),
    };
  }

  private async loadTasks(from?: string, to?: string): Promise<TaskRow[]> {
    const range = this.dateRange(from, to);
    return this.prisma.resolutionTarget.findMany({
      where: range ? { resolution: { createdAt: range } } : {},
      select: {
        status: true,
        deadline: true,
        doneAt: true,
        user: {
          select: {
            id: true,
            fullName: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
            position: { select: { name: true } },
          },
        },
      },
    });
  }

  // Umumiy holat — hujjatlar va topshiriqlar bo'yicha yig'ma ko'rsatkichlar
  async overview(from?: string, to?: string) {
    const range = this.dateRange(from, to);
    const docWhere = range ? { createdAt: range } : {};

    const [docGroups, tasks, sigCount, approvalGroups] = await Promise.all([
      this.prisma.document.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: docWhere,
      }),
      this.loadTasks(from, to),
      this.prisma.documentSignature.count({
        where: range ? { signedAt: range } : {},
      }),
      this.prisma.documentParticipant.groupBy({
        by: ['status'],
        _count: { _all: true },
        where: { role: 'approver', ...(range ? { document: { createdAt: range } } : {}) },
      }),
    ]);

    const documents = {
      total: 0,
      draft: 0,
      inReview: 0,
      inProgress: 0,
      done: 0,
      rejected: 0,
      overdue: 0,
    };
    for (const g of docGroups) {
      const c = g._count._all;
      documents.total += c;
      switch (g.status) {
        case 'draft':
          documents.draft = c;
          break;
        case 'in_review':
          documents.inReview = c;
          break;
        case 'in_progress':
          documents.inProgress = c;
          break;
        case 'done':
          documents.done = c;
          break;
        case 'rejected':
          documents.rejected = c;
          break;
        case 'overdue':
          documents.overdue = c;
          break;
      }
    }

    const taskBucket = emptyBucket();
    for (const t of tasks) classify(taskBucket, t);

    const approvals = { pending: 0, approved: 0, rejected: 0, done: 0 };
    for (const g of approvalGroups) {
      const c = g._count._all;
      if (g.status === 'pending') approvals.pending = c;
      else if (g.status === 'approved') approvals.approved = c;
      else if (g.status === 'rejected') approvals.rejected = c;
      else if (g.status === 'done') approvals.done = c;
    }

    return { documents, tasks: taskBucket, signatures: sigCount, approvals };
  }

  // Bo'limlar bo'yicha statistika — hujjatlar (bo'lim yaratgan) va topshiriqlar
  // (bo'lim xodimlariga biriktirilgan porucheniyalar) alohida ko'rsatiladi.
  async departments(from?: string, to?: string) {
    const NO_DEPT = '__none__';
    const NO_DEPT_NAME = 'Bo\'limsiz';
    const tasks = await this.loadTasks(from, to);
    const map = new Map<
      string,
      ReturnType<typeof emptyBucket> & { departmentId: string; name: string; documents: number }
    >();
    const ensure = (id: string, name: string) => {
      let row = map.get(id);
      if (!row) {
        row = { departmentId: id, name, documents: 0, ...emptyBucket() };
        map.set(id, row);
      }
      return row;
    };

    // Topshiriqlar — ijrochi xodim bo'limi bo'yicha
    for (const t of tasks) {
      const id = t.user.department?.id || NO_DEPT;
      const name = t.user.department?.name || NO_DEPT_NAME;
      classify(ensure(id, name), t);
    }

    // Hujjatlar — yaratuvchi xodim bo'limi bo'yicha
    const range = this.dateRange(from, to);
    const docs = await this.prisma.document.findMany({
      where: {
        status: { not: 'draft' },
        ...(range ? { createdAt: range } : {}),
      },
      select: { createdBy: { select: { department: { select: { id: true, name: true } } } } },
    });
    for (const d of docs) {
      const dep = d.createdBy?.department;
      const id = dep?.id || NO_DEPT;
      const name = dep?.name || NO_DEPT_NAME;
      ensure(id, name).documents += 1;
    }

    return [...map.values()].sort(
      (a, b) => b.documents + b.total - (a.documents + a.total),
    );
  }

  // Xodimlar bo'yicha topshiriqlar statistikasi
  async staff(from?: string, to?: string, departmentId?: string) {
    const tasks = await this.loadTasks(from, to);
    const map = new Map<
      string,
      ReturnType<typeof emptyBucket> & { userId: string; fullName: string; department: string; position: string }
    >();
    for (const t of tasks) {
      if (departmentId && t.user.departmentId !== departmentId) continue;
      let row = map.get(t.user.id);
      if (!row) {
        row = {
          userId: t.user.id,
          fullName: t.user.fullName,
          department: t.user.department?.name || '—',
          position: t.user.position?.name || '—',
          ...emptyBucket(),
        };
        map.set(t.user.id, row);
      }
      classify(row, t);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  // Rahbarlar imzolash statistikasi
  async signing(from?: string, to?: string) {
    const range = this.dateRange(from, to);
    const groups = await this.prisma.documentSignature.groupBy({
      by: ['signerId'],
      _count: { _all: true },
      where: range ? { signedAt: range } : {},
    });
    if (groups.length === 0) return [];
    const users = await this.prisma.user.findMany({
      where: { id: { in: groups.map((g) => g.signerId) } },
      select: { id: true, fullName: true, position: { select: { name: true } } },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return groups
      .map((g) => ({
        userId: g.signerId,
        fullName: byId.get(g.signerId)?.fullName || '—',
        position: byId.get(g.signerId)?.position?.name || '—',
        count: g._count._all,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // Kelishuvchilar (tasdiqlovchilar) statistikasi
  async approvals(from?: string, to?: string) {
    const range = this.dateRange(from, to);
    const participants = await this.prisma.documentParticipant.findMany({
      where: {
        role: 'approver',
        ...(range ? { document: { createdAt: range } } : {}),
      },
      select: {
        status: true,
        user: { select: { id: true, fullName: true, position: { select: { name: true } } } },
      },
    });
    const map = new Map<
      string,
      { userId: string; fullName: string; position: string; total: number; pending: number; approved: number; rejected: number }
    >();
    for (const p of participants) {
      let row = map.get(p.user.id);
      if (!row) {
        row = {
          userId: p.user.id,
          fullName: p.user.fullName,
          position: p.user.position?.name || '—',
          total: 0,
          pending: 0,
          approved: 0,
          rejected: 0,
        };
        map.set(p.user.id, row);
      }
      row.total += 1;
      if (p.status === 'pending') row.pending += 1;
      else if (p.status === 'approved' || p.status === 'done') row.approved += 1;
      else if (p.status === 'rejected') row.rejected += 1;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }
}
