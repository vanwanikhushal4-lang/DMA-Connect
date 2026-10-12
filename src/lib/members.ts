export type MemberDraft = {
  name: string;
  email: string;
  mobile: string;
  residence: string;
  dob: string;
  taluka: string;
};

export type Member = MemberDraft & { id: string; createdAt: string };
export type FieldErrors = Partial<Record<keyof MemberDraft, string>>;
export const emptyDraft: MemberDraft = { name: '', email: '', mobile: '', residence: '', dob: '', taluka: '' };

export function normalizeMobile(value: string): string {
  const digits = value.replace(/\D/g, '');
  return digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits;
}

export function formatDobInput(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 4) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

export function parseDob(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match.map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function normalizeDraft(draft: MemberDraft): MemberDraft {
  return {
    name: draft.name.trim().replace(/\s+/g, ' '), email: draft.email.trim().toLowerCase(),
    mobile: normalizeMobile(draft.mobile), residence: draft.residence.trim(),
    dob: draft.dob.trim(), taluka: draft.taluka.trim(),
  };
}

export function validateMember(draft: MemberDraft, members: Member[], today = new Date()): FieldErrors {
  const value = normalizeDraft(draft);
  const errors: FieldErrors = {};
  if (!value.name) errors.name = 'Please enter the member’s name.';
  else if (value.name.length > 120) errors.name = 'Use up to 120 characters for the name.';
  if (value.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) errors.email = 'Please enter a valid email address.';
  else if (value.email.length > 254) errors.email = 'Use up to 254 characters for the email.';
  if (!/^[6-9]\d{9}$/.test(value.mobile)) {
    errors.mobile = 'Please enter a valid 10-digit mobile number.';
  } else if (members.some(member => normalizeMobile(member.mobile) === value.mobile)) {
    errors.mobile = 'A member with this mobile number has already been added.';
  }
  if (!value.residence) errors.residence = 'Please enter the member’s residence.';
  else if (value.residence.length > 500) errors.residence = 'Use up to 500 characters for the residence.';
  const dob = parseDob(value.dob);
  const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  if (!dob || dob.getFullYear() < 1900) {
    errors.dob = 'Enter a real date as DD/MM/YYYY (1900 or later).';
  } else if (dob > endOfToday) {
    errors.dob = 'Date of birth cannot be in the future.';
  }
  if (!value.taluka) errors.taluka = 'Please enter the member’s taluka.';
  else if (value.taluka.length > 100) errors.taluka = 'Use up to 100 characters for the taluka.';
  return errors;
}

export function isMemberList(value: unknown): value is Member[] {
  if (!Array.isArray(value)) return false;
  const keys = [...Object.keys(emptyDraft), 'id', 'createdAt'];
  return value.every(item => item !== null && typeof item === 'object'
    && keys.every(key => typeof item[key] === 'string') && !Number.isNaN(Date.parse(item.createdAt)));
}
