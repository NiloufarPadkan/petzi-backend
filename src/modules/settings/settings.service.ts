import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SettingsGroup } from '../../common/enums/admin-panel.enums';
import { SmsService } from '../sms/sms.service';
import { SystemSetting } from './entities/system-setting.entity';
import { SECRET_MASK, SETTINGS_SCHEMA, SettingField } from './settings.schema';

type SettingValues = Record<string, unknown>;

interface GatewayConfig {
  code: string;
  name: string;
  enabled: boolean;
  merchantId?: string;
  apiKey?: string;
}

const MAX_STRING_LENGTH = 500;
const MAX_GATEWAYS = 20;

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(SystemSetting)
    private readonly settingsRepository: Repository<SystemSetting>,
    private readonly smsService: SmsService,
  ) {}

  /** Every group with defaults applied, secrets masked. */
  async getAll(): Promise<Record<SettingsGroup, SettingValues>> {
    const rows = await this.settingsRepository.find();
    const stored = new Map(rows.map((row) => [row.group, row.values]));
    const result = {} as Record<SettingsGroup, SettingValues>;
    for (const group of Object.values(SettingsGroup)) {
      result[group] = this.mask(
        group,
        this.withDefaults(group, stored.get(group)),
      );
    }
    return result;
  }

  async getGroup(group: SettingsGroup): Promise<SettingValues> {
    return this.mask(group, await this.getRawGroup(group));
  }

  /** Unmasked values for server-side use (never return these over HTTP). */
  async getRawGroup(group: SettingsGroup): Promise<SettingValues> {
    const row = await this.settingsRepository.findOne({ where: { group } });
    return this.withDefaults(group, row?.values);
  }

  async updateGroup(
    group: SettingsGroup,
    input: Record<string, unknown>,
    actorId: string,
  ): Promise<SettingValues> {
    const schema = SETTINGS_SCHEMA[group];
    const current = await this.getRawGroup(group);
    const next: SettingValues = { ...current };

    for (const [key, value] of Object.entries(input ?? {})) {
      const field = schema[key];
      if (!field) {
        throw new BadRequestException(
          `تنظیم «${key}» برای این بخش تعریف نشده است`,
        );
      }
      if (field.secret && value === SECRET_MASK) continue;
      next[key] =
        key === 'gateways'
          ? this.validateGateways(value, current['gateways'])
          : this.validateValue(key, field, value);
    }

    await this.settingsRepository.save({
      group,
      values: next,
      updatedById: actorId,
    });
    return this.mask(group, next);
  }

  async sendTestSms(phoneNumber: string, message?: string): Promise<void> {
    const values = await this.getRawGroup(SettingsGroup.EMAIL_SMS);
    if (values['smsEnabled'] !== true) {
      throw new BadRequestException('ارسال پیامک در تنظیمات فعال نشده است');
    }
    await this.smsService.sendText(
      phoneNumber,
      message?.trim() || 'این یک پیامک آزمایشی از پنل مدیریت پتزی است.',
    );
  }

  private withDefaults(
    group: SettingsGroup,
    stored?: SettingValues,
  ): SettingValues {
    const values: SettingValues = {};
    for (const [key, field] of Object.entries(SETTINGS_SCHEMA[group])) {
      values[key] = stored?.[key] ?? field.default;
    }
    return values;
  }

  private mask(group: SettingsGroup, values: SettingValues): SettingValues {
    const masked: SettingValues = { ...values };
    for (const [key, field] of Object.entries(SETTINGS_SCHEMA[group])) {
      if (field.secret && masked[key]) masked[key] = SECRET_MASK;
    }
    if (Array.isArray(masked['gateways'])) {
      masked['gateways'] = (masked['gateways'] as GatewayConfig[]).map(
        (gateway) => ({
          ...gateway,
          apiKey: gateway.apiKey ? SECRET_MASK : undefined,
        }),
      );
    }
    return masked;
  }

  private validateValue(key: string, field: SettingField, value: unknown) {
    switch (field.type) {
      case 'boolean':
        if (typeof value !== 'boolean')
          this.invalid(key, 'باید درست/نادرست باشد');
        return value;
      case 'number':
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
          this.invalid(key, 'باید عدد غیرمنفی باشد');
        }
        return value;
      case 'string':
        if (typeof value !== 'string' || value.length > MAX_STRING_LENGTH) {
          this.invalid(key, 'باید متن کوتاه‌تر از ۵۰۰ کاراکتر باشد');
        }
        if (key === 'webhookUrl' && value && !/^https?:\/\//i.test(value)) {
          this.invalid(key, 'باید با http:// یا https:// شروع شود');
        }
        return value.trim();
      default:
        return value;
    }
  }

  private validateGateways(value: unknown, current: unknown): GatewayConfig[] {
    if (!Array.isArray(value) || value.length > MAX_GATEWAYS) {
      this.invalid('gateways', 'باید فهرستی از درگاه‌ها باشد');
    }
    const previous = new Map(
      ((current as GatewayConfig[] | undefined) ?? []).map((g) => [g.code, g]),
    );
    const seen = new Set<string>();
    return (value as Record<string, unknown>[]).map((item) => {
      const { code, name, enabled, merchantId, apiKey } = item ?? {};
      if (
        typeof code !== 'string' ||
        !/^[a-z0-9_-]{2,30}$/i.test(code) ||
        typeof name !== 'string' ||
        !name.trim() ||
        typeof enabled !== 'boolean'
      ) {
        this.invalid(
          'gateways',
          'هر درگاه به کد، نام و وضعیت فعال بودن نیاز دارد',
        );
      }
      if (seen.has(code)) {
        this.invalid('gateways', 'کد درگاه‌ها نباید تکراری باشد');
      }
      seen.add(code);
      for (const secretish of [merchantId, apiKey]) {
        if (
          secretish !== undefined &&
          (typeof secretish !== 'string' ||
            secretish.length > MAX_STRING_LENGTH)
        ) {
          this.invalid('gateways', 'اطلاعات درگاه نامعتبر است');
        }
      }
      return {
        code: code,
        name: name.trim(),
        enabled: enabled,
        merchantId: (merchantId as string | undefined) || undefined,
        // A masked key means "unchanged".
        apiKey:
          apiKey === SECRET_MASK
            ? previous.get(code)?.apiKey
            : (apiKey as string | undefined) || undefined,
      };
    });
  }

  private invalid(key: string, reason: string): never {
    throw new BadRequestException(`مقدار «${key}» نامعتبر است: ${reason}`);
  }
}
