// Core logic for random chat matching, extracted from routes.
// Dependency-injected: prisma, io, and a queues object to keep tests simple.

export function buildQueues() {
  return {
    waitingQueue: [],                 // [{ socketId, userId, username, ageBand, wantsAgeFilter }]
    waitingBySocket: new Map(),       // socketId -> entry
    activeRoomBySocket: new Map(),    // socketId -> { roomId, peerSocketId, peerUserId }
  };
}

export function areCompatible(a, b) {
  if (!a || !b) return false;
  if (a.userId === b.userId) return false;
  // if either side wants an age filter, and both have ageBand, they must match
  if (a.wantsAgeFilter && a.ageBand && b.ageBand && a.ageBand !== b.ageBand) return false;
  if (b.wantsAgeFilter && b.ageBand && a.ageBand && a.ageBand !== b.ageBand) return false;
  return true;
}

export function enqueue(queues, entry) {
  queues.waitingQueue.push(entry);
  queues.waitingBySocket.set(entry.socketId, entry);
}

export function removeFromQueue(queues, socketId) {
  if (!queues.waitingBySocket.has(socketId)) return null;
  const entry = queues.waitingBySocket.get(socketId);
  queues.waitingBySocket.delete(socketId);
  const idx = queues.waitingQueue.findIndex((e) => e.socketId === socketId);
  if (idx >= 0) queues.waitingQueue.splice(idx, 1);
  return entry;
}

export async function createRandomRoom(prisma, userA, userB) {
  const systemIntro = `You've been paired for a random chat. Be kind!`;
  const room = await prisma.randomChatRoom.create({
    data: {
      participants: {
        connect: [{ id: userA.userId }, { id: userB.userId }],
      },
      messages: {
        create: [
          {
            content: systemIntro,
            sender: { connect: { id: userA.userId } }, // or a system user if you have one
          },
        ],
      },
    },
    include: {
      participants: true,
      messages: { include: { sender: true } },
    },
  });
  return room;
}

/**
 * Attempts to match `currentEntry` against the FIFO waiting queue.
 * - If no peer: enqueues and emits 'waiting'
 * - If peer: creates DB room, joins sockets to io room, emits 'pair_found'
 */
export async function tryMatch({ queues, prisma, io, currentEntry, getSocketById }) {
  // find first compatible peer (FIFO)
  const peerIdx = queues.waitingQueue.findIndex((e) => areCompatible(currentEntry, e));
  if (peerIdx === -1) {
    enqueue(queues, currentEntry);
    const socket = getSocketById(currentEntry.socketId);
    if (socket) socket.emit('waiting', 'Looking for a partner…');
    return { matched: false };
  }

  const peerEntry = queues.waitingQueue[peerIdx];
  // remove peer from queue
  queues.waitingQueue.splice(peerIdx, 1);
  queues.waitingBySocket.delete(peerEntry.socketId);

  // create DB room
  const room = await createRandomRoom(prisma, currentEntry, peerEntry);

  // put both sockets into an io room
  const chan = `random:${room.id}`;
  const sA = getSocketById(currentEntry.socketId);
  const sB = getSocketById(peerEntry.socketId);
  if (sA) sA.join(chan);
  if (sB) sB.join(chan);

  // track active map for cleanup
  queues.activeRoomBySocket.set(currentEntry.socketId, {
    roomId: room.id,
    peerSocketId: peerEntry.socketId,
    peerUserId: peerEntry.userId,
  });
  queues.activeRoomBySocket.set(peerEntry.socketId, {
    roomId: room.id,
    peerSocketId: currentEntry.socketId,
    peerUserId: currentEntry.userId,
  });

  // notify both sides
  if (sA) {
    sA.emit('pair_found', {
      roomId: room.id,
      partner: peerEntry.username,
      partnerId: peerEntry.userId,
    });
  }
  if (sB) {
    sB.emit('pair_found', {
      roomId: room.id,
      partner: currentEntry.username,
      partnerId: currentEntry.userId,
    });
  }

  return { matched: true, roomId: room.id, partnerId: peerEntry.userId };
}
