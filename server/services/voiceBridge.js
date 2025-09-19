import Boom from '@hapi/boom';
import prisma from '../utils/prismaClient.js';
import { normalizeE164, isE164 } from '../utils/phone.js';

// You’ll need small provider clients/adapters (Telnyx Call Control / Bandwidth Voice)
// Here we assume you have helpers you can fill in later.
async function getUserAliasNumber(userId) {
  const user = await prisma.user.findUnique({
    where: { id: Number(userId) },
    select: { assignedNumbers: { select: { e164: true }, take: 1, orderBy: { id: 'asc' } }, forwardPhoneNumber: true }
  });
  const from = user?.assignedNumbers?.[0]?.e164 ? normalizeE164(user.assignedNumbers[0].e164) : null;
  if (!from) throw Boom.preconditionFailed('No ChatOrbit number assigned');
  const userPhone = normalizeE164(user?.forwardPhoneNumber || '');
  return { from, userPhone };
}

export async function startAliasCall({ userId, to }) {
  const dest = normalizeE164(to);
  if (!isE164(dest)) throw Boom.badRequest('Invalid destination phone');
  const { from, userPhone } = await getUserAliasNumber(userId);
  if (!isE164(userPhone)) throw Boom.preconditionFailed('User forwarding phone not verified');

  // PSEUDO: for Telnyx Call Control (or Bandwidth BXML)
  // 1) Create Call A: from ChatOrbit number -> userPhone, answer with TTS "press 1"
  // 2) Gather DTMF, on '1' create Call B: from ChatOrbit number -> dest, then bridge A<->B
  // You’ll wire these in your existing voice webhook controller.

  // We return early; actual call flow continues via webhooks.
  return { ok: true, from, to: dest, stage: 'legA-dialing' };
}
