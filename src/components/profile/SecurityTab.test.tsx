import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stubbed before the component is imported: the real one talks to Supabase.
vi.mock('../../data/authClient', () => ({
  listLinkedIdentities: vi.fn(async () => [
    { id: 'gid', provider: 'google', email: 'someone@gmail.com' },
  ]),
  connectGoogle: vi.fn(),
  disconnectGoogle: vi.fn(),
}));

import { SecurityTab } from './SecurityTab';
import { useAuthStore, type AuthUser } from '../../store/authStore';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function signIn(hasPassword: boolean) {
  const user: AuthUser = {
    id: 'u1',
    email: 'someone@gmail.com',
    displayName: 'Someone',
    role: 'student',
    createdAt: new Date(0).toISOString(),
    institution: null,
    program: null,
    department: null,
    onboarded: true,
    hasPassword,
  };
  useAuthStore.setState({ user, status: 'authenticated' });
}

/** Mount and let the identity fetch settle. */
async function render() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<SecurityTab />);
  });
  return {
    host,
    button: (label: string) =>
      [...host.querySelectorAll('button')].find((b) => b.textContent?.includes(label)),
    unmount: () => act(() => root.unmount()),
  };
}

describe('SecurityTab', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  /** The rule the whole has_password flag exists for: disconnecting Google
   *  without a password of your own is a lockout. */
  it('will not let a password-less account disconnect Google', async () => {
    signIn(false);
    const { host, button, unmount } = await render();

    expect(button('Disconnect')?.disabled).toBe(true);
    expect(host.textContent).toContain('No password');
    expect(host.textContent).toContain('only way into this account');

    unmount();
  });

  it('allows it once a password is set', async () => {
    signIn(true);
    const { host, button, unmount } = await render();

    expect(button('Disconnect')?.disabled).toBe(false);
    expect(host.textContent).toContain('Password set');
    expect(host.textContent).not.toContain('only way into this account');

    unmount();
  });

  it('asks for the current password only when there is one', async () => {
    signIn(true);
    const withPassword = await render();
    expect(withPassword.host.querySelector('#current-password')).not.toBeNull();
    expect(withPassword.host.textContent).toContain('Change password');
    withPassword.unmount();

    signIn(false);
    const without = await render();
    // Nothing to verify against, so the field would only be a dead end.
    expect(without.host.querySelector('#current-password')).toBeNull();
    expect(without.host.textContent).toContain('Set a password');
    without.unmount();
  });
});
