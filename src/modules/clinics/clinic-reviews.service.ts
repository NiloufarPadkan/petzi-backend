import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  QueryVetReviewsDto,
  VetReviewListResponseDto,
  VetReviewResponseDto,
  VetReviewSummaryDto,
} from '../vets/dto/vet-review.dto';
import { ClinicReview } from './entities/clinic-review.entity';
import { ClinicsService } from './clinics.service';

@Injectable()
export class ClinicReviewsService {
  constructor(
    @InjectRepository(ClinicReview)
    private readonly reviewsRepository: Repository<ClinicReview>,
    private readonly clinicsService: ClinicsService,
  ) {}

  async findAll(
    clinicId: string,
    query: QueryVetReviewsDto,
  ): Promise<VetReviewListResponseDto> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const [reviews, total] = await this.reviewsRepository.findAndCount({
      where: { clinicId, ...(query.status ? { status: query.status } : {}) },
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

  async getSummary(clinicId: string): Promise<VetReviewSummaryDto> {
    const detail = await this.clinicsService.findOne(clinicId);
    return {
      averageRating: detail.rating.average,
      totalReviews: detail.stats.approvedReviews,
      satisfactionPercent: detail.stats.satisfactionPercent,
      pendingReviews: detail.stats.pendingReviews,
    };
  }

  async reply(
    clinicId: string,
    reviewId: string,
    reply: string,
  ): Promise<VetReviewResponseDto> {
    const review = await this.getReviewOrThrow(clinicId, reviewId);
    await this.reviewsRepository.update(review.id, {
      reply,
      repliedAt: new Date(),
    });
    return this.toResponse(await this.getReviewOrThrow(clinicId, reviewId));
  }

  async setStatus(
    clinicId: string,
    reviewId: string,
    status: ApprovalStatus,
  ): Promise<VetReviewResponseDto> {
    const review = await this.getReviewOrThrow(clinicId, reviewId);
    await this.reviewsRepository.update(review.id, { status });
    return this.toResponse(await this.getReviewOrThrow(clinicId, reviewId));
  }

  async remove(clinicId: string, reviewId: string): Promise<void> {
    const review = await this.getReviewOrThrow(clinicId, reviewId);
    await this.reviewsRepository.remove(review);
  }

  private async getReviewOrThrow(
    clinicId: string,
    reviewId: string,
  ): Promise<ClinicReview> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const review = await this.reviewsRepository.findOne({
      where: { id: reviewId, clinicId },
      relations: { author: true },
    });
    if (!review) {
      throw new NotFoundException('نظر یافت نشد');
    }
    return review;
  }

  private toResponse(review: ClinicReview): VetReviewResponseDto {
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
