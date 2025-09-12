let _emitToUser = () => {};
let _io = null;

export function setSocketIo(io, emitToUser) {
  _io = io;
  _emitToUser = emitToUser || ((uid, evt, payload) => io?.to(`user:${uid}`)?.emit(evt, payload));
}

export function emitToUser(userId, event, payload) {
  return _emitToUser?.(userId, event, payload);
}

export function getIo() { return _io; }
