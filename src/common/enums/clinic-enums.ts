export enum ClinicType {
  CLINIC = 'clinic',
  HOSPITAL = 'hospital',
  SPECIALTY_CLINIC = 'specialty_clinic',
}

export enum ClinicVerificationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  NEEDS_EDIT = 'needs_edit',
}

export enum ClinicActivityStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum ClinicImageCategory {
  EXTERIOR = 'exterior',
  INTERIOR = 'interior',
  EQUIPMENT = 'equipment',
  STAFF = 'staff',
}

export enum ClinicLogType {
  ACCOUNT_CREATED = 'account_created',
  VERIFICATION_STATUS = 'verification_status',
  ACTIVITY_STATUS = 'activity_status',
  SCHEDULE_CHANGED = 'schedule_changed',
}
