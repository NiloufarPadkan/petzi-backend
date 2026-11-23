import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SettingsService } from '../../settings/settings.service';
import type { PaymentGatewayProvider } from './gateway.types';
import { PaymentGatewayService } from './payment-gateway.service';

const input = {
  paymentId: 'p1',
  amountToman: 1000,
  description: 'test',
  callbackUrl: 'http://api.test/callback',
};

function fakeProvider(code: string): PaymentGatewayProvider {
  return {
    code,
    initiate: jest.fn().mockResolvedValue({ authority: `${code}-A`, redirectUrl: `https://${code}.test` }),
    verify: jest.fn().mockResolvedValue({ success: true }),
  };
}

function service(nodeEnv: string, gateways: unknown[] = []) {
  const settings = {
    getRawGroup: jest.fn().mockResolvedValue({ gateways, sandboxMode: true }),
  } as unknown as SettingsService;
  const config = { get: () => nodeEnv } as unknown as ConfigService;
  return new PaymentGatewayService(
    settings,
    config,
    fakeProvider('zarinpal') as never,
    fakeProvider('mock') as never,
    fakeProvider('sandbox') as never,
  );
}

describe('PaymentGatewayService', () => {
  it('falls back to the sandbox gateway in development', async () => {
    const result = await service('development').initiate(undefined, input);
    expect(result.gatewayCode).toBe('sandbox');
  });

  it('allows requesting mock or sandbox explicitly in development', async () => {
    await expect(service('development').initiate('mock', input)).resolves.toMatchObject({ gatewayCode: 'mock' });
    await expect(service('development').initiate('sandbox', input)).resolves.toMatchObject({ gatewayCode: 'sandbox' });
  });

  it('uses the first enabled real gateway', async () => {
    const result = await service('development', [
      { code: 'zarinpal', enabled: true, merchantId: 'm' },
    ]).initiate(undefined, input);
    expect(result.gatewayCode).toBe('zarinpal');
  });

  it('refuses to take payments in production without a real gateway', async () => {
    await expect(service('production').initiate(undefined, input)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('never uses dev-only gateways in production, even when enabled or requested', async () => {
    const prod = service('production', [{ code: 'sandbox', enabled: true }]);
    await expect(prod.initiate(undefined, input)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(prod.initiate('sandbox', input)).rejects.toBeInstanceOf(BadRequestException);
    await expect(prod.initiate('mock', input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a requested gateway that is not enabled', async () => {
    await expect(service('development').initiate('zarinpal', input)).rejects.toBeInstanceOf(BadRequestException);
  });
});
