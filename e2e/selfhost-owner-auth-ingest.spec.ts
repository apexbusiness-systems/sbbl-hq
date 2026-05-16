import { expect, test } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SELFHOST_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const anonKey = process.env.SELFHOST_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
const serviceRoleKey = process.env.SELFHOST_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const ownerEmail = process.env.SELFHOST_OWNER_EMAIL ?? 'jr@sbbl.test';
const ownerPassword = process.env.SELFHOST_OWNER_PASSWORD ?? 'Password123!';

function requireSelfHostEnv() {
  test.skip(!anonKey || !serviceRoleKey, 'Self-host Supabase anon/service role env vars are required.');
}

test.describe('self-host auth owner go-live and ingest', () => {
  test('signs up, confirms, signs in, validates JWT session, signs out, and signs JR/super_admin back in', async ({ page }, testInfo) => {
    requireSelfHostEnv();
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const email = `selfhost-${Date.now()}@example.test`;
    const password = 'Password123!';

    await page.goto('/login?mode=signup');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await testInfo.attach('signup', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: /create account/i }).click();
    await expect(page.getByText(/account created|check your inbox/i)).toBeVisible();

    const { data: listed, error: listError } = await admin.auth.admin.listUsers();
    expect(listError).toBeNull();
    const created = listed.users.find((user) => user.email === email);
    expect(created?.id).toBeTruthy();
    const { error: confirmError } = await admin.auth.admin.updateUserById(created!.id, { email_confirm: true });
    expect(confirmError).toBeNull();

    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill(password);
    await testInfo.attach('signin', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/live|\/onboarding/);

    const token = await page.evaluate(async () => {
      const keys = Object.keys(localStorage).filter((key) => key.startsWith('sb-') && key.endsWith('-auth-token'));
      for (const key of keys) {
        const parsed = JSON.parse(localStorage.getItem(key) ?? '{}');
        if (parsed?.access_token) return parsed.access_token as string;
      }
      return null;
    });
    expect(token).toBeTruthy();
    const sessionResponse = await page.request.get('/auth/session', { headers: { Authorization: `Bearer ${token}` } });
    const sessionText = await sessionResponse.text();
    await testInfo.attach('session', { body: sessionText, contentType: 'application/json' });
    expect(sessionResponse.ok()).toBeTruthy();
    await expect(sessionResponse).toBeOK();
    expect(JSON.parse(sessionText)).toMatchObject({ ok: true });

    await page.goto('/login');
    await page.getByLabel(/email address/i).fill(email);
    await page.getByLabel(/^password$/i).fill('WrongPassword123!');
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();

    await page.goto('/settings');
    await testInfo.attach('signout', { body: await page.screenshot(), contentType: 'image/png' });
    await page.getByRole('button', { name: /sign out/i }).click();
    await expect(page.getByRole('link', { name: /sign in/i })).toBeVisible();

    await page.goto('/login');
    await page.getByLabel(/email address/i).fill(ownerEmail);
    await page.getByLabel(/^password$/i).fill(ownerPassword);
    await page.getByRole('button', { name: /^sign in$/i }).click();
    await page.waitForURL(/\/live|\/ops|\/onboarding/);
  });

  test('JR/super_admin can go live broadcast-only, receive broadcast playback, heartbeat, and ingest media', async ({ page }, testInfo) => {
    requireSelfHostEnv();
    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const { data: signIn, error } = await auth.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });
    expect(error).toBeNull();
    const jwt = signIn.session?.access_token;
    expect(jwt).toBeTruthy();

    const goLive = await page.request.post('/ops/streams/go-live', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-live-${Date.now()}` },
      data: { isLive: true, collectionId: 'https://cdn.example/live.m3u8', title: 'Owner Broadcast', activeGameId: null },
    });
    const goLiveText = await goLive.text();
    await testInfo.attach('owner-go-live-activeGameId-null', { body: goLiveText, contentType: 'application/json' });
    expect(goLive.status()).toBe(200);
    expect(JSON.parse(goLiveText)).toMatchObject({ ok: true, activeGameId: null });

    const playback = await page.request.post('/api/broadcast/session', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-broadcast-session-${Date.now()}` },
      data: { sessionKey: `owner-session-${Date.now()}` },
    });
    const playbackBody = await playback.json();
    await testInfo.attach('broadcast-session-response', { body: JSON.stringify(playbackBody, null, 2), contentType: 'application/json' });
    expect(playback.status()).toBe(200);
    expect(playbackBody.playback?.url).toContain('m3u8');

    const heartbeat = await page.request.post('/api/broadcast/session/heartbeat', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-heartbeat-${Date.now()}` },
      data: { sessionId: playbackBody.session.id },
    });
    expect(heartbeat.status()).toBe(200);

    const presign = await page.request.post('/ops/ingest/presign', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-presign-${Date.now()}` },
      data: { kind: 'event', filename: 'tiny-owner.png' },
    });
    const presignBody = await presign.json();
    expect(presign.status()).toBe(200);
    await page.request.put(presignBody.signedUrl, { data: Buffer.from([0x89, 0x50, 0x4e, 0x47]) });

    const submit = await page.request.post('/ops/ingest/submit', {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-submit-${Date.now()}` },
      data: {
        kind: 'event',
        objectPath: presignBody.objectPath,
        publicUrl: presignBody.publicUrl ?? presignBody.signedUrl,
        title: 'Owner tiny fixture',
        leagueId: 'sbbl',
        publishStatus: 'draft',
      },
    });
    const submitBody = await submit.json();
    expect(submit.status()).toBe(200);

    const approve = await page.request.post(`/ops/ingest/${submitBody.jobId}/approve`, {
      headers: { Authorization: `Bearer ${jwt}`, 'x-idempotency-key': `owner-approve-${Date.now()}` },
      data: {},
    });
    const approveBody = await approve.json();
    await testInfo.attach('ingest-approve', { body: JSON.stringify(approveBody, null, 2), contentType: 'application/json' });
    expect(approve.status()).toBe(200);

    const db = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
    const [job, publication, audit] = await Promise.all([
      db.from('ingest_jobs').select('*').eq('id', submitBody.jobId).maybeSingle(),
      db.from('media_publications').select('*').eq('id', approveBody.publicationId).maybeSingle(),
      db.from('audit_logs').select('*').limit(5),
    ]);
    await testInfo.attach('ingest-db-proof', {
      body: JSON.stringify({ ingest_jobs: job.data, media_publications: publication.data, audit_logs: audit.data }, null, 2),
      contentType: 'application/json',
    });
    expect(job.data).toBeTruthy();
    expect(publication.data).toBeTruthy();
  });
});
