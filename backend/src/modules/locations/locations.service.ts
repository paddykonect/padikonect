import { Injectable, NotFoundException } from '@nestjs/common';
import { Country, State } from 'country-state-city';

export interface StateOption {
  name: string;
  code: string;
}

// Reference data for onboarding's State of residence step. Served from the
// offline country-state-city dataset — no third-party call at runtime.
@Injectable()
export class LocationsService {
  getStates(countryCode: string): StateOption[] {
    const code = countryCode.toUpperCase();
    if (!Country.getCountryByCode(code)) {
      throw new NotFoundException(`Unknown country code: ${countryCode}`);
    }
    return State.getStatesOfCountry(code)
      .map((s) => ({ name: s.name, code: s.isoCode }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
