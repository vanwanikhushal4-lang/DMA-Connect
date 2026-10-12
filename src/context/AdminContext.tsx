import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { President, PresidentRole } from '../lib/presidents';
import type { MemberDraft } from '../lib/members';
import type { AdminMember } from '../services/admin';
import {
  deleteMember as apiDeleteMember,
  deletePresident as apiDeletePresident,
  exportMembersCSV,
  subscribeToAllMembers,
  subscribeToPresidents,
  updateMember as apiUpdateMember,
  updatePresidentRole as apiUpdatePresidentRole,
} from '../services/admin';
import { useSession } from './SessionContext';

type AdminStats = {
  totalMembers: number;
  totalPresidents: number;
  membersToday: number;
  districtsCount: number;
  talukasCount: number;
};

type AdminContextValue = {
  presidents: President[];
  members: AdminMember[];
  loading: boolean;
  error: string;
  stats: AdminStats;
  updatePresidentRole: (uid: string, updates: { role: PresidentRole; district?: string; taluka?: string; locality?: string; cell?: string }) => Promise<void>;
  deletePresident: (uid: string) => Promise<void>;
  updateMember: (presidentUid: string, mobile: string, updates: Partial<MemberDraft>) => Promise<void>;
  deleteMember: (presidentUid: string, mobile: string) => Promise<void>;
  exportCSV: () => Promise<void>;
  retry: () => void;
};

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: PropsWithChildren) {
  const { isAdmin } = useSession();
  const [presidents, setPresidents] = useState<President[]>([]);
  const [rawMembers, setRawMembers] = useState<AdminMember[]>([]);
  const [loadingPresidents, setLoadingPresidents] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [error, setError] = useState('');
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!isAdmin) return;

    const unsubPresidents = subscribeToPresidents(
      data => {
        setPresidents(data);
        setLoadingPresidents(false);
      },
      err => {
        if (__DEV__) console.warn('Failed to load presidents:', err);
        setError('Failed to load presidents directory.');
        setLoadingPresidents(false);
      },
    );

    const unsubMembers = subscribeToAllMembers(
      data => {
        setRawMembers(data);
        setLoadingMembers(false);
      },
      err => {
        if (__DEV__) console.warn('Failed to load members group:', err);
        setError('Failed to load all members. Check Firestore rules and indexes.');
        setLoadingMembers(false);
      },
    );

    return () => {
      unsubPresidents();
      unsubMembers();
    };
  }, [isAdmin, retryKey]);

  // Enrich members with president name and role
  const members = useMemo(() => {
    const presidentMap = new Map(presidents.map(p => [p.uid, p]));
    return rawMembers.map(m => {
      const pres = presidentMap.get(m.presidentUid);
      return {
        ...m,
        presidentName: pres?.name || m.presidentName || 'Unknown President',
        presidentRole: pres?.role || m.presidentRole || '',
      };
    });
  }, [rawMembers, presidents]);

  const stats: AdminStats = useMemo(() => {
    const today = new Date();
    const isToday = (isoDate: string) => {
      const d = new Date(isoDate);
      return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
    };

    const uniqueDistricts = new Set<string>();
    const uniqueTalukas = new Set<string>();

    presidents.forEach(p => {
      if (p.district) uniqueDistricts.add(p.district.trim().toLowerCase());
      if (p.taluka) uniqueTalukas.add(p.taluka.trim().toLowerCase());
    });

    members.forEach(m => {
      if (m.taluka) uniqueTalukas.add(m.taluka.trim().toLowerCase());
    });

    return {
      totalMembers: members.length,
      totalPresidents: presidents.length,
      membersToday: members.filter(m => isToday(m.createdAt)).length,
      districtsCount: uniqueDistricts.size,
      talukasCount: uniqueTalukas.size,
    };
  }, [presidents, members]);

  async function updatePresidentRole(uid: string, updates: { role: PresidentRole; district?: string; taluka?: string; locality?: string; cell?: string }) {
    await apiUpdatePresidentRole(uid, updates);
  }

  async function deletePresident(uid: string) {
    await apiDeletePresident(uid);
  }

  async function updateMember(presidentUid: string, mobile: string, updates: Partial<MemberDraft>) {
    await apiUpdateMember(presidentUid, mobile, updates);
  }

  async function deleteMember(presidentUid: string, mobile: string) {
    await apiDeleteMember(presidentUid, mobile);
  }

  async function exportCSV() {
    await exportMembersCSV(members);
  }

  return (
    <AdminContext.Provider
      value={{
        presidents: isAdmin ? presidents : [],
        members: isAdmin ? members : [],
        loading: isAdmin ? (loadingPresidents || loadingMembers) : false,
        error,
        stats,
        updatePresidentRole,
        deletePresident,
        updateMember,
        deleteMember,
        exportCSV,
        retry: () => {
          setLoadingPresidents(true);
          setLoadingMembers(true);
          setError('');
          setRetryKey(k => k + 1);
        },
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within an AdminProvider');
  return ctx;
}
