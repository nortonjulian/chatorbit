// Manual mock for @mantine/core that renders real, accessible DOM

const React = require('react');

// Strip Mantine-only props so they don't end up on DOM elements
const strip = (props = {}) => {
  const {
    p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
    radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
    centered, position, withArrow, loading,
    ...rest
  } = props;
  return rest;
};

const Div = (p) => React.createElement('div', strip(p), p.children);
const MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);

const Button = ({ children, type = 'button', onClick, ...rest }) =>
  React.createElement('button', { type, onClick, ...strip(rest) }, children);

// Accessible TextInput: <label>{label}<input ... /></label>
const TextInput = ({ label, placeholder, type = 'text', value, onChange, ...rest }) =>
  React.createElement(
    'label',
    null,
    label,
    React.createElement('input', {
      'aria-label': label ?? placeholder,
      placeholder,
      type,
      value,
      onChange,
      ...strip(rest),
    })
  );

const PasswordInput = ({ placeholder, value, onChange, ...rest }) =>
  React.createElement(
    'label',
    null,
    placeholder,
    React.createElement('input', {
      'aria-label': placeholder,
      placeholder,
      type: 'password',
      value,
      onChange,
      ...strip(rest),
    })
  );

const Alert = ({ children, ...rest }) =>
  React.createElement('div', { role: 'alert', ...strip(rest) }, children);

const Text = ({ children, ...rest }) => React.createElement('p', strip(rest), children);
const Title = ({ children, order = 3, ...rest }) =>
  React.createElement(`h${order}`, strip(rest), children);
const Image = ({ src, alt = '', ...rest }) =>
  React.createElement('img', { src, alt, ...strip(rest) });
const Anchor = ({ children, to, href, ...rest }) =>
  React.createElement('a', { href: href ?? to, ...strip(rest) }, children);

// Simple layout wrappers
const Center = Div;
const Container = Div;
const Paper = Div;
const Stack = Div;
const Group = Div;

module.exports = {
  __esModule: true,
  MantineProvider,
  Button,
  TextInput,
  PasswordInput,
  Alert,
  Text,
  Title,
  Image,
  Anchor,
  Center,
  Container,
  Paper,
  Stack,
  Group,
};

