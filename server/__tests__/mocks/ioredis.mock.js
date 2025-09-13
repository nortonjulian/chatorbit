// ESM mock for 'ioredis'
export default class Redis {
  constructor() {}
  on() {}
  quit() { return Promise.resolve(); }
  disconnect() {}
  publish() { return Promise.resolve(0); }
  subscribe() { return Promise.resolve(); }
  psubscribe() { return Promise.resolve(); }
  unsubscribe() { return Promise.resolve(); }
}
