import { AvailabilityService, iranianWeekday } from './availability.service';

describe('iranianWeekday', () => {
  it('numbers the week from Saturday', () => {
    expect(iranianWeekday('2025-01-04')).toBe(0); // Saturday
    expect(iranianWeekday('2025-01-05')).toBe(1); // Sunday
    expect(iranianWeekday('2025-01-08')).toBe(4); // Wednesday
    expect(iranianWeekday('2025-01-10')).toBe(6); // Friday
  });
});

describe('AvailabilityService.getSlots', () => {
  const vetId = 'vet-1';
  // Saturday 2025-01-04, 09:00–11:00 Tehran = 05:30–07:30 UTC.
  const SATURDAY = '2025-01-04';
  const row = {
    dayOfWeek: 0,
    isActive: true,
    morningEnabled: true,
    morningStart: '09:00',
    morningEnd: '11:00',
    morningMaxAppointments: null as number | null,
    eveningEnabled: false,
    eveningStart: null,
    eveningEnd: null,
    eveningMaxAppointments: null,
  };

  const build = (
    booked: { scheduledAt: Date; durationMinutes: number }[] = [],
    hours = [row],
  ) => {
    const repo = (value: unknown) => ({
      findOne: jest.fn().mockResolvedValue(value),
    });
    return new AvailabilityService(
      repo({ userId: vetId, clinicId: null }) as never,
      { find: jest.fn().mockResolvedValue(hours) } as never,
      { find: jest.fn().mockResolvedValue([]) } as never,
      repo(null) as never,
      repo(null) as never,
      { find: jest.fn().mockResolvedValue(booked) } as never,
    );
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2025-01-02T00:00:00Z'));
  });
  afterEach(() => jest.useRealTimers());

  it('cuts a shift into slots of the service duration', async () => {
    const [day] = await build().getSlots(vetId, { from: SATURDAY, days: 1 });
    expect(day.slots.map((s) => s.startsAt)).toEqual([
      '2025-01-04T05:30:00.000Z',
      '2025-01-04T06:00:00.000Z',
      '2025-01-04T06:30:00.000Z',
      '2025-01-04T07:00:00.000Z',
    ]);
  });

  it('uses the requested duration', async () => {
    const [day] = await build().getSlots(vetId, {
      from: SATURDAY,
      days: 1,
      durationMinutes: 60,
    });
    expect(day.slots).toHaveLength(2);
  });

  it('removes slots that overlap an active reservation', async () => {
    const booked = [
      { scheduledAt: new Date('2025-01-04T06:00:00Z'), durationMinutes: 30 },
    ];
    const [day] = await build(booked).getSlots(vetId, {
      from: SATURDAY,
      days: 1,
    });
    expect(day.slots.map((s) => s.startsAt)).not.toContain(
      '2025-01-04T06:00:00.000Z',
    );
    expect(day.slots).toHaveLength(3);
  });

  it('drops slots inside the booking cutoff window', async () => {
    // 05:00 UTC is 08:30 Tehran; with a 1h default cutoff 09:00 is too soon.
    jest.setSystemTime(new Date('2025-01-04T05:00:00Z'));
    const [day] = await build().getSlots(vetId, { from: SATURDAY, days: 1 });
    expect(day.slots[0].startsAt).toBe('2025-01-04T06:00:00.000Z');
  });

  it('stops offering a shift once its appointment cap is reached', async () => {
    const booked = [
      { scheduledAt: new Date('2025-01-04T05:30:00Z'), durationMinutes: 30 },
    ];
    const capped = { ...row, morningMaxAppointments: 1 };
    const [day] = await build(booked, [capped]).getSlots(vetId, {
      from: SATURDAY,
      days: 1,
    });
    expect(day.slots).toEqual([]);
  });

  it('rejects a slot that is not free', async () => {
    const service = build();
    await expect(
      service.assertSlotAvailable(vetId, new Date('2025-01-04T05:45:00Z'), 30),
    ).rejects.toThrow('این زمان دیگر در دسترس نیست');
    await expect(
      service.assertSlotAvailable(vetId, new Date('2025-01-04T06:00:00Z'), 30),
    ).resolves.toBeUndefined();
  });

  it('offers nothing for a vet with no schedule', async () => {
    const [day] = await build([], []).getSlots(vetId, {
      from: SATURDAY,
      days: 1,
    });
    expect(day.slots).toEqual([]);
  });
});
