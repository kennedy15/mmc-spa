import { useEffect, useState } from 'react';

/** The current time, refreshed every `ms` so countdowns tick and periods roll over at reset. */
export function useNow(ms = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}
