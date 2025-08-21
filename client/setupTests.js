if (!window.matchMedia) {
  window.matchMedia = () => ({ matches: false, addListener() {}, removeListener() {} });
}
HTMLMediaElement.prototype.play = () => {};
HTMLMediaElement.prototype.pause = () => {};
