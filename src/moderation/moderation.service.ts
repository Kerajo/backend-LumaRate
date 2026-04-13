import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { RecensionStatus, ReviewStatus, UserRole } from '@prisma/client';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { ModerationReasonDto } from './dto/moderation-reason.dto';

type CurrentUser = { id: string; role: UserRole };

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  async getReviewsQueue(status: ReviewStatus = ReviewStatus.PENDING, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { status },
        include: {
          user: { select: { id: true, login: true } },
          content: { select: { id: true, slug: true, title: true } },
          rating: { select: { score: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.review.count({ where: { status } }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        author: item.user,
        content: item.content,
        rating: item.rating.score,
        text: item.text,
        status: item.status,
        createdAt: item.createdAt,
      })),
      pagination: { page, total },
    };
  }

  async approveReview(id: string, moderator: CurrentUser) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Отзыв не найден');
    if (review.status !== ReviewStatus.PENDING) {
      throw new ConflictException('Отзыв уже обработан');
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        status: ReviewStatus.APPROVED,
        moderatedBy: moderator.id,
        moderatedAt: new Date(),
        rejectionReason: null,
      },
    });
    return { message: 'Отзыв одобрен', review: { id: updated.id, status: updated.status, moderatedAt: updated.moderatedAt } };
  }

  async rejectReview(id: string, moderator: CurrentUser, dto: ModerationReasonDto) {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Отзыв не найден');
    if (review.status !== ReviewStatus.PENDING) {
      throw new ConflictException('Отзыв уже обработан');
    }

    const updated = await this.prisma.review.update({
      where: { id },
      data: {
        status: ReviewStatus.REJECTED,
        moderatedBy: moderator.id,
        moderatedAt: new Date(),
        rejectionReason: dto.reason ?? null,
      },
    });
    return { message: 'Отзыв отклонён', review: { id: updated.id, status: updated.status } };
  }

  async getRecensionsQueue(status: RecensionStatus = RecensionStatus.PENDING, query: PaginationQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.recension.findMany({
        where: { status },
        include: {
          expert: { select: { id: true, login: true, role: true } },
          content: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.recension.count({ where: { status } }),
    ]);

    return {
      data: items.map((item) => ({
        id: item.id,
        title: item.title,
        author: item.expert,
        content: item.content,
        textPreview: item.text.slice(0, 160),
        status: item.status,
        createdAt: item.createdAt,
      })),
      pagination: { page, total },
    };
  }

  async approveRecension(id: string, moderator: CurrentUser) {
    const recension = await this.prisma.recension.findUnique({ where: { id } });
    if (!recension) throw new NotFoundException('Рецензия не найдена');
    if (recension.status !== RecensionStatus.PENDING) {
      throw new ConflictException('Рецензия уже обработана');
    }

    const updated = await this.prisma.recension.update({
      where: { id },
      data: {
        status: RecensionStatus.APPROVED,
        moderatedBy: moderator.id,
        publishedAt: new Date(),
        rejectionReason: null,
      },
    });
    return {
      message: 'Рецензия одобрена и опубликована',
      recension: { id: updated.id, status: updated.status, publishedAt: updated.publishedAt },
    };
  }

  async rejectRecension(id: string, moderator: CurrentUser, dto: ModerationReasonDto) {
    const recension = await this.prisma.recension.findUnique({ where: { id } });
    if (!recension) throw new NotFoundException('Рецензия не найдена');
    if (recension.status !== RecensionStatus.PENDING) {
      throw new ConflictException('Рецензия уже обработана');
    }

    const updated = await this.prisma.recension.update({
      where: { id },
      data: {
        status: RecensionStatus.REJECTED,
        moderatedBy: moderator.id,
        rejectionReason: dto.reason ?? null,
      },
    });
    return { message: 'Рецензия отклонена', recension: { id: updated.id, status: updated.status } };
  }

  async getStats() {
    const [pendingReviews, pendingRecensions, approvedReviews, approvedRecensions] = await Promise.all([
      this.prisma.review.count({ where: { status: ReviewStatus.PENDING } }),
      this.prisma.recension.count({ where: { status: RecensionStatus.PENDING } }),
      this.prisma.review.count({ where: { status: ReviewStatus.APPROVED } }),
      this.prisma.recension.count({ where: { status: RecensionStatus.APPROVED } }),
    ]);

    return {
      reviews: { pending: pendingReviews, approved: approvedReviews },
      recensions: { pending: pendingRecensions, approved: approvedRecensions },
      totalPending: pendingReviews + pendingRecensions,
    };
  }
}
