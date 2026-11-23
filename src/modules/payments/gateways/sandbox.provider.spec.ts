import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SandboxProvider } from './sandbox.provider';

const settings = { code: 'sandbox', sandbox: true };
const input = {
  paymentId: '11111111-1111-4111-8111-111111111111',
  amountToman: 250_000,
  description: 'پرداخت رزرو',
  callbackUrl: 'http://api.test/api/v1/reservations/payments/callback?paymentId=p1',
};

function provider(nodeEnv = 'development') {
  const config = {
    get: (key: string) =>
      ({ nodeEnv, appUrl: 'http://api.test/' })[key as 'nodeEnv' | 'appUrl'],
  } as unknown as ConfigService;
  return new SandboxProvider(config);
}

describe('SandboxProvider', () => {
  it('sends the payer to the sandbox page on the API origin', async () => {
    const result = await provider().initiate(settings, input);
    expect(result.authority).toMatch(/^SBX-/);
    expect(result.redirectUrl).toBe(
      `http://api.test/api/v1/payments/sandbox/${result.authority}`,
    );
  });

  it('approving redirects to the callback with Status=OK and verifies', async () => {
    const sandbox = provider();
    const { authority } = await sandbox.initiate(settings, input);
    const url = new URL(sandbox.decide(authority, 'paid'));
    expect(url.searchParams.get('paymentId')).toBe('p1');
    expect(url.searchParams.get('Authority')).toBe(authority);
    expect(url.searchParams.get('Status')).toBe('OK');
    const verified = await sandbox.verify(settings, {
      authority,
      amountToman: input.amountToman,
    });
    expect(verified.success).toBe(true);
    expect(verified.referenceId).toMatch(/^SBX-REF-/);
  });

  it('cancelling redirects with Status=NOK and does not verify', async () => {
    const sandbox = provider();
    const { authority } = await sandbox.initiate(settings, input);
    expect(new URL(sandbox.decide(authority, 'cancelled')).searchParams.get('Status')).toBe('NOK');
    const verified = await sandbox.verify(settings, {
      authority,
      amountToman: input.amountToman,
    });
    expect(verified.success).toBe(false);
  });

  it('keeps the first decision', async () => {
    const sandbox = provider();
    const { authority } = await sandbox.initiate(settings, input);
    sandbox.decide(authority, 'cancelled');
    expect(new URL(sandbox.decide(authority, 'paid')).searchParams.get('Status')).toBe('NOK');
  });

  it('rejects a verify with a different amount', async () => {
    const sandbox = provider();
    const { authority } = await sandbox.initiate(settings, input);
    sandbox.decide(authority, 'paid');
    const verified = await sandbox.verify(settings, { authority, amountToman: 1 });
    expect(verified.success).toBe(false);
  });

  it('reports unknown sessions', async () => {
    const sandbox = provider();
    expect(() => sandbox.getSession('SBX-missing')).toThrow(NotFoundException);
    expect((await sandbox.verify(settings, { authority: 'SBX-missing', amountToman: 1 })).success).toBe(false);
  });

  it('refuses to run in production', () => {
    const sandbox = provider('production');
    expect(sandbox.enabled).toBe(false);
    expect(() => sandbox.initiate(settings, input)).toThrow(ForbiddenException);
  });
});
