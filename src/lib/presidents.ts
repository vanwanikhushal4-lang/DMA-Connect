export const presidentRoles = [
  { value: 'district', label: 'District president', description: 'Represent your district' },
  { value: 'taluka', label: 'Taluka president', description: 'Represent your taluka' },
  { value: 'city', label: 'City president', description: 'Represent your city' },
  { value: 'ward', label: 'Ward president', description: 'Represent your ward' },
  { value: 'village', label: 'Village president', description: 'Represent your village' },
  { value: 'cell', label: 'Cell president', description: 'Represent your foundation cell' },
] as const;

export type PresidentRole = typeof presidentRoles[number]['value'] | 'admin';
export type PresidentDraft = {
  name: string; email: string; mobile: string; role: PresidentRole | '';
  district: string; taluka: string; locality: string; cell: string;
};
export type President = PresidentDraft & { uid: string; createdAt: string };
export const emptyPresident: PresidentDraft = { name: '', email: '', mobile: '', role: '', district: '', taluka: '', locality: '', cell: '' };

export function roleLabel(role: string) {
  if (role === 'admin') return 'Administrator';
  return presidentRoles.find(item => item.value === role)?.label || 'President';
}
export function needsTaluka(role: string) { return ['taluka', 'ward', 'village'].includes(role); }
export function localityLabel(role: string) { return role === 'ward' ? 'Ward' : role === 'village' ? 'Village' : 'City'; }
export function presidentArea(profile: PresidentDraft) { return [profile.locality || profile.cell || profile.taluka, profile.district].filter(Boolean).join(', '); }

export function validatePresident(draft: PresidentDraft, password: string, confirm: string, completingProfile = false) {
  const errors: Partial<Record<keyof PresidentDraft | 'password' | 'confirm', string>> = {};
  if (!draft.name.trim() || draft.name.trim().length > 120) errors.name = 'Enter your full name (up to 120 characters).';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()) || draft.email.length > 254) errors.email = 'Enter a valid email address.';
  if (!/^[6-9]\d{9}$/.test(draft.mobile)) errors.mobile = 'Enter a valid 10-digit mobile number.';
  if (!presidentRoles.some(role => role.value === draft.role)) errors.role = 'Choose your president role.';
  if (!draft.district.trim() || draft.district.length > 100) errors.district = 'Enter your district (up to 100 characters).';
  if (needsTaluka(draft.role) && (!draft.taluka.trim() || draft.taluka.length > 100)) errors.taluka = 'Enter your taluka (up to 100 characters).';
  if (['city', 'ward', 'village'].includes(draft.role) && (!draft.locality.trim() || draft.locality.length > 100)) errors.locality = `Enter your ${localityLabel(draft.role).toLowerCase()} (up to 100 characters).`;
  if (draft.role === 'cell' && (!draft.cell.trim() || draft.cell.length > 100)) errors.cell = 'Enter your cell name (up to 100 characters).';
  if (!completingProfile && password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!completingProfile && password !== confirm) errors.confirm = 'Your passwords don’t match.';
  return errors;
}
