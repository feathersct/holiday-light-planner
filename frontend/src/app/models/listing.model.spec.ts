import { matchesDateFilter, DateFilter, ListingSummary } from './listing.model';

function makeListing(start: string, end: string): ListingSummary {
  return { startDatetime: start, endDatetime: end } as ListingSummary;
}

// Fixed reference point: 2026-01-15 at 5:00 PM
const NOW = new Date('2026-01-15T17:00:00');

describe('matchesDateFilter', () => {
  describe('all', () => {
    it('always returns true regardless of dates', () => {
      expect(matchesDateFilter(makeListing('2020-01-01', '2020-01-02'), 'all', NOW)).toBeTrue();
    });
  });

  describe('today', () => {
    it('includes a listing currently in progress (started yesterday, ends tomorrow)', () => {
      expect(matchesDateFilter(makeListing('2026-01-14', '2026-01-16'), 'today', NOW)).toBeTrue();
    });

    it('includes a listing that starts later today (6 PM)', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T18:00:00', '2026-01-15T22:00:00'), 'today', NOW)).toBeTrue();
    });

    it('excludes a listing that ended earlier today (4 PM, it is now 5 PM)', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T08:00:00', '2026-01-15T16:00:00'), 'today', NOW)).toBeFalse();
    });

    it('excludes a listing that starts tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-16', '2026-01-17'), 'today', NOW)).toBeFalse();
    });
  });

  describe('tomorrow', () => {
    it('includes a listing spanning today through tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-15', '2026-01-16T20:00:00'), 'tomorrow', NOW)).toBeTrue();
    });

    it('includes a listing that starts tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-16T08:00:00', '2026-01-20'), 'tomorrow', NOW)).toBeTrue();
    });

    it('excludes a listing that ends today before midnight', () => {
      expect(matchesDateFilter(makeListing('2026-01-15T08:00:00', '2026-01-15T23:00:00'), 'tomorrow', NOW)).toBeFalse();
    });

    it('excludes a listing that starts the day after tomorrow', () => {
      expect(matchesDateFilter(makeListing('2026-01-17', '2026-01-18'), 'tomorrow', NOW)).toBeFalse();
    });
  });

  describe('this-week', () => {
    it('includes a listing starting in 3 days', () => {
      expect(matchesDateFilter(makeListing('2026-01-18', '2026-01-20'), 'this-week', NOW)).toBeTrue();
    });

    it('includes a listing currently in progress that ends next week', () => {
      expect(matchesDateFilter(makeListing('2026-01-10', '2026-01-20'), 'this-week', NOW)).toBeTrue();
    });

    it('excludes a listing that ended before now', () => {
      expect(matchesDateFilter(makeListing('2026-01-14', '2026-01-15T16:00:00'), 'this-week', NOW)).toBeFalse();
    });

    it('excludes a listing starting more than 7 days from now', () => {
      expect(matchesDateFilter(makeListing('2026-01-23', '2026-01-25'), 'this-week', NOW)).toBeFalse();
    });
  });
});
