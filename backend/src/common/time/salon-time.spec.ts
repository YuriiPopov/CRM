import {
  assertSalonTimezone,
  DEFAULT_SALON_TIMEZONE,
  salonNow,
  salonTimezone,
  toSalonTime,
} from './salon-time';

describe('salon time (item77)', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  const at = (realUtc: string) =>
    toSalonTime(new Date(realUtc), 'Europe/Warsaw');

  describe('salonNow', () => {
    it('is UTC+2 in summer time', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T06:30:00.000Z'));
      expect(salonNow('Europe/Warsaw')).toEqual(
        new Date('2026-07-15T08:30:00.000Z'),
      );
    });

    it('is UTC+1 in winter time', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-01-15T07:30:00.000Z'));
      expect(salonNow('Europe/Warsaw')).toEqual(
        new Date('2026-01-15T08:30:00.000Z'),
      );
    });

    it('keeps seconds and milliseconds of the real clock', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T06:59:59.999Z'));
      expect(salonNow('Europe/Warsaw')).toEqual(
        new Date('2026-07-15T08:59:59.999Z'),
      );
    });

    it('uses SALON_TIMEZONE, defaulting to Europe/Warsaw', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-07-15T06:30:00.000Z'));
      const previous = process.env.SALON_TIMEZONE;
      try {
        delete process.env.SALON_TIMEZONE;
        expect(salonNow()).toEqual(new Date('2026-07-15T08:30:00.000Z'));
        process.env.SALON_TIMEZONE = 'Europe/London';
        expect(salonNow()).toEqual(new Date('2026-07-15T07:30:00.000Z'));
      } finally {
        if (previous === undefined) delete process.env.SALON_TIMEZONE;
        else process.env.SALON_TIMEZONE = previous;
      }
    });
  });

  describe('spring forward — 29.03.2026 (02:00 CET → 03:00 CEST)', () => {
    it('is UTC+1 right before the switch', () => {
      expect(at('2026-03-29T00:59:59.000Z')).toEqual(
        new Date('2026-03-29T01:59:59.000Z'),
      );
    });

    it('jumps straight to 03:00 at the switch', () => {
      expect(at('2026-03-29T01:00:00.000Z')).toEqual(
        new Date('2026-03-29T03:00:00.000Z'),
      );
    });

    it('is UTC+2 for the rest of the day', () => {
      expect(at('2026-03-29T07:00:00.000Z')).toEqual(
        new Date('2026-03-29T09:00:00.000Z'),
      );
    });
  });

  describe('fall back — 25.10.2026 (03:00 CEST → 02:00 CET)', () => {
    it('is UTC+2 right before the switch', () => {
      expect(at('2026-10-25T00:59:59.000Z')).toEqual(
        new Date('2026-10-25T02:59:59.000Z'),
      );
    });

    it('repeats the 02:00 hour after the switch', () => {
      expect(at('2026-10-25T00:30:00.000Z')).toEqual(
        new Date('2026-10-25T02:30:00.000Z'),
      );
      expect(at('2026-10-25T01:30:00.000Z')).toEqual(
        new Date('2026-10-25T02:30:00.000Z'),
      );
    });

    it('is UTC+1 for the rest of the day', () => {
      expect(at('2026-10-25T08:00:00.000Z')).toEqual(
        new Date('2026-10-25T09:00:00.000Z'),
      );
    });
  });

  describe('around midnight', () => {
    it('is already the next salon day while UTC is still on the previous one (summer)', () => {
      expect(at('2026-07-15T22:30:00.000Z')).toEqual(
        new Date('2026-07-16T00:30:00.000Z'),
      );
    });

    it('is already the next salon day while UTC is still on the previous one (winter)', () => {
      expect(at('2026-12-31T23:30:00.000Z')).toEqual(
        new Date('2027-01-01T00:30:00.000Z'),
      );
    });

    it('shows midnight as 00:00, not 24:00', () => {
      expect(at('2026-07-15T22:00:00.000Z')).toEqual(
        new Date('2026-07-16T00:00:00.000Z'),
      );
    });
  });

  describe('SALON_TIMEZONE config', () => {
    it('defaults to Europe/Warsaw', () => {
      expect(DEFAULT_SALON_TIMEZONE).toBe('Europe/Warsaw');
      expect(salonTimezone({})).toBe('Europe/Warsaw');
      expect(salonTimezone({ SALON_TIMEZONE: '' })).toBe('Europe/Warsaw');
    });

    it('accepts a valid IANA time zone', () => {
      expect(() => assertSalonTimezone({})).not.toThrow();
      expect(() =>
        assertSalonTimezone({ SALON_TIMEZONE: 'Europe/Kyiv' }),
      ).not.toThrow();
    });

    it('rejects an unknown time zone at startup', () => {
      expect(() =>
        assertSalonTimezone({ SALON_TIMEZONE: 'Europe/Atlantis' }),
      ).toThrow(/SALON_TIMEZONE/);
    });
  });
});
