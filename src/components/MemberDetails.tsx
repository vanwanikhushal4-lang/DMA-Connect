import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { X } from 'lucide-react-native';
import type { Person } from '../lib/community';
import { displayDob, canCreatePresident, committeePath } from '../lib/community';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { api } from '../services/api';
import { PersonPhoto } from './PersonPhoto';
import { SelectField } from './SelectField';
import { ActionButton } from './ActionButton';
import { ui } from './Screen';
import { colors } from '../theme';
export function MemberDetails({ member, onClose, requestId }: { member: Person; onClose: () => void; requestId?: string }) {
  const { account } = useSession(), { committees, refresh } = useCommunity();
  const [target, setTarget] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  async function appoint() {
    setBusy(true); setError('');
    try { await api('changeAppointment', { uid: member.accountUid, committeeId: target }); await refresh(); setMessage('The appointment has been submitted to your checker.'); }
    catch (e) { setError(e instanceof Error ? e.message : 'The appointment could not be updated.'); } finally { setBusy(false); }
  }
  return <Modal transparent animationType="fade" onRequestClose={onClose}><View style={{ flex: 1, backgroundColor: 'rgba(30,21,49,.3)', justifyContent: 'center', alignItems: 'center', padding: 22 }}><ScrollView style={{ width: '100%', maxWidth: 480, maxHeight: '88%', backgroundColor: colors.white, borderRadius: 20, flexGrow: 0 }} contentContainerStyle={{ padding: 24, gap: 17 }} accessibilityViewIsModal>
    <View style={ui.between}><Text style={ui.heading}>Member details</Text><Pressable accessibilityRole="button" accessibilityLabel="Close member details" onPress={onClose} hitSlop={12}><X size={22} color={colors.muted} /></Pressable></View>
    {member.photoPaths.map(path => <PersonPhoto key={path} personId={member.personId} path={path} name={member.name} size={180} requestId={requestId} />)}
    <Text style={ui.title}>{member.name}</Text>
    {[['Mobile', '+91 ' + member.mobile], ['Email', member.email], ['Residence', member.residence], ['Date of birth', displayDob(member.dob)], ['Home area', member.taluka], ['Facebook', member.socials.facebook || 'Not provided'], ['LinkedIn', member.socials.linkedin || 'Not provided'], ['Instagram', member.socials.instagram || 'Not provided'], ['Account', member.accountUid ? 'Account claimed' : 'Awaiting signup with this mobile number']].map(([label, value]) => <View key={label}><Text style={ui.body}>{label}</Text><Text selectable style={ui.heading}>{value}</Text></View>)}
    {account?.role === 'maker' && !!member.accountUid && member.accountUid !== account.uid && <View style={{ gap: 15 }}><View style={ui.divider} /><Text style={ui.heading}>President appointment</Text><SelectField label="Committee" value={target} options={committees.filter(c => canCreatePresident(account, c) && (!c.presidentUid || c.presidentUid === member.accountUid) && !c.pendingInvitationId).map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))} onChange={setTarget} /><ActionButton title="Submit president appointment" disabled={!target} busy={busy} onPress={() => void appoint()} />{!!error && <Text style={ui.error}>{error}</Text>}{!!message && <Text style={ui.success}>{message}</Text>}</View>}
  </ScrollView></View></Modal>;
}
