import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => {
  onUnauthorized = fn;
};

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body === undefined ? 'GET' : 'POST'),
    headers: opts.body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    credentials: 'same-origin',
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/api/auth/')) onUnauthorized?.();
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

/** Small data-loading hook: fetches on mount and whenever `path` changes. Pass null to skip. */
export function useApi<T>(path: string | null, opts: { pollMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  const pathRef = useRef(path);
  pathRef.current = path;

  const load = useCallback(
    async (quiet = false) => {
      if (!path) return;
      if (!quiet) setLoading(true);
      try {
        const result = await api<T>(path);
        if (pathRef.current === path) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (pathRef.current === path) setError((err as Error).message);
      } finally {
        if (pathRef.current === path) setLoading(false);
      }
    },
    [path],
  );

  useEffect(() => {
    load();
    if (!opts.pollMs) return;
    const t = setInterval(() => load(true), opts.pollMs);
    return () => clearInterval(t);
  }, [load, opts.pollMs]);

  return { data, error, loading, reload: () => load(true), setData };
}

export function fileToDataUrl(file: File, maxBytes = 5 * 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return reject(new Error('Please choose an image file.'));
    if (file.size > maxBytes) return reject(new Error('Images must be 5 MB or smaller.'));
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

let metaPromise: Promise<{ collegeName: string; mailEnabled: boolean }> | null = null;
/** Host college name etc. Fetched once and shared by every caller. */
export function useMeta() {
  const [meta, setMeta] = useState<{ collegeName: string; mailEnabled: boolean } | null>(null);
  useEffect(() => {
    metaPromise ??= api('/api/meta');
    metaPromise.then(setMeta).catch(() => {});
  }, []);
  return meta;
}

export const sameCollege = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
