import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { auth } from '../services/auth-client';
import type { President, PresidentDraft } from '../lib/presidents';
import { needsTaluka, validatePresident } from '../lib/presidents';
import { friendlyFirebaseError } from '../lib/firebase-errors';

type SessionValue = {
  user: User | null; profile: President | null; isAdmin: boolean; loading: boolean; error: string;
  createAccount: (draft: PresidentDraft, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>; resetPassword: (email: string) => Promise<void>; retry: () => void;
};
const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<President | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;
    let unsubscribeAdmin: (() => void) | undefined;
    let adminResolved = false;
    let profileResolved = false;

    function maybeFinishLoading() {
      // Only mark loading done once BOTH checks have fired at least once.
      if (adminResolved && profileResolved) setLoading(false);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, nextUser => {
      unsubscribeProfile?.();
      unsubscribeAdmin?.();
      adminResolved = false;
      profileResolved = false;
      setUser(nextUser); setProfile(null); setError(''); setIsAdmin(false);
      if (!nextUser) { setLoading(false); return; }
      setLoading(true);

      // Verify custom token claims (best-effort — Firestore snapshot is the authoritative check)
      void nextUser.getIdTokenResult().then(tokenResult => {
        if (tokenResult.claims.admin) setIsAdmin(true);
      }).catch(() => {});

      // Verify admins collection document
      unsubscribeAdmin = onSnapshot(doc(db, 'admins', nextUser.uid), snap => {
        if (snap.exists()) setIsAdmin(true);
        if (!adminResolved) { adminResolved = true; maybeFinishLoading(); }
      }, () => { if (!adminResolved) { adminResolved = true; maybeFinishLoading(); } });

      unsubscribeProfile = onSnapshot(doc(db, 'presidents', nextUser.uid), snapshot => {
        // Do not open the workspace until the profile write is acknowledged.
        // Otherwise its member query can start before ownership rules see it.
        if (snapshot.metadata.hasPendingWrites) return;
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data.role === 'admin' || data.admin === true) setIsAdmin(true);
          setProfile({ ...data, uid: nextUser.uid, createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString() } as President);
        } else setProfile(null);
        if (!profileResolved) { profileResolved = true; maybeFinishLoading(); }
      }, cause => { if (__DEV__) console.warn('Profile subscription failed:', cause.code, cause.message); setError('Your account details couldn’t be loaded. Check your connection and retry.'); if (!profileResolved) { profileResolved = true; maybeFinishLoading(); } });
    }, () => { setError('Sign-in couldn’t be restored. Please retry.'); setLoading(false); });
    return () => { unsubscribeAuth(); unsubscribeProfile?.(); unsubscribeAdmin?.(); };
  }, [retryKey]);

  async function createAccount(draft: PresidentDraft, password: string) {
    if (Object.keys(validatePresident(draft, password, password, !!auth.currentUser)).length) throw new Error('Please check your account details.');
    const account = auth.currentUser || (await createUserWithEmailAndPassword(auth, draft.email.trim().toLowerCase(), password)).user;
    const normalized = {
      uid: account.uid, name: draft.name.trim().replace(/\s+/g, ' '), email: account.email,
      mobile: draft.mobile, role: draft.role, district: draft.district.trim(),
      taluka: draft.taluka ? draft.taluka.trim() : (needsTaluka(draft.role) ? draft.taluka.trim() : ''),
      locality: ['city', 'ward', 'village'].includes(draft.role) ? draft.locality.trim() : '',
      cell: draft.role === 'cell' ? draft.cell.trim() : '', createdAt: serverTimestamp(),
    };
    await setDoc(doc(db, 'presidents', account.uid), normalized);
    await updateProfile(account, { displayName: normalized.name });
  }
  return <SessionContext.Provider value={{ user, profile, isAdmin, loading, error, createAccount,
    signIn: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password); },
    signOut: () => signOut(auth), resetPassword: email => sendPasswordResetEmail(auth, email.trim().toLowerCase()),
    retry: () => { setLoading(true); setRetryKey(previous => previous + 1); },
  }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession requires SessionProvider');
  return value;
}
export { friendlyFirebaseError };
