import request from 'supertest';
import { createApp } from '../../app.js';
import prisma from '../../utils/prismaClient.js';

export function makeAgent() {
  const app = createApp();
  const agent = request.agent(app); // keeps cookies across requests
  return { app, agent };
}

export async function resetDb() {
  // Prefer a clean DB per suite; adjust if you use migrate reset scripts
  // You can also truncate tables you touch for speed.
  await prisma.messageReaction.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.participant.deleteMany({});
  await prisma.chatRoom.deleteMany({});
  await prisma.user.deleteMany({});
}
