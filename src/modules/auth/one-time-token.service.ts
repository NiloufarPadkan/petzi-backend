import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Repository } from 'typeorm';
import { OneTimeTokenPurpose } from '../../common/enums/one-time-token-purpose.enum';
import { OneTimeToken } from './entities/one-time-token.entity';

@Injectable()
export class OneTimeTokenService {
  constructor(
    @InjectRepository(OneTimeToken)
    private readonly tokenRepository: Repository<OneTimeToken>,
  ) {}

  async issue(params: {
    purpose: OneTimeTokenPurpose;
    expiresInSeconds: number;
    phoneNumber?: string;
    userId?: string;
  }): Promise<{ jti: string; expiresAt: Date }> {
    const jti = randomUUID().replace(/-/g, '');
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000);

    const row = this.tokenRepository.create({
      jti,
      purpose: params.purpose,
      phoneNumber: params.phoneNumber ?? null,
      userId: params.userId ?? null,
      expiresAt,
      isUsed: false,
    });
    await this.tokenRepository.save(row);

    return { jti, expiresAt };
  }

  /**
   * Atomically consumes a one-time token. Returns the row when successful,
   * otherwise null (missing, expired, wrong purpose, or already used).
   */
  async consume(
    jti: string,
    purpose: OneTimeTokenPurpose,
  ): Promise<OneTimeToken | null> {
    const token = await this.tokenRepository.findOne({
      where: { jti, purpose, isUsed: false },
    });

    if (!token) return null;
    if (token.expiresAt < new Date()) {
      await this.tokenRepository.update(
        { id: token.id, isUsed: false },
        { isUsed: true },
      );
      return null;
    }

    const result = await this.tokenRepository.update(
      { id: token.id, isUsed: false },
      { isUsed: true },
    );
    if (result.affected !== 1) return null;

    return { ...token, isUsed: true };
  }
}
