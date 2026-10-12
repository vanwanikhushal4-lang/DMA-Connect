import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { ArrowRight, CalendarDays, ChevronRight, MapPin, Search, TrendingUp, UserRoundPlus, UsersRound, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { router } from 'expo-router';
import { useMembers } from '../hooks/useMembers';
import { useEntrance } from '../hooks/useMotion';
import { RegistrationChart } from '../components/RegistrationChart';
import { AreaChart } from '../components/AreaChart';
import { AnimatedCount } from '../components/AnimatedCount';
import { MemberDetails } from '../components/MemberDetails';
import { ActionButton } from '../components/ActionButton';
import { areaDistribution, dayKey, filterPeriod, periodOptions, registrationSeries } from '../lib/statistics';
import type { Period } from '../lib/statistics';
import type { Member } from '../lib/members';
import { colors, fonts } from '../theme';

export function StatisticsScreen() {
  const { width } = useWindowDimensions();
  const compact = width < 540;
  const wide = width >= 940;
  const { members, loading, storageError, loadMembers } = useMembers();
  const [period, setPeriod] = useState<Period>('week');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Member | null>(null);
  const entrance = useEntrance();
  const filtered = useMemo(() => filterPeriod(members, period), [members, period]);
  const points = useMemo(() => registrationSeries(members, period), [members, period]);
  const areas = useMemo(() => areaDistribution(filtered), [filtered]);
  const visible = useMemo(() => filtered.filter(member => `${member.name} ${member.mobile} ${member.taluka}`.toLowerCase().includes(search.trim().toLowerCase())), [filtered, search]);
  const addedToday = members.filter(member => dayKey(new Date(member.createdAt)) === dayKey(new Date())).length;
  const periodName = period === 'week' ? 'Last 7 days' : period === 'month' ? 'Last 30 days' : 'All time';
  const metrics: { title: string; value: number; icon: LucideIcon; note: string }[] = [
    { title: 'Total members', value: members.length, icon: UsersRound, note: 'Added by you · all time' },
    { title: 'Added today', value: addedToday, icon: UserRoundPlus, note: 'Your registrations today' },
    { title: periodName, value: filtered.length, icon: TrendingUp, note: 'Registrations in this period' },
    { title: 'Talukas reached', value: areas.length, icon: MapPin, note: 'Across the selected period' },
  ];
  const header = <Animated.View style={entrance}>
    <View style={[styles.pageHeading, compact && styles.headingCompact]}><View><Text accessibilityRole="header" style={[styles.pageTitle, compact && { fontSize: 30 }]}>Your statistics</Text><Text style={styles.description}>Keep track of the members you’ve added.</Text></View>
      <View style={styles.periodControl}>{periodOptions.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityLabel={`Show ${option.label}`} accessibilityState={{ selected: period === option.value }} onPress={() => { setPeriod(option.value); setSearch(''); }} style={[styles.periodOption, period === option.value && styles.activePeriod]}><Text style={[styles.periodText, period === option.value && styles.activePeriodText]}>{option.label}</Text></Pressable>)}</View>
    </View>
    {!!storageError && <View style={styles.errorBox}><Text accessibilityRole="alert" style={styles.error}>{storageError}</Text><ActionButton title="Retry" secondary onPress={loadMembers} /></View>}
    <View style={styles.metrics}>{metrics.map(({ title, value, icon: Icon, note }) => <View key={title} style={[styles.metric, { width: wide ? '23.5%' : '47.5%' }]}><View style={styles.metricTop}><Text style={styles.metricTitle}>{title}</Text><View style={styles.metricIcon}><Icon size={17} color="#8766A0" strokeWidth={1.65} /></View></View>{loading ? <ActivityIndicator color={colors.purple} style={{ alignSelf: 'flex-start', marginVertical: 14 }} /> : <AnimatedCount value={value} style={styles.metricValue} />}<Text style={styles.metricNote}>{note}</Text></View>)}</View>
    <View style={[styles.charts, !wide && styles.chartsCompact]}><RegistrationChart key={`activity-${period}`} points={points} compact={!wide} subtitle={period === 'all' ? 'Last 6 months · tap to explore' : `${periodName} · daily registrations`} /><AreaChart key={`areas-${period}-${areas.map(area => area.label).join(',')}`} areas={areas} compact={!wide} /></View>
    <View style={styles.directoryHeader}><View><Text accessibilityRole="header" style={styles.directoryTitle}>Member directory</Text><Text style={styles.directorySubtitle}>{filtered.length} {filtered.length === 1 ? 'member' : 'members'} · {periodName.toLowerCase()}</Text></View><View style={styles.directoryBadge}><UsersRound size={16} color={colors.purple} /></View></View>
    <View style={styles.searchBox}><Search size={17} color="#A090AE" /><TextInput value={search} onChangeText={setSearch} placeholder="Search name, mobile or taluka" accessibilityLabel="Search members" autoCapitalize="none" autoCorrect={false} placeholderTextColor={colors.placeholder} style={styles.search} />{!!search && <Pressable onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear member search" hitSlop={8}><X size={16} color={colors.muted} /></Pressable>}</View>
    {!compact && <View style={styles.tableHeader}><Text style={[styles.tableLabel, { flex: 1.4 }]}>MEMBER</Text><Text style={[styles.tableLabel, { flex: 1 }]}>MOBILE</Text><Text style={[styles.tableLabel, { flex: 1 }]}>TALUKA</Text><Text style={[styles.tableLabel, { width: 82 }]}>ADDED</Text><View style={{ width: 15 }} /></View>}
  </Animated.View>;
  return <View collapsable={Platform.OS !== 'ios'} style={styles.screen}>
    <FlatList data={visible} keyExtractor={member => member.id} keyboardShouldPersistTaps="handled" ListHeaderComponent={header}
      contentContainerStyle={[styles.list, compact && styles.listCompact]} initialNumToRender={12} maxToRenderPerBatch={15}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`View member ${item.name}`} onPress={() => setSelected(item)} style={({ pressed }) => [styles.memberRow, pressed && { backgroundColor: colors.lavender }]}>
        <View style={[styles.memberCell, { flex: 1.4 }]}><View style={styles.memberAvatar}><Text style={styles.memberInitial}>{item.name.trim()[0]?.toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text numberOfLines={1} style={styles.memberName}>{item.name}</Text>{compact && <Text style={styles.memberSecondary}>+91 {item.mobile}</Text>}</View></View>
        {!compact && <Text style={[styles.memberText, { flex: 1 }]}>{item.mobile}</Text>}
        <Text numberOfLines={1} style={[styles.memberText, compact ? { maxWidth: 80, marginHorizontal: 10 } : { flex: 1 }]}>{item.taluka}</Text>
        {!compact && <Text style={[styles.memberText, { width: 82 }]}>{new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</Text>}
        <ChevronRight size={15} color="#AA9DB6" />
      </Pressable>}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.purple} style={{ marginTop: 30 }} /> : <View style={styles.empty}><View style={styles.emptyIcon}><UsersRound size={27} color="#8B6DA5" strokeWidth={1.5} /></View><Text style={styles.emptyTitle}>{search ? 'No matching members' : members.length ? 'No members in this period' : 'Your member directory starts here'}</Text><Text style={styles.emptyText}>{search ? 'Try another name, mobile number or taluka.' : members.length ? 'Choose another period to see your registrations.' : 'Add your first member and their details will appear here.'}</Text>{!search && !members.length && <Pressable accessibilityRole="button" accessibilityLabel="Add your first member" onPress={() => router.navigate('/(tabs)')} style={styles.emptyAction}><Text style={styles.emptyActionText}>Add your first member</Text><ArrowRight size={15} color={colors.purple} /></Pressable>}</View>}
      ListFooterComponent={<View style={styles.footer}><CalendarDays size={12} color="#A192AF" /><Text style={styles.footerText}>Statistics update as your members are saved.</Text></View>}
    />
    {selected && <MemberDetails member={selected} onClose={() => setSelected(null)} />}
  </View>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, list: { width: '100%', maxWidth: 1088, alignSelf: 'center', paddingHorizontal: 32, paddingTop: 32, paddingBottom: 24, flexGrow: 1 }, listCompact: { paddingHorizontal: 20, paddingTop: 25 },
  pageHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 26 }, headingCompact: { flexDirection: 'column', alignItems: 'flex-start', gap: 20 }, pageTitle: { fontFamily: fonts.bold, color: colors.ink, fontSize: 35, letterSpacing: -1.2 }, description: { fontFamily: fonts.regular, color: colors.muted, fontSize: 13, lineHeight: 21, marginTop: 9 },
  periodControl: { flexDirection: 'row', padding: 4, backgroundColor: '#EEEAF3', borderRadius: 10 }, periodOption: { minHeight: 34, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 7 }, activePeriod: { backgroundColor: colors.white, boxShadow: '0 2px 6px rgba(56,32,108,0.06)' }, periodText: { fontFamily: fonts.medium, fontSize: 11, color: '#9A8CA7' }, activePeriodText: { color: colors.purple, fontFamily: fonts.semibold },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 13, marginBottom: 22 }, metric: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 18 }, metricTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 5 }, metricTitle: { fontFamily: fonts.medium, color: '#81728E', fontSize: 11, flexShrink: 1 }, metricIcon: { width: 30, height: 30, backgroundColor: '#F5F1F9', borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, metricValue: { fontFamily: fonts.semibold, fontSize: 32, color: colors.purple, letterSpacing: -1, marginTop: 12, marginBottom: 7 }, metricNote: { fontFamily: fonts.regular, color: '#A397AC', fontSize: 9, lineHeight: 15 },
  charts: { flexDirection: 'row', alignItems: 'stretch', gap: 20, marginBottom: 27 }, chartsCompact: { flexDirection: 'column' },
  directoryHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.white, borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border, borderTopLeftRadius: 15, borderTopRightRadius: 15, padding: 22 }, directoryTitle: { fontFamily: fonts.semibold, fontSize: 17, color: colors.ink }, directorySubtitle: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, marginTop: 6 }, directoryBadge: { padding: 9, borderRadius: 10, backgroundColor: colors.lavender }, searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 22, paddingBottom: 17, backgroundColor: colors.white, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }, search: { flex: 1, minHeight: 40, backgroundColor: '#FBF9FD', fontFamily: fonts.regular, fontSize: 12, paddingHorizontal: 10, borderRadius: 8, color: colors.ink, outlineWidth: 0 },
  tableHeader: { backgroundColor: '#F7F5FA', paddingHorizontal: 22, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border }, tableLabel: { fontFamily: fonts.semibold, fontSize: 8, letterSpacing: 1, color: '#A294AC' },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 22, paddingVertical: 17, backgroundColor: colors.white, borderWidth: 1, borderTopWidth: 0, borderColor: '#EFEAF3' }, memberCell: { flexDirection: 'row', alignItems: 'center', gap: 11, minWidth: 0 }, memberAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0EBF7', alignItems: 'center', justifyContent: 'center' }, memberInitial: { fontFamily: fonts.semibold, fontSize: 12, color: '#795994' }, memberName: { fontFamily: fonts.medium, fontSize: 12, color: colors.ink }, memberSecondary: { fontFamily: fonts.regular, fontSize: 10, color: colors.muted, marginTop: 4 }, memberText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  empty: { padding: 35, alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderTopWidth: 0, borderColor: colors.border, borderBottomLeftRadius: 15, borderBottomRightRadius: 15 }, emptyIcon: { width: 57, height: 57, borderRadius: 18, backgroundColor: colors.lavender, justifyContent: 'center', alignItems: 'center', marginBottom: 16 }, emptyTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink, textAlign: 'center' }, emptyText: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 290 }, emptyAction: { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 44, marginTop: 14 }, emptyActionText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.purple },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 22 }, footerText: { fontFamily: fonts.regular, fontSize: 10, color: '#A294AC' }, errorBox: { backgroundColor: '#FFF3F5', borderRadius: 12, padding: 17, gap: 14, marginBottom: 20 }, error: { fontFamily: fonts.regular, fontSize: 12, color: colors.error, lineHeight: 19 },
});
