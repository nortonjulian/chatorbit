const React = require('react');

const SpotlightProvider = ({ children }) =>
  React.createElement(React.Fragment, null, children);

const useSpotlight = () => ({
  open: jest.fn(),
  close: jest.fn(),
  registerActions: jest.fn(),
});

module.exports = { __esModule: true, SpotlightProvider, useSpotlight };
