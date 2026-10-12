import type { Member } from './members';

export type Period = 'week' | 'month' | 'all';
export const periodOptions = [{ value: 'week', label: '7 days' }, { value: 'month', label: '30 days' }, { value: 'all', label: 'All time' }] as const;
export function dayKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
export function periodStart(period: Period, today: Date) {
  if (period === 'all') return new Date(0);
  return new Date(today.getFullYear(), today.getMonth(), today.getDate() - (period === 'week' ? 6 : 29));
}
export function filterPeriod(members: Member[], period: Period, today = new Date()) {
  const start = periodStart(period, today);
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  return members.filter(member => { const created = new Date(member.createdAt); return created >= start && created < end; });
}
export function registrationSeries(members: Member[], period: Period, today = new Date()) {
  if (period === 'all') {
    return Array.from({ length: 6 }, (_, i) => {
      const date = new Date(today.getFullYear(), today.getMonth() - 5 + i, 1);
      const next = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      return { label: date.toLocaleDateString('en-IN', { month: 'short' }), fullLabel: date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), count: members.filter(member => { const d = new Date(member.createdAt); return d >= date && d < next; }).length };
    });
  }
  const count = period === 'week' ? 7 : 30;
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - count + 1 + i);
    return { label: period === 'week' ? date.toLocaleDateString('en-IN', { weekday: 'short' }) : String(date.getDate()), fullLabel: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), count: members.filter(member => dayKey(new Date(member.createdAt)) === dayKey(date)).length };
  });
}
export function areaDistribution(members: Member[]) {
  const grouped = new Map<string, { label: string; count: number }>();
  for (const member of members) {
    const key = member.taluka.trim().toLocaleLowerCase('en-IN');
    const current = grouped.get(key);
    grouped.set(key, { label: current?.label || member.taluka.trim(), count: (current?.count || 0) + 1 });
  }
  return [...grouped.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
