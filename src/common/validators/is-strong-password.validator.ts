import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isStrongPassword', async: false })
export class IsStrongPasswordConstraint implements ValidatorConstraintInterface {
  validate(value: string): boolean {
    if (typeof value !== 'string') return false;
    if (value.length < 8) return false;
    if (!/\d/.test(value)) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(value)) return false;
    return true;
  }

  defaultMessage(): string {
    return 'رمز عبور باید حداقل ۸ کاراکتر، شامل عدد، حروف بزرگ و کوچک انگلیسی و یک کاراکتر خاص باشد';
  }
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsStrongPasswordConstraint,
    });
  };
}
