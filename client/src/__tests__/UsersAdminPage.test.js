import { render, screen, waitFor, withUser } from './test-utils.js';
import api from '@/api/axiosClient';
import UsersAdminPage from '@/pages/UsersAdminPage.js';

jest.mock('@/api/axiosClient');

describe('UsersAdminPage', () => {
  afterEach(() => jest.clearAllMocks());

  test('admin loads user list', async () => {
    const admin = { id: 1, username: 'root', role: 'ADMIN', plan: 'PREMIUM' };
    api.get.mockResolvedValueOnce({ data: { users: [{ id: 10, username: 'alice' }] } });

    // Pass currentUser so the page doesn't render "Forbidden"
    render(<UsersAdminPage currentUser={admin} />, { wrapper: withUser(admin) });

    await waitFor(() => {
      expect(api.get).toHaveBeenCalled();
      expect(screen.getByText(/alice/i)).toBeInTheDocument();
    });
  });

  test('non-admin blocked', () => {
    const peasant = { id: 2, username: 'bob', role: 'USER', plan: 'PREMIUM' };
    render(<UsersAdminPage />, { wrapper: withUser(peasant) });

    const blocked = screen.queryByText(/forbidden|not authorized|admin only/i);
    expect(blocked).toBeTruthy();
  });
});
