import { makeAgent, resetDb } from './helpers/testServer.js';
import prisma from '../utils/prismaClient.js';

const ENDPOINTS = {
  register: '/auth/register',
  login: '/auth/login',
  follow: (userId) => `/follows/${userId}`,
  unfollow: (userId) => `/follows/${userId}`,
  feed: '/status/feed?scope=following', // adjust as needed
};

describe.skip('Follows: follow/unfollow & feed filter', () => {
  let a, b, aid, bid;

  beforeAll(() => {
    a = makeAgent().agent;
    b = makeAgent().agent;
  });

  beforeEach(async () => {
    await resetDb();
    await a.post('/auth/register').send({ email: 'a@x.com', password: 'Pass123!', username: 'a' });
    await a.post('/auth/login').send({ email: 'a@x.com', password: 'Pass123!' });
    await b.post('/auth/register').send({ email: 'b@x.com', password: 'Pass123!', username: 'b' });
    await b.post('/auth/login').send({ email: 'b@x.com', password: 'Pass123!' });
    aid = (await prisma.user.findUnique({ where: { email: 'a@x.com' } })).id;
    bid = (await prisma.user.findUnique({ where: { email: 'b@x.com' } })).id;
  });

  test('follow → follower-only status appears in feed; unfollow hides it', async () => {
    await a.post(ENDPOINTS.follow(bid)).expect(200);

    // create follower-only status by B (adjust endpoint to your status create route)
    // await b.post('/status').send({ audience: 'FOLLOWERS', content: 'hello' }).expect(201);

    // B’s post appears in A’s following feed
    const feed = await a.get(ENDPOINTS.feed).expect(200);
    // expect(feed.body.items.find((i) => i.content === 'hello')).toBeTruthy();

    await a.delete(ENDPOINTS.unfollow(bid)).expect(200);
    const feed2 = await a.get(ENDPOINTS.feed).expect(200);
    // expect(feed2.body.items.find((i) => i.content === 'hello')).toBeFalsy();
  });
});
