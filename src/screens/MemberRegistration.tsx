import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { useMembers } from '../context/MembersContext';
import { emptyPerson, committeePath } from '../lib/community';
import { Screen, ui } from '../components/Screen';
import { PersonForm } from '../components/PersonForm';
import { SelectField } from '../components/SelectField';

export function MemberRegistration() {
  const { account } = useSession(), { committees } = useCommunity(), { addMember } = useMembers();
  const [committeeId, setCommittee] = useState(account?.role === 'maker' ? account.committeeId : '');
  const [success, setSuccess] = useState(''), [formKey, setFormKey] = useState(0);
  const available = committees.filter(c => !['state', 'district'].includes(c.level) && (account?.role === 'superadmin' || c.ancestorIds.includes(account?.committeeId || '')));
  return <Screen title="Add a member" description="Submit a member profile for your team’s checker to review. Membership becomes active only after approval.">
    <View style={ui.card}><SelectField label="Committee" value={committeeId} options={available.map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))} onChange={setCommittee} placeholder="Choose a committee" /></View>
    {!!success && <View style={ui.card}><Text accessibilityRole="alert" style={ui.success}>{success}</Text></View>}
    <PersonForm key={formKey} initial={{ ...emptyPerson, areaId: account?.role === 'maker' ? committees.find(c => c.id === account.committeeId)?.areaId || '' : '' }} submitTitle="Submit for approval" onSubmit={async draft => {
      if (!committeeId) throw new Error('Choose the committee for this member.');
      await addMember(draft, committeeId); setSuccess(draft.name + ' has been submitted to your checker. You can enter the next member.'); setFormKey(k => k + 1);
    }} />
  </Screen>;
}
