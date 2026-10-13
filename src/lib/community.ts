export type CommitteeLevel = 'state' | 'district' | 'taluka' | 'ward' | 'local' | 'cell';
export type Committee = {
  id: string; name: string; level: CommitteeLevel; branch: 'state' | 'district' | 'area' | 'cell';
  parentId: string; areaId: string; ancestorIds: string[]; presidentUid: string;
  presidentName?: string; pendingInvitationId?: string; active: boolean; teamId: string; appointmentTeamId: string; makerUid?: string; checkerUid?: string; makerName?: string; checkerName?: string; pendingMakerInvitationId?: string; pendingCheckerInvitationId?: string;
};
export type Account = {
  uid: string; personId: string; role: 'superadmin' | 'president' | 'member' | 'maker' | 'checker';
  level: CommitteeLevel | 'member'; committeeId: string; parentCommitteeId: string;
  status: 'active' | 'suspended'; phoneNumber: string; districtId: string; createdBy: string; createdAt: string;
};
export type PersonDraft = {
  name: string; email: string; mobile: string; residence: string; dob: string; areaId: string;
  socials: { facebook: string; linkedin: string; instagram: string };
  photoPaths: string[]; birthdayEmailsEnabled: boolean;
};
export type Person = PersonDraft & {
  id: string; personId: string; accountUid: string; phoneNumber: string; taluka: string;
  activeMember: boolean; activeScopeIds: string[]; activeCommitteeIds: string[]; createdAt: string;
};
export type Affiliation = { id: string; personId: string; accountUid: string; committeeId: string; committeeName: string; branch: 'area' | 'cell'; status: 'active' | 'left' | 'suspended'; createdAt: string };
export type AffiliationRequest = { id: string; personId: string; applicantUid: string; applicantName: string; committeeId: string; committeeName: string; branch: 'area' | 'cell'; status: 'pending' | 'approved' | 'declined' | 'withdrawn'; reason: string; createdAt: string };
export type Invitation = { id: string; name: string; email: string; phoneNumber: string; role: 'president' | 'member' | 'maker' | 'checker'; level: CommitteeLevel | 'member'; committeeId: string; committeeName: string; expiresAt: string; status: string };
export const emptyPerson: PersonDraft = { name: '', email: '', mobile: '', residence: '', dob: '', areaId: '', socials: { facebook: '', linkedin: '', instagram: '' }, photoPaths: [], birthdayEmailsEnabled: true };
export function accountRole(account: Account | null) {
  if (!account) return 'Member';
  if (account.role === 'superadmin') return 'Super Admin';
  if (account.role === 'member') return 'Member';
  const levelName = ({ state: 'State', district: 'District', taluka: 'Taluka', ward: 'Ward', local: 'Village / local', cell: 'Cell', member: 'Member' })[account.level];
  if (account.role === 'maker' || account.role === 'checker') return levelName + ' ' + account.role;
  return ({ state: 'State president', taluka: 'Taluka president', ward: 'Ward president', local: 'Village / local president', cell: 'Cell president', district: 'District president', member: 'Member' })[account.level];
}
export function canCreatePresident(account: Account | null, committee: Committee) {
  return !!account && account.status === 'active' && account.role === 'maker' && committee.active && committee.appointmentTeamId === account.committeeId;
}
export const isMaker = (account: Account | null) => account?.status === 'active' && account.role === 'maker';
export const isChecker = (account: Account | null) => account?.status === 'active' && account.role === 'checker';
export function canReviewCommittee(account: Account | null, committee: Committee) {
  return isChecker(account) && committee.teamId === account?.committeeId;
}
export function committeePath(committee: Committee, catalogue: Committee[]) {
  return committee.ancestorIds.map(id => catalogue.find(c => c.id === id)?.name).filter(Boolean).join(' / ');
}
export type WorkItem = { id: string; operation: 'addMember' | 'createInvitation' | 'changeAppointment'; name: string; teamId: string; teamName: string; createdBy: string; createdByName: string; status: 'pending' | 'approved' | 'declined' | 'withdrawn'; reviewedBy: string; reviewedByName?: string; reason: string; createdAt: string; reviewedAt?: string; phoneNumber?: string; committeeId?: string; role?: string; payload?: Record<string, unknown> };
export function isStaff(account: Account | null) { return !!account && account.status === 'active' && account.role !== 'member'; }
export function toIsoDob(display: string) { const [d, m, y] = display.split('/'); return y && m && d ? `${y}-${m}-${d}` : display; }
export function displayDob(iso: string) { const [y, m, d] = iso.split('-'); return y && m && d ? `${d}/${m}/${y}` : iso; }
export function validatePerson(draft: PersonDraft) {
  const errors: Partial<Record<keyof PersonDraft, string>> = {};
  if (!draft.name.trim() || draft.name.trim().length > 120) errors.name = 'Enter a full name up to 120 characters.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim())) errors.email = 'Enter a valid email address.';
  if (!/^[6-9]\d{9}$/.test(draft.mobile)) errors.mobile = 'Enter a valid 10-digit Indian mobile number.';
  if (!draft.residence.trim() || draft.residence.length > 500) errors.residence = 'Enter a residence up to 500 characters.';
  const iso = toIsoDob(draft.dob), date = new Date(iso + 'T00:00:00Z');
  const todayIndia = new Date(Date.now() + 19800000).toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso || iso < '1900-01-01' || iso > todayIndia) errors.dob = 'Enter a valid date of birth that is not in the future.';
  if (!draft.areaId) errors.areaId = 'Choose a home area.';
  if (!draft.photoPaths.length) errors.photoPaths = 'Add a profile photograph.';
  for (const key of ['facebook', 'linkedin', 'instagram'] as const) {
    const value = draft.socials[key].trim();
    if (value && !(key === 'instagram' && /^@?[\w.]+$/.test(value))) {
      try { const url = new URL(value); if (url.protocol !== 'https:' || !url.hostname.endsWith(key === 'linkedin' ? 'linkedin.com' : key + '.com')) errors.socials = `Use a valid HTTPS ${key} profile link.`; } catch { errors.socials = `Use a valid HTTPS ${key} profile link.`; }
    }
  }
  return errors;
}
