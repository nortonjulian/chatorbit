/**
 * @jest-environment node
 */
import request from 'supertest';
import app from '../app.js';
import prisma from '../utils/prismaClient.js';

async function registerAndLogin(agent, { email, username, password }) {
  await agent.post('/auth/register').send({ email, username, password }).expect(200);
  await agent.post('/auth/login').send({ email, password }).expect(200);
}

describe('Backups export', () => {
  const agent = request.agent(app);
  const email = `me_${Date.now()}@example.com`;
  const username = `me_${Date.now()}`;
  const password = 'testpass123!';

  beforeAll(async () => {
    await registerAndLogin(agent, { email, username, password });

    const me = await prisma.user.findFirst({ where: { email } });

    // seed simple data authored by me
    const room = await prisma.chatRoom.create({
      data: {
        type: 'DIRECT',
        participants: { connect: [{ id: me.id }] },
      }
    });
    await prisma.message.create({
      data: { chatRoomId: room.id, authorId: me.id, kind: 'text', content: 'hello export' }
    });
    await prisma.status.create({
      data: { authorId: me.id, audience: 'PRIVATE', caption: 'my story', expiresAt: new Date(Date.now()+3600_000) }
    });
  });

  test('returns a JSON download with my data', async () => {
    const res = await agent.get('/backups/export').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.headers['content-disposition']).toMatch(/attachment/);
    const parsed = JSON.parse(res.text);
    expect(parsed).toHaveProperty('profile');
    expect(parsed).toHaveProperty('messagesAuthored');
    expect(parsed.messagesAuthored.map(m => m.content)).toContain('hello export');
  });

  test('unauthorized blocked', async () => {
    await request(app).get('/backups/export').expect(401);
  });
});
