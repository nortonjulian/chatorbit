import 'dotenv/config';

// If your tests use a factory to build the app, reuse it:
import makeApp from '../tests/appFactory.js';  // path is from /server/scripts → /server/tests

const port = process.env.PORT || 3000;

const app = await makeApp();
app.get('/healthz', (_req, res) => res.status(200).json({ ok: true })); // keep this

app.listen(port, () => {
  console.log(`[miniserver] listening on http://localhost:${port}`);
});
