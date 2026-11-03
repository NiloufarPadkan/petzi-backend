import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  QueryVetReviewsDto,
  VetReviewListResponseDto,
  VetReviewResponseDto,
  VetReviewSummaryDto,
} from './dto/vet-review.dto';
import { VetReview } from './entities/vet-review.entity';
import { VetsService } from './vets.service';

@Injectable()
export class VetReviewsService {
  constructor(
    @InjectRepository(VetReview)
    private readonly reviewsRepository: Repository<VetReview>,
    private readonly vetsService: VetsService,
  ) {}

  async findAll(
    vetId: string,
    query: QueryVetReviewsDto,
  ): Promise<VetReviewListResponseDto> {
    await this.vetsService.getVetOrThrow(vetId);
    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: { vetId, ...(query.status ? { status: query.status } : {}) },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: reviews.map((review) => this.toResponse(review)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async getSummary(vetId: string): Promise<VetReviewSummaryDto> {
    const detail = await this.vetsService.findOne(vetId);
    return {
      averageRating: detail.rating.average,
      totalReviews: detail.stats.approvedReviews,
      satisfactionPercent: detail.stats.satisfactionPercent,
      pendingReviews: detail.stats.pendingReviews,
    };
  }

  async reply(
    vetId: string,
    reviewId: string,
    reply: string,
  ): Promise<VetReviewResponseDto> {
    const review = await this.getReviewOrThrow(vetId, reviewId);
    await this.reviewsRepository.update(review.id, {
      reply,
      repliedAt: new Date(),
    });
    return this.toResponse(await this.getReviewOrThrow(vetId, reviewId));
  }

  async setStatus(
    vetId: string,
    reviewId: string,
    status: ApprovalStatus,
  ): Promise<VetReviewResponseDto> {
    const review = await this.getReviewOrThrow(vetId, reviewId);
    await this.reviewsRepository.update(review.id, { status });
    return this.toResponse(await this.getReviewOrThrow(vetId, reviewId));
  }

  async remove(vetId: string, reviewId: string): Promise<void> {
    const review = await this.getReviewOrThrow(vetId, reviewId);
    await this.reviewsRepository.remove(review);
  }

  private async getReviewOrThrow(
    vetId: string,
    reviewId: string,
  ): Promise<VetReview> {
    await this.vetsService.getVetOrThrow(vetId);
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId, vetId },
      relations: { author: true },
    });
    if (!review) {
      throw new NotFoundException('نظر یافت نشد');
    }
    return review;
  }

  private toResponse(review: VetReview): VetReviewResponseDto {
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      reply: review.reply,
      repliedAt: review.repliedAt,
      status: review.status,
      author: review.author
        ? {
            id: review.author.id,
            fullName: review.author.fullName,
            profilePictureUrl: review.author.profilePictureUrl,
          }
        : null,
      createdAt: review.createdAt,
    };
  }
}
