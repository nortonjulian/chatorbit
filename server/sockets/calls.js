export function registerCallHandlers({ io, socket, prisma }) {
  const me = Number(socket.user?.id);
  if (!me) return;

  // Caller invites callee with SDP offer
  socket.on('call:invite', async ({ calleeId, chatId, mode, sdp }) => {
    if (!calleeId || !sdp || !mode) return;
    try {
      // Record call row in DB
      const call = await prisma.call.create({
        data: {
          callerId: me,
          calleeId: Number(calleeId),
          chatId: chatId ?? null,
          mode, // 'AUDIO' | 'VIDEO'
          status: 'INITIATED',
        },
      });

      // Notify callee (if online)
      io.to(`user:${Number(calleeId)}`).emit('call:ring', {
        callId: call.id,
        fromUserId: me,
        chatId: call.chatId,
        mode: call.mode,
        sdp, // caller offer
        createdAt: call.createdAt,
      });
    } catch (e) {
      socket.emit('call:error', { error: 'INVITE_FAILED' });
    }
  });

  // Callee answers with SDP answer (or rejects)
  socket.on('call:answer', async ({ callId, accept, sdp }) => {
    if (!callId) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return;

      const isCallee = call.calleeId === me;
      if (!isCallee) return;

      if (!accept) {
        await prisma.call.update({
          where: { id: callId },
          data: { status: 'REJECTED', endedAt: new Date() },
        });
        io.to(`user:${call.callerId}`).emit('call:rejected', { callId });
        return;
      }

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ANSWERED', acceptedAt: new Date() },
      });

      // Send answer to caller
      io.to(`user:${call.callerId}`).emit('call:answered', { callId, sdp });
    } catch (e) {
      socket.emit('call:error', { error: 'ANSWER_FAILED' });
    }
  });

  // ICE candidate relay (both directions)
  socket.on('call:candidate', async ({ callId, toUserId, candidate }) => {
    if (!callId || !toUserId || !candidate) return;
    io.to(`user:${Number(toUserId)}`).emit('call:candidate', { callId, candidate });
  });

  // Hang up (either side)
  socket.on('call:hangup', async ({ callId }) => {
    if (!callId) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return;

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: new Date() },
      });

      const peerId = me === call.callerId ? call.calleeId : call.callerId;
      io.to(`user:${peerId}`).emit('call:ended', { callId });
    } catch (e) {
      socket.emit('call:error', { error: 'HANGUP_FAILED' });
    }
  });
}
