import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { Search } from 'lucide-react-native';
import { useMembers } from '../context/MembersContext';
import { useCommunity } from '../context/CommunityContext';
import { useSession } from '../context/SessionContext';
import { PersonPhoto } from '../components/PersonPhoto';
import { MemberDetails } from '../components/MemberDetails';
import { ActionButton } from '../components/ActionButton';
import { SelectField } from '../components/SelectField';
import { ui } from '../components/Screen';
import { colors, fonts } from '../theme';
import type { Person } from '../lib/community';

export function MembersScreen() {
  const { members, total, loading, loadingMore, storageError, loadMembers, loadMore, nextCursor, search, setSearch, committeeFilter, setCommitteeFilter } = useMembers();
  const { committees } = useCommunity(), { account } = useSession();
  const [selected, setSelected] = useState<Person | null>(null);
  const available = committees.filter(c => c.level !== 'district' && (account?.role === 'superadmin' || c.ancestorIds.includes(account?.committeeId || '')));
  return <View style={ui.screen}><FlatList
    data={members} keyExtractor={m => m.id} contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled" initialNumToRender={12} windowSize={7}
    refreshing={loading} onRefresh={loadMembers} onEndReached={() => void loadMore()} onEndReachedThreshold={.4}
    ListHeaderComponent={<View style={{ gap: 16, marginBottom: 15 }}><Text style={ui.title}>Members</Text><Text style={ui.body}>{total} unique members in your assigned scope.</Text><View style={[ui.row, { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white, paddingHorizontal: 14, borderRadius: 12 }]}><Search size={18} color={colors.muted} /><TextInput accessibilityLabel="Search members" placeholder="Search name or mobile" value={search} onChangeText={setSearch} autoCapitalize="none" style={{ flex: 1, minHeight: 51, fontFamily: fonts.regular, color: colors.ink }} /></View><SelectField label="Committee filter" value={committeeFilter} options={[{ value: '', label: 'All assigned committees' }, ...available.map(c => ({ value: c.id, label: c.name }))]} onChange={setCommitteeFilter} />
      {!!storageError && <View style={ui.card}><Text style={ui.error}>{storageError}</Text><ActionButton title="Retry loading members" secondary onPress={loadMembers} /></View>}
    </View>}
    ListEmptyComponent={loading ? <ActivityIndicator color={colors.purple} /> : <View style={ui.card}><Text style={ui.heading}>{search ? 'No matching members' : 'No approved members yet'}</Text><Text style={ui.body}>Add a member or approve a committee request to include them here.</Text></View>}
    ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={'View ' + item.name} onPress={() => setSelected(item)} style={[ui.card, ui.row, { padding: 16 }]}><PersonPhoto personId={item.personId} path={item.photoPaths[0]} name={item.name} /><View style={{ flex: 1, gap: 5 }}><Text style={ui.heading}>{item.name}</Text><Text style={ui.body}>+91 {item.mobile} · {item.taluka}</Text><Text style={ui.body}>{item.activeCommitteeIds.map(id => committees.find(c => c.id === id)?.name).filter(Boolean).join(' · ')}</Text></View></Pressable>}
    ListFooterComponent={<View style={{ marginTop: 16 }}>{loadingMore ? <ActivityIndicator color={colors.purple} /> : nextCursor ? <ActionButton title="Load more members" secondary onPress={() => void loadMore()} /> : !!members.length && <Text style={ui.body}>All {members.length} matching members shown.</Text>}</View>}
  />{selected && <MemberDetails member={selected} onClose={() => setSelected(null)} />}</View>;
}
