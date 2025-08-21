const React = require('react');

const tag = (t) => {
  const C = ({ children, ...rest }) => React.createElement(t, rest, children);
  C.displayName = `Mock(${t})`;
  return C;
};

exports.Modal = tag('div');
exports.Drawer = tag('div');
exports.Group = tag('div');
exports.Stack = tag('div');
exports.Box = tag('div');
exports.Badge = tag('span');
exports.Avatar = (p) => React.createElement('img', p);
exports.Text = tag('span');
exports.Title = tag('h1');
exports.SimpleGrid = tag('div');
exports.Image = (p) => React.createElement('img', p);

exports.TextInput = (p) => React.createElement('input', { type: 'text', ...p });
exports.Textarea  = (p) => React.createElement('textarea', p);
exports.FileInput = (p) => React.createElement('input', { type: 'file', ...p });
exports.Select = ({ data = [], value, onChange, ...rest }) => (
  React.createElement(
    'select',
    { value, onChange: (e) => onChange?.(e.target.value), ...rest },
    data.map((d) =>
      React.createElement('option', { key: d.value ?? d, value: d.value ?? d }, d.label ?? String(d))
    )
  )
);

exports.Button = (p) => React.createElement('button', p);
exports.ActionIcon = (p) => React.createElement('button', p);

exports.Popover = ({ children }) => React.createElement(React.Fragment, null, children);
exports.PopoverTarget = ({ children }) => React.createElement(React.Fragment, null, children);
exports.PopoverDropdown = ({ children }) => React.createElement('div', null, children);
exports.Tooltip = ({ children }) => React.createElement(React.Fragment, null, children);

exports.MantineProvider = ({ children }) => React.createElement(React.Fragment, null, children);
