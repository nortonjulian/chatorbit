export async function scanFile(absPath) {
  if (process.env.CLAMAV_DISABLED === 'true') return { ok: true };
  // integrate clamdscan/clamav.js here; for now pretend success:
  return { ok: true };
}
