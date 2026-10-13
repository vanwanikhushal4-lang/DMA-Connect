import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { api } from '../services/api';
import { ui } from '../components/Screen';
import { colors } from '../theme';
type History = { activity: { id: string; action: string; createdAt: string }[]; deliveries: { id: string; status: string; date: string; error?: string }[]; mailStatus: { lastRunAt: string; configurationMissing?: boolean; sent: number } | null };
export function HistoryScreen() {
  const [history, setHistory] = useState<History | null>(null), [error, setError] = useState('');
  useEffect(() => { let active = true; void api<History>('adminHistory').then(h => { if (active) setHistory(h); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, []);
  return <View style={{ gap: 16 }}>{!!error && <Text style={ui.error}>{error}</Text>}{!history && !error && <ActivityIndicator color={colors.purple} />}<View style={ui.card}><Text style={ui.heading}>Birthday email service</Text><Text style={ui.body}>{history?.mailStatus ? history.mailStatus.configurationMissing ? 'Email sender setup is required.' : `Last run: ${new Date(history.mailStatus.lastRunAt).toLocaleString('en-IN')} · ${history.mailStatus.sent} sent` : 'The service has not run yet.'}</Text>{history?.deliveries.map(d => <View key={d.id}><Text style={ui.body}>{d.date} · {d.status}</Text>{!!d.error && <Text style={ui.error}>{d.error}</Text>}</View>)}</View><View style={ui.card}><Text style={ui.heading}>Administrative history</Text>{history?.activity.map(a => <View key={a.id}><Text style={ui.heading}>{a.action.replace(/-/g, ' ')}</Text><Text style={ui.body}>{new Date(a.createdAt).toLocaleString('en-IN')}</Text></View>)}</View></View>;
}
