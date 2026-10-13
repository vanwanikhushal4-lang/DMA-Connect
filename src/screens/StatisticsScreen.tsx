import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useCommunity } from '../context/CommunityContext';
import { useSession } from '../context/SessionContext';
import { api } from '../services/api';
import { Screen, ui } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';
import { RegistrationChart } from '../components/RegistrationChart';
import { AreaChart } from '../components/AreaChart';
import { colors } from '../theme';
import type { Period } from '../lib/statistics';
import { periodOptions } from '../lib/statistics';

type Stats = { total: number; periodTotal: number; today: number; series: { label: string; fullLabel: string; count: number }[]; distribution: { label: string; count: number }[] };
export function StatisticsScreen() {
  const { account } = useSession(), { revision, staffState } = useCommunity();
  const [period, setPeriod] = useState<Period>('week'), [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; data: Stats | null; error: string } | null>(null);
  const key = [period, revision, retry, account?.committeeId].join(':');
  const current = result?.key === key ? result : null, data = current?.data, error = current?.error || '', loading = !current;
  useEffect(() => { let active = true; void api<Stats>('statistics', { period }).then(d => { if (active) setResult({ key, data: d, error: '' }); }).catch(e => { if (active) setResult({ key, data: null, error: e.message }); }); return () => { active = false; }; }, [key, period]);
  return <Screen title="Statistics" description={account?.role === 'superadmin' ? 'Foundation members and committee affiliations across your district.' : 'Members within your assigned committee and its authorised descendants.'}>
    <View style={ui.row}>{periodOptions.map(p => <Pressable key={p.value} accessibilityRole="button" accessibilityState={{ selected: p.value === period }} onPress={() => setPeriod(p.value)} style={[ui.pill, { backgroundColor: p.value === period ? colors.purple : colors.lavender }]}><Text style={[ui.pillText, { color: p.value === period ? colors.white : colors.purple }]}>{p.label}</Text></Pressable>)}</View>
    {!!error && <View style={ui.card}><Text style={ui.error}>{error}</Text><ActionButton title="Retry statistics" secondary onPress={() => setRetry(k => k + 1)} /></View>}
    {loading && <ActivityIndicator color={colors.purple} />}
    {data && <>
      <View style={ui.card}><Text style={ui.body}>Unique members</Text><Text style={[ui.title, { fontSize: 44 }]}>{data.total.toLocaleString('en-IN')}</Text><Text style={ui.body}>Each person is counted once, including people affiliated with both an area and a cell.</Text><View style={ui.divider} /><Text style={ui.body}>{data.periodTotal} registered in this period · {data.today} registered today</Text><Text style={ui.body}>{staffState?.affiliationTotal || 0} active committee affiliations</Text></View>
      <RegistrationChart points={data.series} subtitle="Unique member registrations in this period" compact />
      <AreaChart areas={data.distribution} compact />
    </>}
  </Screen>;
}
