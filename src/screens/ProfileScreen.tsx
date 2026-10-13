import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { accountRole, displayDob } from '../lib/community';
import { Screen, ui } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';
import { PersonPhoto } from '../components/PersonPhoto';
import { PersonForm } from '../components/PersonForm';

export function ProfileScreen() {
  const { profile, account, completeProfile } = useSession(), { affiliations, myRequests } = useCommunity();
  const [editing, setEditing] = useState(false), [message, setMessage] = useState('');
  if (!profile) return null;
  return <Screen title={editing ? 'Edit your profile' : 'My profile'} description="Your personal details and committee memberships.">
    {!!message && <Text style={ui.success}>{message}</Text>}
    {editing ? <><PersonForm initial={profile} lockMobile onSubmit={async draft => { await completeProfile(draft); setEditing(false); setMessage('Your profile has been updated.'); }} /><ActionButton title="Cancel editing" secondary onPress={() => setEditing(false)} /></> : <>
      <View style={ui.card}>
        <PersonPhoto personId={profile.personId} path={profile.photoPaths[0]} name={profile.name} size={120} />
        <Text style={ui.heading}>{profile.name}</Text><View style={ui.pill}><Text style={ui.pillText}>{accountRole(account)}</Text></View>
        {[['Email', profile.email], ['Mobile', '+91 ' + profile.mobile], ['Residence', profile.residence], ['Date of birth', displayDob(profile.dob)], ['Home area', profile.taluka], ['Facebook', profile.socials.facebook || 'Not provided'], ['LinkedIn', profile.socials.linkedin || 'Not provided'], ['Instagram', profile.socials.instagram || 'Not provided']].map(([key, value]) => <View key={key}><Text style={ui.body}>{key}</Text><Text selectable style={ui.heading}>{value}</Text></View>)}
        <ActionButton title="Edit profile" secondary onPress={() => { setEditing(true); setMessage(''); }} />
      </View>
      <View style={ui.card}><Text style={ui.heading}>My committees</Text><Text style={ui.body}>{affiliations.filter(a => a.status === 'active').length} approved affiliations · {myRequests.filter(r => r.status === 'pending').length} pending requests</Text>
        {affiliations.filter(a => a.status === 'active').map(a => <View key={a.id} style={ui.row}><View style={ui.pill}><Text style={ui.pillText}>Approved</Text></View><Text style={ui.body}>{a.committeeName}</Text></View>)}
        <ActionButton title="Choose or manage committees" onPress={() => router.push('/committees')} />
      </View>
    </>}
  </Screen>;
}
