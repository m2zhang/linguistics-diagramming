import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveDraftBeacon } from './submissions';

/**
 * The beacon is the `beforeunload` backstop: it bypasses supabase-js and posts
 * to PostgREST directly, because saveDraft() awaits getSession() first and the
 * browser cancels in-flight work once the page starts unloading.
 *
 * That means it depends on two things supabase-js owns rather than us — the
 * localStorage key holding the session, and the shape of the row. These tests
 * exist so a library upgrade that changes either fails here rather than
 * silently dropping students' last edits.
 */
const REF = 'deaeevrqwlhqcvvoouuw';
const PAYLOAD = JSON.stringify({ tree: { id: 'r', label: 'S', children: [] }, version: '1.0' });

/** jsdom's localStorage is not complete enough here, so drive a plain Map. */
let store: Map<string, string>;

function setItem(key: string, value: string) {
  store.set(key, value);
}

function seedSession() {
  setItem(
    `sb-${REF}-auth-token`,
    JSON.stringify({ access_token: 'tok123', user: { id: 'student-1' } }),
  );
}

describe('saveDraftBeacon', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new Map();
    fetchMock = vi.fn(() => Promise.resolve({ ok: true } as Response));
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem,
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts with keepalive so the request outlives the page', () => {
    seedSession();
    saveDraftBeacon('a1', PAYLOAD);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    // Without this the browser kills the request during unload and the whole
    // backstop silently does nothing.
    expect(init.keepalive).toBe(true);
  });

  it('upserts, matching saveDraft()', () => {
    seedSession();
    saveDraftBeacon('a1', PAYLOAD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/rest/v1/drafts');
    expect(url).toContain('on_conflict=assignment_id,student_id');
    expect(init.headers.Prefer).toContain('resolution=merge-duplicates');
    expect(init.headers.Authorization).toBe('Bearer tok123');
  });

  it('sends the row saveDraft would have written', () => {
    seedSession();
    saveDraftBeacon('a1', PAYLOAD);

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.assignment_id).toBe('a1');
    expect(body.student_id).toBe('student-1');
    expect(body.content).toEqual(JSON.parse(PAYLOAD));
    expect(body.updated_at).toBeTruthy();
  });

  it('does nothing when there is no session rather than posting anonymously', () => {
    saveDraftBeacon('a1', PAYLOAD);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws — beforeunload must not block the page closing', () => {
    setItem(`sb-${REF}-auth-token`, 'not json');
    expect(() => saveDraftBeacon('a1', PAYLOAD)).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
