import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Network, UserRound } from 'lucide-react-native';
import { Brand } from './Brand';
import { useSession } from '../context/SessionContext';
import { accountRole, isStaff } from '../lib/community';
import { colors, fonts } from '../theme';
import { usingEmulators } from '../services/firebase';

export function WorkspaceHeader() {
  const { account, profile } = useSession();
  return <SafeAreaView edges={['top']} style={styles.safe}><View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Go to home" onPress={() => router.replace('/(tabs)')}><Brand /></Pressable>
    <View style={styles.actions}>
      {isStaff(account) && <Pressable accessibilityRole="button" accessibilityLabel="Manage committees and accounts" onPress={() => router.push('/manage')} style={styles.button}><Network size={21} color={colors.purple} /></Pressable>}
      <Pressable accessibilityRole="button" accessibilityLabel="Open your account" onPress={() => router.push('/settings')} style={styles.button}><UserRound size={21} color={colors.purple} /></Pressable>
    </View>
  </View>{usingEmulators && <Text style={[styles.role, { paddingHorizontal: 22, paddingBottom: 8 }]}>Test mode</Text>}{profile && <View style={styles.context}><Text numberOfLines={1} style={styles.name}>{profile.name}</Text><Text style={styles.role}>{accountRole(account)}</Text></View>}</SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { backgroundColor: colors.white, borderBottomWidth: 1, borderColor: colors.border },
  header: { width: '100%', maxWidth: 1120, alignSelf: 'center', paddingHorizontal: 20, minHeight: 74, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', gap: 8 }, button: { width: 41, height: 41, borderRadius: 21, backgroundColor: colors.lavender, alignItems: 'center', justifyContent: 'center' },
  context: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 22, paddingBottom: 12, width: '100%', maxWidth: 1120, alignSelf: 'center' },
  name: { flex: 1, fontFamily: fonts.medium, fontSize: 11, color: colors.muted }, role: { fontFamily: fonts.semibold, fontSize: 10, color: colors.purple },
});
