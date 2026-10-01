import ms from './ms.util';

describe('ms.util', () => {
  it('parses seconds, minutes, hours, days', () => {
    expect(ms('30s')).toBe(30 * 1000);
    expect(ms('15m')).toBe(15 * 60 * 1000);
    expect(ms('24h')).toBe(24 * 60 * 60 * 1000);
    expect(ms('60d')).toBe(60 * 24 * 60 * 60 * 1000);
  });

  it('throws on an invalid duration string', () => {
    expect(() => ms('bogus')).toThrow();
    expect(() => ms('15')).toThrow();
    expect(() => ms('15x')).toThrow();
  });
});
