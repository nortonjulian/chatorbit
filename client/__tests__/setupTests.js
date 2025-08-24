require('@testing-library/jest-dom');

// (Optional) quiet a few noisy warnings you mentioned
const origError = console.error;

beforeAll(() => {
  jest.spyOn(console, 'error').mockImplementation((msg, ...args) => {
    if (typeof msg === 'string') {
      // silence these specific warnings during tests
      if (
        msg.includes('ReactDOMTestUtils.act is deprecated') ||
        msg.includes('not wrapped in act') ||
        msg.includes('React does not recognize the `leftSection`')
      ) {
        return;
      }
    }
    origError(msg, ...args);
  });
});

afterAll(() => {
  if (console.error.mockRestore) console.error.mockRestore();
});
