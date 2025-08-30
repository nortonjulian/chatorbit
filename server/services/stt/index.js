import * as mock from './mock.js';

const provider = (process.env.STT_PROVIDER || 'mock').toLowerCase();
const adapters = { mock };
const impl = adapters[provider] || mock;


export async function transcribeFromUrl(url, language = 'en-US') {
return impl.transcribeFromUrl(url, language);
}