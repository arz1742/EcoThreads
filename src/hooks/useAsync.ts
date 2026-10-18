import { useCallback, useEffect, useState } from "react";
import { friendlyError } from "@/lib/supabase";

/** Runs an async loader and tracks loading / error / data. */
export function useAsync<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(loader, deps);

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await run()); }
    catch (e) { setError(friendlyError(e)); }
    finally { setLoading(false); }
  }, [run]);

  useEffect(() => { reload(); }, [reload]);
  return { data, error, loading, reload, setData };
}
