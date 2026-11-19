import { SettingsGroup } from '../../common/enums/admin-panel.enums';

export type SettingType = 'boolean' | 'string' | 'number' | 'array';

export interface SettingField {
  type: SettingType;
  default: unknown;
  /** Secrets are masked on read and ignored on write when sent back masked. */
  secret?: boolean;
  /** Long free text (legal pages) instead of a short line. */
  long?: boolean;
}

const bool = (value: boolean): SettingField => ({
  type: 'boolean',
  default: value,
});
const str = (value: string, secret = false): SettingField => ({
  type: 'string',
  default: value,
  secret,
});
const longText = (value: string): SettingField => ({
  type: 'string',
  default: value,
  long: true,
});
const num = (value: number): SettingField => ({
  type: 'number',
  default: value,
});

export const SECRET_MASK = '********';

export const SETTINGS_SCHEMA: Record<
  SettingsGroup,
  Record<string, SettingField>
> = {
  [SettingsGroup.GENERAL]: {
    systemName: str('پتزی'),
    logoUrl: str(''),
    primaryColor: str('#7C3AED'),
    secondaryColor: str('#F59E0B'),
    twoFactorLogin: bool(false),
    auditLog: bool(true),
    maintenanceMode: bool(false),
    supportPhone: str(''),
    supportEmail: str(''),
    supportHours: str(''),
    termsText: longText(''),
    privacyText: longText(''),
    aboutText: longText(''),
  },
  [SettingsGroup.SECURITY]: {
    lockAfterFailedAttempts: bool(true),
    maxFailedAttempts: num(5),
    lockMinutes: num(15),
    forceTwoFactor: bool(false),
    forcePasswordRotation: bool(false),
    passwordRotationDays: num(90),
    maxConcurrentSessions: num(3),
    autoLogoutOnIdle: bool(true),
    idleTimeoutMinutes: num(30),
    minPasswordLength: num(8),
    requireSpecialChars: bool(false),
    requireNumbers: bool(true),
    requireMixedCase: bool(false),
  },
  [SettingsGroup.EMAIL_SMS]: {
    emailEnabled: bool(false),
    smtpHost: str(''),
    smtpPort: num(587),
    smtpSecure: bool(false),
    smtpUser: str(''),
    smtpPassword: str('', true),
    emailFrom: str(''),
    smsEnabled: bool(false),
    smsProvider: str(''),
    smsApiKey: str('', true),
    smsSender: str(''),
  },
  [SettingsGroup.PAYMENT_GATEWAYS]: {
    /** [{ code, name, enabled, merchantId?, apiKey? }] */
    gateways: { type: 'array', default: [] },
    sandboxMode: bool(true),
    currency: str('IRT'),
    minTransactionAmount: num(0),
    maxTransactionAmount: num(0),
    autoSendReceipt: bool(true),
  },
  [SettingsGroup.BACKUP]: {
    autoBackupEnabled: bool(false),
    frequency: str('daily'),
    backupTime: str('03:00'),
    retentionCount: num(7),
  },
  [SettingsGroup.OTHER]: {
    smsAlerts: bool(false),
    emailAlerts: bool(false),
    inAppAlerts: bool(true),
    dataRetentionDays: num(365),
    autoCleanup: bool(false),
    webhookEnabled: bool(false),
    webhookUrl: str(''),
    webhookSecret: str('', true),
  },
  [SettingsGroup.NOTIFICATIONS]: {
    notifyReservationCancelled: bool(true),
    notifyNewUser: bool(true),
    notifyNewReservation: bool(true),
    notifyErrorReport: bool(true),
    notifyPaymentSuccess: bool(true),
    emailReminder: bool(true),
    emailWelcome: bool(true),
    emailReservationConfirm: bool(true),
    smsCancel: bool(true),
    smsReminder: bool(true),
    smsConfirm: bool(true),
    pushEnabled: bool(true),
  },
};
