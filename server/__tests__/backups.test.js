/**
 * Backups export tests – fixes participant connect error by creating it inline.
 */
import request from 'supertest';
import app from '../app.js';
import { prisma } from '../utils/prismaClient.js';

const ENDPOINT = '/backups/export';

describe('Backups export', () => {
  let agent;
  let email = 'me@example.com';
  let password = 'SuperSecret123!';
  let me;

  beforeAll(async () => {
    agent = request.agent(app);

    // Ensure a user exists and is logged in (tests run with test pre-login auto-provisioner)
    await agent.post('/auth/login').send({ email, password }).expect(200);

    me = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
    expect(me).toBeTruthy();

    // Seed a simple 1:1 room owned/used by me, with a created participant row
    await prisma.chatRoom.create({
      data: {
        isGroup: false,
        participants: {
          create: [
            {
              user: { connect: { id: me.id } },
            },
          ],
        },
      },
    });

    // Optionally seed a message to ensure backup payload has content
    const room = await prisma.chatRoom.findFirst({
      where: { participants: { some: { userId: me.id } } },
    });

    await prisma.message.create({
      data: {
        content: 'hello world',
        rawContent: 'hello world',
        sender: { connect: { id: me.id } },
        chatRoom: { connect: { id: room.id } },
      },
    });
  });

  afterAll(async () => {
    // Clean up messages/rooms created by this test to keep DB tidy
    const rooms = await prisma.chatRoom.findMany({
      where: { participants: { some: { userId: me.id } } },
      select: { id: true },
    });
    for (const r of rooms) {
      await prisma.message.deleteMany({ where: { chatRoomId: r.id } });
      await prisma.participant.deleteMany({ where: { chatRoomId: r.id } });
      await prisma.chatRoom.delete({ where: { id: r.id } });
    }
  });

  it('returns a JSON download with my data', async () => {
    const res = await agent.get(ENDPOINT).expect(200);

    // Content-Disposition should suggest a JSON download
    expect(res.headers['content-type']).toMatch(/application\/json/i);
    expect(res.headers['content-disposition']).toMatch(/attachment/i);

    // Body should be valid JSON (streamed or buffered by supertest)
    expect(res.body).toBeTruthy();
    // sanity: backup should include at least user or messages arrays/objects
    const str = typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
    expect(str.length).toBeGreaterThan(2);
  });

  it('unauthorized blocked', async () => {
    await request(app).get(ENDPOINT).expect(401);
  });
});
