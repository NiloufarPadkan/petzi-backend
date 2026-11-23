import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  GatewayInitiateInput,
  GatewayInitiateResult,
  GatewaySettings,
  GatewayVerifyInput,
  GatewayVerifyResult,
  PaymentGatewayProvider,
} from './gateway.types';

export type SandboxDecision = 'pending' | 'paid' | 'cancelled';

export interface SandboxSession {
  authority: string;
  paymentId: string;
  amountToman: number;
  description: string;
  callbackUrl: string;
  decision: SandboxDecision;
  createdAt: number;
}

const SESSION_TTL_MS = 30 * 60_000;

/**
 * Development-only gateway with a real "payment page"
 * (GET /api/v1/payments/sandbox/:authority, see SandboxPaymentController).
 * It behaves like an external gateway: initiate → payer approves or cancels
 * on the page → payer is sent to the callback → the app calls verify.
 *
 * Sessions live in memory, so a server restart drops unfinished payments.
 * It throws in production; real gateways (e.g. ZarinpalProvider) implement
 * the same PaymentGatewayProvider contract.
 */
@Injectable()
export class SandboxProvider implements PaymentGatewayProvider {
  readonly code = 'sandbox';
  private readonly sessions = new Map<string, SandboxSession>();

  constructor(private readonly configService: ConfigService) {}

  get enabled(): boolean {
    return this.configService.get<string>('nodeEnv') !== 'production';
  }

  initiate(
    _settings: GatewaySettings,
    input: GatewayInitiateInput,
  ): Promise<GatewayInitiateResult> {
    this.assertEnabled();
    this.prune();
    const authority = `SBX-${randomUUID()}`;
    this.sessions.set(authority, {
      authority,
      paymentId: input.paymentId,
      amountToman: input.amountToman,
      description: input.description,
      callbackUrl: input.callbackUrl,
      decision: 'pending',
      createdAt: Date.now(),
    });
    const base = (
      this.configService.get<string>('appUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    return Promise.resolve({
      authority,
      redirectUrl: `${base}/api/v1/payments/sandbox/${authority}`,
    });
  }

  verify(
    _settings: GatewaySettings,
    input: GatewayVerifyInput,
  ): Promise<GatewayVerifyResult> {
    this.assertEnabled();
    const session = this.sessions.get(input.authority);
    if (!session) {
      return Promise.resolve({
        success: false,
        message: 'جلسه پرداخت آزمایشی یافت نشد یا منقضی شده است',
      });
    }
    if (session.amountToman !== input.amountToman) {
      return Promise.resolve({
        success: false,
        message: 'مبلغ پرداخت با درخواست مطابقت ندارد',
      });
    }
    if (session.decision !== 'paid') {
      return Promise.resolve({
        success: false,
        message: 'پرداخت آزمایشی تایید نشد',
      });
    }
    return Promise.resolve({
      success: true,
      referenceId: `SBX-REF-${session.authority.slice(4, 12).toUpperCase()}`,
      cardPan: '6037-99**-****-1234',
    });
  }

  /** The pending session shown on the sandbox page. */
  getSession(authority: string): SandboxSession {
    this.assertEnabled();
    const session = this.sessions.get(authority);
    if (!session || this.expired(session)) {
      throw new NotFoundException('جلسه پرداخت آزمایشی یافت نشد');
    }
    return session;
  }

  /**
   * Records the payer's choice once and returns the gateway callback URL,
   * using the Zarinpal-style `Authority` / `Status=OK|NOK` query parameters.
   */
  decide(authority: string, decision: Exclude<SandboxDecision, 'pending'>) {
    const session = this.getSession(authority);
    if (session.decision === 'pending') session.decision = decision;
    const url = new URL(session.callbackUrl);
    url.searchParams.set('Authority', authority);
    url.searchParams.set('Status', session.decision === 'paid' ? 'OK' : 'NOK');
    return url.toString();
  }

  private assertEnabled() {
    if (!this.enabled) {
      throw new ForbiddenException(
        'درگاه آزمایشی فقط در محیط توسعه در دسترس است',
      );
    }
  }

  private expired(session: SandboxSession) {
    return Date.now() - session.createdAt > SESSION_TTL_MS;
  }

  private prune() {
    for (const [key, session] of this.sessions)
      if (this.expired(session)) this.sessions.delete(key);
  }
}
