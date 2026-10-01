import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../common/exceptions/app.exception';

export interface GeocodedLocation {
  latitude: number;
  longitude: number;
}

interface GoogleGeocodeResponse {
  status: string;
  results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);

  constructor(private readonly config: ConfigService) {}

  async geocodeAddress(addressText: string): Promise<GeocodedLocation> {
    const apiKey = this.config.get<string>('googleMaps.apiKey');
    if (!apiKey) {
      throw new AppException(
        'GEOCODING_NOT_CONFIGURED',
        'Location lookup is not configured yet. Please pick the location on the map instead.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    url.searchParams.set('address', addressText);
    url.searchParams.set('key', apiKey);

    let response: Response;
    try {
      response = await fetch(url.toString());
    } catch (err) {
      this.logger.warn(`Geocoding request failed: ${(err as Error).message}`);
      throw new AppException(
        'GEOCODING_FAILED',
        'Could not look up that address. Please try again.',
        HttpStatus.BAD_GATEWAY,
      );
    }

    const body = (await response.json()) as GoogleGeocodeResponse;
    if (body.status !== 'OK' || body.results.length === 0) {
      throw new AppException(
        'ADDRESS_NOT_FOUND',
        "We couldn't find that address. Please refine it or pick the location on the map.",
        HttpStatus.BAD_REQUEST,
      );
    }

    const { lat, lng } = body.results[0].geometry.location;
    return { latitude: lat, longitude: lng };
  }
}
