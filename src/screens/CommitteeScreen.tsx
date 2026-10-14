import { useState } from 'react';
import { Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { useSession } from '../context/SessionContext';
import { committeePath } from '../lib/community';
import { api } from '../services/api';
import { Screen, ui } from '../components/Screen';
import { SelectField } from '../components/SelectField';
import { ActionButton } from '../components/ActionButton';
import { LetterheadCard } from '../components/LetterheadCard';

export function CommitteeScreen() {
  const { committees, myRequests, affiliations, catalogueError } = useCommunity(), { profile } = useSession();
  const [areaId, setArea] = useState(profile?.areaId || ''), [wardId, setWard] = useState(''), [localId, setLocal] = useState(''), [cellId, setCell] = useState('');
  const [busy, setBusy] = useState(''), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function act(operation: string, payload: object, key: string, success: string) {
    setBusy(key); setError(''); setMessage('');
    try { await api(operation, payload); setMessage(success); } catch (e) { setError(e instanceof Error ? e.message : 'The request could not be completed.'); } finally { setBusy(''); }
  }
  const selectedArea = localId || wardId || areaId;
  const unavailable = (id: string) => affiliations.some(a => a.committeeId === id && a.status === 'active') || myRequests.some(r => r.committeeId === id && r.status === 'pending');
  const wards = committees.filter(c => c.level === 'ward' && c.parentId === areaId), locals = committees.filter(c => c.level === 'local' && c.parentId === wardId);
  return <Screen title="My committees" description="Join an area committee, a cell, or both. Each committee approves its own membership requests.">
    {!!(error || catalogueError) && <Text accessibilityRole="alert" style={ui.error}>{error || catalogueError}</Text>}{!!message && <Text accessibilityRole="alert" style={ui.success}>{message}</Text>}
    <View style={ui.card}><Text style={ui.heading}>Area committee</Text>
      <SelectField label="Area" value={areaId} options={committees.filter(c => c.level === 'taluka').map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))} onChange={v => { setArea(v); setWard(''); setLocal(''); }} />
      {!!wards.length && <SelectField label="Ward" value={wardId} options={[{ value: '', label: 'Area committee only' }, ...wards.map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))]} onChange={v => { setWard(v); setLocal(''); }} />}
      {!!locals.length && <SelectField label="Village or locality" value={localId} options={[{ value: '', label: 'Ward committee only' }, ...locals.map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))]} onChange={setLocal} />}
      {!!selectedArea && <Text style={ui.body}>Requesting: {committees.find(c => c.id === selectedArea)?.name}</Text>}
      <ActionButton title={unavailable(selectedArea) ? 'Already joined or requested' : 'Request area membership'} disabled={!selectedArea || unavailable(selectedArea) || !!busy} busy={busy === 'area'} onPress={() => void act('requestAffiliation', { committeeId: selectedArea }, 'area', 'Your area request has been submitted for approval.')} />
    </View>
    <View style={ui.card}><Text style={ui.heading}>Cell committee</Text><SelectField label="Cell" value={cellId} options={committees.filter(c => c.level === 'cell').map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))} onChange={setCell} />
      <ActionButton title={unavailable(cellId) ? 'Already joined or requested' : 'Request cell membership'} disabled={!cellId || unavailable(cellId) || !!busy} busy={busy === 'cell'} onPress={() => void act('requestAffiliation', { committeeId: cellId }, 'cell', 'Your cell request has been submitted for approval.')} />
    </View>
    <View style={ui.card}><Text style={ui.heading}>Approved affiliations</Text>{!affiliations.some(a => a.status === 'active') && <Text style={ui.body}>Approved memberships will appear here.</Text>}
      {affiliations.filter(a => a.status === 'active').map(a => <View key={a.id} style={{ gap: 10 }}><Text style={ui.heading}>{a.committeeName}</Text><View style={ui.pill}><Text style={ui.pillText}>Approved · {a.branch === 'cell' ? 'Cell' : 'Area'}</Text></View><ActionButton title="Leave committee" secondary disabled={!!busy} busy={busy === a.id} onPress={() => void act('leaveAffiliation', { committeeId: a.committeeId }, a.id, 'You have left ' + a.committeeName + '. Your other affiliations are unchanged.')} /></View>)}
    </View>
    <View style={ui.card}><Text style={ui.heading}>My requests</Text>{!myRequests.length && <Text style={ui.body}>You have not submitted a committee request yet.</Text>}
      {[...myRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(r => <View key={r.id} style={{ gap: 9 }}><Text style={ui.heading}>{r.committeeName}</Text><View style={ui.pill}><Text style={ui.pillText}>{r.status[0].toUpperCase() + r.status.slice(1)}</Text></View>{!!r.reason && <Text style={ui.body}>{r.reason}</Text>}{r.status === 'pending' && <ActionButton title="Withdraw request" secondary disabled={!!busy} busy={busy === r.id} onPress={() => void act('decideRequest', { requestId: r.id, decision: 'withdrawn' }, r.id, 'Your pending request has been withdrawn.')} />}</View>)}
    </View>
    <LetterheadCard />
  </Screen>;
}
