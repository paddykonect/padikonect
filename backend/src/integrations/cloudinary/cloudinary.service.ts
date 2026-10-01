import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { AppException } from '../../common/exceptions/app.exception';

export interface SignedUploadParams {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  publicId?: string;
  overwrite?: boolean;
  signature: string;
}

interface CloudinaryCreds {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * Thin wrapper around the Cloudinary SDK. Clients upload directly to
 * Cloudinary using a short-lived signed payload from here — the file itself
 * never passes through this backend.
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);
  private configured = false;

  constructor(private readonly config: ConfigService) {}

  private getCreds(): CloudinaryCreds {
    const cloudName = this.config.get<string>('cloudinary.cloudName');
    const apiKey = this.config.get<string>('cloudinary.apiKey');
    const apiSecret = this.config.get<string>('cloudinary.apiSecret');
    if (!cloudName || !apiKey || !apiSecret) {
      throw new AppException(
        'MEDIA_UPLOAD_NOT_CONFIGURED',
        'Media upload is not configured yet. Please try again later.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    if (!this.configured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
      });
      this.configured = true;
    }
    return { cloudName, apiKey, apiSecret };
  }

  /**
   * Signed params for a direct client-side "public" upload (avatars, post
   * media, event covers). Every param the client will send to Cloudinary
   * (other than the file itself, api_key and resource_type) must appear here
   * — Cloudinary rejects the upload if the client adds an unsigned param.
   */
  getSignedUploadParams(
    folder: string,
    publicId?: string,
    overwrite?: boolean,
  ): SignedUploadParams {
    const { cloudName, apiKey, apiSecret } = this.getCreds();
    const timestamp = Math.round(Date.now() / 1000);
    const paramsToSign: Record<string, string | number> = { timestamp, folder };
    if (publicId) paramsToSign.public_id = publicId;
    if (overwrite !== undefined) paramsToSign.overwrite = overwrite.toString();

    const signature = cloudinary.utils.api_sign_request(
      paramsToSign,
      apiSecret,
    );
    return {
      cloudName,
      apiKey,
      timestamp,
      folder,
      publicId,
      overwrite,
      signature,
    };
  }

  async destroy(publicId: string): Promise<void> {
    this.getCreds();
    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      // Best-effort cleanup — a failed delete of the old asset must never block
      // the user's action (e.g. replacing their avatar with a new one).
      this.logger.warn(
        `Failed to destroy Cloudinary asset ${publicId}: ${(err as Error).message}`,
      );
    }
  }
}
