import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronDown, LogOut, Mail, MapPin, ShieldCheck, UserRound, X } from 'lucide-react-native';
import { Brand } from './Brand';
import { ActionButton } from './ActionButton';
import { AdminConsole } from './AdminConsole';
import { useSession, friendlyFirebaseError } from '../context/SessionContext';
import { presidentArea, roleLabel } from '../lib/presidents';
import { colors, fonts } from '../theme';

export function WorkspaceHeader() {
  const { profile, isAdmin, signOut } = useSession();
  const { width } = useWindowDimensions();
  const compact = width < 540;
  const [open, setOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // ── Admin-only header (no president profile) ──────────────────────────────
  if (isAdmin && !profile) {
    return <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={[styles.header, compact && styles.compact]}>
        <Brand />
        <View style={styles.rightNav}>
          <Pressable
            onPress={() => setAdminOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Admin Console"
            style={styles.adminConsoleButton}
          >
            <ShieldCheck size={16} color={colors.purple} strokeWidth={2} />
            <Text style={styles.adminConsoleText}>Admin Console</Text>
          </Pressable>
          <Pressable
            onPress={() => setOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Admin menu"
            style={styles.profileButton}
          >
            <View style={styles.avatar}>
              <ShieldCheck size={16} color={colors.purple} strokeWidth={2} />
            </View>
            {!compact && <View>
              <Text style={styles.profileName}>Admin</Text>
              <Text style={styles.role}>Administrator</Text>
            </View>}
            {!compact && <ChevronDown size={15} color={colors.muted} />}
          </Pressable>
        </View>
      </View>
      {open && <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close menu" />
          <View style={styles.dialog} accessibilityViewIsModal>
            <View style={styles.dialogTop}><Text style={styles.dialogTitle}>Admin Account</Text><Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}><X size={21} color={colors.muted} /></Pressable></View>
            <View style={styles.largeAvatar}><ShieldCheck size={28} color={colors.purple} strokeWidth={2} /></View>
            <Text style={styles.name}>Administrator</Text>
            <Text style={styles.profileRole}>Foundation Admin</Text>
            <View style={styles.adminBadgeRow}>
              <ShieldCheck size={13} color={colors.purple} />
              <Text style={styles.adminBadgeLabel}>Full Access Granted</Text>
            </View>
            <View style={{ marginTop: 24, marginBottom: 12 }}>
              <ActionButton
                title="Open Admin Console"
                icon={ShieldCheck}
                onPress={() => { setOpen(false); setAdminOpen(true); }}
              />
            </View>
            {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
            <ActionButton title="Sign out" secondary icon={LogOut} busy={busy} onPress={() => { setBusy(true); void signOut().then(() => setOpen(false)).catch(cause => { setError(friendlyFirebaseError(cause)); setBusy(false); }); }} />
          </View>
        </View>
      </Modal>}
      {adminOpen && (
        <Modal visible animationType="slide" onRequestClose={() => setAdminOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
            <AdminConsole onClose={() => setAdminOpen(false)} />
          </SafeAreaView>
        </Modal>
      )}
    </SafeAreaView>;
  }

  // ── President user — no profile yet, render nothing ───────────────────────
  if (!profile) return null;

  const initials = profile.name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return <SafeAreaView edges={['top']} style={styles.safe}>
    <View style={[styles.header, compact && styles.compact]}>
      <Brand />
      <View style={styles.rightNav}>
        {isAdmin && (
          <Pressable
            onPress={() => setAdminOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Admin Console"
            style={styles.adminConsoleButton}
          >
            <ShieldCheck size={16} color={colors.purple} strokeWidth={2} />
            <Text style={styles.adminConsoleText}>Admin Console</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Open president profile" style={styles.profileButton}>
          <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
          {!compact && <View><Text style={styles.profileName}>{profile.name}</Text><Text style={styles.role}>{isAdmin ? 'Administrator' : roleLabel(profile.role)}</Text></View>}
          {!compact && <ChevronDown size={15} color={colors.muted} />}
        </Pressable>
      </View>
    </View>
    {open && <Modal transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessibilityLabel="Close profile" />
        <View style={styles.dialog} accessibilityViewIsModal>
          <View style={styles.dialogTop}><Text style={styles.dialogTitle}>Your profile</Text><Pressable onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel="Close profile" hitSlop={10}><X size={21} color={colors.muted} /></Pressable></View>
          <View style={styles.largeAvatar}><Text style={styles.largeInitials}>{initials}</Text></View>
          <Text style={styles.name}>{profile.name}</Text>
          <Text style={styles.profileRole}>{isAdmin ? 'Administrator' : roleLabel(profile.role)}</Text>
          {isAdmin && (
            <View style={styles.adminBadgeRow}>
              <ShieldCheck size={13} color={colors.purple} />
              <Text style={styles.adminBadgeLabel}>All Users Access Granted</Text>
            </View>
          )}
          <View style={styles.details}><View style={styles.detail}><Mail size={17} color={colors.muted} /><Text style={styles.detailText}>{profile.email}</Text></View><View style={styles.detail}><MapPin size={17} color={colors.muted} /><Text style={styles.detailText}>{presidentArea(profile) || 'Headquarters'}</Text></View><View style={styles.detail}><UserRound size={17} color={colors.muted} /><Text style={styles.detailText}>+91 {profile.mobile}</Text></View></View>
          {isAdmin && (
            <View style={{ marginBottom: 12 }}>
              <ActionButton
                title="Open Admin Console"
                icon={ShieldCheck}
                onPress={() => {
                  setOpen(false);
                  setAdminOpen(true);
                }}
              />
            </View>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <ActionButton title="Sign out" secondary icon={LogOut} busy={busy} onPress={() => { setBusy(true); void signOut().then(() => setOpen(false)).catch(cause => { setError(friendlyFirebaseError(cause)); setBusy(false); }); }} />
        </View>
      </View>
    </Modal>}
    {adminOpen && (
      <Modal visible animationType="slide" onRequestClose={() => setAdminOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
          <AdminConsole onClose={() => setAdminOpen(false)} />
        </SafeAreaView>
      </Modal>
    )}
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border }, header: { width: '100%', maxWidth: 1120, alignSelf: 'center', minHeight: 82, paddingHorizontal: 32, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, compact: { minHeight: 75, paddingHorizontal: 20 },
  rightNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adminConsoleButton: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.lavender, borderWidth: 1, borderColor: colors.lavenderBorder, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  adminConsoleText: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 12 },
  adminBadgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: colors.lavender, paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12, marginTop: 8, alignSelf: 'center' },
  adminBadgeLabel: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 11 },
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 5 }, avatar: { width: 35, height: 35, borderRadius: 18, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' }, initials: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 11 }, profileName: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 12 }, role: { fontFamily: fonts.regular, color: colors.muted, fontSize: 10, marginTop: 3 },
  backdrop: { flex: 1, backgroundColor: 'rgba(30,21,49,0.3)', alignItems: 'center', justifyContent: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 390, backgroundColor: colors.white, padding: 27, borderRadius: 22 },
  dialogTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, dialogTitle: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 18 }, largeAvatar: { width: 65, height: 65, borderRadius: 33, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 28 }, largeInitials: { fontFamily: fonts.bold, color: colors.purple, fontSize: 22 },
  name: { fontFamily: fonts.bold, color: colors.ink, fontSize: 21, textAlign: 'center', marginTop: 14 }, profileRole: { fontFamily: fonts.medium, color: '#8B70A1', fontSize: 12, textAlign: 'center', marginTop: 7 }, details: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 22, marginTop: 20, marginBottom: 20, gap: 14 }, detail: { flexDirection: 'row', gap: 10, alignItems: 'center' }, detailText: { flex: 1, fontFamily: fonts.regular, fontSize: 12, color: colors.muted }, error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginBottom: 14 },
});
