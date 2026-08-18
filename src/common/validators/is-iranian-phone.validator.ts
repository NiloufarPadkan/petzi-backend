import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

const IRANIAN_PHONE_REGEX = /^(\+98|0)?9\d{9}$/;

@ValidatorConstraint({ name: 'isIranianPhone', async: false })
export class IsIranianPhoneConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;
    return IRANIAN_PHONE_REGEX.test(value.replace(/\s/g, ''));
  }

  defaultMessage(): string {
    return 'شماره موبایل باید یک شماره معتبر ایرانی باشد (مثال: 09123456789)';
  }
}

export function IsIranianPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsIranianPhoneConstraint,
    });
  };
}

export function normalizePhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\s/g, '');
  if (cleaned.startsWith('+98')) {
    return '0' + cleaned.slice(3);
  }
  if (cleaned.startsWith('98') && cleaned.length === 12) {
    return '0' + cleaned.slice(2);
  }
  return cleaned;
}
