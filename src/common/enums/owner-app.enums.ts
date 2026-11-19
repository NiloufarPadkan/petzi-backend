export enum FavoriteType {
  VET = 'vet',
  CLINIC = 'clinic',
}

export enum PetEventType {
  VACCINATION = 'vaccination',
  DEWORMING = 'deworming',
  GROOMING = 'grooming',
  VET_VISIT = 'vet_visit',
  ILLNESS = 'illness',
  INJURY = 'injury',
  MEDICATION = 'medication',
  TRAINING = 'training',
  BIRTHDAY = 'birthday',
  OTHER = 'other',
}

export enum SurgeryStatus {
  SCHEDULED = 'scheduled',
  DONE = 'done',
  CANCELLED = 'cancelled',
}

export enum NotificationType {
  RESERVATION = 'reservation',
  VACCINE_REMINDER = 'vaccine_reminder',
  MEDICATION_REMINDER = 'medication_reminder',
  CHECKUP_REMINDER = 'checkup_reminder',
  PAYMENT = 'payment',
  DISCOUNT = 'discount',
  SYSTEM = 'system',
  GENERAL = 'general',
}

export enum DevicePlatform {
  ANDROID = 'android',
  IOS = 'ios',
  WEB = 'web',
}
