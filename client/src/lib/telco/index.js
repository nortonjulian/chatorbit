import * as mock from './mock.js';
import * as telnyx from './telnyx.js';
import * as bandwidth from './bandwidth.js';

const providers = { mock, telnyx, bandwidth };

export function getProvider(name) {
  const key = (name || process.env.DEFAULT_PROVIDER || 'mock').toLowerCase();
  const mod = providers[key];
  if (!mod) throw new Error(`Unsupported provider: ${key}`);
  return mod;
}
