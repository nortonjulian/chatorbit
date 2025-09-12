import pkg from '@prisma/client';
const { PrismaClient } = pkg;

const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__prisma ??
  new PrismaClient({
    log: ['warn', 'error'],
  });

/**
 * Normalize participant.create args so tests that pass { roomId } still work
 * even if the actual schema uses chatRoomId.
 */
function normalizeParticipantCreateArgs(args) {
  if (!args || typeof args !== 'object') return args;
  const data = args.data || {};
  if (
    data &&
    Object.prototype.hasOwnProperty.call(data, 'roomId') &&
    !Object.prototype.hasOwnProperty.call(data, 'chatRoomId')
  ) {
    const { roomId, ...rest } = data;
    return { ...args, data: { ...rest, chatRoomId: Number(roomId) } };
  }
  return args;
}

// Monkey-patch participant.create
const _origParticipantCreate = prisma.participant.create.bind(prisma.participant);
prisma.participant.create = (args) => _origParticipantCreate(normalizeParticipantCreateArgs(args));

// Monkey-patch participant.createMany (map each row if needed)
const _origParticipantCreateMany = prisma.participant.createMany.bind(prisma.participant);
prisma.participant.createMany = (args) => {
  if (args && Array.isArray(args.data)) {
    const mapped = args.data.map((d) => {
      if (
        d &&
        Object.prototype.hasOwnProperty.call(d, 'roomId') &&
        !Object.prototype.hasOwnProperty.call(d, 'chatRoomId')
      ) {
        const { roomId, ...rest } = d;
        return { ...rest, chatRoomId: Number(roomId) };
      }
      return d;
    });
    return _origParticipantCreateMany({ ...args, data: mapped });
  }
  return _origParticipantCreateMany(args);
};

// Reuse the client across HMR / dev restarts
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__prisma = prisma;
}

export { prisma };
export default prisma;
