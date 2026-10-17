import { useState } from 'react';
import { Image, Pressable, Switch, Text, View } from 'react-native';
import { CalendarDays, Camera, KeyRound, Link2, Mail, MapPin, Phone, UserRound, X } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useCommunity } from '../context/CommunityContext';
import type { PersonDraft } from '../lib/community';
import { displayDob, validatePerson, committeePath } from '../lib/community';
import { formatDobInput, normalizeMobile } from '../lib/members';
import { api } from '../services/api';
import { MemberField } from './MemberField';
import { SelectField } from './SelectField';
import { BirthDatePicker } from './BirthDatePicker';
import { ActionButton } from './ActionButton';
import { ui } from './Screen';
import { colors } from '../theme';
import { PersonPhoto } from './PersonPhoto';

type AreaOption = { value: string; label: string; description?: string };
type FormErrors = Partial<Record<keyof PersonDraft | 'password' | 'confirmPassword', string>>;
export function PersonForm({ initial, onSubmit, submitTitle = 'Save profile', lockMobile = false, areaOptions, areasLoading = false, areasError = '', onRetryAreas, requirePassword = false, photosEnabled = true }: {
  initial: PersonDraft; onSubmit: (draft: PersonDraft, password?: string) => Promise<void>; submitTitle?: string; lockMobile?: boolean;
  areaOptions?: AreaOption[]; areasLoading?: boolean; areasError?: string; onRetryAreas?: () => void; requirePassword?: boolean; photosEnabled?: boolean;
}) {
  const { committees, catalogueError } = useCommunity();
  const [draft, setDraft] = useState<PersonDraft>({ ...initial, dob: displayDob(initial.dob), socials: { ...initial.socials }, photoPaths: [...initial.photoPaths] });
  const [errors, setErrors] = useState<FormErrors>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false), [uploading, setUploading] = useState(false), [calendar, setCalendar] = useState(false);
  const [password, setPassword] = useState(''), [confirmPassword, setConfirmPassword] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});
  function change<K extends keyof PersonDraft>(key: K, value: PersonDraft[K]) { setDraft(d => ({ ...d, [key]: value })); setErrors(e => ({ ...e, [key]: undefined })); setError(''); }
  async function pickPhoto(camera = false) {
    setError('');
    try {
      if (camera && !(await ImagePicker.requestCameraPermissionsAsync()).granted) throw new Error('Allow camera access to take a photograph.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: .8 };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      setUploading(true);
      const image = ImageManipulator.manipulate(result.assets[0].uri);
      image.resize({ width: 1024 });
      const rendered = await image.renderAsync();
      const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: .82, base64: true });
      if (!saved.base64) throw new Error('This photograph could not be prepared. Choose another image.');
      const { path } = await api<{ path: string }>('uploadPhoto', { base64: saved.base64 });
      setPreviews(p => ({ ...p, [path]: saved.uri }));
      setDraft(d => ({ ...d, photoPaths: [...d.photoPaths, path].slice(0, 3) })); setErrors(e => ({ ...e, photoPaths: undefined }));
    } catch (e) { setError(e instanceof Error ? e.message : 'The photograph could not be uploaded.'); }
    finally { setUploading(false); }
  }
  async function submit() {
    const result: FormErrors = validatePerson(draft, { requirePhoto: photosEnabled });
    if (areaOptions && !areaOptions.some(option => option.value === draft.areaId)) result.areaId = 'Choose an active home area from the list.';
    if (requirePassword && password.length < 8) result.password = 'Choose a password with at least 8 characters.';
    if (requirePassword && password !== confirmPassword) result.confirmPassword = 'The passwords do not match.';
    setErrors(result);
    if (Object.keys(result).length) { setError('Please check the highlighted fields.'); return; }
    setBusy(true); setError('');
    try { await onSubmit(draft, requirePassword ? password : undefined); setPassword(''); setConfirmPassword(''); } catch (e) { setError(e instanceof Error ? e.message : 'Your details could not be saved.'); } finally { setBusy(false); }
  }
  return <View style={ui.card}>
    <Text style={ui.heading}>Personal details</Text>
    <MemberField label="Full name" icon={UserRound} value={draft.name} onChangeText={v => change('name', v)} error={errors.name} editable={!busy} autoCapitalize="words" maxLength={120} />
    <MemberField label="Email" icon={Mail} value={draft.email} onChangeText={v => change('email', v)} error={errors.email} editable={!busy} keyboardType="email-address" autoCapitalize="none" autoComplete="email" maxLength={254} />
    {requirePassword && <>
      <MemberField label="Password" icon={KeyRound} value={password} onChangeText={value => { setPassword(value); setErrors(e => ({ ...e, password: undefined })); }} error={errors.password} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
      <MemberField label="Confirm password" icon={KeyRound} value={confirmPassword} onChangeText={value => { setConfirmPassword(value); setErrors(e => ({ ...e, confirmPassword: undefined })); }} error={errors.confirmPassword} editable={!busy} secureTextEntry autoCapitalize="none" autoComplete="new-password" textContentType="newPassword" />
    </>}
    <MemberField label="Mobile" icon={Phone} value={draft.mobile} onChangeText={v => change('mobile', normalizeMobile(v))} error={errors.mobile} editable={!busy && !lockMobile} keyboardType="phone-pad" prefix="+91" maxLength={12} />
    {lockMobile && <Text style={ui.body}>Your verified mobile number is linked to your account.</Text>}
    <MemberField label="Residence" icon={MapPin} value={draft.residence} onChangeText={v => change('residence', v)} error={errors.residence} editable={!busy} multiline maxLength={500} />
    <MemberField label="Date of birth" icon={CalendarDays} value={draft.dob} onChangeText={v => change('dob', formatDobInput(v))} error={errors.dob} placeholder="DD / MM / YYYY" keyboardType="number-pad" maxLength={10} editable={!busy} onIconPress={() => setCalendar(true)} iconLabel="Choose date of birth" />
    <SelectField label="Home area" value={draft.areaId} options={areaOptions ?? committees.filter(c => c.level === 'taluka').map(c => ({ value: c.id, label: c.name, description: committeePath(c, committees) }))} onChange={v => change('areaId', v)} error={errors.areaId} disabled={busy || areasLoading || !!areasError || (areaOptions !== undefined && !areaOptions.length)} placeholder={areasLoading ? 'Loading home areas…' : 'Choose your home area'} />
    {!!(areaOptions === undefined ? catalogueError : areasError) && <Text accessibilityRole="alert" style={ui.error}>{areaOptions === undefined ? catalogueError : areasError}</Text>}
    {!!areasError && onRetryAreas && <ActionButton title="Retry loading home areas" secondary disabled={busy || uploading || areasLoading} onPress={onRetryAreas} />}
    {photosEnabled && <><View style={ui.divider} /><Text style={ui.heading}>Photographs</Text><Text style={ui.body}>Add one profile photo and up to two extra photographs.</Text>
    <View style={{ flexDirection: 'row', gap: 12, flexWrap: 'wrap' }}>{draft.photoPaths.map((path, i) => <View key={path} style={{ width: 94, gap: 7 }}>
      {previews[path] ? <Image source={{ uri: previews[path] }} style={{ width: 94, height: 94, borderRadius: 12 }} /> : 'personId' in initial ? <PersonPhoto personId={initial.personId as string} path={path} name={draft.name} size={94} /> : <View style={{ width: 94, height: 94, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }}><Camera color={colors.purple} size={28} /></View>}
      <Text style={ui.body}>{i === 0 ? 'Profile photo' : 'Extra photo'}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Remove photo ${i + 1}`} disabled={busy || uploading} onPress={() => change('photoPaths', draft.photoPaths.filter(p => p !== path))} style={ui.row}><X size={13} color={colors.error} /><Text style={ui.error}>Remove</Text></Pressable>
    </View>)}</View>
    {!!errors.photoPaths && <Text style={ui.error}>{errors.photoPaths}</Text>}
    {draft.photoPaths.length < 3 && <><ActionButton title={uploading ? 'Uploading photograph…' : 'Choose photograph'} icon={Camera} secondary busy={uploading} disabled={busy} onPress={() => void pickPhoto()} /><ActionButton title="Take photograph" secondary disabled={uploading || busy} onPress={() => void pickPhoto(true)} /></>}
    </>}
    <View style={ui.divider} /><Text style={ui.heading}>Social profiles</Text><Text style={ui.body}>Leave a field empty if you do not use that platform.</Text>
    <MemberField label="Facebook" icon={Link2} optional value={draft.socials.facebook} placeholder="https://www.facebook.com/..." onChangeText={v => change('socials', { ...draft.socials, facebook: v })} editable={!busy} autoCapitalize="none" maxLength={300} />
    <MemberField label="LinkedIn" icon={Link2} optional value={draft.socials.linkedin} placeholder="https://www.linkedin.com/in/..." onChangeText={v => change('socials', { ...draft.socials, linkedin: v })} editable={!busy} autoCapitalize="none" maxLength={300} />
    <MemberField label="Instagram" icon={Link2} optional value={draft.socials.instagram} placeholder="@yourprofile" onChangeText={v => change('socials', { ...draft.socials, instagram: v })} editable={!busy} autoCapitalize="none" maxLength={300} />
    {!!errors.socials && <Text style={ui.error}>{errors.socials}</Text>}
    <View style={ui.divider} /><View style={ui.between}><View style={{ flex: 1 }}><Text style={ui.heading}>Birthday greetings</Text><Text style={ui.body}>Receive a birthday email{photosEnabled ? ' with your profile photograph' : ''} from the foundation. Your email must be verified.</Text></View><Switch value={draft.birthdayEmailsEnabled} onValueChange={v => change('birthdayEmailsEnabled', v)} disabled={busy} trackColor={{ true: colors.purple }} accessibilityLabel="Receive birthday greetings by email" /></View>
    <Text style={ui.body}>Your details are visible to authorised foundation administrators and the presidents managing your approved committees.</Text>
    {!!error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    <ActionButton title={submitTitle} busy={busy} disabled={uploading || (areaOptions !== undefined && (areasLoading || !!areasError || !areaOptions.length))} onPress={() => void submit()} />
    {calendar && <BirthDatePicker value={draft.dob} onSelect={v => change('dob', v)} onClose={() => setCalendar(false)} />}
  </View>;
}
