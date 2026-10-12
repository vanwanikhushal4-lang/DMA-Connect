import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  CalendarDays,
  Download,
  Edit2,
  Mail,
  MapPin,
  Phone,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserRoundPlus,
  UsersRound,
  X,
} from 'lucide-react-native';
import { useAdmin } from '../context/AdminContext';
import type { AdminMember } from '../services/admin';
import type { President, PresidentRole } from '../lib/presidents';
import { presidentRoles, roleLabel } from '../lib/presidents';
import { colors, fonts } from '../theme';
import { ActionButton } from './ActionButton';
import { MemberField } from './MemberField';
import { SelectField } from './SelectField';

type AdminTab = 'presidents' | 'members';

export function AdminConsole({ onClose }: { onClose?: () => void }) {
  const { width } = useWindowDimensions();
  const compact = width < 768;
  const {
    presidents,
    members,
    loading,
    error,
    stats,
    updatePresidentRole,
    deletePresident,
    updateMember,
    deleteMember,
    exportCSV,
    retry,
  } = useAdmin();

  const [activeTab, setActiveTab] = useState<AdminTab>('presidents');
  const [search, setSearch] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [exporting, setExporting] = useState(false);

  // Modals state
  const [editingPresident, setEditingPresident] = useState<President | null>(null);
  const [presidentDraftRole, setPresidentDraftRole] = useState<PresidentRole>('district');
  const [presidentDraftDistrict, setPresidentDraftDistrict] = useState('');
  const [presidentDraftTaluka, setPresidentDraftTaluka] = useState('');
  const [presidentDraftLocality, setPresidentDraftLocality] = useState('');
  const [presidentDraftCell, setPresidentDraftCell] = useState('');
  const [presidentBusy, setPresidentBusy] = useState(false);

  const [editingMember, setEditingMember] = useState<AdminMember | null>(null);
  const [memberDraftName, setMemberDraftName] = useState('');
  const [memberDraftEmail, setMemberDraftEmail] = useState('');
  const [memberDraftResidence, setMemberDraftResidence] = useState('');
  const [memberDraftTaluka, setMemberDraftTaluka] = useState('');
  const [memberDraftDob, setMemberDraftDob] = useState('');
  const [memberBusy, setMemberBusy] = useState(false);

  const [targetPresidentFilter, setTargetPresidentFilter] = useState<string | null>(null);

  // Compute members count per president
  const membersByPresident = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach(m => {
      map.set(m.presidentUid, (map.get(m.presidentUid) || 0) + 1);
    });
    return map;
  }, [members]);

  // Filtered Presidents
  const filteredPresidents = useMemo(() => {
    return presidents.filter(p => {
      if (selectedRoleFilter !== 'all' && p.role !== selectedRoleFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.mobile.includes(q) ||
        (p.district && p.district.toLowerCase().includes(q)) ||
        (p.taluka && p.taluka.toLowerCase().includes(q))
      );
    });
  }, [presidents, selectedRoleFilter, search]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    return members.filter(m => {
      if (targetPresidentFilter && m.presidentUid !== targetPresidentFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.mobile.includes(q) ||
        (m.taluka && m.taluka.toLowerCase().includes(q)) ||
        (m.residence && m.residence.toLowerCase().includes(q)) ||
        (m.presidentName && m.presidentName.toLowerCase().includes(q))
      );
    });
  }, [members, targetPresidentFilter, search]);

  const handleExport = async () => {
    try {
      setExporting(true);
      await exportCSV();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Export failed';
      Alert.alert('Export Error', msg);
    } finally {
      setExporting(false);
    }
  };

  const openEditPresident = (p: President) => {
    setEditingPresident(p);
    setPresidentDraftRole((p.role as PresidentRole) || 'district');
    setPresidentDraftDistrict(p.district || '');
    setPresidentDraftTaluka(p.taluka || '');
    setPresidentDraftLocality(p.locality || '');
    setPresidentDraftCell(p.cell || '');
  };

  const handleSavePresident = async () => {
    if (!editingPresident) return;
    try {
      setPresidentBusy(true);
      await updatePresidentRole(editingPresident.uid, {
        role: presidentDraftRole,
        district: presidentDraftDistrict.trim(),
        taluka: presidentDraftTaluka.trim(),
        locality: presidentDraftLocality.trim(),
        cell: presidentDraftCell.trim(),
      });
      setEditingPresident(null);
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : 'Could not update president.');
    } finally {
      setPresidentBusy(false);
    }
  };

  const openEditMember = (m: AdminMember) => {
    setEditingMember(m);
    setMemberDraftName(m.name);
    setMemberDraftEmail(m.email || '');
    setMemberDraftResidence(m.residence);
    setMemberDraftTaluka(m.taluka);
    setMemberDraftDob(m.dob);
  };

  const handleSaveMember = async () => {
    if (!editingMember) return;
    try {
      setMemberBusy(true);
      await updateMember(editingMember.presidentUid, editingMember.mobile, {
        name: memberDraftName.trim(),
        email: memberDraftEmail.trim().toLowerCase(),
        residence: memberDraftResidence.trim(),
        taluka: memberDraftTaluka.trim(),
        dob: memberDraftDob.trim(),
      });
      setEditingMember(null);
    } catch (e) {
      Alert.alert('Update Failed', e instanceof Error ? e.message : 'Could not update member.');
    } finally {
      setMemberBusy(false);
    }
  };

  const confirmDeleteMember = (m: AdminMember) => {
    const doDelete = async () => {
      try {
        await deleteMember(m.presidentUid, m.mobile);
      } catch (e) {
        Alert.alert('Delete Failed', e instanceof Error ? e.message : 'Could not delete member.');
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm(`Are you sure you want to delete member ${m.name} (${m.mobile})?`)) {
        void doDelete();
      }
    } else {
      Alert.alert(
        'Delete Member',
        `Are you sure you want to delete ${m.name} (+91 ${m.mobile})? This cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
        ],
      );
    }
  };

  // On phones (height < 700 or compact width) the fixed sections already overflow
  // the screen so the inner list ScrollView gets 0 height. Use a single flat
  // ScrollView for the whole page on mobile; keep flex-based layout on tablet/web.
  const { height: screenHeight } = Dimensions.get('window');
  const useFlatScroll = compact || screenHeight < 700;

  // ── Shared sections (rendered as children in both layout modes) ─────────────
  const topBanner = (
    <View style={styles.topBanner}>
      <View style={styles.bannerLeft}>
        <View style={styles.badgeRow}>
          <View style={styles.adminBadge}>
            <ShieldCheck size={14} color={colors.purple} />
            <Text style={styles.adminBadgeText}>Administrator Mode</Text>
          </View>
          {targetPresidentFilter && (
            <Pressable
              onPress={() => setTargetPresidentFilter(null)}
              style={styles.filterChip}
            >
              <Text style={styles.filterChipText}>Filtered by President</Text>
              <X size={12} color={colors.purple} />
            </Pressable>
          )}
        </View>
        <Text style={styles.bannerTitle}>Foundation Control Center</Text>
        <Text style={styles.bannerSubtitle}>
          Overview and management across all organizational tiers and member registries.
        </Text>
      </View>
      <View style={styles.bannerActions}>
        <Pressable
          accessibilityRole="button"
          onPress={handleExport}
          disabled={exporting || members.length === 0}
          style={[styles.exportButton, (exporting || members.length === 0) && { opacity: 0.6 }]}
        >
          {exporting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Download size={16} color={colors.white} />
              <Text style={styles.exportButtonText}>Export CSV</Text>
            </>
          )}
        </Pressable>
        {onClose && (
          <Pressable accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <X size={20} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );

  const statsGrid = (
    <View style={[styles.statsGrid, compact && styles.statsGridCompact]}>
      <View style={[styles.statCard, compact && styles.statCardCompact]}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>Total Members</Text>
          <View style={styles.statIcon}><UsersRound size={16} color={colors.purple} /></View>
        </View>
        <Text style={styles.statValue}>{stats.totalMembers}</Text>
        <Text style={styles.statNote}>Across all presidents</Text>
      </View>
      <View style={[styles.statCard, compact && styles.statCardCompact]}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>Active Presidents</Text>
          <View style={styles.statIcon}><UserCheck size={16} color={colors.purple} /></View>
        </View>
        <Text style={styles.statValue}>{stats.totalPresidents}</Text>
        <Text style={styles.statNote}>All leadership roles</Text>
      </View>
      <View style={[styles.statCard, compact && styles.statCardCompact]}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>Registrations Today</Text>
          <View style={styles.statIcon}><UserRoundPlus size={16} color={colors.purple} /></View>
        </View>
        <Text style={styles.statValue}>{stats.membersToday}</Text>
        <Text style={styles.statNote}>Foundation-wide today</Text>
      </View>
      <View style={[styles.statCard, compact && styles.statCardCompact]}>
        <View style={styles.statHeader}>
          <Text style={styles.statTitle}>Regions Covered</Text>
          <View style={styles.statIcon}><MapPin size={16} color={colors.purple} /></View>
        </View>
        <Text style={styles.statValue}>{stats.talukasCount} Talukas</Text>
        <Text style={styles.statNote}>{stats.districtsCount} Districts represented</Text>
      </View>
    </View>
  );

  const navRow = (
    <View style={[styles.navRow, compact && styles.navRowCompact]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.tabsContainer}>
          <Pressable
            accessibilityRole="tab"
            onPress={() => { setActiveTab('presidents'); setTargetPresidentFilter(null); }}
            style={[styles.tabButton, activeTab === 'presidents' && styles.tabButtonActive]}
          >
            <UserRound size={16} color={activeTab === 'presidents' ? colors.purple : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'presidents' && styles.tabTextActive]}>
              Presidents ({presidents.length})
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            onPress={() => setActiveTab('members')}
            style={[styles.tabButton, activeTab === 'members' && styles.tabButtonActive]}
          >
            <UsersRound size={16} color={activeTab === 'members' ? colors.purple : colors.muted} />
            <Text style={[styles.tabText, activeTab === 'members' && styles.tabTextActive]}>
              All Members ({members.length})
            </Text>
          </Pressable>
        </View>
      </ScrollView>
      <View style={[styles.searchBox, compact && styles.searchBoxFull]}>
        <Search size={16} color={colors.placeholder} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={activeTab === 'presidents' ? 'Search name, area, mobile...' : 'Search name, phone, taluka...'}
          placeholderTextColor={colors.placeholder}
          style={styles.searchInput}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')}>
            <X size={15} color={colors.muted} />
          </Pressable>
        )}
      </View>
    </View>
  );

  const filterPills = activeTab === 'presidents' && (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
      <Pressable
        onPress={() => setSelectedRoleFilter('all')}
        style={[styles.rolePill, selectedRoleFilter === 'all' && styles.rolePillActive]}
      >
        <Text style={[styles.rolePillText, selectedRoleFilter === 'all' && styles.rolePillTextActive]}>
          All Roles ({presidents.length})
        </Text>
      </Pressable>
      {presidentRoles.map(r => {
        const count = presidents.filter(p => p.role === r.value).length;
        return (
          <Pressable
            key={r.value}
            onPress={() => setSelectedRoleFilter(r.value)}
            style={[styles.rolePill, selectedRoleFilter === r.value && styles.rolePillActive]}
          >
            <Text style={[styles.rolePillText, selectedRoleFilter === r.value && styles.rolePillTextActive]}>
              {r.label} ({count})
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );

  // List items rendered inline (no nested ScrollView in flat mode)
  const listItems = loading ? (
    <View style={[styles.loadingBox, useFlatScroll && { minHeight: 200 }]}>
      <ActivityIndicator size="large" color={colors.purple} />
      <Text style={styles.loadingText}>Syncing organization database...</Text>
    </View>
  ) : error ? (
    <View style={styles.errorBox}>
      <Text style={styles.errorText}>{error}</Text>
      <ActionButton title="Retry" secondary onPress={retry} />
    </View>
  ) : activeTab === 'presidents' ? (
    <View style={useFlatScroll ? styles.listContentFlat : undefined}>
      {filteredPresidents.length === 0 ? (
        <View style={styles.emptyView}>
          <Text style={styles.emptyTitle}>No presidents found</Text>
          <Text style={styles.emptyText}>Try adjusting your search query or role filter.</Text>
        </View>
      ) : (
        filteredPresidents.map(p => {
          const count = membersByPresident.get(p.uid) || 0;
          const area = [p.locality || p.cell || p.taluka, p.district].filter(Boolean).join(', ');
          return (
            <View key={p.uid} style={styles.cardItem}>
              <View style={styles.cardMain}>
                <View style={styles.cardAvatar}>
                  <Text style={styles.avatarInitials}>{p.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.cardTitleRow}>
                    <Text style={styles.cardTitle}>{p.name}</Text>
                    <View style={styles.roleTag}><Text style={styles.roleTagText}>{roleLabel(p.role)}</Text></View>
                  </View>
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}><Mail size={13} color={colors.muted} /><Text style={styles.metaText}>{p.email}</Text></View>
                    <View style={styles.metaItem}><Phone size={13} color={colors.muted} /><Text style={styles.metaText}>+91 {p.mobile}</Text></View>
                    {!!area && <View style={styles.metaItem}><MapPin size={13} color={colors.muted} /><Text style={styles.metaText}>{area}</Text></View>}
                  </View>
                </View>
              </View>
              <View style={styles.cardRight}>
                <View style={styles.countBadge}>
                  <Text style={styles.countNumber}>{count}</Text>
                  <Text style={styles.countLabel}>members</Text>
                </View>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => { setTargetPresidentFilter(p.uid); setActiveTab('members'); }}
                    style={styles.iconBtn}
                    accessibilityLabel="View registered members"
                  >
                    <UsersRound size={16} color={colors.purple} />
                  </Pressable>
                  <Pressable onPress={() => openEditPresident(p)} style={styles.iconBtn} accessibilityLabel="Edit president role">
                    <Edit2 size={16} color={colors.purple} />
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  ) : (
    <View style={useFlatScroll ? styles.listContentFlat : undefined}>
      {filteredMembers.length === 0 ? (
        <View style={styles.emptyView}>
          <Text style={styles.emptyTitle}>No members found</Text>
          <Text style={styles.emptyText}>
            {targetPresidentFilter
              ? 'This president has not registered any members yet.'
              : 'Try searching for another name, phone number, or taluka.'}
          </Text>
        </View>
      ) : (
        filteredMembers.map(m => (
          <View key={`${m.presidentUid}-${m.mobile}`} style={styles.cardItem}>
            <View style={styles.cardMain}>
              <View style={[styles.cardAvatar, { backgroundColor: '#EDE7F6' }]}>
                <Text style={[styles.avatarInitials, { color: colors.purple }]}>{m.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.cardTitleRow}>
                  <Text style={styles.cardTitle}>{m.name}</Text>
                  <Text style={styles.cardPhone}>+91 {m.mobile}</Text>
                </View>
                <View style={styles.metaRow}>
                  <View style={styles.metaItem}><MapPin size={13} color={colors.muted} /><Text style={styles.metaText}>{m.taluka} {m.residence ? `• ${m.residence}` : ''}</Text></View>
                  <View style={styles.metaItem}><UserRound size={13} color={colors.muted} /><Text style={styles.metaText}>Added by {m.presidentName || 'President'} ({roleLabel(m.presidentRole || '')})</Text></View>
                </View>
              </View>
            </View>
            <View style={styles.cardRight}>
              <Text style={styles.memberDobText}>DOB: {m.dob}</Text>
              <View style={styles.actionRow}>
                <Pressable onPress={() => openEditMember(m)} style={styles.iconBtn} accessibilityLabel="Edit member">
                  <Edit2 size={16} color={colors.purple} />
                </Pressable>
                <Pressable onPress={() => confirmDeleteMember(m)} style={[styles.iconBtn, { backgroundColor: '#FDF2F4' }]} accessibilityLabel="Delete member">
                  <Trash2 size={16} color={colors.error} />
                </Pressable>
              </View>
            </View>
          </View>
        ))
      )}
    </View>
  );

  // Modals — declared before returns so both branches can reference them
  const editModals = (
    <>
      {editingPresident && (
        <Modal transparent animationType="fade" onRequestClose={() => setEditingPresident(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit President Role</Text>
                <Pressable onPress={() => setEditingPresident(null)}>
                  <X size={20} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>
                Updating role and territory for {editingPresident.name} ({editingPresident.email})
              </Text>
              <ScrollView style={{ maxHeight: 380, marginVertical: 12 }}>
                <SelectField
                  label="Role"
                  value={presidentDraftRole}
                  options={[
                    ...presidentRoles,
                    { value: 'admin', label: 'Administrator', description: 'Full access to all accounts' },
                  ]}
                  placeholder="Select role"
                  onChange={v => setPresidentDraftRole(v as PresidentRole)}
                />
                <MemberField label="District" icon={MapPin} value={presidentDraftDistrict} onChangeText={setPresidentDraftDistrict} placeholder="Enter district" />
                <MemberField label="Taluka" icon={MapPin} value={presidentDraftTaluka} onChangeText={setPresidentDraftTaluka} placeholder="Enter taluka" />
                <MemberField label="Locality / Ward / Village / City" icon={MapPin} value={presidentDraftLocality} onChangeText={setPresidentDraftLocality} placeholder="Enter locality" />
                <MemberField label="Cell (if applicable)" icon={UserRound} value={presidentDraftCell} onChangeText={setPresidentDraftCell} placeholder="e.g. OBC Cell" />
              </ScrollView>
              <View style={styles.modalActions}>
                <Pressable
                  onPress={() => {
                    if (editingPresident) {
                      const doDel = async () => {
                        try { await deletePresident(editingPresident.uid); setEditingPresident(null); }
                        catch (err) { Alert.alert('Delete Failed', err instanceof Error ? err.message : 'Could not delete president.'); }
                      };
                      if (Platform.OS === 'web') {
                        if (window.confirm(`Delete president ${editingPresident.name}?`)) void doDel();
                      } else {
                        Alert.alert('Delete President', `Delete ${editingPresident.name}?`, [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => void doDel() },
                        ]);
                      }
                    }
                  }}
                  style={[styles.iconBtn, { backgroundColor: '#FDF2F4', marginRight: 'auto' }]}
                  accessibilityLabel="Delete president"
                >
                  <Trash2 size={16} color={colors.error} />
                </Pressable>
                <ActionButton title="Cancel" secondary onPress={() => setEditingPresident(null)} disabled={presidentBusy} />
                <ActionButton title="Save Changes" onPress={handleSavePresident} busy={presidentBusy} />
              </View>
            </View>
          </View>
        </Modal>
      )}
      {editingMember && (
        <Modal transparent animationType="fade" onRequestClose={() => setEditingMember(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Edit Member Details</Text>
                <Pressable onPress={() => setEditingMember(null)}>
                  <X size={20} color={colors.muted} />
                </Pressable>
              </View>
              <Text style={styles.modalSubtitle}>Update details for member +91 {editingMember.mobile}</Text>
              <ScrollView style={{ maxHeight: 380, marginVertical: 12 }}>
                <MemberField label="Full Name" icon={UserRound} value={memberDraftName} onChangeText={setMemberDraftName} placeholder="Enter member name" />
                <MemberField label="Email (optional)" icon={Mail} value={memberDraftEmail} onChangeText={setMemberDraftEmail} placeholder="Enter email" keyboardType="email-address" />
                <MemberField label="Taluka" icon={MapPin} value={memberDraftTaluka} onChangeText={setMemberDraftTaluka} placeholder="Enter taluka" />
                <MemberField label="Residence Address" icon={MapPin} value={memberDraftResidence} onChangeText={setMemberDraftResidence} placeholder="Enter residence" multiline />
                <MemberField label="Date of Birth (DD/MM/YYYY)" icon={CalendarDays} value={memberDraftDob} onChangeText={setMemberDraftDob} placeholder="DD/MM/YYYY" />
              </ScrollView>
              <View style={styles.modalActions}>
                <ActionButton title="Cancel" secondary onPress={() => setEditingMember(null)} disabled={memberBusy} />
                <ActionButton title="Save Member" onPress={handleSaveMember} busy={memberBusy} />
              </View>
            </View>
          </View>
        </Modal>
      )}
    </>
  );

  // ── PHONE: single flat ScrollView ─────────────────────────────────────────
  if (useFlatScroll) {
    return (
      <View style={styles.container}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.flatScrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {topBanner}
          {statsGrid}
          {navRow}
          {filterPills}
          <View style={styles.listContentFlat}>{listItems}</View>
        </ScrollView>
        {editModals}
      </View>
    );
  }

  // ── TABLET / WEB: flex layout with inner list ScrollView ──────────────────
  return (
    <View style={styles.container}>
      {topBanner}
      {statsGrid}
      {navRow}
      {filterPills}
      <ScrollView style={styles.listArea} contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
        {listItems}
      </ScrollView>
      {editModals}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  topBanner: {
    backgroundColor: colors.white,
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 16,
  },
  bannerLeft: {
    maxWidth: 680,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.lavender,
    borderColor: colors.lavenderBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  adminBadgeText: {
    fontFamily: fonts.semibold,
    color: colors.purple,
    fontSize: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAE6F3',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  filterChipText: {
    fontFamily: fonts.medium,
    color: colors.purple,
    fontSize: 11,
  },
  bannerTitle: {
    fontFamily: fonts.bold,
    fontSize: 22,
    color: colors.ink,
    letterSpacing: -0.3,
  },
  bannerSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 4,
  },
  bannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.purple,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  exportButtonText: {
    fontFamily: fonts.semibold,
    color: colors.white,
    fontSize: 13,
  },
  closeButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: colors.lavender,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 14,
  },
  statCard: {
    flex: 1,
    minWidth: 180,
    backgroundColor: colors.white,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statCardCompact: {
    minWidth: '46%',
  },
  statsGridCompact: {
    paddingVertical: 12,
    gap: 10,
  },
  navRowCompact: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 10,
  },
  searchBoxFull: {
    minWidth: 0,
    width: '100%',
  },
  flatScrollContent: {
    paddingBottom: 40,
  },
  listContentFlat: {
    paddingHorizontal: 16,
    gap: 10,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  statTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 24,
    color: colors.ink,
  },
  statNote: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 10,
    flexWrap: 'wrap',
    gap: 14,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: colors.lavender,
  },
  tabText: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.muted,
  },
  tabTextActive: {
    fontFamily: fonts.semibold,
    color: colors.purple,
  },
  searchBox: {
    flex: 1,
    minWidth: 260,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.ink,
  },
  filterScroll: {
    paddingHorizontal: 24,
    paddingBottom: 10,
    gap: 8,
  },
  rolePill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rolePillActive: {
    backgroundColor: colors.purple,
    borderColor: colors.purple,
  },
  rolePillText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.muted,
  },
  rolePillTextActive: {
    color: colors.white,
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    gap: 12,
  },
  cardItem: {
    backgroundColor: colors.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 14,
  },
  cardMain: {
    flex: 1,
    minWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.purple,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  cardTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    color: colors.ink,
  },
  cardPhone: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
  },
  roleTag: {
    backgroundColor: colors.lavender,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roleTagText: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    color: colors.purple,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
  },
  cardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  countBadge: {
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  countNumber: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.ink,
  },
  countLabel: {
    fontFamily: fonts.regular,
    fontSize: 10,
    color: colors.muted,
  },
  memberDobText: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.lavender,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 16,
    color: colors.ink,
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginTop: 6,
  },
  loadingBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontFamily: fonts.medium,
    color: colors.muted,
    fontSize: 13,
  },
  errorBox: {
    backgroundColor: '#FDF2F4',
    padding: 16,
    margin: 24,
    borderRadius: 12,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    fontFamily: fonts.medium,
    color: colors.error,
    fontSize: 13,
    textAlign: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(38,34,55,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontFamily: fonts.bold,
    fontSize: 18,
    color: colors.ink,
  },
  modalSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
});
