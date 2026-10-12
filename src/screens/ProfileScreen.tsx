import { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogOut, Mail, MapPin, Phone, ShieldCheck, UserRound } from 'lucide-react-native';
import { ActionButton } from '../components/ActionButton';
import { AdminConsole } from '../components/AdminConsole';
import { useSession, friendlyFirebaseError } from '../context/SessionContext';
import { useEntrance } from '../hooks/useMotion';
import { presidentArea, roleLabel } from '../lib/presidents';
import { colors, fonts } from '../theme';

export function ProfileScreen() {
  const { profile, isAdmin, signOut } = useSession();
  const { width } = useWindowDimensions();
  const compact = width < 540;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [adminOpen, setAdminOpen] = useState(false);
  const entrance = useEntrance();

  const name = profile?.name ?? 'Administrator';
  const initials = name.split(' ').slice(0, 2).map(word => word[0]).join('').toUpperCase();
  const roleName = isAdmin ? 'Administrator' : profile ? roleLabel(profile.role) : '';
  const area = profile ? presidentArea(profile) : '';

  function handleSignOut() {
    setBusy(true);
    setError('');
    void signOut().catch(cause => {
      setError(friendlyFirebaseError(cause));
      setBusy(false);
    });
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Animated.View style={[styles.container, compact && styles.containerCompact, entrance]}>
        {/* Profile Card */}
        <View style={[styles.card, compact && styles.cardCompact]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatar}>
              {isAdmin && !profile
                ? <ShieldCheck size={30} color={colors.purple} strokeWidth={2} />
                : <Text style={styles.initials}>{initials}</Text>}
            </View>
            <View style={styles.nameCol}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.role}>{roleName}</Text>
            </View>
          </View>

          {isAdmin && (
            <View style={styles.adminBadge}>
              <ShieldCheck size={13} color={colors.purple} />
              <Text style={styles.adminBadgeText}>Admin Access Granted</Text>
            </View>
          )}

          {/* Details */}
          <View style={styles.details}>
            {profile?.email ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Mail size={17} color={colors.purple} strokeWidth={1.6} /></View>
                <View>
                  <Text style={styles.detailLabel}>Email</Text>
                  <Text style={styles.detailValue}>{profile.email}</Text>
                </View>
              </View>
            ) : null}

            {profile?.mobile ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><Phone size={17} color={colors.purple} strokeWidth={1.6} /></View>
                <View>
                  <Text style={styles.detailLabel}>Mobile</Text>
                  <Text style={styles.detailValue}>+91 {profile.mobile}</Text>
                </View>
              </View>
            ) : null}

            {profile?.role ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><UserRound size={17} color={colors.purple} strokeWidth={1.6} /></View>
                <View>
                  <Text style={styles.detailLabel}>Role</Text>
                  <Text style={styles.detailValue}>{roleLabel(profile.role)}</Text>
                </View>
              </View>
            ) : null}

            {area ? (
              <View style={styles.detailRow}>
                <View style={styles.detailIcon}><MapPin size={17} color={colors.purple} strokeWidth={1.6} /></View>
                <View>
                  <Text style={styles.detailLabel}>Area</Text>
                  <Text style={styles.detailValue}>{area}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* Actions */}
        <View style={[styles.actionsCard, compact && styles.cardCompact]}>
          {isAdmin && (
            <View style={{ marginBottom: 14 }}>
              <ActionButton
                title="Open Admin Console"
                icon={ShieldCheck}
                onPress={() => setAdminOpen(true)}
              />
            </View>
          )}
          {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
          <ActionButton
            title="Sign out"
            secondary
            icon={LogOut}
            busy={busy}
            onPress={handleSignOut}
          />
        </View>

        <Text style={styles.footer}>Dr. Mangesh Amale Foundation</Text>
      </Animated.View>

      {adminOpen && (
        <Modal visible animationType="slide" onRequestClose={() => setAdminOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
            <AdminConsole onClose={() => setAdminOpen(false)} />
          </SafeAreaView>
        </Modal>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1 },
  container: { width: '100%', maxWidth: 540, alignSelf: 'center', paddingHorizontal: 28, paddingTop: 36, paddingBottom: 32 },
  containerCompact: { paddingHorizontal: 20, paddingTop: 24 },

  card: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 28 },
  cardCompact: { padding: 22, borderRadius: 18 },

  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fonts.bold, color: colors.purple, fontSize: 22 },
  nameCol: { flex: 1 },
  name: { fontFamily: fonts.bold, color: colors.ink, fontSize: 22, letterSpacing: -0.5 },
  role: { fontFamily: fonts.medium, color: '#8B70A1', fontSize: 13, marginTop: 4 },

  adminBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.lavender, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 14, marginTop: 18, alignSelf: 'flex-start' },
  adminBadgeText: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 12 },

  details: { borderTopWidth: 1, borderColor: colors.border, marginTop: 24, paddingTop: 22, gap: 20 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  detailIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  detailLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.muted, marginBottom: 2 },
  detailValue: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },

  actionsCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 22, padding: 28, marginTop: 18 },

  error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, marginBottom: 14 },

  footer: { textAlign: 'center', fontFamily: fonts.regular, color: '#9D93A7', fontSize: 10, marginTop: 28, paddingBottom: 10 },
});
