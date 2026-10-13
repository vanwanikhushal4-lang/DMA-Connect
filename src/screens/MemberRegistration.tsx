import { useState } from 'react';
import { Text, View } from 'react-native';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { useMembers } from '../context/MembersContext';
import { emptyPerson } from '../lib/community';
import { Screen, ui } from '../components/Screen';
import { PersonForm } from '../components/PersonForm';
import { SelectField } from '../components/SelectField';

export function MemberRegistration() {
  const { account } = useSession(), { committees } = useCommunity(), { addMember } = useMembers();
  const [committeeId, setCommittee] = useState(account?.role === 'president' ? account.committeeId : '');
  const [success, setSuccess] = useState(''), [formKey, setFormKey] = useState(0);
  const available = committees.filter(c => c.level !== 'district' && (account?.role === 'superadmin' || c.ancestorIds.includes(account?.committeeId || '')));
  return <Screen title="Add a member" description="Register a person with your committee. They can later verify their number to claim their own account.">
    <View style={ui.card}><SelectField label="Committee" value={committeeId} options={available.map(c => ({ value: c.id, label: c.name, description: c.branch === 'cell' ? 'Cell committee' : 'Area committee' }))} onChange={setCommittee} placeholder="Choose a committee" /></View>
    {!!success && <View style={ui.card}><Text accessibilityRole="alert" style={ui.success}>{success}</Text></View>}
    <PersonForm key={formKey} initial={{ ...emptyPerson, areaId: account?.role === 'president' ? committees.find(c => c.id === account.committeeId)?.areaId || '' : '' }} submitTitle="Add member" onSubmit={async draft => {
      if (!committeeId) throw new Error('Choose the committee for this member.');
      await addMember(draft, committeeId); setSuccess(draft.name + ' has been added. You can register the next member.'); setFormKey(k => k + 1);
    }} />
  </Screen>;
}
