import { useState } from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { useCommunity } from '../context/CommunityContext';
import { accountRole, isStaff } from '../lib/community';
import { Screen, ui } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';

export function SettingsScreen() {
  const { profile, account, emailVerified, verifyEmail, refreshVerification, signOut } = useSession(), { committees } = useCommunity();
  const [busy, setBusy] = useState(''), [message, setMessage] = useState(''), [error, setError] = useState('');
  async function act(key: string, fn: () => Promise<void>, result: string) { setBusy(key); setError(''); setMessage(''); try { await fn(); setMessage(result); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(''); } }
  return <Screen title="Account" description="Your sign-in details, appointment and email preferences.">
    {!!message && <Text style={ui.success}>{message}</Text>}{!!error && <Text style={ui.error}>{error}</Text>}
    <View style={ui.card}><Text style={ui.heading}>{profile?.name}</Text><Text style={ui.body}>{accountRole(account)}{account?.committeeId ? ' · ' + committees.find(c => c.id === account.committeeId)?.name : ''}</Text><Text style={ui.body}>Mobile: {account?.phoneNumber}</Text><ActionButton title="View or edit my profile" secondary onPress={() => router.push('/profile')} />{isStaff(account) && <ActionButton title="Manage committees and accounts" secondary onPress={() => router.push('/manage')} />}</View>
    <View style={ui.card}><Text style={ui.heading}>Email verification</Text><Text style={ui.body}>{profile?.email}</Text><View style={ui.pill}><Text style={ui.pillText}>{emailVerified ? 'Verified' : 'Verification needed'}</Text></View><Text style={ui.body}>Birthday greetings are sent to a verified email after you become a committee member.</Text>
      {!emailVerified && <><ActionButton title="Send verification email" busy={busy === 'send'} disabled={!!busy} onPress={() => void act('send', verifyEmail, 'Check your inbox and open the verification link.')} /><ActionButton title="I have verified my email" secondary busy={busy === 'check'} disabled={!!busy} onPress={() => void act('check', refreshVerification, 'Your email verification status has been refreshed.')} /></>}
    </View>
    <View style={ui.card}><Text style={ui.heading}>Birthday greetings</Text><Text style={ui.body}>{profile?.birthdayEmailsEnabled ? 'Enabled. A greeting with your profile photograph will be sent on your birthday.' : 'Turned off.'}</Text><ActionButton title="Change birthday preference" secondary onPress={() => router.push('/profile')} /></View>
    <ActionButton title="Sign out" secondary busy={busy === 'logout'} disabled={!!busy} onPress={() => void act('logout', signOut, '')} />
  </Screen>;
}
