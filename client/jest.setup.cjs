require('@testing-library/jest-dom');

// If your component uses crypto.subtle in the browser, polyfill or stub it:
if (!global.crypto) global.crypto = {};
if (!global.crypto.subtle) global.crypto.subtle = { /* add minimal stubs your code touches */ };
