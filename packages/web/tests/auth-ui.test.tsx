import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../src/context/AuthProvider';
import { ToastProvider } from '../src/context/ToastProvider';
import LoginPage from '../src/app/(auth)/login/page';
import { request, tryRefresh } from '../src/hooks/useApi';

const navigation = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));
vi.mock('framer-motion', () => ({ m: {
  div: ({ children, ...props }: { children: ReactNode }) => <div>{children}</div>,
  h1: ({ children }: { children: ReactNode }) => <h1>{children}</h1>,
  p: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  button: ({ children, whileHover, whileTap, ...props }: React.ComponentProps<'button'> & { whileHover?: unknown; whileTap?: unknown }) => <button {...props}>{children}</button>,
} }));
vi.mock('../src/components/ui/GoogleButton', () => ({ default: () => <button>Continuar con Google</button> }));
const user = { id: 'u1', nombre: 'Ana', apellido: '', email: 'ana@example.com', tier: 'detal', role: 'cliente' };
const denied = () => Response.json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Email o contrase\u00f1a incorrectos' } }, { status: 401 });
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => denied());
  vi.stubGlobal('fetch', fetchMock);
  navigation.push.mockClear(); navigation.replace.mockClear();
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const wrap = (children: ReactNode) => <AuthProvider><ToastProvider>{children}</ToastProvider></AuthProvider>;
function Probe() {
  const { user } = useAuth();
  return <p>{user ? `User: ${user.id}` : 'Anonymous'}</p>;
}
async function enterCredentials() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: user.email } });
  fireEvent.change(screen.getByLabelText('Contrase\u00f1a'), { target: { value: 'wrong-password' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
}

describe('login and authentication context', () => {
  it('direct /login without cookies is clean, including after remount/reload', async () => {
    const view = render(wrap(<LoginPage />));
    await screen.findByRole('button', { name: 'Ingresar' });
    expect(screen.queryByText('Sesi\u00f3n expirada')).toBeNull();
    expect(navigation.replace).not.toHaveBeenCalled();
    view.unmount();
    render(wrap(<LoginPage />));
    await screen.findByRole('button', { name: 'Ingresar' });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('wrong password shows the specific message and clears it on the next attempt', async () => {
    render(wrap(<LoginPage />));
    await screen.findByRole('button', { name: 'Ingresar' });
    await enterCredentials();
    expect((await screen.findByRole('alert')).textContent).toBe('Email o contrase\u00f1a incorrectos');
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));
    expect(screen.queryByRole('alert')).toBeNull();
    await act(async () => { finish(Response.json({ success: true, data: { user } })); });
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/catalogo'));
  });

  it('invalid refresh clears the user, redirects once, and leaves login usable', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: user }));
    const view = render(wrap(<Probe />));
    await screen.findByText('User: u1');
    await act(async () => {
      await Promise.allSettled([request('GET', '/api/orders'), request('GET', '/api/profile')]);
    });
    expect(screen.getByText('Anonymous')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Sesi\u00f3n expirada');
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith('/login');
    expect(fetchMock.mock.calls.filter(([path]) => path === '/api/auth/refresh')).toHaveLength(1);
    view.rerender(wrap(<LoginPage />));
    expect(screen.queryByRole('alert')).toBeNull();
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: { user } }));
    await enterCredentials();
    await waitFor(() => expect(navigation.push).toHaveBeenCalledWith('/catalogo'));
  });

  it('the background refresh handles 401 through the same session cleanup', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ success: true, data: user }));
    render(wrap(<Probe />));
    await screen.findByText('User: u1');
    await act(async () => { await tryRefresh(); });
    expect(screen.getByText('Anonymous')).toBeTruthy();
    expect(navigation.replace).toHaveBeenCalledExactlyOnceWith('/login');
  });
});
