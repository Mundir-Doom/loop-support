import { useCallback, useEffect, useRef, useState } from "react";
import { createSupportSession } from "./api";
import { clearStoredSession, loadStoredSession, persistSession } from "./session";
import { SupportSession } from "./types";

interface UseSupportSessionResult {
  session?: SupportSession;
  isLoading: boolean;
  error?: string;
  refresh: () => Promise<SupportSession | undefined>;
  reset: () => void;
}

export function useSupportSession(): UseSupportSessionResult {
  const [session, setSession] = useState<SupportSession | undefined>(() => loadStoredSession());
  const [isLoading, setIsLoading] = useState<boolean>(() => !session);
  const [error, setError] = useState<string | undefined>(undefined);
  const isFetching = useRef(false);

  const refresh = useCallback(async () => {
    if (isFetching.current) {
      return session;
    }

    isFetching.current = true;
    setIsLoading(true);
    try {
      const freshSession = await createSupportSession();
      setSession(freshSession);
      persistSession(freshSession);
      setError(undefined);
      return freshSession;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to initialize support";
      setError(message);
      setSession(undefined);
      clearStoredSession();
      return undefined;
    } finally {
      isFetching.current = false;
      setIsLoading(false);
    }
  }, [session]);

  const reset = useCallback(() => {
    clearStoredSession();
    setSession(undefined);
    setError(undefined);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!session && !isFetching.current) {
      void refresh();
    }
  }, [session, refresh]);

  return {
    session,
    isLoading,
    error,
    refresh,
    reset
  };
}
