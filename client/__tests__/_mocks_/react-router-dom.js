const React = require('react');
const actual = jest.requireActual('react-router-dom');

module.exports = {
  ...actual,
  Link: ({ to, children, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  NavLink: ({ to, children, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  useNavigate: () => jest.fn(),
};
