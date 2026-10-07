import { NotFoundException } from '@nestjs/common';
import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  const service = new LocationsService();

  it('returns states sorted by name, case-insensitive on the country code', () => {
    const states = service.getStates('ng');
    expect(states.length).toBeGreaterThan(30);
    expect(states).toContainEqual({ name: 'Lagos', code: 'LA' });
    const names = states.map((s) => s.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  it('rejects an unknown country code', () => {
    expect(() => service.getStates('xx')).toThrow(NotFoundException);
  });
});
