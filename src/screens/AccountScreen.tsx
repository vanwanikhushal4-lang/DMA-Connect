import { useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Check, Eye, EyeOff, LockKeyhole, Mail, MapPin, Phone, ShieldCheck, UserRound, UserRoundPlus } from 'lucide-react-native';
import { Brand } from '../components/Brand';
import { MemberField } from '../components/MemberField';
import { SelectField } from '../components/SelectField';
import { ActionButton } from '../components/ActionButton';
import { CommunityIllustration } from '../components/CommunityIllustration';
import { useEntrance } from '../hooks/useMotion';
import { useSession, friendlyFirebaseError } from '../context/SessionContext';
import { emptyPresident, localityLabel, needsTaluka, presidentRoles, validatePresident } from '../lib/presidents';
import type { PresidentDraft, PresidentRole } from '../lib/presidents';
import { normalizeMobile } from '../lib/members';
import { colors, fonts } from '../theme';

export function AccountScreen() {
  const { width } = useWindowDimensions();
  const wide = width >= 1000;
  const compact = width < 540;
  const { user, loading: sessionLoading, createAccount, signIn, resetPassword, error: sessionError, retry, signOut } = useSession();
  const completing = !!user;
  const [requestedMode, setMode] = useState<'create' | 'signin' | 'reset'>('create');
  const [setupStep, setStep] = useState(1);
  const [draft, setDraft] = useState<PresidentDraft>({ ...emptyPresident, email: user?.email || '' });
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<ReturnType<typeof validatePresident>>({});
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const entrance = useEntrance();
  const mode = completing ? 'create' : requestedMode;
  const step = completing ? 2 : setupStep;

  function change(field: keyof PresidentDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined })); setError('');
  }
  function changeMode(next: typeof mode) { setMode(next); setStep(1); setErrors({}); setError(''); setMessage(''); setPassword(''); setConfirm(''); }
  async function submit() {
    setError(''); setMessage('');
    if (mode === 'create') {
      const validation = validatePresident(draft, password, confirm, completing);
      if (step === 1) {
        const personal = { name: validation.name, email: validation.email, mobile: validation.mobile, password: validation.password, confirm: validation.confirm };
        setErrors(personal);
        if (Object.values(personal).some(Boolean)) return;
        setErrors({}); setStep(2); return;
      }
      setErrors(validation);
      if (Object.values(validation).some(Boolean)) return;
    } else {
      const validation: typeof errors = {};
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) validation.email = 'Enter a valid email address.';
      if (mode === 'signin' && !password) validation.password = 'Enter your password.';
      setErrors(validation); if (Object.values(validation).some(Boolean)) return;
    }
    setBusy(true);
    try {
      if (mode === 'create') await createAccount(draft, password);
      if (mode === 'signin') await signIn(draft.email, password);
      if (mode === 'reset') { await resetPassword(draft.email); setMessage('If an account exists for this email, a reset link is on its way. Check your inbox.'); }
    } catch (cause) {
      if (__DEV__) console.warn('Account action failed:', (cause as { code?: string }).code || 'unknown');
      setError(friendlyFirebaseError(cause));
    }
    finally { setBusy(false); }
  }

  const emailField = <MemberField label="Email address" icon={Mail} value={draft.email} onChangeText={value => change('email', value)} error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} maxLength={254} autoComplete="email" editable={!busy && !completing} />;
  const passwordField = <MemberField label="Password" icon={showPassword ? EyeOff : Eye} value={password} onChangeText={value => { setPassword(value); setErrors(previous => ({ ...previous, password: undefined })); }} error={errors.password} placeholder={mode === 'create' ? 'At least 8 characters' : 'Enter your password'} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} maxLength={128} autoComplete={mode === 'create' ? 'new-password' : 'current-password'} onIconPress={() => setShowPassword(value => !value)} iconLabel={showPassword ? 'Hide password' : 'Show password'} editable={!busy} />;

  if (user && (sessionLoading || busy)) return <SafeAreaView style={[styles.screen, { backgroundColor: colors.white }]}><View style={styles.opening}><Brand large /><ActivityIndicator color={colors.purple} style={{ marginTop: 30 }} /><Text style={styles.openingText}>Opening your workspace…</Text></View></SafeAreaView>;
  return <SafeAreaView style={styles.screen}>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={[styles.topbar, compact && styles.topbarCompact]}><Brand />
          {!compact && <Text style={styles.workspaceLabel}>PRESIDENT’S WORKSPACE</Text>}</View>
        <View style={[styles.content, compact && styles.contentCompact]}>
          {wide && <Animated.View style={[styles.intro, entrance]}>
            <View style={styles.introBadge}><ShieldCheck size={15} color={colors.purple} /><Text style={styles.introBadgeText}>Dr. Mangesh Amale Foundation</Text></View>
            <Text style={styles.introTitle}>Your foundation.{'\n'}Your workspace.</Text>
            <Text style={styles.introDescription}>Register members in your area and keep track of every person you add, all in one place.</Text>
            <View style={styles.illustration}><CommunityIllustration /></View>
            <View style={styles.feature}><View style={styles.featureIcon}><UserRoundPlus size={19} color={colors.purple} /></View><View><Text style={styles.featureTitle}>Add members with ease</Text><Text style={styles.featureDescription}>A simple form, ready for your next registration.</Text></View></View>
            <View style={styles.feature}><View style={styles.featureIcon}><ShieldCheck size={19} color={colors.purple} /></View><View><Text style={styles.featureTitle}>Your records, wherever you are</Text><Text style={styles.featureDescription}>Sign in on another device and pick up where you left off.</Text></View></View>
          </Animated.View>}
          <Animated.View style={[styles.card, compact && styles.cardCompact, entrance]}>
            <View style={styles.cardIcon}><UserRoundPlus size={25} color={colors.purple} strokeWidth={1.6} /></View>
            <Text accessibilityRole="header" style={styles.title}>{mode === 'reset' ? 'Reset your password' : mode === 'signin' ? 'Welcome back' : completing ? 'Finish your account' : 'Create your account'}</Text>
            <Text style={styles.subtitle}>{mode === 'reset' ? 'We’ll send a reset link to your email address.' : mode === 'signin' ? 'Sign in to your president’s workspace.' : 'Set up your president profile to start adding members.'}</Text>
            {mode === 'create' && <View style={styles.steps}>
              <View style={styles.step}><View style={[styles.stepNumber, styles.activeStep]}>{step > 1 ? <Check size={13} color={colors.white} /> : <Text style={styles.activeNumber}>1</Text>}</View><Text style={styles.stepText}>Your details</Text></View>
              <View style={styles.stepLine} />
              <View style={styles.step}><View style={[styles.stepNumber, step === 2 && styles.activeStep]}><Text style={step === 2 ? styles.activeNumber : styles.inactiveNumber}>2</Text></View><Text style={[styles.stepText, step === 1 && { color: colors.placeholder }]}>Your role</Text></View>
            </View>}
            {!!sessionError && <View style={styles.errorBox}><Text style={styles.errorText}>{sessionError}</Text><Pressable onPress={retry} accessibilityRole="button"><Text style={styles.link}>Retry loading account</Text></Pressable></View>}
            <AccountFields key={`${mode}-${step}`}>
              {mode === 'create' && (step === 1 || completing) && <MemberField label="Full name" icon={UserRound} placeholder="Enter your full name" value={draft.name} onChangeText={value => change('name', value)} error={errors.name} autoCapitalize="words" autoComplete="name" maxLength={120} editable={!busy} />}
              {(step === 1 || mode !== 'create' || completing) && emailField}
              {mode === 'create' && (step === 1 || completing) && <MemberField label="Mobile number" icon={Phone} prefix="+91" placeholder="10-digit number" value={draft.mobile} onChangeText={value => change('mobile', normalizeMobile(value))} error={errors.mobile} keyboardType="phone-pad" maxLength={16} editable={!busy} />}
              {(mode === 'signin' || (mode === 'create' && step === 1 && !completing)) && passwordField}
              {mode === 'create' && step === 1 && !completing && <MemberField label="Confirm password" icon={LockKeyhole} value={confirm} onChangeText={value => { setConfirm(value); setErrors(previous => ({ ...previous, confirm: undefined })); }} error={errors.confirm} placeholder="Re-enter your password" secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} maxLength={128} autoComplete="new-password" editable={!busy} />}
              {mode === 'create' && step === 2 && <>
                <SelectField label="President role" value={draft.role} options={presidentRoles} placeholder="Choose your role" error={errors.role} disabled={busy} onChange={value => { change('role', value as PresidentRole); change('taluka', ''); change('locality', ''); change('cell', ''); }} />
                <MemberField label="District" icon={MapPin} placeholder="Enter your district" value={draft.district} onChangeText={value => change('district', value)} error={errors.district} maxLength={100} autoCapitalize="words" editable={!busy} />
                {needsTaluka(draft.role) && <MemberField label="Taluka" icon={MapPin} placeholder="Enter your taluka" value={draft.taluka} onChangeText={value => change('taluka', value)} error={errors.taluka} maxLength={100} autoCapitalize="words" editable={!busy} />}
                {['city', 'ward', 'village'].includes(draft.role) && <MemberField label={localityLabel(draft.role)} icon={MapPin} placeholder={`Enter your ${localityLabel(draft.role).toLowerCase()}`} value={draft.locality} onChangeText={value => change('locality', value)} error={errors.locality} maxLength={100} autoCapitalize="words" editable={!busy} />}
                {draft.role === 'cell' && <MemberField label="Cell name" icon={UserRound} placeholder="e.g. OBC cell" value={draft.cell} onChangeText={value => change('cell', value)} error={errors.cell} maxLength={100} autoCapitalize="words" editable={!busy} />}
                <View style={styles.areaNote}><MapPin size={15} color={colors.purple} /><Text style={styles.areaNoteText}>Your role and area will appear on your president profile.</Text></View>
              </>}
            </AccountFields>
            {mode === 'signin' && <Pressable onPress={() => changeMode('reset')} disabled={busy} accessibilityRole="button" style={styles.forgot}><Text style={styles.link}>Forgot password?</Text></Pressable>}
            {!!error && <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>}
            {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}
            <View style={{ marginTop: 24 }}><ActionButton title={mode === 'reset' ? 'Send reset link' : mode === 'signin' ? 'Sign in' : step === 1 ? 'Continue' : completing ? 'Finish setup' : 'Create account'} onPress={() => void submit()} busy={busy} /></View>
            {mode === 'create' && step === 2 && !completing && <Pressable disabled={busy} onPress={() => { setStep(1); setError(''); }} accessibilityRole="button" style={styles.back}><ArrowLeft size={15} color={colors.muted} /><Text style={styles.backText}>Back to your details</Text></Pressable>}
            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>{completing ? 'Signed in as ' + user.email : mode === 'create' ? 'Already have an account?' : mode === 'signin' ? 'New to DMA Connect?' : 'Remember your password?'}</Text>
              <Pressable disabled={busy} accessibilityRole="button" onPress={() => completing ? void signOut() : changeMode(mode === 'create' || mode === 'reset' ? 'signin' : 'create')}><Text style={styles.link}>{completing ? 'Sign out' : mode === 'create' || mode === 'reset' ? 'Sign in' : 'Create account'}</Text></Pressable>
            </View>
          </Animated.View>
        </View>
        <Text style={styles.footer}>Dr. Mangesh Amale Foundation</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
function AccountFields({ children }: { children: React.ReactNode }) { const entrance = useEntrance(); return <Animated.View style={[styles.fields, entrance]}>{children}</Animated.View>; }
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, scroll: { flexGrow: 1 },
  opening: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }, openingText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 16 },
  topbar: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border, paddingHorizontal: 48, minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topbarCompact: { paddingHorizontal: 24, minHeight: 78 },
  workspaceLabel: { color: '#94889E', fontSize: 9, letterSpacing: 1.8, fontFamily: fonts.medium },
  content: { width: '100%', maxWidth: 1100, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 70, paddingHorizontal: 32, paddingTop: 48, paddingBottom: 32, flexGrow: 1 }, contentCompact: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  intro: { flex: 1, maxWidth: 440 }, introBadge: { flexDirection: 'row', gap: 8, alignItems: 'center' }, introBadgeText: { fontFamily: fonts.medium, fontSize: 11, color: '#79648E' },
  introTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 43, lineHeight: 53, letterSpacing: -1.8, marginTop: 22 }, introDescription: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, lineHeight: 24, marginTop: 18, maxWidth: 350 },
  illustration: { backgroundColor: colors.lavender, borderRadius: 24, marginTop: 26, marginBottom: 24, maxWidth: 350, paddingVertical: 16 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 }, featureIcon: { width: 39, height: 39, borderRadius: 11, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  featureTitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink }, featureDescription: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 5, maxWidth: 320, lineHeight: 17 },
  card: { width: '100%', maxWidth: 440, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 32, boxShadow: '0 10px 40px rgba(44, 24, 75, 0.035)' }, cardCompact: { padding: 24, borderRadius: 18 },
  cardIcon: { width: 49, height: 49, borderRadius: 13, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.9, color: colors.ink }, subtitle: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted, lineHeight: 21, marginTop: 9 },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 23, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 24 }, step: { flexDirection: 'row', alignItems: 'center', gap: 8 }, stepNumber: { width: 23, height: 23, borderRadius: 12, backgroundColor: '#F2F0F5', alignItems: 'center', justifyContent: 'center' },
  activeStep: { backgroundColor: colors.purple }, activeNumber: { fontFamily: fonts.medium, fontSize: 10, color: colors.white }, inactiveNumber: { fontFamily: fonts.medium, fontSize: 10, color: colors.muted },
  stepText: { fontFamily: fonts.medium, fontSize: 11, color: colors.purple }, stepLine: { height: 1, backgroundColor: colors.border, flex: 1 }, fields: { gap: 19, marginTop: 23 },
  areaNote: { backgroundColor: colors.lavender, borderRadius: 9, padding: 13, flexDirection: 'row', gap: 9, alignItems: 'center' }, areaNoteText: { flex: 1, fontFamily: fonts.regular, fontSize: 11, lineHeight: 17, color: '#79658E' },
  link: { fontFamily: fonts.semibold, fontSize: 12, color: colors.purple }, forgot: { alignSelf: 'flex-end', paddingVertical: 14 },
  back: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, marginTop: 10 }, backText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  bottomRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 5, borderTopWidth: 1, borderColor: colors.border, paddingTop: 23, marginTop: 25 }, bottomText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  footer: { textAlign: 'center', fontFamily: fonts.regular, color: '#9D93A7', fontSize: 10, paddingBottom: 24 }, errorBox: { backgroundColor: '#FFF4F5', padding: 12, borderRadius: 9, gap: 10, marginTop: 18 }, errorText: { fontFamily: fonts.regular, color: colors.error, fontSize: 12, lineHeight: 19, marginTop: 12 }, message: { fontFamily: fonts.regular, fontSize: 12, color: colors.success, lineHeight: 19, marginTop: 15 },
});
