import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import type { Affiliation } from '../lib/community';
import { canReviewCommittee } from '../lib/community';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { api } from '../services/api';
import { ActionButton } from '../components/ActionButton';
import { SelectField } from '../components/SelectField';
import { ui } from '../components/Screen';
import { colors } from '../theme';
type Page = { affiliations: (Affiliation & { personName: string })[]; nextCursor: string | null };
export function AffiliationManagement() {
  const { account } = useSession(), { committees, revision, refresh } = useCommunity();
  const [status, setStatus] = useState('active'), [page, setPage] = useState<Page | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState('');
  useEffect(() => { let active = true; void api<Page>('affiliationDirectory', { status }).then(p => { if (active) setPage(p); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [status, revision]);
  return <View style={{ gap: 16 }}><View style={ui.card}><Text style={ui.heading}>Committee affiliations</Text><Text style={ui.body}>Checkers can suspend or restore links handled by their team. Each area and cell affiliation is managed independently.</Text><SelectField label="Affiliation status" value={status} options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }]} onChange={v => { setStatus(v); setPage(null); setError(''); }} /></View>{!!error && <Text style={ui.error}>{error}</Text>}{!page && !error && <ActivityIndicator color={colors.purple} />}{page?.affiliations.length === 0 && <Text style={ui.body}>No {status} affiliations in your scope.</Text>}{page?.affiliations.map(link => { const c = committees.find(c => c.id === link.committeeId); return <View key={link.id} style={ui.card}><Text style={ui.heading}>{link.personName}</Text><Text style={ui.body}>{link.committeeName} · {link.status}</Text>{c && canReviewCommittee(account, c) && link.accountUid !== account?.uid && <ActionButton title={link.status === 'active' ? 'Suspend affiliation' : 'Restore affiliation'} secondary disabled={!!busy} busy={busy === link.id} onPress={() => { setBusy(link.id); setError(''); void api('changeAffiliation', { affiliationId: link.id, status: link.status === 'active' ? 'suspended' : 'active' }).then(refresh).catch(e => setError(e.message)).finally(() => setBusy('')); }} />}</View>; })}{page?.nextCursor && <ActionButton title="Load more affiliations" secondary disabled={!!busy} onPress={() => { setBusy('more'); void api<Page>('affiliationDirectory', { status, cursor: page.nextCursor }).then(p => setPage(current => current ? { affiliations: [...current.affiliations, ...p.affiliations], nextCursor: p.nextCursor } : p)).catch(e => setError(e.message)).finally(() => setBusy('')); }} />}</View>;
}
