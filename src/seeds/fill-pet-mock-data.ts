/**
 * Fills every active pet (non-deleted owners) with varied profile + health
 * history so home/timeline charts and care screens show real data.
 *
 *   npm run seed:fill-pets
 *   docker exec petzi-backend-api-1 node dist/seeds/fill-pet-mock-data.js
 *
 * Idempotent per pet: replaces weights / events / medications / surgeries /
 * vaccines for that pet, then updates the pet row. Skips drafts. Refuses
 * production.
 */
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '../config/data-source';

if (process.env.NODE_ENV === 'production') {
  console.error('fill-pet-mock-data: refusing to run with NODE_ENV=production');
  process.exit(1);
}

const ymd = (daysAgo: number) => {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
};

const isoAt = (daysAgo: number, hour = 10) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  d.setUTCHours(hour - 3, 30, 0, 0);
  return d.toISOString();
};

type Curve = 'rise' | 'fall' | 'stable' | 'dip' | 'peak';

const CURVES: Curve[] = ['rise', 'fall', 'stable', 'dip', 'peak'];

function series(base: number, curve: Curve, count = 10): { daysAgo: number; kg: number }[] {
  const span = 330;
  const out: { daysAgo: number; kg: number }[] = [];
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const daysAgo = Math.round(span * (1 - t));
    let factor = 1;
    if (curve === 'rise') factor = 0.9 + 0.18 * t;
    else if (curve === 'fall') factor = 1.12 - 0.16 * t;
    else if (curve === 'stable') factor = 1 + Math.sin(t * Math.PI * 4) * 0.03;
    else if (curve === 'dip') factor = 1 - 0.12 * Math.sin(t * Math.PI);
    else factor = 0.95 + 0.18 * Math.sin(t * Math.PI);
    const noise = ((i % 3) - 1) * 0.02;
    const kg = Math.max(0.05, Math.round((base * (factor + noise)) * 100) / 100);
    out.push({ daysAgo, kg });
  }
  return out;
}

type Profile = {
  rename?: string;
  type: string;
  breed: string;
  gender: string;
  birthDate: string;
  color: string;
  weight: number;
  height: number;
  healthStatus: string;
  vaccinationStatus: string;
  allergies: string;
  underlyingDiseases: string;
  medications: string;
  healthNotes: string;
  foodType: string;
  foodBrand: string;
  mealsPerDay: string;
  foodSensitivities: string;
  lastDewormingDate: string;
  dewormingType: string;
  microchipNumber: string | null;
  curve: Curve;
  vaccines: { name: string; daysAgo: number; nextIn: number | null; notes: string | null }[];
  meds: { name: string; dosage: string; frequency: string; startAgo: number; endAgo: number | null; active: boolean }[];
  events: { type: string; title: string; daysAgo: number; note: string | null }[];
  surgeries: { name: string; daysAgo: number; vetName: string; clinicName: string; status: string }[];
};

const FORCE_RENAME = new Set([
  'بیسکویت',
  'پرشین',
  'ژرمن شپرد',
  'دشمیر',
  'پودل',
  'گلدن رتریور',
  'لوپ',
  'کاکادو',
  'اسکاتیش',
  'هاسکی',
  'لابرادور',
  'مین‌کون',
  'بولداگ فرانسوی',
]);

const PROFILES: Profile[] = [
  {
    rename: 'پیشی',
    type: 'cat',
    breed: 'پرشین',
    gender: 'female',
    birthDate: '2022-03-10',
    color: 'سفید',
    weight: 4.2,
    height: 24,
    healthStatus: 'excellent',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'وضعیت کلی عالی؛ وزن پایدار.',
    foodType: 'dry',
    foodBrand: 'رویال کنین',
    mealsPerDay: '2',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(40),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991001',
    curve: 'stable',
    vaccines: [
      { name: 'سه‌گانه گربه', daysAgo: 200, nextIn: 165, notes: 'نوبت سالانه' },
      { name: 'هاری', daysAgo: 200, nextIn: 165, notes: null },
    ],
    meds: [],
    events: [
      { type: 'grooming', title: 'آرایش و کوتاهی ناخن', daysAgo: 20, note: null },
      { type: 'deworming', title: 'ضدانگل دوره‌ای', daysAgo: 40, note: 'قرص خوراکی' },
    ],
    surgeries: [],
  },
  {
    rename: 'رکس',
    type: 'dog',
    breed: 'ژرمن شپرد',
    gender: 'male',
    birthDate: '2020-07-01',
    color: 'قهوه‌ای-مشکی',
    weight: 31,
    height: 62,
    healthStatus: 'good',
    vaccinationStatus: 'in_progress',
    allergies: 'حساسیت به گرده',
    underlyingDiseases: 'درماتیت خفیف',
    medications: 'آتوپیکا',
    healthNotes: 'رژیم کاهش وزن در جریان است.',
    foodType: 'mixed',
    foodBrand: 'هیلز',
    mealsPerDay: '2',
    foodSensitivities: 'مرغ',
    lastDewormingDate: ymd(55),
    dewormingType: 'موضعی',
    microchipNumber: 'IR-991002',
    curve: 'fall',
    vaccines: [
      { name: 'DHPP', daysAgo: 90, nextIn: 5, notes: 'بوستر به‌زودی' },
      { name: 'هاری', daysAgo: 400, nextIn: -20, notes: 'عقب‌افتاده' },
    ],
    meds: [
      {
        name: 'آتوپیکا',
        dosage: '۵۰ میلی‌گرم',
        frequency: 'روزانه یک عدد',
        startAgo: 45,
        endAgo: null,
        active: true,
      },
    ],
    events: [
      { type: 'vet_visit', title: 'معاینه پوست', daysAgo: 30, note: 'بهبود نسبی' },
      { type: 'illness', title: 'خارش فصلی', daysAgo: 60, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'میشو',
    type: 'cat',
    breed: 'دشمیر',
    gender: 'female',
    birthDate: '2021-11-02',
    color: 'خاکستری',
    weight: 4.5,
    height: 23,
    healthStatus: 'good',
    vaccinationStatus: 'complete',
    allergies: 'پنی‌سیلین',
    underlyingDiseases: 'عفونت گوش مزمن',
    medications: 'قطره گوش',
    healthNotes: 'پیگیری ماهانه گوش.',
    foodType: 'wet',
    foodBrand: 'ویسکاس',
    mealsPerDay: '3',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(70),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991003',
    curve: 'rise',
    vaccines: [
      { name: 'سه‌گانه گربه', daysAgo: 120, nextIn: 245, notes: null },
    ],
    meds: [
      {
        name: 'اوتوماکس',
        dosage: '۲ قطره',
        frequency: 'دو بار در روز',
        startAgo: 14,
        endAgo: -1,
        active: true,
      },
    ],
    events: [
      { type: 'illness', title: 'عفونت گوش', daysAgo: 14, note: 'شروع درمان' },
      { type: 'vet_visit', title: 'ویزیت پیگیری', daysAgo: 7, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'لونا',
    type: 'dog',
    breed: 'پودل',
    gender: 'female',
    birthDate: '2019-05-18',
    color: 'کرم',
    weight: 7.5,
    height: 35,
    healthStatus: 'excellent',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'فعال و اجتماعی.',
    foodType: 'dry',
    foodBrand: 'اکنون',
    mealsPerDay: '2',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(25),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991004',
    curve: 'dip',
    vaccines: [
      { name: 'DHPP', daysAgo: 180, nextIn: 185, notes: null },
      { name: 'لپتوسپیروز', daysAgo: 180, nextIn: 185, notes: null },
    ],
    meds: [],
    events: [
      { type: 'training', title: 'کلاس اطاعت‌پذیری', daysAgo: 12, note: null },
      { type: 'birthday', title: 'تولد ۷ سالگی', daysAgo: 100, note: null },
    ],
    surgeries: [
      {
        name: 'عقیم‌سازی',
        daysAgo: 900,
        vetName: 'دکتر سارا احمدی',
        clinicName: 'کلینیک دامپزشکی آوا',
        status: 'done',
      },
    ],
  },
  {
    rename: 'تدی',
    type: 'dog',
    breed: 'گلدن رتریور',
    gender: 'male',
    birthDate: '2018-09-09',
    color: 'طلایی',
    weight: 29,
    height: 56,
    healthStatus: 'average',
    vaccinationStatus: 'in_progress',
    allergies: 'غذای حاوی سویا',
    underlyingDiseases: 'دیسپلازی خفیف لگن',
    medications: 'گلوکوزامین',
    healthNotes: 'ورزش سبک توصیه شده.',
    foodType: 'homemade',
    foodBrand: 'غذای خانگی',
    mealsPerDay: '2',
    foodSensitivities: 'سویا',
    lastDewormingDate: ymd(90),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991005',
    curve: 'peak',
    vaccines: [
      { name: 'DHPP', daysAgo: 30, nextIn: 335, notes: null },
      { name: 'هاری', daysAgo: 400, nextIn: -10, notes: 'نیاز به تمدید' },
    ],
    meds: [
      {
        name: 'گلوکوزامین',
        dosage: '۵۰۰ میلی‌گرم',
        frequency: 'روزانه',
        startAgo: 120,
        endAgo: null,
        active: true,
      },
    ],
    events: [
      { type: 'injury', title: 'کشیدگی خفیف پا', daysAgo: 45, note: 'استراحت یک هفته' },
      { type: 'vet_visit', title: 'چکاپ مفصل', daysAgo: 40, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'کوکی',
    type: 'rabbit',
    breed: 'لوپ',
    gender: 'female',
    birthDate: '2023-01-15',
    color: 'قهوه‌ای',
    weight: 1.8,
    height: 18,
    healthStatus: 'good',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'رژیم پرفیبر.',
    foodType: 'mixed',
    foodBrand: 'ورسل‌لاگا',
    mealsPerDay: '3',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(60),
    dewormingType: 'خوراکی',
    microchipNumber: null,
    curve: 'stable',
    vaccines: [
      { name: 'Myxo-RHD', daysAgo: 150, nextIn: 215, notes: null },
    ],
    meds: [],
    events: [
      { type: 'grooming', title: 'کوتاهی ناخن', daysAgo: 18, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'زرد',
    type: 'bird',
    breed: 'کاکادو',
    gender: 'male',
    birthDate: '2021-04-22',
    color: 'زرد',
    weight: 0.42,
    height: 35,
    healthStatus: 'good',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'پرریزی فصلی طبیعی.',
    foodType: 'mixed',
    foodBrand: 'ورسل‌لاگا',
    mealsPerDay: 'more',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(100),
    dewormingType: 'خوراکی',
    microchipNumber: null,
    curve: 'rise',
    vaccines: [],
    meds: [],
    events: [
      { type: 'other', title: 'تعویض قفس', daysAgo: 50, note: null },
      { type: 'vet_visit', title: 'معاینه پر و پوست', daysAgo: 80, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'سیمبا',
    type: 'cat',
    breed: 'اسکاتیش',
    gender: 'male',
    birthDate: '2022-08-08',
    color: 'کرم-خاکستری',
    weight: 5.1,
    height: 26,
    healthStatus: 'needs_checkup',
    vaccinationStatus: 'none',
    allergies: 'گرده گل',
    underlyingDiseases: 'آسم گربه‌ای مشکوک',
    medications: 'اسپری استنشاقی',
    healthNotes: 'نیاز به چکاپ تنفسی.',
    foodType: 'dry',
    foodBrand: 'پروی‌پلن',
    mealsPerDay: '2',
    foodSensitivities: 'ماهی',
    lastDewormingDate: ymd(200),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991008',
    curve: 'dip',
    vaccines: [
      { name: 'سه‌گانه گربه', daysAgo: 10, nextIn: 20, notes: 'شروع دوره' },
    ],
    meds: [
      {
        name: 'فلوتیکازون',
        dosage: '۱ پاف',
        frequency: 'دو بار در روز',
        startAgo: 21,
        endAgo: null,
        active: true,
      },
    ],
    events: [
      { type: 'illness', title: 'سرفه شبانه', daysAgo: 25, note: null },
      { type: 'vet_visit', title: 'معاینه تنفسی', daysAgo: 21, note: 'شروع درمان' },
    ],
    surgeries: [],
  },
  {
    rename: 'باران',
    type: 'dog',
    breed: 'هاسکی',
    gender: 'female',
    birthDate: '2021-02-14',
    color: 'خاکستری-سفید',
    weight: 21,
    height: 52,
    healthStatus: 'excellent',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'ورزش روزانه زیاد.',
    foodType: 'dry',
    foodBrand: 'اوریجن',
    mealsPerDay: '2',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(35),
    dewormingType: 'موضعی',
    microchipNumber: 'IR-991009',
    curve: 'stable',
    vaccines: [
      { name: 'DHPP', daysAgo: 100, nextIn: 265, notes: null },
      { name: 'هاری', daysAgo: 100, nextIn: 265, notes: null },
    ],
    meds: [],
    events: [
      { type: 'training', title: 'پیاده‌روی طولانی', daysAgo: 3, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'ماکس',
    type: 'dog',
    breed: 'لابرادور',
    gender: 'male',
    birthDate: '2020-12-01',
    color: 'مشکی',
    weight: 27,
    height: 58,
    healthStatus: 'good',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'اضافه وزن خفیف',
    medications: 'ندارد',
    healthNotes: 'کالری کنترل‌شده.',
    foodType: 'dry',
    foodBrand: 'هیلز متابولیک',
    mealsPerDay: '2',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(48),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991010',
    curve: 'fall',
    vaccines: [
      { name: 'DHPP', daysAgo: 60, nextIn: 305, notes: null },
    ],
    meds: [],
    events: [
      { type: 'vet_visit', title: 'مشاوره تغذیه', daysAgo: 55, note: null },
    ],
    surgeries: [
      {
        name: 'جراحی دندان',
        daysAgo: 200,
        vetName: 'دکتر نیما موسوی',
        clinicName: 'مطب خصوصی',
        status: 'done',
      },
    ],
  },
  {
    rename: 'نیکا',
    type: 'cat',
    breed: 'مین‌کون',
    gender: 'female',
    birthDate: '2023-06-20',
    color: 'تابی',
    weight: 5.8,
    height: 30,
    healthStatus: 'excellent',
    vaccinationStatus: 'complete',
    allergies: 'ندارد',
    underlyingDiseases: 'ندارد',
    medications: 'ندارد',
    healthNotes: 'رشد سریع طبیعی.',
    foodType: 'mixed',
    foodBrand: 'رویال کنین',
    mealsPerDay: '3',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(22),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991011',
    curve: 'rise',
    vaccines: [
      { name: 'سه‌گانه گربه', daysAgo: 80, nextIn: 285, notes: null },
      { name: 'هاری', daysAgo: 80, nextIn: 285, notes: null },
    ],
    meds: [],
    events: [
      { type: 'birthday', title: 'تولد یک‌سالگی', daysAgo: 5, note: null },
    ],
    surgeries: [],
  },
  {
    rename: 'راکی',
    type: 'dog',
    breed: 'بولداگ فرانسوی',
    gender: 'male',
    birthDate: '2022-10-11',
    color: 'حنایی',
    weight: 11.5,
    height: 30,
    healthStatus: 'average',
    vaccinationStatus: 'in_progress',
    allergies: 'گرد و غبار',
    underlyingDiseases: 'سندرم براکیسفالیک خفیف',
    medications: 'ندارد',
    healthNotes: 'اجتناب از گرمای شدید.',
    foodType: 'wet',
    foodBrand: 'رویال کنین',
    mealsPerDay: '3',
    foodSensitivities: 'ندارد',
    lastDewormingDate: ymd(75),
    dewormingType: 'خوراکی',
    microchipNumber: 'IR-991012',
    curve: 'peak',
    vaccines: [
      { name: 'DHPP', daysAgo: 15, nextIn: 15, notes: 'بوستر بعدی' },
    ],
    meds: [],
    events: [
      { type: 'vet_visit', title: 'معاینه تنفسی', daysAgo: 15, note: null },
      { type: 'grooming', title: 'تمیزکاری چین‌های صورت', daysAgo: 8, note: null },
    ],
    surgeries: [],
  },
];

async function main() {
  await AppDataSource.initialize();
  const runner = AppDataSource.createQueryRunner();
  await runner.startTransaction();
  try {
    const pets: {
      id: string;
      name: string | null;
      type: string | null;
      weight: number | null;
      ownerId: string;
      ownerName: string | null;
    }[] = await runner.query(`
      SELECT p.id, p.name, p.type, p.weight, p."ownerId", u."fullName" AS "ownerName"
      FROM pets p
      JOIN users u ON u.id = p."ownerId"
      WHERE p.status = 'active'
        AND u.role = 'user'
        AND u."phoneNumber" NOT LIKE 'deleted_%'
      ORDER BY p."createdAt" ASC
    `);

    let filled = 0;
    for (let i = 0; i < pets.length; i++) {
      const pet = pets[i];
      const profile = PROFILES[i % PROFILES.length];
      const curve = CURVES[i % CURVES.length];

      // Diversify e2e clones / accidental breed names; keep real user-chosen names.
      const keepName =
        !!pet.name &&
        pet.ownerName !== 'صاحب تست' &&
        !FORCE_RENAME.has(pet.name) &&
        !/^پت‌تست/.test(pet.name);
      const name = keepName
        ? pet.name!
        : `${profile.rename ?? 'پت'}${i >= PROFILES.length ? ` ${i + 1}` : ''}`;

      const base =
        keepName && pet.weight && pet.weight > 0
          ? pet.weight
          : profile.weight * (0.85 + (i % 5) * 0.05);

      const points = series(base, curve, 10 + (i % 3));
      const current = points[points.length - 1].kg;

      const type = keepName && pet.type ? pet.type : profile.type;
      await runner.query(
        `UPDATE pets SET
          name = $2,
          type = $3::pets_type_enum,
          breed = $4,
          gender = COALESCE(gender, $5::pets_gender_enum),
          "birthDate" = COALESCE("birthDate", $6::date),
          color = COALESCE(NULLIF(color, ''), $7),
          weight = $8,
          height = COALESCE(height, $9),
          "healthStatus" = $10::pets_healthstatus_enum,
          "vaccinationStatus" = $11::pets_vaccinationstatus_enum,
          allergies = $12,
          "underlyingDiseases" = $13,
          medications = $14,
          "healthNotes" = $15,
          "foodType" = $16::pets_foodtype_enum,
          "foodBrand" = $17,
          "mealsPerDay" = $18::pets_mealsperday_enum,
          "foodSensitivities" = $19,
          "lastDewormingDate" = $20::date,
          "dewormingType" = $21,
          "microchipNumber" = COALESCE("microchipNumber", $22),
          "updatedAt" = NOW()
        WHERE id = $1`,
        [
          pet.id,
          name,
          type,
          profile.breed,
          profile.gender,
          profile.birthDate,
          profile.color,
          current,
          profile.height,
          profile.healthStatus,
          profile.vaccinationStatus,
          profile.allergies,
          profile.underlyingDiseases,
          profile.medications,
          profile.healthNotes,
          profile.foodType,
          profile.foodBrand,
          profile.mealsPerDay,
          profile.foodSensitivities,
          profile.lastDewormingDate,
          profile.dewormingType,
          profile.microchipNumber,
        ],
      );

      await runner.query(`DELETE FROM pet_weights WHERE "petId" = $1`, [pet.id]);
      await runner.query(`DELETE FROM pet_events WHERE "petId" = $1`, [pet.id]);
      await runner.query(`DELETE FROM pet_medications WHERE "petId" = $1`, [pet.id]);
      await runner.query(`DELETE FROM pet_surgeries WHERE "petId" = $1`, [pet.id]);
      await runner.query(`DELETE FROM pet_vaccines WHERE "petId" = $1`, [pet.id]);

      for (const point of points) {
        await runner.query(
          `INSERT INTO pet_weights (id, "petId", "weightKg", "measuredAt", note, "createdAt")
           VALUES ($1, $2, $3, $4::date, $5, NOW())`,
          [
            randomUUID(),
            pet.id,
            point.kg,
            ymd(point.daysAgo),
            point.daysAgo === 0 ? 'آخرین اندازه‌گیری' : null,
          ],
        );
      }

      for (const v of profile.vaccines) {
        const nextDue =
          v.nextIn === null ? null : ymd(-v.nextIn); // nextIn days from today; negative => past
        await runner.query(
          `INSERT INTO pet_vaccines (id, "petId", "vaccineName", "vaccineDate", "nextDueDate", notes, "createdAt")
           VALUES ($1, $2, $3, $4::date, $5::date, $6, NOW())`,
          [randomUUID(), pet.id, v.name, ymd(v.daysAgo), nextDue, v.notes],
        );
      }

      for (const m of profile.meds) {
        await runner.query(
          `INSERT INTO pet_medications
            (id, "petId", name, dosage, frequency, "startDate", "endDate", notes, "isActive", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8, $9, NOW(), NOW())`,
          [
            randomUUID(),
            pet.id,
            m.name,
            m.dosage,
            m.frequency,
            ymd(m.startAgo),
            m.endAgo === null ? null : ymd(m.endAgo),
            null,
            m.active,
          ],
        );
      }

      for (const e of profile.events) {
        await runner.query(
          `INSERT INTO pet_events
            (id, "petId", type, title, note, "eventAt", "createdAt", "updatedAt")
           VALUES ($1, $2, $3::pet_events_type_enum, $4, $5, $6::timestamptz, NOW(), NOW())`,
          [randomUUID(), pet.id, e.type, e.title, e.note, isoAt(e.daysAgo)],
        );
      }

      for (const s of profile.surgeries) {
        await runner.query(
          `INSERT INTO pet_surgeries
            (id, "petId", name, "surgeryDate", "vetName", "clinicName", notes, status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8::pet_surgeries_status_enum, NOW(), NOW())`,
          [
            randomUUID(),
            pet.id,
            s.name,
            ymd(s.daysAgo),
            s.vetName,
            s.clinicName,
            null,
            s.status,
          ],
        );
      }

      filled += 1;
      console.log(
        `filled ${name} (${pet.id.slice(0, 8)}…) curve=${curve} points=${points.length} kg=${current}`,
      );
    }

    await runner.commitTransaction();
    console.log(`fill-pet-mock-data: done. ${filled} active pets updated.`);
  } catch (error) {
    await runner.rollbackTransaction();
    throw error;
  } finally {
    await runner.release();
    await AppDataSource.destroy();
  }
}

main().catch((error) => {
  console.error('fill-pet-mock-data failed:', error);
  process.exit(1);
});
