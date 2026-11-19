import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SettingsGroup } from '../../../common/enums/admin-panel.enums';
import { SettingsService } from '../../settings/settings.service';
import type {
  GatewayInitiateInput,
  GatewayInitiateResult,
  GatewaySettings,
  GatewayVerifyInput,
  GatewayVerifyResult,
  PaymentGatewayProvider,
} from './gateway.types';
import { MockProvider } from './mock.provider';
import { ZarinpalProvider } from './zarinpal.provider';

interface ConfiguredGateway {
  code: string;
  enabled: boolean;
  merchantId?: string;
  apiKey?: string;
}

/**
 * Picks a payment provider from the admin "payment gateways" settings. With
 * nothing enabled, development falls back to the mock provider; production
 * refuses to take payments.
 */
@Injectable()
export class PaymentGatewayService {
  private readonly providers: Map<string, PaymentGatewayProvider>;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly configService: ConfigService,
    zarinpal: ZarinpalProvider,
    mock: MockProvider,
  ) {
    this.providers = new Map([zarinpal, mock].map((p) => [p.code, p]));
  }

  async initiate(
    requestedCode: string | undefined,
    input: GatewayInitiateInput,
  ): Promise<GatewayInitiateResult & { gatewayCode: string }> {
    const { provider, settings } = await this.resolve(requestedCode);
    const result = await provider.initiate(settings, input);
    return { ...result, gatewayCode: provider.code };
  }

  async verify(
    gatewayCode: string,
    input: GatewayVerifyInput,
  ): Promise<GatewayVerifyResult> {
    const { provider, settings } = await this.resolve(gatewayCode);
    return provider.verify(settings, input);
  }

  private async resolve(requestedCode?: string) {
    const values = await this.settingsService.getRawGroup(
      SettingsGroup.PAYMENT_GATEWAYS,
    );
    const gateways = (values['gateways'] as ConfiguredGateway[]) ?? [];
    const sandbox = values['sandboxMode'] !== false;
    const production =
      this.configService.get<string>('nodeEnv') === 'production';

    const enabled = gateways.filter((g) => g.enabled);
    const chosen = requestedCode
      ? enabled.find((g) => g.code === requestedCode)
      : enabled[0];

    if (requestedCode && !chosen && requestedCode !== 'mock') {
      throw new BadRequestException('درگاه انتخاب‌شده فعال نیست');
    }
    if (chosen) {
      const provider = this.providers.get(chosen.code);
      if (!provider) {
        throw new ServiceUnavailableException(
          `پیاده‌سازی درگاه «${chosen.code}» وجود ندارد`,
        );
      }
      const settings: GatewaySettings = {
        code: chosen.code,
        merchantId: chosen.merchantId,
        apiKey: chosen.apiKey,
        sandbox,
      };
      return { provider, settings };
    }

    if (production) {
      throw new ServiceUnavailableException(
        'درگاه پرداخت فعالی تنظیم نشده است',
      );
    }
    return {
      provider: this.providers.get('mock')!,
      settings: { code: 'mock', sandbox: true } satisfies GatewaySettings,
    };
  }
}
