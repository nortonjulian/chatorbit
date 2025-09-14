import { notifications } from '@mantine/notifications';

// Small helper to keep a consistent options shape
function show(message, opts = {}) {
  return notifications.show({ message, withBorder: true, ...opts });
}

// Provide a stable API that covers both your existing "ok/err/info"
// and the common "success/error/warn/loading/dismiss" methods.
// Components can import { toast } from '../utils/toast'
export const toast = {
  // your original names (back-compat)
  ok: (message, opts) => show(message, opts),
  err: (message, opts) => show(message, { color: 'red', ...opts }),
  info: (message, opts) => show(message, { color: 'blue', ...opts }),

  // common aliases
  success: (message, opts) => show(message, { color: 'green', ...opts }),
  error: (message, opts) => show(message, { color: 'red', ...opts }),
  warn: (message, opts) => show(message, { color: 'yellow', ...opts }),

  // simple loading handle: returns an object with dismiss()
  loading: (message = 'Working...', opts = {}) => {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    notifications.show({
      id,
      message,
      loading: true,
      autoClose: false,
      withBorder: true,
      ...opts,
    });
    return { dismiss: () => notifications.hide(id) };
  },

  // no-id dismiss just no-ops; Mantine requires an id
  dismiss: (id) => {
    if (id) notifications.hide(id);
  },
};

export default toast;
