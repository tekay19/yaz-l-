import { signOut } from '@/lib/auth/current';

export const runtime = 'nodejs';

export async function POST() {
  await signOut();
  return Response.json({ ok: true });
}
