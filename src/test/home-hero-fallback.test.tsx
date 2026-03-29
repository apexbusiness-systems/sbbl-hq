import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import HomePage from '@/pages/Home';
import { AppProvider } from '@/contexts/AppContext';

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ roles: ['fan'], isAdmin: false }),
}));

describe('home hero fallback', () => {
  it('keeps hero text visible when image fails', async () => {
    render(
      <BrowserRouter>
        <AppProvider>
          <HomePage />
        </AppProvider>
      </BrowserRouter>,
    );

    const heroImage = screen.getByAltText('SBBL hero');
    fireEvent.error(heroImage);
    expect(await screen.findByText(/Season Live/)).toBeInTheDocument();
  });
});
