import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StorePage from '@/pages/Store';
import { apiFetch } from '@/lib/api/client';
import { toast } from 'sonner';

let mockedSession: { access_token: string } | null = null;

vi.mock('@/contexts/BagContext', () => ({
  useBag: () => ({ addToBag: vi.fn() }),
}));

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: mockedSession }),
}));

vi.mock('@/lib/api/client', () => ({
  apiFetch: vi.fn(async (path: string) => {
    if (path === '/api/public/products') {
      return {
        ok: true,
        data: [{
          id: 'custom-jersey',
          name: 'Custom Jersey',
          image: '/jersey.png',
          category: 'custom',
          price: 0,
          is_custom: true,
          colors: ['Black'],
          sizes: ['M'],
        }],
      };
    }
    return { ok: true };
  }),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

function renderStore() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={client}>
      <StorePage />
    </QueryClientProvider>,
  );
}

async function openAndFillQuoteForm() {
  fireEvent.click(await screen.findByText('Custom Jersey'));
  fireEvent.click(screen.getByRole('button', { name: /request custom quote/i }));
  const textboxes = screen.getAllByRole('textbox');
  fireEvent.change(textboxes[0], { target: { value: 'JR Owner' } });
  fireEvent.change(textboxes[1], { target: { value: 'SBBL' } });
  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } });
  fireEvent.click(screen.getByRole('button', { name: /submit request/i }));
}

describe('Store auth token source', () => {
  beforeEach(() => {
    mockedSession = null;
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('blocks quote checkout when AuthContext has no session token, ignoring project localStorage keys', async () => {
    localStorage.setItem('sb-zofpeqwrmxemymvtdwct-auth-token', JSON.stringify({ access_token: 'stale-local-token' }));
    renderStore();

    await openAndFillQuoteForm();

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Please sign in to submit a quote request.'));
    expect(apiFetch).not.toHaveBeenCalledWith(
      '/api/store/quote',
      expect.anything(),
      expect.stringMatching(/eyMock|stale-local-token/),
    );
  });

  it('uses only AuthContext session.access_token for quote API calls', async () => {
    mockedSession = { access_token: 'real-authcontext-jwt' };
    localStorage.setItem('sb-zofpeqwrmxemymvtdwct-auth-token', JSON.stringify({ access_token: 'stale-local-token' }));
    renderStore();

    await openAndFillQuoteForm();

    await waitFor(() => expect(apiFetch).toHaveBeenCalledWith(
      '/api/store/quote',
      expect.objectContaining({ method: 'POST' }),
      'real-authcontext-jwt',
    ));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/quote request sent/i)));
    expect(apiFetch).not.toHaveBeenCalledWith('/api/store/quote', expect.anything(), 'eyMock');
    expect(apiFetch).not.toHaveBeenCalledWith('/api/store/quote', expect.anything(), 'stale-local-token');
  });
});
