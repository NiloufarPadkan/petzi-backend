import { Injectable } from '@nestjs/common';
import type {
  GatewayInitiateInput,
  GatewayInitiateResult,
  GatewaySettings,
  GatewayVerifyInput,
  GatewayVerifyResult,
  PaymentGatewayProvider,
} from './gateway.types';

/**
 * Development gateway: "pays" instantly by sending the payer straight to the
 * callback with a success status. PaymentGatewayService never uses it in
 * production.
 */
@Injectable()
export class MockProvider implements PaymentGatewayProvider {
  readonly code = 'mock';

  initiate(
    _settings: GatewaySettings,
    input: GatewayInitiateInput,
  ): Promise<GatewayInitiateResult> {
    const authority = `MOCK-${input.paymentId}`;
    const separator = input.callbackUrl.includes('?') ? '&' : '?';
    return Promise.resolve({
      authority,
      redirectUrl: `${input.callbackUrl}${separator}Authority=${authority}&Status=OK`,
    });
  }

  verify(
    _settings: GatewaySettings,
    input: GatewayVerifyInput,
  ): Promise<GatewayVerifyResult> {
    return Promise.resolve({
      success: input.authority.startsWith('MOCK-'),
      referenceId: `MOCKREF-${input.authority.slice(5, 13)}`,
    });
  }
}
