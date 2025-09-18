import express from 'express';
const router = express.Router();

// Telnyx: typically POSTs { data: { event_type, payload: {...} } }
router.post('/telnyx', express.json(), async (req, res) => {
  try {
    const ev = req.body?.data || req.body;
    const type = ev?.event_type || ev?.type || 'unknown';
    const p = ev?.payload || ev?.data;
    console.log('[webhook][telnyx]', type, {
      id: p?.id,
      to: p?.to || p?.to_number,
      from: p?.from || p?.from_number,
      status: p?.delivery_status,
      client_ref: p?.client_ref,
      text: p?.text,
    });
    // TODO: handle inbound message → create message record, etc.
    res.sendStatus(200);
  } catch (e) {
    console.error('[webhook][telnyx] error', e);
    res.sendStatus(500);
  }
});

// Bandwidth: usually an array of events in one POST
router.post('/bandwidth', express.json(), async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const evt of events) {
      console.log('[webhook][bandwidth]', evt?.type, {
        messageId: evt?.message?.id,
        to: evt?.to,
        from: evt?.from,
        description: evt?.description,
        tag: evt?.tag,
        text: evt?.text,
      });
      // TODO: handle inbound message & delivery receipts
    }
    res.sendStatus(200);
  } catch (e) {
    console.error('[webhook][bandwidth] error', e);
    res.sendStatus(500);
  }
});

export default router;
