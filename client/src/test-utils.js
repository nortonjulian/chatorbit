import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom'; // if you use react-router

export function renderWithProviders(ui, { route = '/', router = true, ...options } = {}) {
  const Wrapper = ({ children }) =>
    router ? <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter> : <>{children}</>;
  return render(ui, { wrapper: Wrapper, ...options });
}
