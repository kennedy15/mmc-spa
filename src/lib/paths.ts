/** URL for a file in /data (committed by the Action) or /public. */
export function dataUrl(rel: string, root: 'data' | 'public' = 'data'): string {
  const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
  return root === 'data' ? `${base}data/${rel}` : `${base}${rel}`;
}
