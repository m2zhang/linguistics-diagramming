import { describe, expect, it } from 'vitest';
import { resolveAppUrl } from './appUrl';

const ORIGIN = 'https://host.utsc.utoronto.ca';

describe('resolveAppUrl', () => {
  it('keeps the subpath, which window.location.origin alone would drop', () => {
    expect(resolveAppUrl('/dashboard', ORIGIN, '/~you/syntaxtree/')).toBe(
      'https://host.utsc.utoronto.ca/~you/syntaxtree/dashboard',
    );
  });

  it('behaves like the old origin-only form when served from the root', () => {
    expect(resolveAppUrl('/reset-password', ORIGIN, '/')).toBe(
      'https://host.utsc.utoronto.ca/reset-password',
    );
  });

  it('accepts a path with or without a leading slash', () => {
    const base = '/~you/syntaxtree/';
    expect(resolveAppUrl('profile', ORIGIN, base)).toBe(resolveAppUrl('/profile', ORIGIN, base));
  });

  it('does not let a leading slash escape back to the origin', () => {
    // A bare `new URL('/profile', origin + base)` resolves to origin + '/profile',
    // silently discarding the subpath. That regression is what this guards.
    expect(resolveAppUrl('///profile', ORIGIN, '/~you/syntaxtree/')).toBe(
      'https://host.utsc.utoronto.ca/~you/syntaxtree/profile',
    );
  });

  it('works on localhost during development', () => {
    expect(resolveAppUrl('/dashboard', 'http://localhost:5173', '/')).toBe(
      'http://localhost:5173/dashboard',
    );
  });
});
