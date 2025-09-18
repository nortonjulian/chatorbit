/**
 * @jest-environment node
 */
import { buildQueues, areCompatible, tryMatch } from '../services/randomChatService.js';

// fake prisma with only what we use
const prisma = {
  randomChatRoom: {
    create: jest.fn(async ({ data }) => ({
      id: 123,
      participants: data.participants.connect.map(c => ({ id: c.id })),
      messages: [{ content: data.messages.create[0].content }],
    })),
  },
};

// fake io + sockets
function makeFakeIo() {
  const sockets = new Map();
  return {
    sockets: { sockets },
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    _registerSocket(id, sock) { sockets.set(id, sock); },
    _get(id) { return sockets.get(id); },
  };
}
function makeFakeSocket(id) {
  return {
    id,
    events: [],
    rooms: new Set(),
    join: jest.fn(function (room) { this.rooms.add(room); }),
    leave: jest.fn(function (room) { this.rooms.delete(room); }),
    emit: jest.fn(function (event, payload) { this.events.push({ event, payload }); }),
  };
}

describe('randomChatService', () => {
  test('areCompatible respects age band rules', () => {
    const a = { userId: 1, ageBand: '18-25', wantsAgeFilter: true };
    const b = { userId: 2, ageBand: '18-25', wantsAgeFilter: false };
    const c = { userId: 3, ageBand: '26-35', wantsAgeFilter: true };

    expect(areCompatible(a, b)).toBe(true);
    expect(areCompatible(a, c)).toBe(false);
    expect(areCompatible(b, c)).toBe(false); // because c requires age filter, bands differ
  });

  test('tryMatch enqueues first and pairs second', async () => {
    const io = makeFakeIo();
    const s1 = makeFakeSocket('s1');
    const s2 = makeFakeSocket('s2');
    io._registerSocket('s1', s1);
    io._registerSocket('s2', s2);

    const queues = buildQueues();
    const getSocketById = (id) => io._get(id);

    const u1 = { socketId: 's1', userId: 1, username: 'u1', ageBand: '18-25', wantsAgeFilter: true };
    const u2 = { socketId: 's2', userId: 2, username: 'u2', ageBand: '18-25', wantsAgeFilter: false };

    // first call -> enqueued, emits 'waiting'
    const r1 = await tryMatch({ queues, prisma, io, currentEntry: u1, getSocketById });
    expect(r1.matched).toBe(false);
    expect(s1.events.some(e => e.event === 'waiting')).toBe(true);
    expect(queues.waitingQueue).toHaveLength(1);

    // second call -> match occurs, both sockets joined + notified
    const r2 = await tryMatch({ queues, prisma, io, currentEntry: u2, getSocketById });
    expect(r2.matched).toBe(true);
    expect(r2.roomId).toBe(123);
    expect(s1.events.some(e => e.event === 'pair_found')).toBe(true);
    expect(s2.events.some(e => e.event === 'pair_found')).toBe(true);

    // both should be in the same room
    expect(s1.rooms.has('random:123')).toBe(true);
    expect(s2.rooms.has('random:123')).toBe(true);
  });
});
