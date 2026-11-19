export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  ONLINE = 'online',
  CASH = 'cash',
  WALLET = 'wallet',
}

export enum PaymentPurpose {
  RESERVATION = 'reservation',
  SUBSCRIPTION = 'subscription',
}

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
}

export enum TicketPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
}

export enum MessageSenderRole {
  ADMIN = 'admin',
  USER = 'user',
}

export enum OrganizationKind {
  PETSHOP = 'petshop',
  SHELTER = 'shelter',
}

export enum SettingsGroup {
  GENERAL = 'general',
  SECURITY = 'security',
  EMAIL_SMS = 'email_sms',
  PAYMENT_GATEWAYS = 'payment_gateways',
  BACKUP = 'backup',
  OTHER = 'other',
  NOTIFICATIONS = 'notifications',
}
