import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { collection, doc, onSnapshot, orderBy, query, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useSession } from './SessionContext';
import { normalizeDraft, parseDob, validateMember } from '../lib/members';
import type { Member, MemberDraft } from '../lib/members';
import { needsTaluka } from '../lib/presidents';
import { friendlyFirebaseError } from '../lib/firebase-errors';

type Value = { members: Member[]; loading: boolean; saving: boolean; storageError: string; loadMembers: () => void; addMember: (draft: MemberDraft) => Promise<Member> };
const MembersContext = createContext<Value | null>(null);
export function MembersProvider({ children }: PropsWithChildren) {
  const { profile, isAdmin } = useSession();
  const uid = profile?.uid;
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [retry, setRetry] = useState(0);
  const locked = useRef(false);
  useEffect(() => {
    // Admin users have no president profile — mark as done immediately.
    if (!uid) { setLoading(false); setMembers([]); return; }
    setLoading(true);
    // Real-time snapshots are required: both tabs reflect cloud changes immediately.
    const membersQuery = query(collection(db, 'presidents', uid, 'members'), orderBy('createdAt', 'desc'));
    return onSnapshot(membersQuery, snapshot => {
      const next = snapshot.docs.map(item => {
        const data = item.data();
        const dob = (data.dob as Timestamp).toDate();
        return { ...data, id: item.id,
          dob: `${String(dob.getUTCDate()).padStart(2, '0')}/${String(dob.getUTCMonth() + 1).padStart(2, '0')}/${dob.getUTCFullYear()}`,
          createdAt: (data.createdAt as Timestamp)?.toDate().toISOString() || new Date().toISOString(),
        } as Member;
      });
      setMembers(next); setLoading(false); setStorageError('');
    }, cause => { if (__DEV__) console.warn('Member subscription failed:', cause.code, cause.message); setLoading(false); setStorageError('Your members couldn’t be loaded. Check your connection and retry.'); });
  }, [uid, retry]);
  async function addMember(draft: MemberDraft): Promise<Member> {
    if (!profile || loading || storageError) throw new Error('Wait for your member records to load, then try again.');
    if (locked.current) throw new Error('A member is already being saved.');
    const normalized = normalizeDraft({
      ...draft,
      taluka: needsTaluka(profile.role) && profile.taluka ? profile.taluka : draft.taluka,
    });
    if (Object.keys(validateMember(normalized, members)).length) throw new Error('Please check the member details.');
    if (needsTaluka(profile.role) && profile.taluka && normalized.taluka !== profile.taluka) throw new Error('Use the taluka assigned to your account.');
    locked.current = true; setSaving(true);
    try {
      const dob = parseDob(normalized.dob)!;
      const memberRef = doc(db, 'presidents', profile.uid, 'members', normalized.mobile);
      await runTransaction(db, async transaction => {
        if ((await transaction.get(memberRef)).exists()) throw new Error('A member with this mobile number has already been added.');
        transaction.set(memberRef, { ...normalized, dob: Timestamp.fromDate(new Date(Date.UTC(dob.getFullYear(), dob.getMonth(), dob.getDate()))), ownerUid: profile.uid, createdAt: serverTimestamp() });
      });
      return { ...normalized, id: normalized.mobile, createdAt: new Date().toISOString() };
    } catch (error) {
      if (error instanceof Error && error.message.includes('already been added')) throw error;
      throw new Error(friendlyFirebaseError(error));
    } finally { locked.current = false; setSaving(false); }
  }
  return <MembersContext.Provider value={{ members, loading, saving, storageError,
    loadMembers: () => { setLoading(true); setStorageError(''); setRetry(value => value + 1); }, addMember,
  }}>{children}</MembersContext.Provider>;
}
export function useMembers() { const value = useContext(MembersContext); if (!value) throw new Error('useMembers requires MembersProvider'); return value; }
