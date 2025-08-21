import Boom from '@hapi/boom';
import { RoleRank, canActOnRank, getEffectiveRoomRank } from '../utils/roomAuth.js';
import { jest } from '@jest/globals';

describe('RoleRank constants', () => {
  test('values are increasing for higher roles', () => {
    expect(RoleRank.MEMBER).toBe(0);
    expect(RoleRank.MODERATOR).toBe(1);
    expect(RoleRank.ADMIN).toBe(2);
    expect(RoleRank.OWNER).toBe(3);
  });
});

describe('canActOnRank', () => {
  // OWNER (3) can act on any rank
  expect(canActOnRank(RoleRank.OWNER, RoleRank.ADMIN)).toBe(true);
  // ADMIN (2) can act on MODERATOR (1) but not on OWNER (3)
  expect(canActOnRank(RoleRank.ADMIN, RoleRank.MODERATOR)).toBe(true);
  expect(canActOnRank(RoleRank.ADMIN, RoleRank.OWNER)).toBe(false);
  // MODERATOR (1) can only act on MEMBER (0)
  expect(canActOnRank(RoleRank.MODERATOR, RoleRank.MEMBER)).toBe(true);
  expect(canActOnRank(RoleRank.MODERATOR, RoleRank.ADMIN)).toBe(false);
  // MEMBER (0) cannot act on anyone
  expect(canActOnRank(RoleRank.MEMBER, RoleRank.MEMBER)).toBe(false);
});

describe('getEffectiveRoomRank (using fake Prisma)', () => {
  const fakePrisma = {
    chatRoom: { findUnique: jest.fn() },
    participant: { findUnique: jest.fn() },
  };

  test('throws if IDs are not numbers', async () => {
    await expect(getEffectiveRoomRank(fakePrisma, 'abc', 'def', 'MEMBER'))
      .rejects.toThrow();
  });

  test('global ADMIN returns ADMIN rank without DB', async () => {
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'ADMIN')).toBe(RoleRank.ADMIN);
  });

  test('room not found throws notFound', async () => {
    fakePrisma.chatRoom.findUnique.mockResolvedValue(null);
    await expect(getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER'))
      .rejects.toThrow('Room not found');
  });

  test('owner returns OWNER rank', async () => {
    fakePrisma.chatRoom.findUnique.mockResolvedValue({ ownerId: 1 });
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER')).toBe(RoleRank.OWNER);
  });

  test('non-member returns null', async () => {
    fakePrisma.chatRoom.findUnique.mockResolvedValue({ ownerId: 2 });
    fakePrisma.participant.findUnique.mockResolvedValue(null);
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER')).toBeNull();
  });

  test('participant roles map correctly', async () => {
    fakePrisma.chatRoom.findUnique.mockResolvedValue({ ownerId: 2 });
    fakePrisma.participant.findUnique.mockResolvedValue({ role: 'ADMIN' });
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER')).toBe(RoleRank.ADMIN);
    fakePrisma.participant.findUnique.mockResolvedValue({ role: 'MODERATOR' });
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER')).toBe(RoleRank.MODERATOR);
    fakePrisma.participant.findUnique.mockResolvedValue({ role: 'MEMBER' });
    expect(await getEffectiveRoomRank(fakePrisma, 1, 100, 'MEMBER')).toBe(RoleRank.MEMBER);
  });
});
