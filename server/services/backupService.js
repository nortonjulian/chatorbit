import prisma from '../utils/prismaClient.js';

/** stream helper */
async function write(res, str) {
  if (!res.write(str)) await new Promise(r => res.once('drain', r));
}

/**
 * Streams a user’s data as JSON.
 * Includes: profile, devices, contacts, chatrooms(meta), messagesAuthored, statusesAuthored, reactions, statusViews.
 * NOTE: we *only* include *user-authored* message content for privacy.
 */
export async function exportUserDataStream(res, userId) {
  await write(res, '{\n');

  // profile (safe fields only)
  const profile = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, username: true, email: true, phone: true,
      plan: true, theme: true, preferredLanguage: true,
      createdAt: true, updatedAt: true,
    },
  });
  await write(res, `  "profile": ${JSON.stringify(profile || {})},\n`);

  // devices
  const devices = await prisma.device.findMany({
    where: { userId },
    select: { id: true, name: true, platform: true, createdAt: true, lastSeenAt: true },
    orderBy: { createdAt: 'asc' },
  });
  await write(res, `  "devices": ${JSON.stringify(devices)},\n`);

  // contacts I saved
  const contacts = await prisma.contact.findMany({
    where: { ownerId: userId },
    select: { id: true, userId: true, alias: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  await write(res, `  "contacts": ${JSON.stringify(contacts)},\n`);

  // chatrooms I’m in (meta only)
  const rooms = await prisma.chatRoom.findMany({
    where: { participants: { some: { id: userId } } },
    select: {
      id: true, name: true, type: true, createdAt: true,
      participants: { select: { id: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  const chatrooms = rooms.map(r => ({
    id: r.id, name: r.name, type: r.type, createdAt: r.createdAt,
    participantIds: r.participants.map(p => p.id),
  }));
  await write(res, `  "chatrooms": ${JSON.stringify(chatrooms)},\n`);

  // messages authored by me
  const messagesAuthored = await prisma.message.findMany({
    where: { authorId: userId },
    select: {
      id: true, chatRoomId: true, createdAt: true, editedAt: true, deletedAt: true,
      kind: true, content: true,
      attachments: { select: { id: true, filename: true, mimeType: true, size: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  await write(res, `  "messagesAuthored": ${JSON.stringify(messagesAuthored)},\n`);

  // statuses authored by me
  const statusesAuthored = await prisma.status.findMany({
    where: { authorId: userId },
    select: {
      id: true, audience: true, caption: true, createdAt: true, expiresAt: true,
      media: { select: { id: true, filename: true, mimeType: true, size: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
  await write(res, `  "statusesAuthored": ${JSON.stringify(statusesAuthored)},\n`);

  // my reactions
  const messageReactionsByUser = await prisma.messageReaction.findMany({
    where: { userId },
    select: { id: true, messageId: true, emoji: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  await write(res, `  "messageReactionsByUser": ${JSON.stringify(messageReactionsByUser)},\n`);

  // statuses I viewed (if table exists)
  let statusViewsByUser = [];
  try {
    statusViewsByUser = await prisma.statusView.findMany({
      where: { viewerId: userId },
      select: { statusId: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
  } catch { /* optional table */ }
  await write(res, `  "statusViewsByUser": ${JSON.stringify(statusViewsByUser)}\n`);

  await write(res, '}\n');
}

/** set headers + call stream */
export async function respondWithUserBackup(res, userId, filenameBase = 'chatforia-backup') {
  const dt = new Date();
  const fname = `${filenameBase}-${dt.getFullYear()}${String(dt.getMonth()+1).padStart(2,'0')}${String(dt.getDate()).padStart(2,'0')}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
  await exportUserDataStream(res, userId);
}
