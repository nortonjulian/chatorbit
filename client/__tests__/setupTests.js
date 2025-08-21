import '@testing-library/jest-dom';

if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
}
HTMLMediaElement.prototype.play = () => {};
HTMLMediaElement.prototype.pause = () => {};

import '@testing-library/jest-dom';

// (optional common browser shims)
if (!window.matchMedia) {
  window.matchMedia = () => ({
    matches: false,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
