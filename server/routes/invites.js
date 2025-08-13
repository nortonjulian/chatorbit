import express from 'express';
import verifyToken from '../middleware/verifyToken.js';
import telnyx from 'telnyx';
import Bandwidth from '@bandwidth/messaging';

const router = express.Router();

const {
  INVITES_PROVIDER,               // 'telnyx' | 'bandwidth'
  APP_DOWNLOAD_URL,

  // Telnyx
  TELNYX_API_KEY,
  TELNYX_MESSAGING_PROFILE_ID,    // or use a specific number as from
  TELNYX_FROM_NUMBER,             // optional: if you prefer a fixed from number

  // Bandwidth
  BANDWIDTH_ACCOUNT_ID,
  BANDWIDTH_USER_ID,
  BANDWIDTH_PASSWORD,
  BANDWIDTH_MESSAGING_APPLICATION_ID,
  BANDWIDTH_FROM_NUMBER,
} = process.env;

const normalize = s => (s || '').toString().replace(/[^\d+]/g, '');

// --- Provider clients (init if configured) ---
const tx = TELNYX_API_KEY ? telnyx(TELNYX_API_KEY) : null;

const bwClient = (BANDWIDTH_ACCOUNT_ID && BANDWIDTH_USER_ID)
  ? new Bandwidth.Client({
      basicAuthUserName: BANDWIDTH_USER_ID,
      basicAuthPassword: BANDWIDTH_PASSWORD,
    })
  : null;

// --- Send via Telnyx ---
async function sendViaTelnyx({ to, text }) {
  if (!tx) throw new Error('Telnyx not configured');
  // Telnyx allows either messaging profile id or a specific from number
  const from = TELNYX_FROM_NUMBER || TELNYX_MESSAGING_PROFILE_ID;
  if (!from) throw new Error('Missing TELNYX_MESSAGING_PROFILE_ID or TELNYX_FROM_NUMBER');

  await tx.messages.create({
    from,                 // Messaging Profile ID or E.164 number
    to,
    text,
  });
}

// --- Send via Bandwidth ---
async function sendViaBandwidth({ to, text }) {
  if (!bwClient) throw new Error('Bandwidth not configured');
  await bwClient.createMessage({
    accountId: BANDWIDTH_ACCOUNT_ID,
    applicationId: BANDWIDTH_MESSAGING_APPLICATION_ID,
    to: [to],
    from: BANDWIDTH_FROM_NUMBER,
    text,
  });
}

// --- Router: POST /invites ---
router.post('/', verifyToken, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    const inviter = req.user?.username || 'A friend';
    const text = (message?.trim()) ||
      `${inviter} invited you to try ChatOrbit. Download here: ${APP_DOWNLOAD_URL || ''}`;

    const to = normalize(phone);

    // Optional: smart routing (example: use Bandwidth for US numbers, Telnyx for intl)
    // const useBandwidth = to.startsWith('+1'); // uncomment if you want per-country routing
    // const preferred = useBandwidth ? 'bandwidth' : 'telnyx';

    const preferred = (INVITES_PROVIDER || 'telnyx').toLowerCase();

    // Send with preferred provider, then fall back if it errors.
    try {
      if (preferred === 'bandwidth') {
        await sendViaBandwidth({ to, text });
      } else {
        await sendViaTelnyx({ to, text });
      }
    } catch (primaryErr) {
      // Fallback to the other provider
      try {
        if (preferred === 'bandwidth') {
          await sendViaTelnyx({ to, text });
        } else {
          await sendViaBandwidth({ to, text });
        }
      } catch (fallbackErr) {
        console.error('Invite failed (primary & fallback):', { primaryErr, fallbackErr });
        return res.status(502).json({ error: 'Failed to send invite' });
      }
    }

    res.json({ sent: true });
  } catch (err) {
    console.error('Invite failed:', err);
    res.status(500).json({ error: 'Failed to send invite' });
  }
});

router.post('/email', verifyToken, async (req, res) => {
  const { to, roomId } = req.body || {};
  if (!Array.isArray(to) || !to.length || !roomId) {
    return res.status(400).json({ error: 'to[] and roomId required' });
  }
  // assume you already create a code elsewhere
  const joinUrl = `${process.env.APP_ORIGIN || 'http://localhost:5173'}/join/${roomId}`;
  const transport = nodemailer.createTransport(process.env.SMTP_URL /* ...same as above... */);
  await transport.sendMail({
    from: process.env.MAIL_FROM || 'noreply@chatorbit.app',
    to,
    subject: 'Join me on ChatOrbit',
    text: `Join my chat: ${joinUrl}`,
  });
  res.json({ ok: true, sent: to.length });
});


export default router;
