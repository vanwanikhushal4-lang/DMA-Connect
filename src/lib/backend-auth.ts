import type { PersonDraft } from './community';
import { toIsoDob, validatePerson } from './community.ts';

export type ApiCommittee = {
  committeeId: number; name: string; level: string; active: boolean;
  parentId?: number | null; branch?: string | null; homeAreaName?: string | null;
};
export type EmailLoginResponse = { token: string; userId: number; name: string; expiresIn: number };
export type BackendSession = EmailLoginResponse & { email: string; expiresAt: number; apiUrl: string };
export type CreateUserPayload = Omit<PersonDraft, 'areaId'> & { areaId: number; password: string };
export type CreateUserResponse = { userId: number; emailNeedsVerification: boolean };

export function signupAreas(committees: ApiCommittee[]) {
  return committees.filter(c => c.active && c.level === 'area').sort((a, b) => a.name.localeCompare(b.name));
}

export function createUserPayload(draft: PersonDraft, password: string, committees: ApiCommittee[]): CreateUserPayload {
  const errors = validatePerson(draft, { requirePhoto: false });
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const area = signupAreas(committees).find(c => String(c.committeeId) === draft.areaId);
  if (!area) throw new Error('Choose an active home area from the list.');
  if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
  return {
    name: draft.name.trim(), email: draft.email.trim().toLowerCase(), mobile: draft.mobile,
    residence: draft.residence.trim(), dob: toIsoDob(draft.dob), areaId: area.committeeId,
    socials: { facebook: draft.socials.facebook.trim(), linkedin: draft.socials.linkedin.trim(), instagram: draft.socials.instagram.trim() },
    photoPaths: [...draft.photoPaths], birthdayEmailsEnabled: draft.birthdayEmailsEnabled, password,
  };
}

export function backendSession(result: EmailLoginResponse, email: string, apiUrl: string, now = Date.now()): BackendSession {
  if (!result || typeof result.token !== 'string' || !result.token || !Number.isSafeInteger(result.userId) || result.userId <= 0 || typeof result.name !== 'string' || !Number.isFinite(result.expiresIn) || result.expiresIn <= 0) {
    throw new Error('The server returned an invalid login response.');
  }
  return { token: result.token, userId: result.userId, name: result.name, expiresIn: result.expiresIn, email: email.trim().toLowerCase(), apiUrl, expiresAt: now + result.expiresIn * 1000 };
}

export function restoreBackendSession(value: string | null, apiUrl: string, now = Date.now()): BackendSession | null {
  if (!value) return null;
  try {
    const saved = JSON.parse(value) as BackendSession;
    if (saved.apiUrl !== apiUrl || typeof saved.email !== 'string' || !Number.isFinite(saved.expiresAt) || saved.expiresAt <= now) return null;
    backendSession(saved, saved.email, apiUrl, now);
    return saved;
  } catch { return null; }
}
