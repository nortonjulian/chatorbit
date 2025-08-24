// CommonJS so Jest can require it without ESM loader headaches
require('@testing-library/jest-dom');

// If your app touches crypto.subtle in tests, keep a stub:
if (!global.crypto) global.crypto = {};
if (!global.crypto.subtle) {
  global.crypto.subtle = {
    // add minimal stubs your code touches, or leave empty for now
  };
}

// (Optional) silence the React Testing Library "act" deprecation noise:
// const origError = console.error;
// jest.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
//   if (typeof msg === 'string' && msg.includes('ReactDOMTestUtils.act is deprecated')) return;
//   origError(msg, ...rest);
// });
