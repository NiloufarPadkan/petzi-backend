import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type {
  GatewayInitiateInput,
  GatewayInitiateResult,
  GatewaySettings,
  GatewayVerifyInput,
  GatewayVerifyResult,
  PaymentGatewayProvider,
} from './gateway.types';

const TIMEOUT_MS = 15_000;
const RIAL_PER_TOMAN = 10;

interface ZarinpalResponse<T> {
  data?: T | [];
  errors?: { code?: number; message?: string } | unknown[];
}

/** Zarinpal REST API v4. Amounts go out in Rial (10 Rial = 1 Toman). */
@Injectable()
export class ZarinpalProvider implements PaymentGatewayProvider {
  readonly code = 'zarinpal';

  async initiate(
    settings: GatewaySettings,
    input: GatewayInitiateInput,
  ): Promise<GatewayInitiateResult> {
    const merchantId = this.requireMerchant(settings);
    const body = await this.post<{ code: number; authority: string }>(
      settings,
      'request',
      {
        merchant_id: merchantId,
        amount: input.amountToman * RIAL_PER_TOMAN,
        callback_url: input.callbackUrl,
        description: input.description,
      },
    );
    if (body.code !== 100 || !body.authority) {
      throw new BadGatewayException('درگاه پرداخت درخواست را نپذیرفت');
    }
    const host = settings.sandbox ? 'sandbox.zarinpal.com' : 'www.zarinpal.com';
    return {
      authority: body.authority,
      redirectUrl: `https://${host}/pg/StartPay/${body.authority}`,
    };
  }

  async verify(
    settings: GatewaySettings,
    input: GatewayVerifyInput,
  ): Promise<GatewayVerifyResult> {
    const merchantId = this.requireMerchant(settings);
    const body = await this.post<{
      code: number;
      ref_id?: number;
      card_pan?: string;
    }>(settings, 'verify', {
      merchant_id: merchantId,
      amount: input.amountToman * RIAL_PER_TOMAN,
      authority: input.authority,
    });
    // 100 = verified now, 101 = it was already verified.
    const success = body.code === 100 || body.code === 101;
    return {
      success,
      referenceId: body.ref_id !== undefined ? String(body.ref_id) : undefined,
      cardPan: body.card_pan,
      message: success ? undefined : `کد خطای درگاه: ${body.code}`,
    };
  }

  private requireMerchant(settings: GatewaySettings): string {
    if (!settings.merchantId) {
      throw new ServiceUnavailableException(
        'شناسه پذیرنده درگاه تنظیم نشده است',
      );
    }
    return settings.merchantId;
  }

  private async post<T>(
    settings: GatewaySettings,
    action: 'request' | 'verify',
    payload: Record<string, unknown>,
  ): Promise<T> {
    const host = settings.sandbox ? 'sandbox.zarinpal.com' : 'api.zarinpal.com';
    let response: Response;
    try {
      response = await fetch(`https://${host}/pg/v4/payment/${action}.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new BadGatewayException('ارتباط با درگاه پرداخت برقرار نشد');
    }
    const json = (await response
      .json()
      .catch(() => ({}))) as ZarinpalResponse<T>;
    const data = json.data;
    if (!data || Array.isArray(data)) {
      // The API reports failures as `errors` with an empty `data`.
      const errors = json.errors as { code?: number } | undefined;
      return { code: errors?.code ?? -1 } as T;
    }
    return data;
  }
}
