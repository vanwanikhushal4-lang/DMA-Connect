import { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBackendAuth } from '../context/BackendAuthContext';
import { backendApi, BackendApiError } from '../services/backend-api';
import type { ApiCommittee } from '../lib/backend-auth';
import { Screen, ui } from '../components/Screen';
import { ActionButton } from '../components/ActionButton';
import { Brand } from '../components/Brand';
import { colors } from '../theme';

export function BackendAccountScreen() {
  const { session, signOut } = useBackendAuth();
  const [committees, setCommittees] = useState<ApiCommittee[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!session) return;
    let active = true;
    const controller = new AbortController();
    void backendApi.getAllCommittees(session.token, controller.signal).then(result => {
      if (active) setCommittees(result.filter(c => c.active).sort((a, b) => a.name.localeCompare(b.name)));
    }).catch(cause => {
      if (!active) return;
      if (cause instanceof BackendApiError && cause.status === 401) void signOut().catch(() => {});
      else setError(cause instanceof Error ? cause.message : 'Committees could not be loaded.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [session, signOut, retry]);
  if (!session) return null;
  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.white }}>
    <View style={{ paddingHorizontal: 22, paddingVertical: 15, alignSelf: 'center', width: '100%', maxWidth: 780 }}><Brand /></View>
    <Screen title={`Welcome, ${session.name}`} description="Your DMA Connect account and committee directory.">
    <View style={ui.card}>
      <Text style={ui.heading}>Signed in</Text><Text style={ui.body}>{session.email}</Text><Text style={ui.body}>User ID: {session.userId}</Text>
      <ActionButton title="Sign out" secondary onPress={() => { void signOut().catch(() => setError('The saved session could not be cleared. Please try signing out again.')); }} />
    </View>
    <View style={ui.card}>
      <Text style={ui.heading}>Committees</Text>
      {loading && <ActivityIndicator color={colors.purple} />}
      {!!error && <><Text accessibilityRole="alert" style={ui.error}>{error}</Text><ActionButton title="Retry loading committees" secondary onPress={() => { setLoading(true); setError(''); setRetry(value => value + 1); }} /></>}
      {!loading && !error && !committees.length && <Text style={ui.body}>No active committees are available.</Text>}
      {!loading && !error && committees.map(committee => <View key={committee.committeeId} style={ui.between}><Text style={ui.heading}>{committee.name}</Text><View style={ui.pill}><Text style={ui.pillText}>{committee.level}</Text></View></View>)}
    </View>
    </Screen>
  </SafeAreaView>;
}
