import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, LogOut, Mail, MapPin, UserRound, X } from 'lucide-react-native';
import { Brand } from './Brand';
import { ActionButton } from './ActionButton';
import { useSession, friendlyFirebaseError } from '../context/SessionContext';
import { presidentArea, roleLabel } from '../lib/presidents';
import { colors, fonts } from '../theme';

export function WorkspaceHeader() {
  const { profile, signOut } = useSession();
  const { width } = useWindowDimensions();
  const compact = width < 540;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (!profile) return null;
  const initials = profile.name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <View style={[styles.header, compact && styles.compact]}><Brand />
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Open president profile" style={styles.profileButton}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
        {!compact && <View><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.role}>{roleLabel(profile.role)}</Text></View>}
        {!compact && <ChevronDown size={15} color={colors.muted} />}
      </Pressable>
    </View>
    {open && <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close profile" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.dialogTop}><Text style={styles.dialogTitle}>Your profile</Text><Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close profile" hitSlop={10}><X size={21} color={colors.muted} /></Pressable></View>
          <View style={styles.largeAvatar}><Text style={styles.largeInitials}>{initials}</Text></View>
          <Text style={styles.name}>{profile.name}</Text><Text style={styles.profileRole}>{roleLabel(profile.role)}</Text>
          <View style={styles.details}><View style={styles.detail}><Mail size={17} color={colors.muted} /><Text style={styles.detailText}>{profile.email}</Text></View><View style={styles.detail}><MapPin size={17} color={colors.muted} /><Text style={styles.detailText}>{presidentArea(profile)}</Text></View><View style={styles.detail}><UserRound size={17} color={colors.muted} /><Text style={styles.detailText}>+91 {profile.mobile}</Text></View></View>
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <ActionButton title="Sign out" secondary icon={LogOut} busy={busy} onPress={() => { setBusy(true); void signOut().then(() => setOpen(false)).catch(cause => { setError(friendlyFirebaseError(cause)); setBusy(false); }); }} />
        </View>
      </View>
    </Modal>}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border }, header: { width: '100%', maxWidth: 1120, alignSelf: 'center', minHeight: 82, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, compact: { minHeight: 75, paddingHorizontal: 20 },
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 5 }, avatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }, initials: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 11 }, profileName: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 12 }, role: { fontFamily: fonts.regular, color: colors.muted, fontSize: 10, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,21,49,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 390, backgroundColor: colors.white, padding: 27, borderRadius: 22 },
  dialogTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dialogTitle: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 18 }, largeAvatar: { width: 65, height: 65, borderRadius: 33, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 28 }, largeInitials: { fontFamily: fonts.bold, color: colors.purple, fontSize: 22 },
  name: { fontFamily: fonts.bold, color: colors.ink, fontSize: 21, textAlign: 'center', marginTop: 14 }, profileRole: { fontFamily: fonts.medium, color: '#8B70A1', fontSize: 12, textAlign: 'center', marginTop: 7 }, details: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 22, marginTop: 25, marginBottom: 25, gap: 16 }, detail: { flexDirection: 'row', gap: 10, alignItems: 'center' }, detailText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted }, error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginBottom: 14 },
});
