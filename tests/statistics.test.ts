import assert from 'node:assert/strict';
import { test } from 'node:test';
import { areaDistribution, filterPeriod, registrationSeries } from '../src/lib/statistics.ts';
import type { Member } from '../src/lib/members.ts';

const today = new Date(2026, 9, 9, 12);
function member(day: number, month = 9, taluka = 'Thane'): Member {
  return { id: `${month}-${day}-${taluka}`, name: 'Test', email: '', mobile: '9876543210', residence: 'Test', dob: '01/01/2000', taluka, createdAt: new Date(2026, month, day, 12).toISOString() };
}
test('date filters use inclusive local dates and exclude future records', () => {
  const data = [member(9), member(3), member(2), member(10, 8), member(9, 8), member(10)];
  assert.equal(filterPeriod(data, 'week', today).length, 2);
  assert.equal(filterPeriod(data, 'month', today).length, 4);
  assert.equal(filterPeriod(data, 'all', today).length, 5);
});
test('daily activity includes empty days and agrees with selected-period totals', () => {
  const data = [member(3), member(9), member(9), member(2)];
  const series = registrationSeries(data, 'week', today);
  assert.equal(series.length, 7);
  assert.deepEqual(series.map(point => point.count), [1, 0, 0, 0, 0, 0, 2]);
  assert.equal(series.reduce((sum, point) => sum + point.count, 0), filterPeriod(data, 'week', today).length);
  assert.equal(registrationSeries([], 'month', today).length, 30);
});
test('all-time graph groups the last six months without folding older records into them', () => {
  const series = registrationSeries([member(9), member(1, 4), member(1, 3)], 'all', today);
  assert.equal(series.length, 6);
  assert.deepEqual(series.map(point => point.count), [1, 0, 0, 0, 0, 1]);
});
test('area distribution groups case variants, sorts counts and preserves every member', () => {
  const areas = areaDistribution([member(9, 9, ' Thane '), member(8, 9, 'thane'), member(7, 9, 'Pune')]);
  assert.deepEqual(areas, [{ label: 'Thane', count: 2 }, { label: 'Pune', count: 1 }]);
  assert.deepEqual(areaDistribution([]), []);
});
