// CommonJS so Jest can require it without ESM loader headaches
require('@testing-library/jest-dom');

// If your app touches crypto.subtle in tests, keep a stub:
if (!global.crypto) global.crypto = {};
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    // add minimal stubs your code touches, or leave empty
  };
}

/**
 * Global console filters:
 *  - silence React Testing Library's "ReactDOMTestUtils.act is deprecated"
 *  - silence React Router v7 "Future Flag" warnings
 *  - (optional) quiet some frequent DOM prop warnings from design libs
 *
 * We bind the real console methods first so our mocks can delegate safely.
 */
const REAL_ERR = console.error.bind(console);
const REAL_WARN = console.warn.bind(console);

jest.spyOn(console, 'error').mockImplementation((...args) => {
  const [first] = args;
  const msg = typeof first === 'string' ? first : (first && first.message) || '';

  if (msg.includes('ReactDOMTestUtils.act is deprecated')) return;
  if (msg.includes('Not implemented: navigation (except hash changes)')) return;

  REAL_ERR(...args);
});

jest.spyOn(console, 'warn').mockImplementation((...args) => {
  const [msg] = args;
  if (typeof msg === 'string') {
    // React Router v7 future-flag warnings
    if (msg.includes('React Router Future Flag Warning')) return;

    // Optional: quiet common DOM prop warnings you don't care about in tests
    if (msg.includes('Received `true` for a non-boolean attribute `grow`')) return;
    if (msg.includes('does not recognize the `withinPortal` prop')) return;
  }
  REAL_WARN(...args);
});

// No afterAll restore here on purpose — this file runs per test environment,
// so each test file gets fresh spies automatically.
