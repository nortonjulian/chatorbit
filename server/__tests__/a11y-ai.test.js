import { makeAgent, resetDb } from './helpers/testServer.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  stt: '/a11y/transcribe',             // adjust to your route
  aiSuggest: '/ai/suggest-replies',    // adjust
};

describe.skip('A11Y/AI quotas and guards', () => {
  let agent;

  beforeAll(() => {
    agent = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
    await agent.post(ENDPOINTS.register).send({
      email: 'cap@example.com', password: 'Test12345!', username: 'cap',
    }).expect(201);
    await agent.post(ENDPOINTS.login).send({ email: 'cap@example.com', password: 'Test12345!' }).expect(200);
  });

  test('STT decrements quota', async () => {
    // Assuming free users have daily minutes; on first call it should succeed, and remaining should drop.
    const r = await agent.post(ENDPOINTS.stt).send({ blob: 'base64audio...' }).expect(200);
    expect(r.body.remainingMinutes).toBeDefined();
  });

  test('AI length/rate guard blocks overly large prompts', async () => {
    const big = 'x'.repeat(20000);
    await agent.post(ENDPOINTS.aiSuggest).send({ text: big }).expect(413); // or 422/400 per your logic
  });
});
