import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, fonts } from '../theme';
export function Screen({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  return <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
    <Text accessibilityRole="header" style={ui.title}>{title}</Text>{description && <Text style={ui.description}>{description}</Text>}{children}
  </ScrollView></KeyboardAvoidingView>;
}
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, page: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: 22, paddingBottom: 45, gap: 18 },
  title: { fontFamily: fonts.bold, fontSize: 29, color: colors.ink, letterSpacing: -.7, marginTop: 8 }, description: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: -9 },
  card: { padding: 22, gap: 16, backgroundColor: colors.white, borderRadius: 16, borderWidth: 1, borderColor: colors.border },
  heading: { fontFamily: fonts.semibold, color: colors.ink, fontSize: 17 }, body: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  error: { fontFamily: fonts.regular, color: colors.error, fontSize: 13, lineHeight: 21 }, success: { fontFamily: fonts.regular, color: colors.success, fontSize: 13, lineHeight: 21 },
  pill: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 9, backgroundColor: colors.lavender }, pillText: { fontFamily: fonts.medium, color: colors.purple, fontSize: 11 },
  link: { fontFamily: fonts.semibold, color: colors.purple, fontSize: 13 }, divider: { height: 1, backgroundColor: colors.border },
});
