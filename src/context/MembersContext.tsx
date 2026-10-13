import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { api } from '../services/api';
import { useSession } from './SessionContext';
import { useCommunity } from './CommunityContext';
import { isStaff, toIsoDob } from '../lib/community';
import type { Person, PersonDraft } from '../lib/community';

type Page = { members: Person[]; total: number; nextCursor: string | null };
type Value = { members: Person[]; total: number; loading: boolean; loadingMore: boolean; storageError: string; nextCursor: string | null; loadMembers: () => void; loadMore: () => Promise<void>; search: string; setSearch: (v: string) => void; committeeFilter: string; setCommitteeFilter: (v: string) => void; addMember: (draft: PersonDraft, committeeId: string) => Promise<void> };
const Context = createContext<Value | null>(null);
export function MembersProvider({ children }: PropsWithChildren) {
  const { account } = useSession(), { revision, refresh } = useCommunity();
  const [result, setResult] = useState<{ key: string; page: Page; error: string } | null>(null), [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState(''), [committeeFilter, setCommitteeFilter] = useState(''), [retry, setRetry] = useState(0), [term, setTerm] = useState('');
  const loadingPage = useRef(false), latestKey = useRef('');
  const enabled = isStaff(account), key = [account?.uid, account?.committeeId, revision, retry, committeeFilter, term].join(':');
  const current = result?.key === key ? result : null;
  const loading = enabled && !current, members = current?.page.members || [], cursor = current?.page.nextCursor || null;
  useEffect(() => { const t = setTimeout(() => setTerm(search.trim()), 300); return () => clearTimeout(t); }, [search]);
  const fetchPage = useCallback(async (after: string | null = null, active: () => boolean = () => true) => {
    try {
      const data = await api<Page>('memberDirectory', { ...(after ? { cursor: after } : {}), ...(committeeFilter ? { committeeId: committeeFilter } : {}), ...(term ? { search: term } : {}) });
      if (!active() || latestKey.current !== key) return;
      setResult(previous => ({ key, error: '', page: { ...data, members: after && previous?.key === key ? [...previous.page.members, ...data.members.filter(m => !previous.page.members.some(p => p.id === m.id))] : data.members } }));
    } catch (e) {
      if (active() && latestKey.current === key) setResult(previous => ({ key, page: previous?.key === key ? previous.page : { members: [], total: 0, nextCursor: null }, error: e instanceof Error ? e.message : 'The members could not be loaded.' }));
    } finally { loadingPage.current = false; if (active() && latestKey.current === key) setLoadingMore(false); }
  }, [committeeFilter, term, key]);
  useEffect(() => {
    latestKey.current = key; loadingPage.current = false;
    if (!enabled) return;
    let active = true; void fetchPage(null, () => active);
    return () => { active = false; };
  }, [enabled, key, fetchPage]);
  async function loadMore() {
    if (!cursor || loading || loadingPage.current) return;
    loadingPage.current = true; setLoadingMore(true); await fetchPage(cursor);
  }
  async function addMember(draft: PersonDraft, committeeId: string) {
    await api('addMember', { ...draft, dob: toIsoDob(draft.dob), committeeId }); await refresh(); setRetry(r => r + 1);
  }
  return <Context.Provider value={{ members, total: current?.page.total || 0, loading, loadingMore, storageError: current?.error || '', nextCursor: cursor, loadMembers: () => setRetry(r => r + 1), loadMore, search, setSearch, committeeFilter, setCommitteeFilter, addMember }}>{children}</Context.Provider>;
}
export function useMembers() { const c = useContext(Context); if (!c) throw new Error('useMembers requires MembersProvider'); return c; }
