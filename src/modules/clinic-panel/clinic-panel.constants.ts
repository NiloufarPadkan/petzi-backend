export enum ClinicPermission {
  RESERVATIONS_VIEW = 'reservations.view',
  RESERVATIONS_MANAGE = 'reservations.manage',
  RESERVATIONS_CANCEL = 'reservations.cancel',
  PATIENTS_VIEW = 'patients.view',
  PATIENTS_EDIT = 'patients.edit',
  FINANCE_VIEW = 'finance.view',
  REPORTS_VIEW = 'reports.view',
  SERVICES_MANAGE = 'settings.services',
  MEMBERS_MANAGE = 'settings.members',
  CLINIC_EDIT = 'settings.clinic',
}

export const ALL_CLINIC_PERMISSIONS = Object.values(ClinicPermission);

/** Grouped the way the role editor shows them. */
export const PERMISSION_GROUPS: {
  key: string;
  label: string;
  permissions: { key: ClinicPermission; label: string }[];
}[] = [
  {
    key: 'reservations',
    label: 'مدیریت نوبت‌ها',
    permissions: [
      { key: ClinicPermission.RESERVATIONS_VIEW, label: 'مشاهده نوبت‌ها' },
      {
        key: ClinicPermission.RESERVATIONS_MANAGE,
        label: 'ایجاد و ویرایش نوبت',
      },
      { key: ClinicPermission.RESERVATIONS_CANCEL, label: 'لغو نوبت' },
    ],
  },
  {
    key: 'patients',
    label: 'مدیریت بیماران',
    permissions: [
      { key: ClinicPermission.PATIENTS_VIEW, label: 'مشاهده پرونده بیماران' },
      {
        key: ClinicPermission.PATIENTS_EDIT,
        label: 'ویرایش اطلاعات بیماران',
      },
    ],
  },
  {
    key: 'finance',
    label: 'مالی و گزارش‌ها',
    permissions: [
      { key: ClinicPermission.FINANCE_VIEW, label: 'مشاهده گزارش مالی' },
      { key: ClinicPermission.REPORTS_VIEW, label: 'مشاهده گزارش نوبت‌ها' },
    ],
  },
  {
    key: 'settings',
    label: 'تنظیمات',
    permissions: [
      { key: ClinicPermission.SERVICES_MANAGE, label: 'مدیریت خدمات' },
      { key: ClinicPermission.MEMBERS_MANAGE, label: 'دعوت و مدیریت اعضا' },
      { key: ClinicPermission.CLINIC_EDIT, label: 'ویرایش اطلاعات کلینیک' },
    ],
  },
];

export enum ClinicMemberType {
  VET = 'vet',
  SECRETARY = 'secretary',
  TECHNICIAN = 'technician',
  ASSISTANT = 'assistant',
  OTHER = 'other',
}

export const DEFAULT_PANEL_NOTIFICATIONS: Record<string, boolean> = {
  liveAlerts: true,
  reservationReminders: true,
  patientMessages: true,
  paymentAlerts: true,
  cancellationAlerts: true,
  statusChangeAlerts: true,
  dailyReports: false,
  systemWarnings: true,
  generalAnnouncements: true,
};

export interface MemberShift {
  start: string;
  end: string;
}

export interface MemberWorkingDay {
  dayOfWeek: number;
  isClosed: boolean;
  shifts: MemberShift[];
}

export const MAX_RECORD_IMAGES = 10;
export const CLINIC_PANEL_PERMISSION_KEY = 'clinic_panel_permissions';

export const DEFAULT_ROLES: {
  key: string;
  name: string;
  color: string;
  permissions: ClinicPermission[];
  memberTypes: ClinicMemberType[];
}[] = [
  {
    key: 'vet',
    name: 'دامپزشک',
    color: '#7C3AED',
    permissions: [
      ClinicPermission.RESERVATIONS_VIEW,
      ClinicPermission.RESERVATIONS_MANAGE,
      ClinicPermission.PATIENTS_VIEW,
      ClinicPermission.PATIENTS_EDIT,
    ],
    memberTypes: [ClinicMemberType.VET],
  },
  {
    key: 'secretary',
    name: 'منشی',
    color: '#0EA5E9',
    permissions: [
      ClinicPermission.RESERVATIONS_VIEW,
      ClinicPermission.RESERVATIONS_MANAGE,
      ClinicPermission.RESERVATIONS_CANCEL,
      ClinicPermission.PATIENTS_VIEW,
    ],
    memberTypes: [ClinicMemberType.SECRETARY],
  },
  {
    key: 'technician',
    name: 'تکنسین',
    color: '#10B981',
    permissions: [
      ClinicPermission.RESERVATIONS_VIEW,
      ClinicPermission.PATIENTS_VIEW,
      ClinicPermission.PATIENTS_EDIT,
    ],
    memberTypes: [ClinicMemberType.TECHNICIAN, ClinicMemberType.ASSISTANT],
  },
];
