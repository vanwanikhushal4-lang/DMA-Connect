import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { backendSession, restoreBackendSession } from '../lib/backend-auth';
import type { BackendSession } from '../lib/backend-auth';
import { backendApi, backendApiEnabled, backendApiUrl } from '../services/backend-api';
import { clearBackendSession, loadBackendSession, saveBackendSession } from '../services/backend-session-store';

type Value = { session: BackendSession | null; loading: boolean; signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void> };
const Context = createContext<Value | null>(null);

export function BackendAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<BackendSession | null>(null), [loading, setLoading] = useState(backendApiEnabled);
  const generation = useRef(0);
  useEffect(() => {
    if (!backendApiEnabled) return;
    let active = true;
    void loadBackendSession().then(value => {
      if (active) setSession(restoreBackendSession(value, backendApiUrl));
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const signOut = useCallback(async () => {
    generation.current++;
    setSession(null);
    await clearBackendSession();
  }, []);
  useEffect(() => {
    if (!session) return;
    const expiresAt = session.expiresAt;
    function checkExpiry() {
      const remaining = expiresAt - Date.now();
      if (remaining <= 0) void signOut().catch(() => {});
      else timer = setTimeout(checkExpiry, Math.min(remaining, 2147483647));
    }
    let timer = setTimeout(checkExpiry, Math.max(0, Math.min(session.expiresAt - Date.now(), 2147483647)));
    return () => clearTimeout(timer);
  }, [session, signOut]);
  async function signIn(email: string, password: string) {
    const current = ++generation.current;
    const result = await backendApi.loginEmail(email, password);
    const next = backendSession(result, email, backendApiUrl);
    if (current !== generation.current) return;
    await saveBackendSession(JSON.stringify(next));
    if (current === generation.current) setSession(next);
  }
  return <Context.Provider value={{ session, loading, signIn, signOut }}>{children}</Context.Provider>;
}

export function useBackendAuth() { const value = useContext(Context); if (!value) throw new Error('useBackendAuth requires BackendAuthProvider'); return value; }
