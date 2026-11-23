import { ConflictException } from '@nestjs/common';
import {
  PaymentStatus,
  ReservationStatus,
} from '../../common/enums/admin-panel.enums';
import type { Payment } from '../payments/entities/payment.entity';
import type { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationPaymentsService } from './reservation-payments.service';

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
const reservation = (overrides: Partial<Reservation> = {}) =>
  ({
    id: 'r1',
    ownerId: 'o1',
    status: ReservationStatus.CONFIRMED,
    scheduledAt: new Date(Date.now() + 86_400_000),
    price: 250_000,
    serviceName: 'معاینه',
    ...overrides,
  }) as Reservation;
const payment = (status: PaymentStatus, createdAt: Date) =>
  ({ reservationId: 'r1', status, createdAt }) as Payment;

function service(payments: Payment[], found?: Reservation) {
  const paymentsRepository = {
    // The service asks for newest first.
    find: jest.fn().mockResolvedValue(
      [...payments].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    ),
  };
  const reservationsRepository = { findOne: jest.fn().mockResolvedValue(found) };
  return new ReservationPaymentsService(
    paymentsRepository as never,
    reservationsRepository as never,
    {} as never,
    {} as never,
    { get: () => undefined } as never,
    {} as never,
  );
}

async function stateOf(payments: Payment[], r = reservation()) {
  return (await service(payments).stateFor([r])).get(r.id)!;
}

describe('ReservationPaymentsService.stateFor', () => {
  it('is unpaid and payable with no payments', async () => {
    expect(await stateOf([])).toEqual({ paymentStatus: 'unpaid', canPay: true });
  });

  it('is paid once any payment succeeded', async () => {
    expect(
      await stateOf([
        payment(PaymentStatus.FAILED, minutesAgo(10)),
        payment(PaymentStatus.SUCCESS, minutesAgo(5)),
      ]),
    ).toEqual({ paymentStatus: 'paid', canPay: false });
  });

  it('is pending while the newest attempt is recent and unfinished', async () => {
    expect((await stateOf([payment(PaymentStatus.PENDING, minutesAgo(2))])).paymentStatus).toBe('pending');
  });

  it('ignores an abandoned attempt once a newer one failed', async () => {
    expect(
      (
        await stateOf([
          payment(PaymentStatus.PENDING, minutesAgo(10)),
          payment(PaymentStatus.FAILED, minutesAgo(1)),
        ])
      ).paymentStatus,
    ).toBe('unpaid');
  });

  it('treats a stale pending attempt as unpaid', async () => {
    expect((await stateOf([payment(PaymentStatus.PENDING, minutesAgo(45))])).paymentStatus).toBe('unpaid');
  });

  it('cannot pay for past, cancelled, completed or free reservations', async () => {
    for (const r of [
      reservation({ scheduledAt: minutesAgo(1) }),
      reservation({ status: ReservationStatus.CANCELLED }),
      reservation({ status: ReservationStatus.COMPLETED }),
      reservation({ price: 0 }),
    ]) {
      expect((await stateOf([], r)).canPay).toBe(false);
    }
  });
});

describe('ReservationPaymentsService.checkout', () => {
  it('refuses to charge a reservation that is already paid', async () => {
    const svc = service([payment(PaymentStatus.SUCCESS, minutesAgo(5))], reservation());
    await expect(svc.checkout('o1', 'r1')).rejects.toBeInstanceOf(ConflictException);
  });
});
