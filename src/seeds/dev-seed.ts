/**
 * Development seed: clinics, vets, services, hours, gallery images, approved
 * reviews, demo/reviewer pets with weight/vaccine/med/event history, and
 * reservations, so every owner-app screen (including charts) has real API data.
 * Idempotent (fixed ids, ON CONFLICT DO NOTHING).
 *
 *   npm run seed:dev                      # from source (needs DB access)
 *   docker exec petzi-backend-api-1 node dist/seeds/dev-seed.js
 *   npm run seed:fill-pets                # enrich ALL active pets in the DB
 *
 * Demo owner login: 09120000000 (OTP is logged by the mock SMS provider).
 * Refuses to run when NODE_ENV=production.
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { QueryRunner } from 'typeorm';
import { AppDataSource } from '../config/data-source';

if (process.env.NODE_ENV === 'production') {
  console.error('dev-seed: refusing to run with NODE_ENV=production');
  process.exit(1);
}

const id = (group: number, n: number) =>
  `5eed0000-0000-4000-8${group.toString().padStart(3, '0')}-${n.toString().padStart(12, '0')}`;

const ASSETS = join(__dirname, 'assets');
const UPLOADS = join(process.cwd(), 'uploads');

/** Copies a seed image into an uploads folder and returns its public URL. */
function upload(file: string, folder: 'clinic-media' | 'profile-pictures') {
  const source = join(ASSETS, file);
  if (!existsSync(source)) return null;
  const dir = join(UPLOADS, folder);
  mkdirSync(dir, { recursive: true });
  const name = `seed-${file}`;
  copyFileSync(source, join(dir, name));
  return `/uploads/${folder}/${name}`;
}

async function insert(
  runner: QueryRunner,
  table: string,
  rows: Record<string, unknown>[],
  conflict = '"id"',
) {
  for (const row of rows) {
    const columns = Object.keys(row);
    await runner.query(
      `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (${conflict}) DO NOTHING`,
      Object.values(row),
    );
  }
}

const days = (n: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  d.setUTCHours(hour - 3, 30, 0, 0); // Tehran ≈ UTC+3:30
  return d.toISOString();
};

async function main() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.startTransaction();
  try {
    const now = new Date().toISOString();

    // ---- people ----
    const owner = id(1, 1);
    const reviewers = [id(1, 2), id(1, 3), id(1, 4)];
    const clinicUsers = [id(2, 1), id(2, 2)];
    const vets = [id(3, 1), id(3, 2), id(3, 3), id(3, 4)];
    const vetPhoto = upload('vet-hero.png', 'profile-pictures');
    const reviewerPhoto = upload('reviewer.png', 'profile-pictures');

    const user = (
      uid: string,
      phone: string,
      fullName: string,
      role: string,
      profilePictureUrl: string | null = null,
    ) => ({
      id: uid,
      phoneNumber: phone,
      fullName,
      role,
      profilePictureUrl,
      isPhoneVerified: true,
      isEmailVerified: false,
      notificationPreferences: '{}',
      twoFactorEnabled: false,
      tokenVersion: 0,
      isSuspended: false,
      createdAt: now,
      updatedAt: now,
    });
    await insert(runner, 'users', [
      user(owner, '09120000000', 'کاربر نمونه', 'user'),
      user(reviewers[0], '09120000002', 'نگار حسینی', 'user', reviewerPhoto),
      user(reviewers[1], '09120000003', 'امیر جعفری', 'user'),
      user(reviewers[2], '09120000004', 'الهام صادقی', 'user'),
      user(clinicUsers[0], '09120000010', 'کلینیک دامپزشکی آوا', 'clinic'),
      user(clinicUsers[1], '09120000011', 'بیمارستان دامپزشکی مهر', 'clinic'),
      user(vets[0], '09120000020', 'دکتر سارا احمدی', 'vet', vetPhoto),
      user(vets[1], '09120000021', 'دکتر علی رضایی', 'vet'),
      user(vets[2], '09120000022', 'دکتر مریم کریمی', 'vet'),
      user(vets[3], '09120000023', 'دکتر نیما موسوی', 'vet'),
    ]);

    // ---- clinics ----
    const cover = upload('hero.png', 'clinic-media');
    await insert(
      runner,
      'clinics',
      [
        {
          userId: clinicUsers[0],
          name: 'کلینیک دامپزشکی آوا',
          type: 'clinic',
          about:
            'کلینیک آوا با تیمی از دامپزشکان باتجربه، خدمات معاینه، واکسیناسیون، جراحی‌های سرپایی و مراقبت‌های دوره‌ای را برای سگ، گربه، پرندگان و جوندگان ارائه می‌دهد.',
          phone: '01333334444',
          province: 'گیلان',
          city: 'رشت',
          address: 'رشت، بلوار دیلمان، نبش کوچه ۱۲',
          latitude: 37.2808,
          longitude: 49.5832,
          coverImageUrl: cover,
          acceptsOnlineBooking: true,
          isListedInSearch: true,
          verificationStatus: 'approved',
          activityStatus: 'active',
          createdAt: now,
          updatedAt: now,
        },
        {
          userId: clinicUsers[1],
          name: 'بیمارستان دامپزشکی مهر',
          type: 'hospital',
          about:
            'بیمارستان شبانه‌روزی مهر با بخش اورژانس، تصویربرداری و آزمایشگاه، آماده پذیرش موارد حاد و جراحی‌های تخصصی است.',
          phone: '02188889999',
          province: 'تهران',
          city: 'تهران',
          address: 'تهران، خیابان شریعتی، بالاتر از پل صدر',
          latitude: 35.7741,
          longitude: 51.4387,
          acceptsOnlineBooking: true,
          isListedInSearch: true,
          verificationStatus: 'approved',
          activityStatus: 'active',
          createdAt: now,
          updatedAt: now,
        },
      ],
      '"userId"',
    );
    const gallery = [
      ['hero.png', 'نمای ورودی کلینیک', 'exterior'],
      ['gallery-1.png', 'سالن انتظار', 'interior'],
      ['gallery-3.png', 'اتاق معاینه', 'equipment'],
      ['gallery-4.png', 'تیم دامپزشکی', 'staff'],
    ] as const;
    await insert(
      runner,
      'clinic_images',
      gallery.flatMap(([file, title, category], i) => {
        const fileUrl = upload(file, 'clinic-media');
        return fileUrl
          ? [{ id: id(4, i + 1), clinicId: clinicUsers[0], title, category, fileUrl }]
          : [];
      }),
    );
    const clinicServices: [string, string, string, number, number][] = [
      [clinicUsers[0], 'معاینه عمومی', 'checkup', 250_000, 30],
      [clinicUsers[0], 'واکسیناسیون', 'vaccine', 180_000, 20],
      [clinicUsers[0], 'آزمایش خون', 'lab', 420_000, 20],
      [clinicUsers[0], 'چکاپ کامل', 'checkup', 650_000, 45],
      [clinicUsers[1], 'ویزیت اورژانس', 'emergency', 500_000, 30],
      [clinicUsers[1], 'سونوگرافی', 'imaging', 900_000, 30],
      [clinicUsers[1], 'جراحی عقیم‌سازی', 'surgery', 3_500_000, 90],
    ];
    await insert(
      runner,
      'clinic_services',
      clinicServices.map(([clinicId, name, category, basePrice, durationMinutes], i) => ({
        id: id(5, i + 1),
        clinicId,
        name,
        category,
        basePrice,
        durationMinutes,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
    // Saturday (0) … Thursday (5) open; Friday (6) closed.
    await insert(
      runner,
      'clinic_working_hours',
      clinicUsers.flatMap((clinicId, c) =>
        [0, 1, 2, 3, 4, 5].map((day) => ({
          id: id(6, c * 10 + day + 1),
          clinicId,
          dayOfWeek: day,
          isActive: true,
          morningEnabled: true,
          morningStart: '09:00',
          morningEnd: '13:00',
          eveningEnabled: true,
          eveningStart: '16:00',
          eveningEnd: '20:00',
        })),
      ),
    );

    // ---- vets ----
    const profile = (
      userId: string,
      council: string,
      city: string,
      specialty: string,
      graduationYear: number,
      bio: string,
      clinicId: string | null,
    ) => ({
      userId,
      medicalCouncilNumber: council,
      city,
      primarySpecialty: specialty,
      subSpecialties: '{}',
      languages: '{فارسی}',
      highestDegree: 'دکترای عمومی دامپزشکی',
      university: 'دانشگاه تهران',
      graduationYear,
      bio,
      clinicId,
      verificationStatus: 'approved',
      collaborationStatus: 'active',
      createdAt: now,
      updatedAt: now,
    });
    await insert(
      runner,
      'vet_profiles',
      [
        profile(vets[0], '۱۲۴۴۵۶', 'رشت', 'داخلی دام کوچک', 2012, 'متخصص بیماری‌های داخلی سگ و گربه با تمرکز بر مراقبت‌های پیشگیرانه و تغذیه.', clinicUsers[0]),
        profile(vets[1], '۱۳۸۹۰۲', 'رشت', 'جراحی', 2015, 'جراح دام کوچک؛ جراحی‌های بافت نرم و ارتوپدی.', clinicUsers[0]),
        profile(vets[2], '۱۴۵۵۷۱', 'تهران', 'پوست', 2010, 'درمان بیماری‌های پوستی و آلرژی در حیوانات خانگی.', clinicUsers[1]),
        profile(vets[3], '۱۵۰۲۳۸', 'تهران', 'دندانپزشکی', 2018, 'جرم‌گیری، کشیدن دندان و مراقبت دهان و دندان.', null),
      ],
      '"userId"',
    );
    // Vets 1–3 use their clinic's services; vet 4 (independent) has its own.
    await insert(
      runner,
      'vet_services',
      [
        ['ویزیت و معاینه دندان', 'checkup', 300_000, 30],
        ['جرم‌گیری', 'dental', 1_200_000, 60],
      ].map(([name, category, basePrice, durationMinutes], i) => ({
        id: id(7, i + 1),
        vetId: vets[3],
        name,
        category,
        basePrice,
        durationMinutes,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await insert(
      runner,
      'vet_working_hours',
      vets.flatMap((vetId, v) =>
        [0, 1, 2, 3, 4].map((day) => ({
          id: id(8, v * 10 + day + 1),
          vetId,
          dayOfWeek: day,
          isActive: true,
          morningEnabled: true,
          morningStart: '09:00',
          morningEnd: '13:00',
          eveningEnabled: v % 2 === 0,
          eveningStart: v % 2 === 0 ? '16:00' : null,
          eveningEnd: v % 2 === 0 ? '19:00' : null,
        })),
      ),
    );

    // ---- demo owner + reviewer pets ----
    const pets = [
      id(9, 1),
      id(9, 2),
      id(9, 3),
      id(9, 4),
      id(9, 5),
      id(9, 6),
      id(9, 7),
      id(9, 8),
    ];
    const ymd = (daysAgo: number) => {
      const d = new Date();
      d.setUTCHours(12, 0, 0, 0);
      d.setUTCDate(d.getUTCDate() - daysAgo);
      return d.toISOString().slice(0, 10);
    };
    const petRow = (
      n: number,
      ownerId: string,
      name: string,
      type: string,
      breed: string,
      gender: string,
      birthDate: string,
      weight: number,
      height: number,
      healthStatus: string,
      vaccinationStatus: string,
      allergies: string,
      underlyingDiseases: string,
      foodType: string,
      foodBrand: string,
      mealsPerDay: string,
    ) => ({
      id: pets[n],
      ownerId,
      status: 'active',
      name,
      type,
      breed,
      gender,
      birthDate,
      weight,
      height,
      healthStatus,
      vaccinationStatus,
      allergies,
      underlyingDiseases,
      medications: 'None',
      healthNotes: null,
      foodType,
      foodBrand,
      mealsPerDay,
      foodSensitivities: 'None',
      lastDewormingDate: ymd(45 + n * 7),
      dewormingType: 'خوراکی',
      createdAt: now,
      updatedAt: now,
    });
    await insert(runner, 'pets', [
      petRow(0, owner, 'پیشی', 'cat', 'پرشین', 'female', '2022-03-10', 4.2, 24, 'excellent', 'complete', 'ندارد', 'ندارد', 'dry', 'رویال کنین', '2'),
      petRow(1, owner, 'رکس', 'dog', 'ژرمن شپرد', 'male', '2020-07-01', 31, 62, 'good', 'in_progress', 'حساسیت به گرده', 'درماتیت خفیف', 'mixed', 'هیلز', '2'),
      petRow(2, reviewers[0], 'میشو', 'cat', 'دشمیر', 'female', '2021-11-02', 4.5, 23, 'good', 'complete', 'پنی‌سیلین', 'عفونت گوش مزمن', 'wet', 'ویسکاس', '3'),
      petRow(3, reviewers[1], 'لونا', 'dog', 'پودل', 'female', '2019-05-18', 7.5, 35, 'excellent', 'complete', 'ندارد', 'ندارد', 'dry', 'اکنون', '2'),
      petRow(4, reviewers[2], 'تدی', 'dog', 'گلدن رتریور', 'male', '2018-09-09', 29, 56, 'average', 'in_progress', 'غذای حاوی سویا', 'دیسپلازی خفیف لگن', 'homemade', 'غذای خانگی', '2'),
      petRow(5, owner, 'کوکی', 'rabbit', 'لوپ', 'female', '2023-01-15', 1.8, 18, 'good', 'complete', 'ندارد', 'ندارد', 'mixed', 'ورسل‌لاگا', '3'),
      petRow(6, reviewers[0], 'زرد', 'bird', 'کاکادو', 'male', '2021-04-22', 0.42, 35, 'good', 'complete', 'ندارد', 'ندارد', 'mixed', 'ورسل‌لاگا', 'more'),
      petRow(7, reviewers[1], 'سیمبا', 'cat', 'اسکاتیش', 'male', '2022-08-08', 5.1, 26, 'needs_checkup', 'none', 'گرده گل', 'آسم گربه‌ای مشکوک', 'dry', 'پروی‌پلن', '2'),
    ]);

    // Weight histories (charts) — varied curves across ~11 months.
    const weightCurve = (pet: number, base: number, kind: 'rise' | 'fall' | 'stable' | 'dip' | 'peak') => {
      const count = 10;
      const rows = [];
      for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        const daysAgo = Math.round(330 * (1 - t));
        let factor = 1;
        if (kind === 'rise') factor = 0.9 + 0.18 * t;
        else if (kind === 'fall') factor = 1.12 - 0.16 * t;
        else if (kind === 'stable') factor = 1 + Math.sin(t * Math.PI * 4) * 0.03;
        else if (kind === 'dip') factor = 1 - 0.12 * Math.sin(t * Math.PI);
        else factor = 0.95 + 0.18 * Math.sin(t * Math.PI);
        rows.push({
          id: id(14, pet * 20 + i + 1),
          petId: pets[pet],
          weightKg: Math.max(0.05, Math.round(base * factor * 100) / 100),
          measuredAt: ymd(daysAgo),
          note: i === count - 1 ? 'آخرین اندازه‌گیری' : null,
          createdAt: now,
        });
      }
      return rows;
    };
    await insert(runner, 'pet_weights', [
      ...weightCurve(0, 4.2, 'stable'),
      ...weightCurve(1, 31, 'fall'),
      ...weightCurve(2, 4.5, 'rise'),
      ...weightCurve(3, 7.5, 'dip'),
      ...weightCurve(4, 29, 'peak'),
      ...weightCurve(5, 1.8, 'stable'),
      ...weightCurve(6, 0.42, 'rise'),
      ...weightCurve(7, 5.1, 'dip'),
    ]);

    await insert(runner, 'pet_vaccines', [
      { id: id(15, 1), petId: pets[0], vaccineName: 'سه‌گانه گربه', vaccineDate: ymd(200), nextDueDate: ymd(-165), notes: 'نوبت سالانه', createdAt: now },
      { id: id(15, 2), petId: pets[0], vaccineName: 'هاری', vaccineDate: ymd(200), nextDueDate: ymd(-165), notes: null, createdAt: now },
      { id: id(15, 3), petId: pets[1], vaccineName: 'DHPP', vaccineDate: ymd(90), nextDueDate: ymd(-5), notes: 'بوستر به‌زودی', createdAt: now },
      { id: id(15, 4), petId: pets[1], vaccineName: 'هاری', vaccineDate: ymd(400), nextDueDate: ymd(20), notes: 'عقب‌افتاده', createdAt: now },
      { id: id(15, 5), petId: pets[2], vaccineName: 'سه‌گانه گربه', vaccineDate: ymd(120), nextDueDate: ymd(-245), notes: null, createdAt: now },
      { id: id(15, 6), petId: pets[3], vaccineName: 'DHPP', vaccineDate: ymd(180), nextDueDate: ymd(-185), notes: null, createdAt: now },
      { id: id(15, 7), petId: pets[4], vaccineName: 'هاری', vaccineDate: ymd(400), nextDueDate: ymd(10), notes: 'نیاز به تمدید', createdAt: now },
      { id: id(15, 8), petId: pets[5], vaccineName: 'Myxo-RHD', vaccineDate: ymd(150), nextDueDate: ymd(-215), notes: null, createdAt: now },
      { id: id(15, 9), petId: pets[7], vaccineName: 'سه‌گانه گربه', vaccineDate: ymd(10), nextDueDate: ymd(-20), notes: 'شروع دوره', createdAt: now },
    ]);

    await insert(runner, 'pet_medications', [
      { id: id(16, 1), petId: pets[1], name: 'آتوپیکا', dosage: '۵۰ میلی‌گرم', frequency: 'روزانه یک عدد', startDate: ymd(45), endDate: null, notes: null, isActive: true, createdAt: now, updatedAt: now },
      { id: id(16, 2), petId: pets[2], name: 'اوتوماکس', dosage: '۲ قطره', frequency: 'دو بار در روز', startDate: ymd(14), endDate: ymd(-1), notes: null, isActive: true, createdAt: now, updatedAt: now },
      { id: id(16, 3), petId: pets[4], name: 'گلوکوزامین', dosage: '۵۰۰ میلی‌گرم', frequency: 'روزانه', startDate: ymd(120), endDate: null, notes: null, isActive: true, createdAt: now, updatedAt: now },
      { id: id(16, 4), petId: pets[7], name: 'فلوتیکازون', dosage: '۱ پاف', frequency: 'دو بار در روز', startDate: ymd(21), endDate: null, notes: null, isActive: true, createdAt: now, updatedAt: now },
    ]);

    await insert(runner, 'pet_events', [
      { id: id(17, 1), petId: pets[0], type: 'grooming', title: 'آرایش و کوتاهی ناخن', note: null, eventAt: days(-20), createdAt: now, updatedAt: now },
      { id: id(17, 2), petId: pets[1], type: 'vet_visit', title: 'معاینه پوست', note: 'بهبود نسبی', eventAt: days(-30), createdAt: now, updatedAt: now },
      { id: id(17, 3), petId: pets[2], type: 'illness', title: 'عفونت گوش', note: 'شروع درمان', eventAt: days(-14), createdAt: now, updatedAt: now },
      { id: id(17, 4), petId: pets[3], type: 'training', title: 'کلاس اطاعت‌پذیری', note: null, eventAt: days(-12), createdAt: now, updatedAt: now },
      { id: id(17, 5), petId: pets[4], type: 'injury', title: 'کشیدگی خفیف پا', note: 'استراحت یک هفته', eventAt: days(-45), createdAt: now, updatedAt: now },
      { id: id(17, 6), petId: pets[5], type: 'grooming', title: 'کوتاهی ناخن', note: null, eventAt: days(-18), createdAt: now, updatedAt: now },
      { id: id(17, 7), petId: pets[6], type: 'vet_visit', title: 'معاینه پر و پوست', note: null, eventAt: days(-80), createdAt: now, updatedAt: now },
      { id: id(17, 8), petId: pets[7], type: 'illness', title: 'سرفه شبانه', note: null, eventAt: days(-25), createdAt: now, updatedAt: now },
    ]);

    await insert(runner, 'pet_surgeries', [
      { id: id(18, 1), petId: pets[3], name: 'عقیم‌سازی', surgeryDate: ymd(900), vetName: 'دکتر سارا احمدی', clinicName: 'کلینیک دامپزشکی آوا', notes: null, status: 'done', createdAt: now, updatedAt: now },
      { id: id(18, 2), petId: pets[4], name: 'جراحی دندان', surgeryDate: ymd(200), vetName: 'دکتر نیما موسوی', clinicName: 'مطب خصوصی', notes: null, status: 'done', createdAt: now, updatedAt: now },
    ]);
    const reservation = (
      n: number,
      vet: number,
      pet: number,
      serviceName: string,
      price: number,
      at: string,
      status: string,
      clinic: string | null,
    ) => ({
      id: id(10, n),
      ownerId: owner,
      petId: pets[pet],
      vetId: vets[vet],
      clinicId: clinic,
      serviceName,
      scheduledAt: at,
      durationMinutes: 30,
      status,
      price,
      createdAt: now,
      updatedAt: now,
    });
    const reservations = [
      // Two completed visits with vet 1: the older one is reviewed, the newer one isn't (review flow).
      reservation(1, 0, 0, 'معاینه عمومی', 250_000, days(-60), 'completed', clinicUsers[0]),
      reservation(2, 0, 0, 'واکسیناسیون', 180_000, days(-14), 'completed', clinicUsers[0]),
      reservation(3, 2, 1, 'ویزیت اورژانس', 500_000, days(-30), 'completed', clinicUsers[1]),
      reservation(4, 3, 1, 'جرم‌گیری', 1_200_000, days(-90), 'cancelled', null),
      // Upcoming, unpaid (payment flow).
      reservation(5, 1, 1, 'معاینه عمومی', 250_000, days(3), 'confirmed', clinicUsers[0]),
    ];
    await insert(runner, 'reservations', reservations);
    await insert(
      runner,
      'reservation_events',
      reservations.map((r, i) => ({
        id: id(11, i + 1),
        reservationId: r.id,
        type: 'created',
        message: 'رزرو توسط صاحب پت ثبت شد',
        actorId: owner,
      })),
    );

    // ---- approved reviews ----
    const vetReviews: [number, string, string | null, number, string, string | null][] = [
      [0, owner, id(10, 1), 5, 'خیلی با حوصله معاینه کردند و همه‌چیز را توضیح دادند.', 'ممنون از اعتماد شما؛ سلامت پیشی آرزوی ماست.'],
      [0, reviewers[0], null, 5, 'برخورد عالی و نوبت‌دهی منظم.', null],
      [0, reviewers[1], null, 4, 'دقیق و حرفه‌ای، فقط کمی انتظار داشتیم.', null],
      [1, reviewers[2], null, 5, 'جراحی سگ ما بدون مشکل انجام شد.', null],
      [2, owner, id(10, 3), 4, 'درمان پوست رکس نتیجه داد.', null],
      [2, reviewers[0], null, 3, 'خوب بود ولی هزینه بالا بود.', null],
      [3, reviewers[1], null, 5, 'جرم‌گیری با دقت و بدون استرس.', null],
    ];
    await insert(
      runner,
      'vet_reviews',
      vetReviews.map(([vet, authorId, reservationId, rating, comment, reply], i) => ({
        id: id(12, i + 1),
        vetId: vets[vet],
        authorId,
        reservationId,
        rating,
        comment,
        reply,
        repliedAt: reply ? now : null,
        status: 'approved',
        createdAt: now,
        updatedAt: now,
      })),
    );
    await insert(
      runner,
      'clinic_reviews',
      [
        [0, reviewers[0], 5, 'محیط تمیز و پرسنل مهربان.'],
        [0, reviewers[2], 4, 'پارکینگ کم است ولی خدمات خوب بود.'],
        [1, reviewers[1], 5, 'نیمه‌شب پذیرش شدیم و خیلی سریع رسیدگی کردند.'],
      ].map(([clinic, authorId, rating, comment], i) => ({
        id: id(13, i + 1),
        clinicId: clinicUsers[clinic as number],
        authorId,
        rating,
        comment,
        status: 'approved',
        createdAt: now,
        updatedAt: now,
      })),
    );

    await runner.commitTransaction();
    console.log('dev-seed: done. Demo owner phone: 09120000000');
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('dev-seed failed:', error);
  process.exit(1);
});
