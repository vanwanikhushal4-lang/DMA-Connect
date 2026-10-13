import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { api } from '../services/api';
import { useSession } from './SessionContext';
import { isStaff } from '../lib/community';
import type { Account, Affiliation, AffiliationRequest, Committee, Invitation } from '../lib/community';

export type StaffState = { requests: AffiliationRequest[]; invitations: Invitation[]; presidents: Account[]; total: number; affiliationTotal: number; allCommittees?: Committee[] };
type Value = { committees: Committee[]; committeesLoading: boolean; catalogueError: string; myRequests: AffiliationRequest[]; affiliations: Affiliation[]; staffState: StaffState | null; staffError: string; refresh: () => Promise<void>; revision: number };
const Context = createContext<Value | null>(null);
export function CommunityProvider({ children }: PropsWithChildren) {
  const { user, account } = useSession();
  const key = [user?.uid, account?.personId, account?.committeeId, account?.role, account?.status].join(':');
  return <OwnedCommunity key={key}>{children}</OwnedCommunity>;
}
function OwnedCommunity({ children }: PropsWithChildren) {
  const { user, account } = useSession();
  const [committees, setCommittees] = useState<Committee[]>([]), [committeesLoading, setLoading] = useState(true), [catalogueError, setCatalogueError] = useState('');
  const [myRequests, setRequests] = useState<AffiliationRequest[]>([]), [affiliations, setAffiliations] = useState<Affiliation[]>([]);
  const [staffState, setStaff] = useState<StaffState | null>(null), [staffError, setError] = useState(''), [revision, setRevision] = useState(0);
  const uid = user?.uid, staffAccount = isStaff(account), personId = account?.personId;
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(query(collection(db, 'committees'), where('active', '==', true)), snapshot => {
      setCommittees(snapshot.docs.map(s => ({ ...s.data(), id: s.id } as Committee)).sort((a, b) => a.name.localeCompare(b.name))); setLoading(false); setCatalogueError('');
    }, () => { setLoading(false); setCatalogueError('Committee information could not be loaded. Check your connection.'); });
  }, [uid]);
  useEffect(() => {
    if (!uid || !personId) return;
    const stopRequests = onSnapshot(query(collection(db, 'requests'), where('applicantUid', '==', uid)), snapshot => setRequests(snapshot.docs.map(s => ({ ...s.data(), id: s.id, createdAt: s.data().createdAt?.toDate?.().toISOString() || '' } as AffiliationRequest))), () => setCatalogueError('Your membership requests could not be loaded.'));
    const stopAffiliations = onSnapshot(query(collection(db, 'affiliations'), where('personId', '==', personId)), snapshot => setAffiliations(snapshot.docs.map(s => ({ ...s.data(), id: s.id, createdAt: s.data().createdAt?.toDate?.().toISOString() || '' } as Affiliation))), () => setCatalogueError('Your affiliations could not be loaded.'));
    return () => { stopRequests(); stopAffiliations(); };
  }, [uid, personId]);
  const refresh = useCallback(async () => {
    if (!uid || !staffAccount) return;
    try { const result = await api<StaffState>('staffState'); setStaff(result); setError(''); setRevision(r => r + 1); }
    catch (e) { setError(e instanceof Error ? e.message : 'The workspace could not be refreshed.'); }
  }, [uid, staffAccount]);
  useEffect(() => {
    if (!uid || !staffAccount) return;
    const stop = onSnapshot(doc(db, 'workspaceEvents', uid), () => { void refresh(); }, () => { setError('The workspace could not be refreshed. Check your connection.'); });
    return stop;
  }, [uid, staffAccount, account?.committeeId, refresh]);
  return <Context.Provider value={{ committees, committeesLoading: !!uid && committeesLoading, catalogueError, myRequests, affiliations, staffState, staffError, refresh, revision }}>{children}</Context.Provider>;
}
export function useCommunity() { const c = useContext(Context); if (!c) throw new Error('useCommunity requires CommunityProvider'); return c; }
