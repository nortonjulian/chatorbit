// ESM mock for 'redis'
export function createClient() {
  const client = {
    connect: async () => {},
    quit: async () => {},
    on: () => {},
    // common commands used in code
    get: async () => null,
    set: async () => 'OK',
    del: async () => 0,
    publish: async () => 0,
    subscribe: async () => {},
    psubscribe: async () => {},
    unsubscribe: async () => {},
    punsubscribe: async () => {},
  };
  return client;
}
export default { createClient };
