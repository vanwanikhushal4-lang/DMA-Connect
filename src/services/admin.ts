import {
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { Platform, Share } from 'react-native';
import { db } from './firebase';
import type { President, PresidentRole } from '../lib/presidents';
import type { Member, MemberDraft } from '../lib/members';
import { parseDob } from '../lib/members';

export type AdminMember = Member & {
  presidentUid: string;
  presidentName?: string;
  presidentRole?: string;
};

export function subscribeToPresidents(
  onUpdate: (presidents: President[]) => void,
  onError: (error: Error) => void,
): () => void {
  const presidentsRef = collection(db, 'presidents');
  return onSnapshot(
    presidentsRef,
    snapshot => {
      const presidents = snapshot.docs.map(item => {
        const data = item.data();
        return {
          ...data,
          uid: item.id,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        } as President;
      });
      onUpdate(presidents);
    },
    error => onError(error),
  );
}

export function subscribeToAllMembers(
  onUpdate: (members: AdminMember[]) => void,
  onError: (error: Error) => void,
): () => void {
  // Query all members across all presidents subcollections
  const membersGroup = query(collectionGroup(db, 'members'), orderBy('createdAt', 'desc'));
  return onSnapshot(
    membersGroup,
    snapshot => {
      const items = snapshot.docs.map(item => {
        const data = item.data();
        const dob = (data.dob as Timestamp)?.toDate ? (data.dob as Timestamp).toDate() : new Date(data.dob || Date.now());
        const parentUid = item.ref.parent.parent?.id || data.ownerUid || '';
        return {
          ...data,
          id: item.id,
          presidentUid: parentUid,
          dob: `${String(dob.getUTCDate()).padStart(2, '0')}/${String(dob.getUTCMonth() + 1).padStart(2, '0')}/${dob.getUTCFullYear()}`,
          createdAt: (data.createdAt as Timestamp)?.toDate?.()?.toISOString() || data.createdAt || new Date().toISOString(),
        } as AdminMember;
      });
      onUpdate(items);
    },
    error => onError(error),
  );
}

export async function updatePresidentRole(
  uid: string,
  updates: {
    role: PresidentRole;
    district?: string;
    taluka?: string;
    locality?: string;
    cell?: string;
  },
): Promise<void> {
  const ref = doc(db, 'presidents', uid);
  await updateDoc(ref, updates);
}

export async function deletePresident(uid: string): Promise<void> {
  const ref = doc(db, 'presidents', uid);
  await deleteDoc(ref);
}

export async function updateMember(
  presidentUid: string,
  mobile: string,
  updates: Partial<MemberDraft>,
): Promise<void> {
  const ref = doc(db, 'presidents', presidentUid, 'members', mobile);
  const data: Record<string, unknown> = { ...updates };
  if (updates.dob) {
    const parsed = parseDob(updates.dob);
    if (parsed) {
      data.dob = Timestamp.fromDate(new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())));
    }
  }
  await updateDoc(ref, data);
}

export async function deleteMember(presidentUid: string, mobile: string): Promise<void> {
  const ref = doc(db, 'presidents', presidentUid, 'members', mobile);
  await deleteDoc(ref);
}

export async function designateAdmin(uid: string, email: string): Promise<void> {
  await setDoc(doc(db, 'admins', uid), {
    uid,
    email,
    assignedAt: new Date().toISOString(),
  });
}

function escapeCsvField(field: unknown): string {
  if (field === undefined || field === null) return '""';
  const str = String(field).replace(/"/g, '""');
  return `"${str}"`;
}

export async function exportMembersCSV(members: AdminMember[]): Promise<void> {
  const headers = ['Name', 'Mobile', 'Email', 'Date of Birth', 'Residence', 'Taluka', 'Registered By', 'President Role', 'Registered Date'];
  const rows = members.map(m => [
    escapeCsvField(m.name),
    escapeCsvField(m.mobile),
    escapeCsvField(m.email || '-'),
    escapeCsvField(m.dob),
    escapeCsvField(m.residence),
    escapeCsvField(m.taluka),
    escapeCsvField(m.presidentName || m.presidentUid || '-'),
    escapeCsvField(m.presidentRole || '-'),
    escapeCsvField(new Date(m.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })),
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `dma_members_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } else {
    // Native platforms: use Share dialog
    await Share.share({
      message: csvContent,
      title: 'DMA Connect Member Directory Export',
    });
  }
}
