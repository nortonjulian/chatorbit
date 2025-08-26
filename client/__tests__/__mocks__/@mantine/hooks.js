module.exports = {
  useDisclosure(initial = false) {
    return [initial, { open: jest.fn(), close: jest.fn(), toggle: jest.fn() }];
  },
  useDebouncedValue(value) { return [value]; },
  useViewportSize() { return { width: 1024, height: 768 }; },
};
