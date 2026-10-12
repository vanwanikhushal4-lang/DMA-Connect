import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CalendarDays, Mail, MapPin, Phone, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import type { Member } from '../lib/members';
import { colors, fonts } from '../theme';

export function MemberDetails({ member, onClose }: { member: Member; onClose: () => void }) {
  const rows: { label: string; value: string; icon: LucideIcon }[] = [
    { label: 'Mobile', value: '+91 ' + member.mobile, icon: Phone }, { label: 'Email', value: member.email || 'Not provided', icon: Mail },
    { label: 'Residence', value: member.residence, icon: MapPin }, { label: 'Date of birth', value: member.dob, icon: CalendarDays },
    { label: 'Taluka', value: member.taluka, icon: MapPin },
  ];
  return <Modal transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.backdrop}><Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close member details" />
      <ScrollView style={styles.dialog} contentContainerStyle={styles.dialogContent} accessibilityViewIsModal>
        <View style={styles.heading}><Text style={styles.overline}>MEMBER DETAILS</Text><Pressable accessibilityRole="button" accessibilityLabel="Close member details" onPress={onClose} hitSlop={12}><X size={21} color={colors.muted} /></Pressable></View>
        <Text accessibilityRole="header" style={styles.name}>{member.name}</Text>
        <Text style={styles.added}>Added {new Date(member.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
        {rows.map(({ label, value, icon: Icon }) => <View key={label} style={styles.row}><Icon size={18} color="#927EA1" strokeWidth={1.6} /><View style={{ flex: 1 }}><Text style={styles.label}>{label}</Text><Text selectable style={styles.value}>{value}</Text></View></View>)}
      </ScrollView>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(30,21,49,0.3)', justifyContent: 'center', alignItems: 'center', padding: 24 }, dialog: { width: '100%', maxWidth: 410, maxHeight: '85%', flexGrow: 0, borderRadius: 22, backgroundColor: colors.white }, dialogContent: { padding: 27 }, heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, overline: { fontFamily: fonts.semibold, fontSize: 9, letterSpacing: 1.7, color: '#90799F' }, name: { fontFamily: fonts.bold, fontSize: 25, letterSpacing: -0.7, color: colors.ink, marginTop: 24 }, added: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 8, marginBottom: 20 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 13, borderTopWidth: 1, borderColor: '#F2EEF5' }, label: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginBottom: 5 }, value: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink, lineHeight: 19 },
});
