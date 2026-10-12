import { useRef, useState } from 'react';
import {
  Animated, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSession } from '../context/SessionContext';
import { needsTaluka, presidentArea, roleLabel } from '../lib/presidents';
import { useEntrance } from '../hooks/useMotion';
import { ActionButton } from '../components/ActionButton';
import {
  ArrowRight, CalendarDays, Check, CircleCheck, Heart, Mail,
  MapPin, Phone, RotateCcw, UserRound, UserRoundPlus, UsersRound, X,
} from 'lucide-react-native';
import { MemberField } from '../components/MemberField';
import { BirthDatePicker } from '../components/BirthDatePicker';
import { CommunityIllustration } from '../components/CommunityIllustration';
import { useMembers } from '../hooks/useMembers';
import { emptyDraft, formatDobInput, normalizeMobile, validateMember } from '../lib/members';
import type { FieldErrors, MemberDraft } from '../lib/members';
import { colors, fonts } from '../theme';

const fieldOrder: (keyof MemberDraft)[] = ['name', 'email', 'mobile', 'residence', 'dob', 'taluka'];

export function MemberRegistration() {
  const { width } = useWindowDimensions();
  const wide = width >= 940;
  const compact = width < 540;
  const { members, loading, saving, storageError, loadMembers, addMember } = useMembers();
  const { profile } = useSession();
  const assignedTaluka = profile && needsTaluka(profile.role) ? profile.taluka : (profile?.taluka || '');
  const isTalukaLocked = !!(profile && needsTaluka(profile.role) && profile.taluka);
  const entrance = useEntrance();
  const [draft, setDraft] = useState<MemberDraft>({ ...emptyDraft, taluka: assignedTaluka });
  const currentTaluka = isTalukaLocked ? assignedTaluka : (draft.taluka || assignedTaluka);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState('');
  const [successName, setSuccessName] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const mobileRef = useRef<TextInput>(null);
  const residenceRef = useRef<TextInput>(null);
  const dobRef = useRef<TextInput>(null);
  const talukaRef = useRef<TextInput>(null);

  function focusField(field: keyof MemberDraft) {
    const refs = { name: nameRef, email: emailRef, mobile: mobileRef, residence: residenceRef, dob: dobRef, taluka: talukaRef };
    refs[field].current?.focus();
  }
  const scroll = useRef<ScrollView>(null);
  const disabled = loading || saving || !!storageError;

  const today = new Date();
  const addedToday = members.filter(member => {
    const created = new Date(member.createdAt);
    return created.getFullYear() === today.getFullYear()
      && created.getMonth() === today.getMonth() && created.getDate() === today.getDate();
  }).length;

  function update(field: keyof MemberDraft, value: string) {
    setDraft(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: undefined }));
    setSaveError('');
    setSuccessName('');
  }

  function clearForm() {
    setDraft({ ...emptyDraft, taluka: isTalukaLocked ? assignedTaluka : '' });
    setErrors({});
    setSaveError('');
    setSuccessName('');
    nameRef.current?.focus();
  }

  async function saveMember() {
    if (disabled) return;
    setSaveError('');
    setSuccessName('');
    const finalTaluka = isTalukaLocked ? assignedTaluka : (draft.taluka || assignedTaluka).trim();
    const candidateDraft = { ...draft, taluka: finalTaluka };
    const nextErrors = validateMember(candidateDraft, members);
    setErrors(nextErrors);
    const firstError = fieldOrder.find(field => nextErrors[field]);
    if (firstError) {
      focusField(firstError);
      return;
    }
    try {
      const member = await addMember(candidateDraft);
      setDraft({ ...emptyDraft, taluka: isTalukaLocked ? assignedTaluka : '' });
      setErrors({});
      setSuccessName(member.name);
      scroll.current?.scrollTo({ y: 0, animated: true });
      nameRef.current?.focus();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Please try saving the member again.');
    }
  }

  const common = (field: keyof MemberDraft) => ({
    value: field === 'taluka' ? currentTaluka : draft[field], error: errors[field], editable: !saving,
    onChangeText: (value: string) => update(field, value),
    returnKeyType: 'next' as const, submitBehavior: 'submit' as const,
  });

  return (
    <SafeAreaView collapsable={Platform.OS !== 'ios'} edges={['left', 'right']} style={styles.screen}>
      <KeyboardAvoidingView collapsable={Platform.OS !== 'ios'} style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}>
        <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scrollContent}>


          <Animated.View style={[styles.main, compact && styles.mainCompact, entrance]}>
            <View style={[styles.pageHeading, compact && styles.pageHeadingCompact]}>
              <View style={styles.headingCopy}>
                <Text accessibilityRole="header" style={[styles.pageTitle, compact && styles.pageTitleCompact]}>Add a member<Text style={styles.titleDot}>.</Text></Text>
                <Text style={[styles.pageDescription, compact && styles.pageDescriptionCompact]}>Enter their details to register them with the foundation.</Text>
              </View>
              <View style={[styles.countBadge, compact && styles.countBadgeCompact]}>
                <UsersRound size={17} color={colors.purple} strokeWidth={1.7} />
                <Text style={styles.countBadgeText}>{loading ? '…' : members.length} <Text style={styles.countBadgeLabel}>{members.length === 1 ? 'member added' : 'members added'}</Text></Text>
              </View>
            </View>

            <View style={styles.contentRow}>
              <View style={[styles.formCard, compact && styles.formCardCompact]}>
                <View style={[styles.formHeader, compact && styles.formHeaderCompact]}>
                  <View style={styles.formIcon}><UserRoundPlus size={23} color={colors.purple} strokeWidth={1.65} /></View>
                  <View style={styles.formHeaderCopy}>
                    <Text accessibilityRole="header" style={styles.formTitle}>Member details</Text>
                    <Text style={styles.formSubtitle}>Let’s get to know our newest member.</Text>
                  </View>
                </View>
                <View style={styles.formDivider} />
                <View style={[styles.formBody, compact && styles.formBodyCompact]}>
                  {!!successName && <View style={styles.successBanner} accessibilityRole="alert" accessibilityLiveRegion="polite">
                    <CircleCheck size={20} color={colors.success} />
                    <View style={styles.bannerCopy}>
                      <Text style={styles.successTitle}>{successName} has been added!</Text>
                      <Text style={styles.successDescription}>You’re ready to add the next member.</Text>
                    </View>
                    <Pressable onPress={() => setSuccessName('')} accessibilityRole="button" accessibilityLabel="Dismiss success message" hitSlop={8}><X size={17} color={colors.success} /></Pressable>
                  </View>}

                  {!!storageError && <View style={styles.errorBanner} accessibilityRole="alert">
                    <Text style={styles.bannerErrorText}>{storageError}</Text>
                    <Pressable accessibilityRole="button" onPress={() => void loadMembers()} style={styles.retryButton}><RotateCcw size={14} color={colors.purple} /><Text style={styles.retryText}>Retry</Text></Pressable>
                  </View>}

                  {profile && <View style={styles.areaPill}><MapPin size={14} color={colors.purple} /><Text style={styles.areaPillText}>{roleLabel(profile.role)} · {presidentArea(profile)}</Text></View>}
                  <MemberField ref={nameRef} {...common('name')} onSubmitEditing={() => emailRef.current?.focus()} label="Name" icon={UserRound} placeholder="Enter full name" autoCapitalize="words" autoComplete="off" maxLength={120} />
                  <View style={[styles.fieldRow, compact && styles.fieldRowCompact]}>
                    <MemberField ref={emailRef} {...common('email')} onSubmitEditing={() => mobileRef.current?.focus()} label="Email" icon={Mail} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="off" optional maxLength={254} />
                    <MemberField ref={mobileRef} {...common('mobile')} onSubmitEditing={() => residenceRef.current?.focus()} label="Mobile" icon={Phone} placeholder="10-digit number" prefix="+91" keyboardType="phone-pad" autoComplete="off" maxLength={16} onChangeText={value => update('mobile', normalizeMobile(value))} />
                  </View>
                  <MemberField ref={residenceRef} {...common('residence')} label="Residence" icon={MapPin} placeholder="House / street, village or city" multiline autoCapitalize="sentences" autoComplete="off" maxLength={500} submitBehavior="newline" />
                  <View style={[styles.fieldRow, compact && styles.fieldRowCompact]}>
                    <MemberField ref={dobRef} {...common('dob')} onSubmitEditing={() => talukaRef.current?.focus()} label="Date of birth" icon={CalendarDays} placeholder="DD / MM / YYYY" keyboardType="number-pad" maxLength={10} onChangeText={value => update('dob', formatDobInput(value))} onIconPress={() => setDatePickerOpen(true)} iconLabel="Choose date of birth" accessibilityHint="Enter day, month and year, or use the date picker." />
                    <MemberField ref={talukaRef} {...common('taluka')} editable={!saving && !isTalukaLocked} accessibilityHint={isTalukaLocked ? 'Your assigned taluka' : undefined} label="Taluka" icon={MapPin} placeholder="Enter taluka" autoCapitalize="words" maxLength={100} returnKeyType="done" onSubmitEditing={() => void saveMember()} />
                  </View>
                  <Text style={styles.requiredNote}><Text style={styles.requiredStar}>*</Text> Required fields. Email is optional.</Text>
                  {!!saveError && <View style={styles.errorBanner} accessibilityRole="alert"><Text style={styles.bannerErrorText}>{saveError}</Text></View>}
                </View>
                <View style={[styles.formFooter, compact && styles.formFooterCompact]}>
                  <Pressable onPress={clearForm} disabled={saving} accessibilityRole="button" accessibilityLabel="Clear form"
                    style={({ pressed }) => [styles.clearButton, pressed && { backgroundColor: colors.lavender }]}>
                    <RotateCcw size={15} color={colors.muted} strokeWidth={1.7} /><Text style={styles.clearText}>Clear form</Text>
                  </Pressable>
                  <View style={compact ? { width: '100%' } : { minWidth: 203 }}>
                    <ActionButton title={saving ? 'Saving member…' : loading ? 'Loading members…' : 'Save member'} icon={UserRoundPlus} onPress={() => void saveMember()} busy={saving || loading} disabled={!!storageError} />
                  </View>
                </View>
              </View>

              {wide && <View style={styles.sideColumn}>
                <View style={styles.communityCard}>
                  <View style={styles.foundationTag}><Heart size={13} color="#8D70AA" strokeWidth={1.8} /><Text style={styles.foundationTagText}>THE POWER OF CONNECTION</Text></View>
                  <CommunityIllustration />
                  <Text style={styles.communityTitle}>Small steps.{'\n'}Stronger communities.</Text>
                  <Text style={styles.communityDescription}>Every person you add brings us closer to a more connected, caring community.</Text>
                  <View style={styles.communityRule} />
                  <Text style={styles.communitySignature}>Together, we make a difference.</Text>
                </View>
                <View style={styles.impactCard}>
                  <View style={styles.impactTitleRow}><Text style={styles.impactTitle}>Your contribution</Text><UsersRound size={18} color="#8B7C9D" strokeWidth={1.6} /></View>
                  <Text style={styles.impactNumber}>{loading ? '—' : members.length.toLocaleString('en-IN')}</Text>
                  <Text style={styles.impactDescription}>{members.length === 1 ? 'member added by you' : 'members added by you'}</Text>
                  <Pressable onPress={() => router.push('/(tabs)/statistics')} accessibilityRole="button" accessibilityLabel="View statistics" style={styles.statsLink}><Text style={styles.statsLinkText}>View statistics</Text><ArrowRight size={14} color={colors.purple} /></Pressable>
                  <View style={styles.todayRow}><View style={styles.todayDot} /><Text style={styles.todayText}>{addedToday} added today</Text></View>
                </View>
              </View>}
            </View>

            <View style={styles.readyNote}><Check size={14} color="#8D8498" strokeWidth={1.7} /><Text style={styles.readyNoteText}>Save a member. Make a connection. Keep going.</Text></View>
            <View style={[styles.pageFooter, compact && styles.pageFooterCompact]}>
              <Text style={styles.footerFoundation}>Dr. Mangesh Amale Foundation</Text>
              <View style={styles.footerMotto}><Heart size={12} color="#9A8DAA" strokeWidth={1.6} /><Text style={styles.footerMottoText}>Connecting people. Building community.</Text></View>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
      {datePickerOpen && <BirthDatePicker value={draft.dob} onSelect={value => update('dob', value)} onClose={() => setDatePickerOpen(false)} />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  areaPill: { flexDirection: 'row', gap: 7, alignItems: 'center', paddingHorizontal: 11, paddingVertical: 9, backgroundColor: colors.lavender, borderRadius: 8 },
  areaPillText: { flex: 1, fontFamily: fonts.medium, color: '#7E659A', fontSize: 10, lineHeight: 16 },
  statsLink: { flexDirection: 'row', gap: 6, alignItems: 'center', minHeight: 34, marginTop: 10 },
  statsLinkText: { fontFamily: fonts.semibold, fontSize: 11, color: colors.purple },
  screen: { flex: 1, backgroundColor: colors.background },
  scrollContent: { flexGrow: 1 },
  header: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: '#EEECF1' },
  headerInner: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 32, minHeight: 84, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerInnerCompact: { minHeight: 82, paddingHorizontal: 20 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  logo: { width: 54, height: 52 },
  logoCompact: { width: 44, height: 44 },
  brandName: { fontFamily: fonts.bold, fontSize: 27, color: colors.purple, letterSpacing: -1 },
  brandNameCompact: { fontSize: 24 },
  connect: { fontFamily: fonts.medium },
  brandCaption: { fontFamily: fonts.medium, color: '#82798E', fontSize: 8.5, letterSpacing: 1.25, marginTop: 4 },
  brandCaptionCompact: { fontSize: 7.5, letterSpacing: 0.8 },
  headerBadge: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  smallDot: { height: 6, width: 6, backgroundColor: '#8864A6', borderRadius: 3 },
  headerBadgeText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  main: { width: '100%', maxWidth: 1088, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 32, paddingBottom: 25 },
  mainCompact: { paddingHorizontal: 20, paddingTop: 28, paddingBottom: 22 },
  pageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26, gap: 18 },
  pageHeadingCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 17, marginBottom: 22 },
  headingCopy: { flexShrink: 1 },
  pageTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 38, letterSpacing: -1.5, lineHeight: 47 },
  pageTitleCompact: { fontSize: 32, lineHeight: 40, letterSpacing: -1.2 },
  titleDot: { color: '#89609F' },
  pageDescription: { fontFamily: fonts.regular, color: colors.muted, fontSize: 14, marginTop: 8, lineHeight: 22 },
  pageDescriptionCompact: { fontSize: 13 },
  countBadge: { flexDirection: 'row', alignItems: 'center', gap: 9, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 11, marginTop: 18 },
  countBadgeCompact: { marginTop: 0, paddingVertical: 8, paddingHorizontal: 12 },
  countBadgeText: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 12 },
  countBadgeLabel: { fontFamily: fonts.regular, color: colors.muted },
  contentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 24 },
  formCard: { flex: 1, minWidth: 0, borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.white, boxShadow: '0 4px 20px rgba(40, 25, 64, 0.025)', overflow: 'hidden' },
  formCardCompact: { borderRadius: 14 },
  formHeader: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingHorizontal: 28, paddingTop: 22, paddingBottom: 20 },
  formHeaderCompact: { paddingHorizontal: 20, paddingTop: 21, paddingBottom: 20 },
  formIcon: { width: 43, height: 43, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.lavender, borderRadius: 11 },
  formHeaderCopy: { flex: 1 },
  formTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink },
  formSubtitle: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 5, lineHeight: 18 },
  formDivider: { height: 1, backgroundColor: '#F0EDF3', marginHorizontal: 28 },
  formBody: { gap: 18, paddingHorizontal: 28, paddingTop: 23, paddingBottom: 19 },
  formBodyCompact: { paddingHorizontal: 20, paddingTop: 21 },
  fieldRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 18 },
  fieldRowCompact: { flexDirection: 'column', alignItems: 'stretch', gap: 21 },
  requiredNote: { fontFamily: fonts.regular, fontSize: 11, color: '#8E8797', marginTop: -3, lineHeight: 17 },
  requiredStar: { color: '#897398' },
  formFooter: { padding: 18, paddingHorizontal: 28, borderTopWidth: 1, borderColor: '#F0EDF3', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16, backgroundColor: '#FDFCFD' },
  formFooterCompact: { flexDirection: 'column-reverse', alignItems: 'stretch', gap: 10, paddingHorizontal: 22, paddingVertical: 19 },
  clearButton: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 8 },
  clearText: { fontFamily: fonts.medium, fontSize: 12, color: colors.muted },
  saveButton: { minHeight: 48, minWidth: 193, paddingHorizontal: 19, backgroundColor: colors.purple, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11, boxShadow: '0 3px 7px rgba(56, 32, 108, 0.12)' },
  saveButtonCompact: { width: '100%' },
  saveText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.white },
  disabledButton: { opacity: 0.55 },
  pressedButton: { backgroundColor: colors.purpleHover },
  sideColumn: { width: 282, gap: 20 },
  communityCard: { backgroundColor: '#F3EFF9', borderRadius: 16, paddingHorizontal: 24, paddingTop: 23, paddingBottom: 25, borderWidth: 1, borderColor: '#EBE4F3' },
  foundationTag: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  foundationTagText: { fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1.05, color: '#8A71A3' },
  communityTitle: { fontFamily: fonts.semibold, color: '#4C356A', fontSize: 20, lineHeight: 28, letterSpacing: -0.6, marginTop: 5 },
  communityDescription: { fontFamily: fonts.regular, color: '#8C7D9E', fontSize: 12, lineHeight: 21, marginTop: 13 },
  communityRule: { height: 1, backgroundColor: '#E2D8EE', marginTop: 24, marginBottom: 17 },
  communitySignature: { fontFamily: fonts.medium, fontSize: 10, color: '#8B73A3' },
  impactCard: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, backgroundColor: colors.white, padding: 22 },
  impactTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  impactTitle: { fontFamily: fonts.medium, fontSize: 12, color: '#6E647C' },
  impactNumber: { fontFamily: fonts.semibold, fontSize: 40, lineHeight: 48, letterSpacing: -1.5, color: colors.purple, marginTop: 17 },
  impactDescription: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted, marginTop: 2 },
  todayRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 18 },
  todayDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#61977B' },
  todayText: { fontFamily: fonts.medium, fontSize: 10, color: '#619077' },
  readyNote: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7, marginTop: 23 },
  readyNoteText: { fontFamily: fonts.regular, color: '#8F8799', fontSize: 11, lineHeight: 17 },
  pageFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 43, borderTopWidth: 1, borderColor: '#EDEAF1', paddingTop: 20 },
  pageFooterCompact: { flexDirection: 'column', alignItems: 'center', marginTop: 31, gap: 10 },
  footerFoundation: { fontFamily: fonts.medium, color: '#8E839A', fontSize: 10 },
  footerMotto: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  footerMottoText: { fontFamily: fonts.regular, color: '#9A91A3', fontSize: 10 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13, backgroundColor: '#F1F8F4', borderWidth: 1, borderColor: '#DBEBDD', borderRadius: 9 },
  bannerCopy: { flex: 1 },
  successTitle: { fontFamily: fonts.medium, color: colors.success, fontSize: 12, lineHeight: 18 },
  successDescription: { fontFamily: fonts.regular, color: '#668071', fontSize: 11, lineHeight: 16, marginTop: 2 },
  errorBanner: { padding: 13, borderRadius: 9, backgroundColor: '#FCF2F3', gap: 10 },
  bannerErrorText: { fontFamily: fonts.regular, color: colors.error, fontSize: 12, lineHeight: 19 },
  retryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
  retryText: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 12 },
});
