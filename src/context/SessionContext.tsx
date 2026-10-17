import { createContext, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { onIdTokenChanged, reload, sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import { auth } from '../services/auth-client';
import { api } from '../services/api';
import { beginPhoneOtp, signOutPhone } from '../services/phone-auth';
import type { OtpConfirmation } from '../services/phone-auth';
import type { Account, Person, PersonDraft } from '../lib/community';
import { toIsoDob } from '../lib/community';
import { friendlyFirebaseError } from '../lib/firebase-errors';
import { backendApiEnabled } from '../services/backend-api';

type Value = {
  user: User | null; account: Account | null; profile: Person | null; loading: boolean; error: string; emailVerified: boolean;
  startOtp: (phone: string, onAutomaticError?: (error: unknown) => void) => Promise<OtpConfirmation>; completeProfile: (draft: PersonDraft) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>; signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>; verifyEmail: () => Promise<void>; refreshVerification: () => Promise<void>; retry: () => void;
};
const Context = createContext<Value | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<User | null>(null), [account, setAccount] = useState<Account | null>(null), [profile, setProfile] = useState<Person | null>(null);
  const [loading, setLoading] = useState(!backendApiEnabled), [error, setError] = useState(''), [emailVerified, setEmailVerified] = useState(false), [retryKey, setRetryKey] = useState(0);
  useEffect(() => {
    if (backendApiEnabled) return;
    let stopAccount: (() => void) | undefined, stopPerson: (() => void) | undefined;
    let generation = 0;
    let previousUid: string | undefined;
    const stopAuth = onIdTokenChanged(auth, next => {
      if (next && next.uid === previousUid) { setUser(next); setEmailVerified(next.emailVerified); return; }
      previousUid = next?.uid;
      generation++; const current = generation;
      stopAccount?.(); stopPerson?.();
      setUser(next); setAccount(null); setProfile(null); setError(''); setEmailVerified(next?.emailVerified || false);
      if (!next) { setLoading(false); return; }
      setLoading(true);
      stopAccount = onSnapshot(doc(db, 'accounts', next.uid), snapshot => {
        if (generation !== current) return;
        stopPerson?.();
        if (!snapshot.exists()) { setAccount(null); setProfile(null); setLoading(false); return; }
        const data = snapshot.data();
        setAccount({ ...data, uid: snapshot.id, createdAt: data.createdAt?.toDate?.().toISOString() || '' } as Account);
        stopPerson = onSnapshot(doc(db, 'people', data.personId), person => {
          if (generation !== current) return;
          const p = person.data();
          setProfile(p ? { ...p, id: person.id, createdAt: p.createdAt?.toDate?.().toISOString() || '' } as Person : null);
          setLoading(false);
        }, () => { if (generation === current) { setError('Your profile could not be loaded. Retry or contact the Super Admin.'); setLoading(false); } });
      }, () => { if (generation === current) { setError('Your account could not be loaded. Check your connection and retry.'); setLoading(false); } });
    });
    return () => { generation++; stopAuth(); stopAccount?.(); stopPerson?.(); };
  }, [retryKey]);
  async function completeProfile(draft: PersonDraft) {
    await api('completeProfile', { ...draft, dob: toIsoDob(draft.dob) });
    if (auth.currentUser) { await reload(auth.currentUser); await auth.currentUser.getIdToken(true); setEmailVerified(auth.currentUser.emailVerified); }
  }
  async function refreshVerification() {
    if (!auth.currentUser) return;
    await reload(auth.currentUser); await auth.currentUser.getIdToken(true); setEmailVerified(auth.currentUser.emailVerified);
  }
  return <Context.Provider value={{ user, account, profile, loading, error, emailVerified, completeProfile, refreshVerification,
    startOtp: (phone, onAutomaticError) => beginPhoneOtp(phone, !!auth.currentUser && !auth.currentUser.phoneNumber, onAutomaticError),
    signIn: async (email, password) => { await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password); },
    signOut: signOutPhone, resetPassword: email => sendPasswordResetEmail(auth, email.trim().toLowerCase()),
    verifyEmail: async () => { if (!auth.currentUser) throw new Error('Sign in first.'); await reload(auth.currentUser); await sendEmailVerification(auth.currentUser); },
    retry: () => { setLoading(true); setRetryKey(k => k + 1); },
  }}>{children}</Context.Provider>;
}
export function useSession() { const c = useContext(Context); if (!c) throw new Error('useSession requires SessionProvider'); return c; }
export { friendlyFirebaseError };
