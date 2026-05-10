/**
 * End-to-end smoke test: registers users, books an appointment, chat, completes visit,
 * optional prescription (requires ImageKit), review, directory, token refresh.
 *
 * Usage (from repo root, with MongoDB reachable and env in .env):
 *   npm run smoke
 *
 * Requires SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD for admin-only steps
 * (same as server bootstrap). Run `npm run seed` once if no SUPER_ADMIN exists yet.
 *
 * Email verification is applied directly in MongoDB because the API never returns
 * the raw verification token.
 */
import '../config/env';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import request from 'supertest';
import { createApp } from '../app';
import { runBootstrap } from '../bootstrap/seed';
import { API_PREFIX } from '../config/constants';
import { connectDb, disconnectDb } from '../config/db';
import { getEnv } from '../config/env';
import { logger } from '../config/logger';
import { UserModel } from '../modules/users/user.model';

dayjs.extend(utc);

type Envelope<T = unknown> = {
  success: boolean;
  message: string;
  data?: T;
  meta?: unknown;
};

function fail(msg: string): never {
  throw new Error(msg);
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) fail(msg);
}

async function activateUsersByEmail(emails: string[]) {
  for (const email of emails) {
    const r = await UserModel.updateOne(
      { email: email.toLowerCase() },
      {
        $set: {
          isEmailVerified: true,
          status: 'ACTIVE',
        },
        $unset: { emailVerificationToken: '', emailVerificationExpires: '' },
      },
    );
    if (r.matchedCount === 0) fail(`Smoke: user not found to activate: ${email}`);
  }
}

const PASSWORD = 'Aa1!SmokeTest';

async function main() {
  const env = getEnv();
  if (!env.SEED_SUPERADMIN_EMAIL || !env.SEED_SUPERADMIN_PASSWORD) {
    fail('Set SEED_SUPERADMIN_EMAIL and SEED_SUPERADMIN_PASSWORD in .env (same as server seed).');
  }

  await connectDb();
  await runBootstrap();

  const app = createApp();
  const api = (path: string) => `${API_PREFIX}${path}`;

  const step = (name: string) => logger.info({ step: name }, 'smoke');

  step('health');
  {
    const res = await request(app).get('/health').expect(200);
    const body = res.body as Envelope<{ database: string }>;
    assert(body.success, body.message);
    assert(body.data?.database === 'up', 'Expected database up on /health');
  }

  step('admin login');
  const adminLoginRes = await request(app)
    .post(api('/admin/auth/login'))
    .send({ email: env.SEED_SUPERADMIN_EMAIL, password: env.SEED_SUPERADMIN_PASSWORD })
    .expect(200);
  const adminBody = adminLoginRes.body as Envelope<{
    user: { id: string };
    tokens: { accessToken: string; refreshToken: string };
  }>;
  assert(adminBody.success && adminBody.data?.tokens?.accessToken, adminBody.message);
  const adminToken = adminBody.data.tokens.accessToken;

  step('ensure specialty exists');
  let specialtyId: string;
  {
    const listRes = await request(app).get(api('/specialties')).expect(200);
    const listBody = listRes.body as Envelope<Array<{ id: string; name: string }>>;
    assert(listBody.success && Array.isArray(listBody.data), listBody.message);
    if (listBody.data!.length > 0) {
      specialtyId = listBody.data![0].id;
    } else {
      const name = `Smoke Specialty ${Date.now()}`;
      const createRes = await request(app)
        .post(api('/admin/specialties'))
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name, description: 'Created by smoke test' })
        .expect(201);
      const createBody = createRes.body as Envelope<{ id: string }>;
      assert(createBody.success && createBody.data?.id, createBody.message);
      specialtyId = createBody.data.id;
    }
  }

  const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const patientEmail = `smoke-patient-${tag}@example.test`.toLowerCase();
  const practitionerEmail = `smoke-practitioner-${tag}@example.test`.toLowerCase();
  const patientPhone = `+1555${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const practitionerPhone = `+1556${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;

  step('register patient');
  {
    const res = await request(app)
      .post(api('/auth/register/patient'))
      .send({
        firstName: 'Smoke',
        lastName: 'Patient',
        email: patientEmail,
        phoneNumber: patientPhone,
        password: PASSWORD,
      })
      .expect(201);
    const body = res.body as Envelope;
    assert(body.success, body.message);
  }

  step('register practitioner with specialties');
  let practitionerId: string;
  {
    const res = await request(app)
      .post(api('/auth/register/practitioner'))
      .send({
        firstName: 'Smoke',
        lastName: 'Doctor',
        email: practitionerEmail,
        phoneNumber: practitionerPhone,
        password: PASSWORD,
        specialties: [specialtyId],
      })
      .expect(201);
    const body = res.body as Envelope;
    assert(body.success, body.message);
    const u = await UserModel.findOne({ email: practitionerEmail.toLowerCase() }).lean();
    assert(u?._id, 'Practitioner user not found after register');
    practitionerId = String(u._id);
  }

  step('activate accounts in DB (email tokens are not exposed via API)');
  await activateUsersByEmail([patientEmail, practitionerEmail]);

  step('patient login');
  let patientAccess: string;
  let patientRefresh: string;
  {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: patientEmail, password: PASSWORD })
      .expect(200);
    const body = res.body as Envelope<{
      tokens: { accessToken: string; refreshToken: string };
    }>;
    assert(body.data?.tokens?.accessToken, body.message);
    patientAccess = body.data.tokens.accessToken;
    patientRefresh = body.data.tokens.refreshToken;
  }

  step('practitioner login');
  let practitionerAccess: string;
  {
    const res = await request(app)
      .post(api('/auth/login'))
      .send({ email: practitionerEmail, password: PASSWORD })
      .expect(200);
    const body = res.body as Envelope<{ tokens: { accessToken: string } }>;
    assert(body.data?.tokens?.accessToken, body.message);
    practitionerAccess = body.data.tokens.accessToken;
  }

  step('admin verify practitioner');
  {
    const res = await request(app)
      .post(api(`/admin/practitioners/${practitionerId}/verify`))
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(200);
    const body = res.body as Envelope<{ verificationStatus?: string }>;
    assert(body.success, body.message);
    assert(body.data?.verificationStatus === 'VERIFIED', 'Expected VERIFIED practitioner');
  }

  step('patient patch profile');
  {
    const res = await request(app)
      .patch(api('/patients/me'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .send({ firstName: 'Smoke', lastName: 'PatientUpdated' })
      .expect(200);
    const body = res.body as Envelope;
    assert(body.success, body.message);
  }

  step('practitioner patch profile');
  {
    const res = await request(app)
      .patch(api('/practitioners/me'))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .send({ bio: 'Smoke test practitioner bio', yearsOfExperience: 5 })
      .expect(200);
    const body = res.body as Envelope;
    assert(body.success, body.message);
  }

  const slotStart = dayjs.utc().add(2, 'day').hour(10).minute(0).second(0).millisecond(0);
  const slotEnd = slotStart.add(30, 'minute');

  step('practitioner create slot');
  let slotId: string;
  {
    const res = await request(app)
      .post(api('/practitioners/me/slots'))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .send({ startTime: slotStart.toISOString(), endTime: slotEnd.toISOString() })
      .expect(201);
    const body = res.body as Envelope<{ _id: string }>;
    assert(body.success && body.data?._id, body.message);
    slotId = String(body.data._id);
  }

  step('public practitioner directory (verified + specialty)');
  {
    const res = await request(app)
      .get(api('/practitioners'))
      .query({ page: 1, limit: 20, specialtyId })
      .expect(200);
    const body = res.body as Envelope<Array<{ _id?: string }>>;
    assert(body.success && Array.isArray(body.data), body.message);
    const found = body.data!.some((p) => String(p._id) === practitionerId);
    assert(found, 'Expected practitioner in public directory');
  }

  step('public open slots');
  {
    const from = slotStart.subtract(1, 'hour').toISOString();
    const to = slotEnd.add(1, 'hour').toISOString();
    const res = await request(app)
      .get(api(`/practitioners/${practitionerId}/slots`))
      .query({ from, to })
      .expect(200);
    const body = res.body as Envelope<Array<{ _id: string }>>;
    assert(body.success && Array.isArray(body.data), body.message);
    const found = body.data!.some((s) => String(s._id) === slotId);
    assert(found, 'Expected slot in public listing');
  }

  step('patient book appointment');
  let appointmentId: string;
  {
    const res = await request(app)
      .post(api('/appointments'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .send({
        slotId,
        reasonForVisit: 'Smoke test visit',
        symptoms: ['none'],
      })
      .expect(201);
    const body = res.body as Envelope<{ _id: string }>;
    assert(body.success && body.data?._id, body.message);
    appointmentId = String(body.data._id);
  }

  step('practitioner confirm appointment');
  {
    const res = await request(app)
      .post(api(`/appointments/${appointmentId}/confirm`))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .expect(200);
    const body = res.body as Envelope<{ status: string }>;
    assert(body.success && body.data?.status === 'CONFIRMED', body.message);
  }

  step('get appointment (patient) for chat room');
  let roomId: string;
  {
    const res = await request(app)
      .get(api(`/appointments/${appointmentId}`))
      .set('Authorization', `Bearer ${patientAccess}`)
      .expect(200);
    const body = res.body as Envelope<{ chatRoom?: { toString(): string } | string }>;
    assert(body.success && body.data?.chatRoom, body.message);
    const cr = body.data!.chatRoom!;
    roomId = typeof cr === 'string' ? cr : cr.toString();
  }

  step('chat messages (before complete locks room)');
  {
    const r1 = await request(app)
      .post(api(`/chat/rooms/${roomId}/messages`))
      .set('Authorization', `Bearer ${patientAccess}`)
      .send({ content: 'Hello from patient' })
      .expect(201);
    assert((r1.body as Envelope).success, (r1.body as Envelope).message);

    const r2 = await request(app)
      .post(api(`/chat/rooms/${roomId}/messages`))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .send({ content: 'Hello from practitioner' })
      .expect(201);
    assert((r2.body as Envelope).success, (r2.body as Envelope).message);

    const r3 = await request(app)
      .get(api(`/chat/rooms/${roomId}/messages`))
      .set('Authorization', `Bearer ${patientAccess}`)
      .query({ page: 1, limit: 10 })
      .expect(200);
    const listBody = r3.body as Envelope<unknown[]>;
    assert(listBody.success && Array.isArray(listBody.data) && listBody.data.length >= 2, listBody.message);
  }

  step('practitioner notes');
  {
    const res = await request(app)
      .patch(api(`/appointments/${appointmentId}/practitioner-notes`))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .send({ practitionerNotes: 'Smoke test clinical notes' })
      .expect(200);
    assert((res.body as Envelope).success, (res.body as Envelope).message);
  }

  step('practitioner start + complete');
  {
    const r1 = await request(app)
      .post(api(`/appointments/${appointmentId}/start`))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .expect(200);
    assert((r1.body as Envelope<{ status: string }>).data?.status === 'IN_PROGRESS', 'start');

    const r2 = await request(app)
      .post(api(`/appointments/${appointmentId}/complete`))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .expect(200);
    assert((r2.body as Envelope<{ status: string }>).data?.status === 'COMPLETED', 'complete');
  }

  step('patient notifications');
  {
    const res = await request(app)
      .get(api('/notifications'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .query({ page: 1, limit: 20 })
      .expect(200);
    assert((res.body as Envelope).success, (res.body as Envelope).message);
  }

  step('patient appointments list');
  {
    const res = await request(app)
      .get(api('/patients/me/appointments'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .query({ page: 1, limit: 10 })
      .expect(200);
    const body = res.body as Envelope<unknown[]>;
    assert(body.success && Array.isArray(body.data), body.message);
  }

  const imageKitConfigured = Boolean(
    env.IMAGEKIT_PUBLIC_KEY && env.IMAGEKIT_PRIVATE_KEY && env.IMAGEKIT_URL_ENDPOINT,
  );

  if (imageKitConfigured) {
    step('issue prescription (ImageKit configured)');
    const res = await request(app)
      .post(api('/prescriptions'))
      .set('Authorization', `Bearer ${practitionerAccess}`)
      .send({
        appointmentId,
        diagnosis: 'Smoke diagnosis',
        medications: [
          {
            drugName: 'Vitamin C',
            dosage: '500mg',
            frequency: 'Once daily',
            duration: '7 days',
          },
        ],
      })
      .expect(201);
    const body = res.body as Envelope<{ prescriptionNumber?: string; pdfUrl?: string }>;
    assert(body.success && body.data?.prescriptionNumber && body.data.pdfUrl, body.message);

    step('patient list prescriptions');
    const listRx = await request(app)
      .get(api('/prescriptions/me'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .query({ page: 1, limit: 10 })
      .expect(200);
    assert((listRx.body as Envelope).success, (listRx.body as Envelope).message);
  } else {
    logger.warn('Skipping prescription step (set IMAGEKIT_* env to include it)');
  }

  step('patient submit review');
  {
    const res = await request(app)
      .post(api('/reviews'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .send({ appointmentId, rating: 5, comment: 'Great smoke test visit' })
      .expect(201);
    assert((res.body as Envelope).success, (res.body as Envelope).message);
  }

  step('refresh token');
  {
    const res = await request(app)
      .post(api('/auth/refresh'))
      .send({ refreshToken: patientRefresh })
      .expect(200);
    const body = res.body as Envelope<{ tokens: { accessToken: string } }>;
    assert(body.success && body.data?.tokens?.accessToken, body.message);
  }

  step('auth me (patient)');
  {
    const res = await request(app)
      .get(api('/auth/me'))
      .set('Authorization', `Bearer ${patientAccess}`)
      .expect(200);
    assert((res.body as Envelope).success, (res.body as Envelope).message);
  }

  logger.info('Smoke test finished successfully.');
}

main()
  .catch((err) => {
    logger.error({ err }, 'Smoke test failed');
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDb().catch((e) => logger.warn({ e }, 'disconnectDb'));
  });
