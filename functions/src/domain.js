import { createHash } from 'node:crypto';

export const districtId = 'dma-district';
export const stateId = 'dma-state';
export const teamLevels = ['state', 'district', 'taluka'];
export const seatField = role => ({ president: 'presidentUid', maker: 'makerUid', checker: 'checkerUid' })[role];
export const pendingSeatField = role => ({ president: 'pendingInvitationId', maker: 'pendingMakerInvitationId', checker: 'pendingCheckerInvitationId' })[role];
export const areas = ['Belapur', 'Nerul', 'Vashi', 'Turbhe', 'Kopar Khairane', 'Ghansoli', 'Airoli', 'Digha'];
export const cells = ['OBC', 'Maratha', 'Muslim'];
export const slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
export const phoneKey = phone => createHash('sha256').update(phone).digest('hex');
export function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^[6-9]\d{9}$/.test(digits)) return '+91' + digits;
  if (/^91[6-9]\d{9}$/.test(digits)) return '+' + digits;
  throw new Error('Enter a valid Indian mobile number.');
}
export function seedCommittees(name = 'Navi Mumbai', stateName = 'Maharashtra') {
  const state = { id: stateId, name: stateName, level: 'state', branch: 'state', parentId: '', areaId: '', ancestorIds: [stateId], teamId: stateId, appointmentTeamId: stateId, presidentUid: '', active: true };
  const root = { id: districtId, name, level: 'district', branch: 'district', parentId: stateId, areaId: '', ancestorIds: [stateId, districtId], teamId: districtId, appointmentTeamId: stateId, presidentUid: '', active: true };
  return [state, root, ...areas.map(name => ({ id: 'area-' + slug(name), name, level: 'taluka', branch: 'area', parentId: districtId, areaId: 'area-' + slug(name), ancestorIds: [stateId, districtId, 'area-' + slug(name)], teamId: 'area-' + slug(name), appointmentTeamId: districtId, presidentUid: '', active: true })),
    ...cells.map(name => ({ id: 'cell-' + slug(name), name: name + ' Cell', level: 'cell', branch: 'cell', parentId: districtId, areaId: '', ancestorIds: [stateId, districtId, 'cell-' + slug(name)], teamId: districtId, appointmentTeamId: districtId, presidentUid: '', active: true }))];
}
export function canAppoint(actor, target) {
  return actor?.status === 'active' && actor.role === 'maker' && target?.active === true
    && teamLevels.includes(actor.level) && target.appointmentTeamId === actor.committeeId;
}
export function canReview(actor, committee) {
  return actor?.status === 'active' && actor.role === 'checker' && committee?.active === true
    && committee.teamId === actor.committeeId && committee.teamCheckerUid === actor.uid;
}
export function canViewScope(actor, committee) {
  return actor?.status === 'active' && (actor.role === 'superadmin' || (['president', 'maker', 'checker'].includes(actor.role) && committee.ancestorIds.includes(actor.committeeId)));
}
export function validateProfile(input, verifiedPhone, { photoRequired = true } = {}) {
  const clean = (key, max, required = true) => {
    if (typeof input[key] !== 'string') throw new Error('Please check ' + key + '.');
    const v = input[key].trim();
    if ((required && !v) || v.length > max) throw new Error('Please check ' + key + '.');
    return v;
  };
  const name = clean('name', 120).replace(/\s+/g, ' '), email = clean('email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const residence = clean('residence', 500), areaId = clean('areaId', 120), dob = clean('dob', 10);
  const [year, month, day] = dob.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || dob > indiaDate().date) throw new Error('Enter a real date of birth that is not in the future.');
  const socials = {};
  for (const key of ['facebook', 'linkedin', 'instagram']) {
    const value = input.socials?.[key];
    if (typeof value !== 'string' || value.length > 300) throw new Error('Please check your ' + key + ' profile.');
    let v = value.trim();
    if (key === 'instagram' && /^@?[\w.]+$/.test(v) && v) v = 'https://www.instagram.com/' + v.replace(/^@/, '') + '/';
    if (v) {
      let url;
      try { url = new URL(v); } catch { throw new Error('Enter a full ' + key + ' profile link.'); }
      const domains = { facebook: ['facebook.com', 'fb.com'], linkedin: ['linkedin.com'], instagram: ['instagram.com'] }[key];
      if (url.protocol !== 'https:' || url.username || url.password || !domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain))) throw new Error('Use an HTTPS ' + key + ' profile link.');
      v = url.href;
    }
    socials[key] = v;
  }
  if (!Array.isArray(input.photoPaths) || input.photoPaths.length > 3 || (photoRequired && !input.photoPaths.length) || input.photoPaths.some(p => typeof p !== 'string' || p.length > 500)) throw new Error('Add a profile photograph, with up to two extra photos.');
  if (typeof input.birthdayEmailsEnabled !== 'boolean') throw new Error('Choose your birthday email preference.');
  return { name, nameSearch: name.toLocaleLowerCase('en-IN'), email, residence, areaId, dob, mobile: verifiedPhone.slice(3), phoneNumber: verifiedPhone, socials, photoPaths: input.photoPaths, birthdayKey: dob.slice(5), birthdayEmailsEnabled: input.birthdayEmailsEnabled };
}
export function indiaDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = type => parts.find(p => p.type === type)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, birthdayKey: `${get('month')}-${get('day')}`, year: get('year'), hour: Number(get('hour')) };
}
export const birthdayDeliveryId = (personId, year) => `${personId}_${year}`;
export function birthdayDue(person, date) {
  // February 29 greetings are sent on February 28 in non-leap years.
  const year = Number(date.year), leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return person.activeMember === true && person.birthdayEmailsEnabled === true && person.photoPaths?.length > 0
    && (person.birthdayKey === date.birthdayKey || (!leap && date.birthdayKey === '02-28' && person.birthdayKey === '02-29'));
}
export function birthdayMessage(person) {
  const escape = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = escape(person.name);
  return {
    subject: `Happy birthday, ${person.name}!`,
    text: `Dear ${person.name},\n\nWishing you a very happy birthday and a wonderful year ahead.\n\nWith warm wishes,\nDr. Mangesh Amale Foundation\nDMA Connect`,
    html: `<!doctype html><html><body style="margin:0;padding:28px;background:#f8f6fa;font-family:Arial,sans-serif;color:#262237"><table role="presentation" style="width:100%;max-width:540px;margin:auto;background:#fff;border-radius:16px"><tr><td style="padding:36px;text-align:center"><img src="cid:dma-logo" width="72" alt="Dr. Mangesh Amale Foundation"><p style="font-size:12px;color:#777282">DR. MANGESH AMALE FOUNDATION</p><h1 style="font-size:30px;color:#38206c">Happy birthday, ${name}!</h1><img src="cid:member-photo" width="180" alt="Your photograph" style="border-radius:16px;max-width:100%"><p style="font-size:16px;line-height:26px">Wishing you a wonderful birthday and a year filled with happiness and good health.</p><p style="font-size:14px;line-height:22px">With warm wishes,<br><strong>Dr. Mangesh Amale Foundation</strong><br>DMA Connect</p><p style="font-size:11px;color:#777282">You can turn birthday greetings off in your DMA Connect profile.</p></td></tr></table></body></html>`,
  };
}
