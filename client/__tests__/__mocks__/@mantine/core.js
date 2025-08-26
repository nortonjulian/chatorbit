const React = require('react');

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function sanitizeProps(input = {}) {
  const {
    withBorder, shadow, radius, variant, color, size,
    p, px, py, pl, pr, pt, pb,
    m, mx, my, ml, mr, mt, mb,
    gap, align, justify, grow,
    w, h, maw, mah,
    order, component, styles, withinPortal, position,
    to, href,
    style,
    ...rest
  } = input;

  const stylePatch = { ...(style || {}) };
  if (w != null) stylePatch.width = w;
  if (h != null) stylePatch.height = h;
  if (maw != null) stylePatch.maxWidth = maw;
  if (mah != null) stylePatch.maxHeight = mah;
  if (mb != null) stylePatch.marginBottom = mb;
  if (mt != null) stylePatch.marginTop = mt;
  if (ml != null) stylePatch.marginLeft = ml;
  if (mr != null) stylePatch.marginRight = mr;

  const mapped = { ...rest };
  if (href) mapped.href = href;
  else if (to) mapped.href = to;
  if (Object.keys(stylePatch).length) mapped.style = stylePatch;
  return mapped;
}

function toName(labelLike) {
  if (!labelLike) return undefined;
  return String(labelLike).trim().toLowerCase().replace(/\s+/g, '_');
}

function emailLooksInvalid(v) {
  if (v == null) return false;
  const s = String(v).trim();
  if (!s) return false;
  return !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
}

/* -------------------------------------------------------------------------- */
/* Generic inputs (forwardRef so tests/components can attach refs)             */
/* -------------------------------------------------------------------------- */

function makeInput({ type = 'text' } = {}) {
  return React.forwardRef(function Input(
    {
      label,
      ariaLabel,
      placeholder,
      name,
      value,
      defaultValue,
      onChange = () => {},
      error,
      description,
      ...rest
    },
    ref
  ) {
    const aria = ariaLabel || label || placeholder || 'input';
    const props = sanitizeProps(rest);
    const requestedType = props.type || type;

    // Avoid controlled/uncontrolled warnings
    const controlled = {};
    if (value !== undefined) controlled.value = value;
    else if (defaultValue !== undefined) controlled.defaultValue = defaultValue;

    const showEmailDefaultError =
      !error && requestedType === 'email' && emailLooksInvalid(value);

    // Fallback names so FormData(...) works in tests
    const fallbackByType =
      requestedType === 'password'
        ? 'password'
        : requestedType === 'email'
        ? 'email'
        : undefined;

    const nameAttr = name ?? toName(label || ariaLabel) ?? fallbackByType;

    return (
      <label>
        {label}
        <input
          ref={ref}
          type={requestedType}
          aria-label={aria}
          placeholder={placeholder}
          name={nameAttr}
          {...controlled}
          onChange={(e) => {
            try { onChange(e); } catch {}
            try { onChange(e.target?.value); } catch {}
          }}
          {...props}
        />
        {description ? <small>{description}</small> : null}
        {error ? <div role="alert">{error}</div> : null}
        {showEmailDefaultError ? <div role="alert">Enter a valid email</div> : null}
      </label>
    );
  });
}

function passthrough(tag, role) {
  return function Comp({ children, ...props }) {
    const Tag = tag || React.Fragment;
    const p = sanitizeProps(props);
    if (tag) {
      if (role) p.role = role;
      return <Tag {...p}>{children}</Tag>;
    }
    return <>{children}</>;
  };
}

/* -------------------------------------------------------------------------- */
/* Core Primitives                                                             */
/* -------------------------------------------------------------------------- */

const MantineProvider = ({ children }) => <>{children}</>;
const Box = passthrough('div');
const Group = passthrough('div');
const Stack = passthrough('div');
const Container = passthrough('div');
const Title = ({ children, ...p }) => <h3 {...sanitizeProps(p)}>{children}</h3>;
const Text = ({ children, ...p }) => <p {...sanitizeProps(p)}>{children}</p>;
const Divider = passthrough('hr');
const Image = (p) => <img alt={p.alt} {...sanitizeProps(p)} />;
const Badge = ({ children, ...p }) => <span {...sanitizeProps(p)}>{children}</span>;

/* ScrollArea */
const ScrollAreaBase = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;
const ScrollAreaAutosize = ({ children, viewportRef, ...p }) => (
  <div ref={viewportRef} {...sanitizeProps(p)}>{children}</div>
);
const ScrollArea = Object.assign(ScrollAreaBase, { Autosize: ScrollAreaAutosize });

/* Card */
const Card = ({ children, ...p }) => <div data-testid="card" {...sanitizeProps(p)}>{children}</div>;
Card.Section = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;

/* Form-ish */
const TextInput = makeInput({ type: 'text' });
const PasswordInput = makeInput({ type: 'password' });

const FileInput = React.forwardRef(function FileInputComp(
  {
    label,
    ariaLabel,
    placeholder,
    name,
    accept,
    multiple,
    onChange = () => {},
    ...rest
  },
  ref
) {
  const aria = ariaLabel || label || placeholder || 'input';
  const props = sanitizeProps(rest);
  const nameAttr = name ?? toName(label || ariaLabel) ?? 'file';
  return (
    <label>
      {label}
      <input
        ref={ref}
        type="file"
        aria-label={aria}
        placeholder={placeholder}
        name={nameAttr}
        accept={accept}
        multiple={!!multiple}
        onChange={(e) => {
          const files = e.target.files || null;
          const value = multiple ? Array.from(files || []) : (files && files[0]) || null;
          // Support both Mantine-style and DOM-event consumers
          try { onChange(value); } catch {}
          try { onChange(e); } catch {}
        }}
        {...props}
      />
    </label>
  );
});

const Textarea = React.forwardRef(function TextareaComp(
  {
    label,
    ariaLabel,
    placeholder,
    name,
    value,
    defaultValue,
    onChange = () => {},
    error,
    description,
    ...rest
  },
  ref
) {
  const aria = ariaLabel || label || placeholder || 'textarea';
  const props = sanitizeProps(rest);
  const controlled = {};
  if (value !== undefined) controlled.value = value;
  else if (defaultValue !== undefined) controlled.defaultValue = defaultValue;

  const nameAttr = name ?? toName(label || ariaLabel) ?? undefined;

  return (
    <label>
      {label}
      <textarea
        ref={ref}
        aria-label={aria}
        placeholder={placeholder}
        name={nameAttr}
        {...controlled}
        onChange={(e) => {
          try { onChange(e); } catch {}
          try { onChange(e.target?.value); } catch {}
        }}
        {...props}
      />
      {description ? <small>{description}</small> : null}
      {error ? <div role="alert">{error}</div> : null}
    </label>
  );
});

const Select = function SelectComp({
  label,
  ariaLabel,
  data = [],
  value = '',
  onChange = () => {},
  name,
  ...rest
}) {
  const aria = ariaLabel || label || 'select';
  const props = sanitizeProps(rest);
  const nameAttr = name ?? toName(label || ariaLabel) ?? undefined;
  return (
    <label>
      {label}
      <select
        aria-label={aria}
        name={nameAttr}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        {...props}
      >
        {data.map((opt) => {
          const val = typeof opt === 'string' ? opt : opt.value;
          const lab = typeof opt === 'string' ? opt : opt.label || opt.value;
          return <option key={val} value={val}>{lab}</option>;
        })}
      </select>
    </label>
  );
};

const Switch = ({ label, checked, onChange = () => {}, ...rest }) => {
  const props = sanitizeProps(rest);
  return (
    <label>
      {label}
      <input
        type="checkbox"
        role="switch"
        aria-label={label || 'switch'}
        checked={!!checked}
        onChange={(e) => onChange(e)}
        {...props}
      />
    </label>
  );
};

const Button = ({ children, ...p }) => {
  const props = sanitizeProps(p);
  if (!('type' in props)) props.type = 'button';
  return <button {...props}>{children}</button>;
};
const ActionIcon = ({ children, ...p }) => {
  const props = sanitizeProps(p);
  if (!('type' in props)) props.type = 'button';
  return <button {...props}>{children}</button>;
};

const Loader = (props) => <span role="status" {...sanitizeProps(props)} />;

/* Tooltip preserves child aria-label if already present */
const Tooltip = ({ label, children }) => {
  if (React.isValidElement(children)) {
    const existing = children.props?.['aria-label'];
    return React.cloneElement(children, {
      'aria-label': existing ?? (typeof label === 'string' ? label : undefined),
    });
  }
  return <>{children}</>;
};

/* Popover always open in tests */
const PopoverRoot = ({ children, ...rest }) => (
  <div aria-hidden="false" {...sanitizeProps(rest)}>{children}</div>
);
const PopoverTarget = ({ children, ...p }) => <span {...sanitizeProps(p)}>{children}</span>;
const PopoverDropdown = ({ children, ...p }) => <div role="dialog" {...sanitizeProps(p)}>{children}</div>;
const Popover = Object.assign(PopoverRoot, { Target: PopoverTarget, Dropdown: PopoverDropdown });

const Modal = ({ opened, children, title, ...props }) => (
  <div
    role="dialog"
    data-opened={String(!!opened)}
    aria-label={typeof title === 'string' ? title : undefined}
    {...sanitizeProps(props)}
  >
    {opened ? (<>{typeof title === 'string' ? <h2>{title}</h2> : title || null}{children}</>) : null}
  </div>
);

const Drawer = ({ opened, children, title, ...props }) => (
  <div
    role="dialog"
    data-opened={String(!!opened)}
    aria-label={typeof title === 'string' ? title : undefined}
    {...sanitizeProps(props)}
  >
    {opened ? (<>{typeof title === 'string' ? <h2>{title}</h2> : title || null}{children}</>) : null}
  </div>
);

const Tabs = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;
Tabs.List = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;
Tabs.Tab = ({ children, onClick = () => {}, onChange, value, ...p }) => (
  <button
    type="button"
    onClick={() => { onClick(value); if (onChange) onChange(value); }}
    {...sanitizeProps(p)}
  >
    {children}
  </button>
);
Tabs.Panel = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;

const Avatar = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;

const NavLink = ({ label, onClick = () => {}, rightSection, ...p }) => (
  <button type="button" onClick={onClick} {...sanitizeProps(p)}>
    {label}{rightSection || null}
  </button>
);

const Paper = passthrough('div');
const Center = ({ children, ...p }) => <div {...sanitizeProps(p)}>{children}</div>;
const Anchor = ({ children, ...p }) => <a {...sanitizeProps(p)}>{children}</a>;
const Alert = ({ children, ...p }) => <div role="alert" {...sanitizeProps(p)}>{children}</div>;

const SimpleGrid = ({ children, cols = 1, spacing, ...p }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns:
        typeof cols === 'object' ? `repeat(${cols.base || 1}, 1fr)` : `repeat(${cols}, 1fr)`,
      gap: spacing || 0,
      ...(p.style || {}),
    }}
    {...sanitizeProps(p)}
  >
    {children}
  </div>
);

const NumberInput = ({ label, value = 0, onChange = () => {}, min, max, ...rest }) => (
  <label>
    {label}
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => {
        const v = e.target.value === '' ? '' : Number(e.target.value);
        onChange(v);
      }}
      {...sanitizeProps(rest)}
    />
  </label>
);

const CopyButton = ({ value = '', timeout = 0, children }) => {
  const [copied, setCopied] = React.useState(false);
  const copy = () => {
    setCopied(true);
    if (timeout) setTimeout(() => setCopied(false), timeout);
  };
  return typeof children === 'function' ? children({ copied, copy }) : null;
};

/* Table */
const TableRoot = ({ children, ...p }) => <table {...sanitizeProps(p)}>{children}</table>;
const TableThead = ({ children, ...p }) => <thead {...sanitizeProps(p)}>{children}</thead>;
const TableTbody = ({ children, ...p }) => <tbody {...sanitizeProps(p)}>{children}</tbody>;
const TableTr = ({ children, ...p }) => <tr {...sanitizeProps(p)}>{children}</tr>;
const TableTh = ({ children, ...p }) => <th {...sanitizeProps(p)}>{children}</th>;
const TableTd = ({ children, ...p }) => <td {...sanitizeProps(p)}>{children}</td>;
const Table = Object.assign(TableRoot, {
  Thead: TableThead,
  Tbody: TableTbody,
  Tr: TableTr,
  Th: TableTh,
  Td: TableTd,
});

/* -------------------------------------------------------------------------- */
/* Exports                                                                     */
/* -------------------------------------------------------------------------- */

module.exports = {
  MantineProvider,
  Box,
  Group,
  Stack,
  Container,
  Title,
  Text,
  Divider,
  Image,
  Badge,
  ScrollArea,
  Card,
  TextInput,
  PasswordInput,
  FileInput,
  Textarea,
  Select,
  Switch,
  Button,
  ActionIcon,
  Loader,
  Tooltip,
  Popover,
  Modal,
  Drawer,
  Tabs,
  Avatar,

  // Extras
  NavLink,
  Paper,
  Center,
  Anchor,
  Alert,
  SimpleGrid,
  NumberInput,
  CopyButton,
  Table,
};
