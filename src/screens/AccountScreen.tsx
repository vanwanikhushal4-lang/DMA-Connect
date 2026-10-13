import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyRound, Mail, Phone } from 'lucide-react-native';
import { useSession, friendlyFirebaseError } from '../context/SessionContext';
import type { OtpConfirmation } from '../services/phone-auth';
import { api } from '../services/api';
import { emptyPerson } from '../lib/community';
import type { Invitation, Person } from '../lib/community';
import { normalizeMobile } from '../lib/members';
import { Brand } from '../components/Brand';
import { Screen, ui } from '../components/Screen';
import { PersonForm } from '../components/PersonForm';
import { ActionButton } from '../components/ActionButton';
import { MemberField } from '../components/MemberField';
import { colors, fonts } from '../theme';
import { usingEmulators } from '../services/firebase';
import { phoneOtpAvailable, phoneOtpUnavailableMessage } from '../services/otp-config';

export function AccountScreen() {
  const session = useSession();
  const [phone, setPhone] = useState(''), [code, setCode] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState<OtpConfirmation | null>(null), [sentAt, setSentAt] = useState(0), [now, setNow] = useState(() => Date.now());
  const [legacy, setLegacy] = useState(false), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const otpRef = useRef<OtpConfirmation | null>(null);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(t); otpRef.current?.dispose(); }; }, []);
  async function send() {
    setError('');
    if (!/^[6-9]\d{9}$/.test(phone)) { setError('Enter a valid 10-digit Indian mobile number.'); return; }
    setBusy(true);
    try { otpRef.current?.dispose(); const next = await session.startOtp('+91' + phone, e => setError(friendlyFirebaseError(e))); otpRef.current = next; setConfirmation(next); setCode(''); setSentAt(Date.now()); }
    catch (e) { setError(friendlyFirebaseError(e)); } finally { setBusy(false); }
  }
  async function confirm() {
    if (!confirmation || !/^\d{6}$/.test(code)) { setError(usingEmulators ? 'Enter the 6-digit test code shown on this screen.' : 'Enter the 6-digit code sent to your phone.'); return; }
    setBusy(true); setError('');
    try { await confirmation.confirm(code); confirmation.dispose(); otpRef.current = null; setConfirmation(null); }
    catch (e) { setError(friendlyFirebaseError(e)); } finally { setBusy(false); }
  }
  const cooldown = Math.max(0, 60 - Math.floor((now - sentAt) / 1000));
  if (session.loading) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}><View style={{ padding: 22 }}><Brand /></View><View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}><ActivityIndicator color={colors.purple} /><Text style={ui.body}>Loading your account…</Text></View></SafeAreaView>;
  if (session.user?.phoneNumber && !session.error && !session.profile?.photoPaths.length) return <CompleteAccount />;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
    <View style={{ paddingHorizontal: 22, paddingVertical: 15, alignSelf: 'center', width: '100%', maxWidth: 780 }}><Brand /></View>
    {usingEmulators && <View style={{ paddingHorizontal: 22 }}><Text style={ui.body}>Test mode · SMS codes are simulated</Text></View>}
    <Screen title={confirmation ? 'Verify your mobile' : session.user ? 'Verify your phone number' : 'Welcome to DMA Connect'} description={confirmation ? (usingEmulators ? 'Enter the test code for +91 ' : 'Enter the code sent to +91 ') + phone : 'Sign in or create your member account using your own mobile number.'}>
      {!!session.error && <View style={ui.card}><Text style={ui.error}>{session.error}</Text><ActionButton title="Retry loading account" secondary onPress={session.retry} /><ActionButton title="Sign out" secondary onPress={() => void session.signOut()} /></View>}
      <View style={ui.card}>
        {legacy && !session.user ? <>
          <Text style={ui.heading}>Existing email account</Text>
          <MemberField label="Email" icon={Mail} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <MemberField label="Password" icon={KeyRound} value={password} onChangeText={setPassword} secureTextEntry />
          <ActionButton title="Sign in" busy={busy} onPress={() => { setBusy(true); setError(''); void session.signIn(email, password).catch(e => setError(friendlyFirebaseError(e))).finally(() => setBusy(false)); }} />
          <Pressable accessibilityRole="button" onPress={() => { setBusy(true); void session.resetPassword(email).then(() => setError('A password reset email has been sent.')).catch(e => setError(friendlyFirebaseError(e))).finally(() => setBusy(false)); }}><Text style={ui.link}>Reset password</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => { setLegacy(false); setError(''); }}><Text style={ui.link}>Use phone OTP instead</Text></Pressable>
        </> : confirmation ? <>
          {usingEmulators && <View style={{ padding: 16, gap: 6, borderRadius: 11, backgroundColor: colors.lavender }}>
            <Text style={ui.heading}>Test OTP</Text>
            {confirmation.testCode ? <><Text selectable accessibilityLabel={'Test verification code ' + confirmation.testCode} style={{ fontFamily: fonts.bold, fontSize: 28, letterSpacing: 4, color: colors.purple }}>{confirmation.testCode}</Text><Text style={ui.body}>Enter this code below. No SMS was sent.</Text></> : <Text style={ui.body}>The test code couldn’t be loaded. Request a new code or check the local emulator log.</Text>}
          </View>}
          <MemberField label="Verification code" icon={KeyRound} value={code} onChangeText={v => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!busy} onSubmitEditing={() => void confirm()} />
          <ActionButton title="Verify and continue" busy={busy} onPress={() => void confirm()} />
          <ActionButton title={cooldown ? 'Resend code in ' + cooldown + 's' : 'Resend code'} secondary disabled={busy || cooldown > 0} onPress={() => void send()} />
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { confirmation.dispose(); otpRef.current = null; setConfirmation(null); setCode(''); setError(''); }}><Text style={ui.link}>Change mobile number</Text></Pressable>
        </> : <>
          <MemberField label="Mobile number" icon={Phone} value={phone} onChangeText={v => setPhone(normalizeMobile(v))} keyboardType="phone-pad" prefix="+91" maxLength={12} editable={!busy} autoComplete="tel" />
          <Text style={ui.body}>{phoneOtpAvailable ? 'This preview does not send SMS. Tap Send verification code and the test OTP will appear on the next screen.' : phoneOtpUnavailableMessage}</Text>
          <ActionButton title="Send verification code" busy={busy} disabled={!phoneOtpAvailable} onPress={() => void send()} />
          {!session.user && <Pressable accessibilityRole="button" onPress={() => { setLegacy(true); setError(''); }}><Text style={ui.link}>Use an existing email account</Text></Pressable>}
        </>}
        {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      </View>
      <Text style={ui.body}>Presidents use the mobile number assigned in their invitation. All other new accounts start as members.</Text>
      {session.user && <ActionButton title="Sign out" secondary onPress={() => void session.signOut()} />}
    </Screen>
  </SafeAreaView>;
}

function CompleteAccount() {
  const { user, completeProfile, signOut } = useSession();
  const [setup, setSetup] = useState<{ phoneNumber: string; person: Person | null; invitation: Invitation | null } | null>(null), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => { let active = true; void api<typeof setup>('mySetup').then(s => { if (active) { setSetup(s); setError(''); } }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [user?.uid, retry]);
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
    <View style={{ padding: 22, alignSelf: 'center', width: '100%', maxWidth: 780 }}><Brand /></View>
    {usingEmulators && <View style={{ paddingHorizontal: 22 }}><Text style={ui.body}>Test mode · SMS codes are simulated</Text></View>}
    <Screen title="Complete your profile" description="Add your details and photograph, then choose the committees you want to join.">
      {setup?.invitation && <View style={ui.card}><Text style={ui.heading}>Your account invitation</Text><Text style={ui.body}>{setup.invitation.role === 'president' ? setup.invitation.committeeName + ' president' : 'Member account'} · the appointment activates after you complete your profile.</Text></View>}
      {!!error && <View style={ui.card}><Text style={ui.error}>{error}</Text><ActionButton title="Retry" secondary onPress={() => setRetry(k => k + 1)} /></View>}
      {!setup && !error && <ActivityIndicator color={colors.purple} />}
      {setup && <PersonForm initial={setup.person || { ...emptyPerson, name: setup.invitation?.name || user?.displayName || '', email: setup.invitation?.email || user?.email || '', mobile: setup.phoneNumber.slice(3) }} lockMobile onSubmit={completeProfile} submitTitle="Complete account" />}
      <ActionButton title="Sign out" secondary onPress={() => void signOut()} />
    </Screen>
  </SafeAreaView>;
}
