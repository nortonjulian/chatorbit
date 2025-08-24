/**
 * @file ContactList.test.js
 * Tests for client/src/components/ContactList.jsx
 */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

/* ---- Minimal Mantine mock (keeps DOM clean + interactive) ---- */
jest.mock('@mantine/core', () => {
  const React = require('react');

  const strip = (props = {}) => {
    const {
      // layout / style props we don't want on DOM nodes
      p, px, py, m, mx, my, c, ta, bg, fs, fw, mt, mb, ml, mr, mah, h, w,
      radius, withBorder, shadow, variant, size, gap, align, justify, wrap,
      maw, mxw, // etc
      ...rest
    } = props;
    return rest;
  };

  const Div = React.forwardRef((props, ref) =>
    React.createElement('div', { ...strip(props), ref }, props.children)
  );

  const Input = React.forwardRef(({ value, defaultValue, onChange, placeholder, ...rest }, ref) =>
    React.createElement('input', {
      ...strip(rest),
      ref,
      value,
      defaultValue,
      placeholder,
      onChange: (e) => onChange?.(e),
    })
  );

  const Button = React.forwardRef(({ children, onClick, ...rest }, ref) =>
    React.createElement('button', { ...strip(rest), ref, type: 'button', onClick }, children)
  );

  // Mantine NavLink surfaces a click target; we model it as a <button>
  const NavLink = ({ label, rightSection, onClick, ...rest }) =>
    React.createElement(
      'button',
      { ...strip(rest), type: 'button', onClick },
      label,
      rightSection
    );

  const Title = ({ children }) => React.createElement('h4', null, children);
  const Text = ({ children, ...rest }) => React.createElement('span', strip(rest), children);
  const Group = Div;
  const Stack = Div;
  const Box = Div;

  return {
    __esModule: true,
    Box,
    Title,
    TextInput: Input,
    Stack,
    NavLink,
    Text,
    Button,
    Group,
  };
});

/* ---- Router: mock useNavigate ---- */
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const real = jest.requireActual('react-router-dom');
  return { ...real, useNavigate: () => mockNavigate, MemoryRouter: real.MemoryRouter };
});

/* ---- axiosClient mock (safe factory; no TDZ) ---- */
jest.mock('../src/api/axiosClient', () => {
  const get = jest.fn();
  const post = jest.fn();
  const del = jest.fn();
  const patch = jest.fn();
  return {
    __esModule: true,
    default: { get, post, delete: del, patch },
  };
});
import axiosClient from '../src/api/axiosClient';

/* ---- SUT (after mocks) ---- */
import ContactList from '../src/components/ContactList.jsx';

/* ---- Quiet ReactDOMTestUtils warning (optional) ---- */
let origError;
beforeAll(() => {
  origError = console.error;
  jest.spyOn(console, 'error').mockImplementation((msg, ...rest) => {
    if (typeof msg === 'string' && msg.includes('ReactDOMTestUtils.act is deprecated')) return;
    origError(msg, ...rest);
  });
});
afterAll(() => {
  console.error.mockRestore?.();
});

beforeEach(() => {
  jest.clearAllMocks();
});

const renderSut = (props = {}) =>
  render(
    <MemoryRouter>
      <ContactList currentUserId={props.currentUserId ?? 1} onChanged={props.onChanged} />
    </MemoryRouter>
  );

describe('ContactList', () => {
  test('loads and displays contacts; filters by search', async () => {
    axiosClient.get.mockResolvedValueOnce({
      data: [
        { userId: 2, alias: '', user: { username: 'alice' } },
        { userId: 3, alias: 'Bobby', user: { username: 'bob' } },
      ],
    });

    renderSut();

    expect(screen.getByText(/saved contacts/i)).toBeInTheDocument();

    // Wait for contacts
    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.getByText('Bobby')).toBeInTheDocument();

    // Filter to "ali"
    fireEvent.change(screen.getByPlaceholderText(/search contacts/i), {
      target: { value: 'ali' },
    });

    expect(await screen.findByText('alice')).toBeInTheDocument();
    expect(screen.queryByText('Bobby')).not.toBeInTheDocument();
  });

  test('clicking a contact starts a chat and navigates to the room', async () => {
    axiosClient.get.mockResolvedValueOnce({
      data: [{ userId: 42, alias: '', user: { username: 'zoe' } }],
    });
    axiosClient.post.mockResolvedValueOnce({ data: { id: 777 } });

    renderSut();

    // our NavLink mock is a <button> with label content
    const row = await screen.findByRole('button', { name: /zoe/i });
    fireEvent.click(row);

    expect(axiosClient.post).toHaveBeenCalledWith('/chatrooms/direct/42');
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/chat/777'));
  });

  test('delete contact calls API and refreshes the list', async () => {
    axiosClient.get
      .mockResolvedValueOnce({ data: [{ userId: 9, alias: '', user: { username: 'nina' } }] }) // initial
      .mockResolvedValueOnce({ data: [] }); // after refresh
    axiosClient.delete.mockResolvedValueOnce({ status: 200 });

    const onChanged = jest.fn();
    renderSut({ onChanged });

    expect(await screen.findByText('nina')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /delete/i }));

    await waitFor(() =>
      expect(axiosClient.delete).toHaveBeenCalledWith('/contacts', {
        data: { ownerId: 1, userId: 9 },
      })
    );

    expect(await screen.findByText(/no contacts found/i)).toBeInTheDocument();
    expect(onChanged).toHaveBeenCalled();
  });

  test('editing alias triggers PATCH on blur', async () => {
    axiosClient.get
      .mockResolvedValueOnce({ data: [{ userId: 5, alias: '', user: { username: 'amy' } }] }) // initial
      .mockResolvedValueOnce({ data: [{ userId: 5, alias: 'Bestie', user: { username: 'amy' } }] }); // refresh
    axiosClient.patch.mockResolvedValueOnce({ status: 200 });

    renderSut();

    expect(await screen.findByText('amy')).toBeInTheDocument();

    const aliasInput = screen.getByPlaceholderText(/alias/i);
    fireEvent.change(aliasInput, { target: { value: 'Bestie' } });
    fireEvent.blur(aliasInput);

    await waitFor(() =>
      expect(axiosClient.patch).toHaveBeenCalledWith('/contacts', {
        ownerId: 1,
        userId: 5,
        alias: 'Bestie',
      })
    );

    expect(await screen.findByText('Bestie')).toBeInTheDocument();
  });
});
