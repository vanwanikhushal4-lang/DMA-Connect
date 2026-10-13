import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import type { WorkItem } from '../lib/community';
import { committeePath } from '../lib/community';
import { api } from '../services/api';
import { ActionButton } from '../components/ActionButton';
import { MemberField } from '../components/MemberField';
import { SelectField } from '../components/SelectField';
import { Screen, ui } from '../components/Screen';
import { colors } from '../theme';

type Page = { items: WorkItem[]; nextCursor: string | null };
const titles = { addMember: 'Member registration', createInvitation: 'Account invitation', changeAppointment: 'Account change' };
function WorkPhoto({ workId, path }: { workId: string; path: string }) {
  const [uri, setUri] = useState(''), [error, setError] = useState('');
  useEffect(() => { let active = true; void api<{ uri: string }>('workPhoto', { workId, path }).then(r => { if (active) setUri(r.uri); }).catch(() => { if (active) setError('Photograph could not be loaded.'); }); return () => { active = false; }; }, [workId, path]);
  return uri ? <Image source={{ uri }} accessibilityLabel="Submitted member photograph" style={{ width: 180, height: 180, borderRadius: 16 }} /> : error ? <Text style={ui.error}>{error}</Text> : <ActivityIndicator color={colors.purple} />;
}
export function WorkScreen({ embedded = false }: { embedded?: boolean }) {
  const { account } = useSession(), { revision, refresh, committees } = useCommunity();
  const [status, setStatus] = useState('pending'), [page, setPage] = useState<Page | null>(null), [selected, setSelected] = useState<WorkItem | null>(null);
  const [reason, setReason] = useState(''), [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { let active = true; void api<Page>('workDirectory', { status }).then(p => { if (active) setPage(p); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [status, revision]);
  async function action(operation: string, payload: object, key: string) {
    setBusy(key); setError(''); setMessage('');
    try { await api(operation, payload); setSelected(null); setReason(''); await refresh(); setMessage(operation === 'withdrawWork' ? 'Submission withdrawn.' : 'Decision saved.'); } catch (e) { setError(e instanceof Error ? e.message : 'The action failed.'); } finally { setBusy(''); }
  }
  const content = <>
    <View style={ui.card}><Text style={ui.heading}>Maker → Checker → Active</Text><Text style={ui.body}>Makers submit work. A separate checker approves or rejects it. Presidents can see submissions and decisions throughout their scope.</Text><SelectField label="Work status" value={status} options={['pending', 'approved', 'declined', 'withdrawn'].map(value => ({ value, label: value === 'declined' ? 'Rejected' : value[0].toUpperCase() + value.slice(1) }))} onChange={v => { setStatus(v); setPage(null); setSelected(null); setError(''); }} /></View>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}{!!message && <Text accessibilityRole="alert" style={ui.success}>{message}</Text>}
    {!page && !error && <ActivityIndicator color={colors.purple} />}
    {page?.items.length === 0 && <View style={ui.card}><Text style={ui.body}>No {status === 'declined' ? 'rejected' : status} work in your scope.</Text></View>}
    {page?.items.map(item => <View key={item.id} style={ui.card}><Text style={ui.heading}>{item.name}</Text><Text style={ui.body}>{titles[item.operation]} · {item.teamName}</Text><Text style={ui.body}>Submitted by {item.createdByName} · {new Date(item.createdAt).toLocaleString('en-IN')}</Text>{!!item.phoneNumber && <Text style={ui.body}>{item.phoneNumber}</Text>}{!!item.reason && <Text style={ui.body}>{item.reason}</Text>}<ActionButton title="View submission" secondary busy={busy === item.id} disabled={!!busy} onPress={() => { setBusy(item.id); setError(''); void api<{ item: WorkItem }>('workDetail', { workId: item.id }).then(r => { setSelected(r.item); setReason(''); }).catch(e => setError(e.message)).finally(() => setBusy('')); }} /></View>)}
    {selected && <View style={ui.card}><Text style={ui.heading}>{titles[selected.operation]} details</Text><Text style={ui.body}>Team: {selected.teamName} · Status: {selected.status}</Text><Text style={ui.body}>Maker: {selected.createdByName}</Text><Text style={ui.body}>Submitted {new Date(selected.createdAt).toLocaleString('en-IN')}</Text>{!!selected.reviewedAt && <Text style={ui.body}>Decided {new Date(selected.reviewedAt).toLocaleString('en-IN')}</Text>}{!!selected.reviewedBy && <Text selectable style={ui.body}>Checker: {selected.reviewedByName || 'Assigned checker'}</Text>}
      {Object.entries(selected.payload || {}).filter(([key]) => !['uid', 'photoPaths', 'birthdayKey', 'nameSearch', 'phoneNumber', 'subjectProfile'].includes(key)).map(([key, value]) => <View key={key}><Text style={ui.body}>{({ areaId: 'Home area', committeeId: 'Committee', birthdayEmailsEnabled: 'Birthday greetings', uid: 'Account', dob: 'Date of birth' } as Record<string, string>)[key] || key[0].toUpperCase() + key.slice(1)}</Text><Text selectable style={ui.heading}>{key === 'socials' && value && typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${k}: ${v || 'Not provided'}`).join('\n') : ['committeeId', 'areaId'].includes(key) ? (committees.find(c => c.id === value) ? committeePath(committees.find(c => c.id === value)!, committees) : String(value)) : String(value)}</Text></View>)}
      {selected.payload?.subjectProfile && typeof selected.payload.subjectProfile === 'object' ? <View style={{ gap: 10 }}><Text style={ui.heading}>Account holder profile at submission</Text>{Object.entries(selected.payload.subjectProfile).filter(([key]) => key !== 'photoPaths').map(([key, value]) => <View key={key}><Text style={ui.body}>{key}</Text><Text selectable style={ui.heading}>{value && typeof value === 'object' ? Object.entries(value).map(([k, v]) => `${k}: ${v || 'Not provided'}`).join('\n') : key === 'areaId' ? (committees.find(c => c.id === value) ? committeePath(committees.find(c => c.id === value)!, committees) : String(value)) : String(value)}</Text></View>)}</View> : null}
      {selected.payload?.subjectProfile && typeof selected.payload.subjectProfile === 'object' && 'photoPaths' in selected.payload.subjectProfile && Array.isArray(selected.payload.subjectProfile.photoPaths) ? selected.payload.subjectProfile.photoPaths.map(path => <WorkPhoto key={String(path)} workId={selected.id} path={String(path)} />) : null}
      {Array.isArray(selected.payload?.photoPaths) && selected.payload.photoPaths.map(path => <WorkPhoto key={String(path)} workId={selected.id} path={String(path)} />)}
      {!!selected.reason && <Text style={ui.body}>Decision note: {selected.reason}</Text>}
      {selected.status === 'pending' && account?.role === 'checker' && account.committeeId === selected.teamId && account.uid !== selected.createdBy && <><MemberField label="Decision note" icon={UserRound} value={reason} onChangeText={setReason} maxLength={500} multiline /><ActionButton title="Approve submission" busy={busy === 'approve'} disabled={!!busy} onPress={() => void action('reviewWork', { workId: selected.id, decision: 'approved', reason }, 'approve')} /><ActionButton title="Reject submission" secondary busy={busy === 'reject'} disabled={!!busy || !reason.trim()} onPress={() => void action('reviewWork', { workId: selected.id, decision: 'declined', reason }, 'reject')} /></>}
      {selected.status === 'pending' && account?.role === 'maker' && account.uid === selected.createdBy && <ActionButton title="Withdraw submission" secondary disabled={!!busy} onPress={() => void action('withdrawWork', { workId: selected.id }, 'withdraw')} />}
      <ActionButton title="Close submission" secondary onPress={() => setSelected(null)} />
    </View>}
    {page?.nextCursor && <ActionButton title="Load more work" secondary disabled={!!busy} busy={busy === 'more'} onPress={() => { setBusy('more'); void api<Page>('workDirectory', { status, cursor: page.nextCursor }).then(p => setPage(current => current ? { items: [...current.items, ...p.items], nextCursor: p.nextCursor } : p)).catch(e => setError(e.message)).finally(() => setBusy('')); }} />}
  </>;
  return embedded ? <View style={{ gap: 16 }}>{content}</View> : <Screen title={account?.role === 'checker' ? 'Review work' : 'Submitted work'}>{content}</Screen>;
}
