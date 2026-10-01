import { HttpStatus, Injectable } from '@nestjs/common';
import { Profile } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AVATAR_FOLDER = 'avatars';

export interface OwnProfileView {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  drinkPreference: Profile['drinkPreference'];
  interests: string[];
  country: string | null;
  nationality: string | null;
  state: string | null;
  // Placeholders until their owning models exist — see plan §Data model.
  membershipStatus: 'FREE' | 'PREMIUM';
  padiPoints: number;
  hostedCount: number;
  attendedCount: number;
}

// country/nationality/state are onboarding-only, kept private like padiPoints.
export type PublicProfileView = Omit<
  OwnProfileView,
  'padiPoints' | 'country' | 'nationality' | 'state'
>;

function avatarPublicId(userId: string): string {
  return `${AVATAR_FOLDER}/${userId}`;
}

function toOwnView(profile: Profile): OwnProfileView {
  return {
    id: profile.userId,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl,
    bio: profile.bio,
    drinkPreference: profile.drinkPreference,
    interests: profile.interests,
    country: profile.country,
    nationality: profile.nationality,
    state: profile.state,
    membershipStatus: 'FREE',
    padiPoints: profile.padiPoints,
    hostedCount: 0,
    attendedCount: 0,
  };
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /** Lazily creates the Profile row on first access — no eager creation coupling into AuthModule. */
  private async findOrCreate(userId: string): Promise<Profile> {
    return this.prisma.profile.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async getOwn(userId: string): Promise<OwnProfileView> {
    const profile = await this.findOrCreate(userId);
    return toOwnView(profile);
  }

  async updateOwn(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<OwnProfileView> {
    await this.findOrCreate(userId);
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.drinkPreference !== undefined && {
          drinkPreference: dto.drinkPreference,
        }),
        ...(dto.interests !== undefined && { interests: dto.interests }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.state !== undefined && { state: dto.state }),
      },
    });
    return toOwnView(profile);
  }

  getAvatarUploadSignature(userId: string) {
    return this.cloudinary.getSignedUploadParams(
      AVATAR_FOLDER,
      avatarPublicId(userId),
      true,
    );
  }

  async updateAvatar(
    userId: string,
    photoUrl: string,
  ): Promise<OwnProfileView> {
    await this.findOrCreate(userId);
    const profile = await this.prisma.profile.update({
      where: { userId },
      data: { photoUrl, photoPublicId: avatarPublicId(userId) },
    });
    return toOwnView(profile);
  }

  // Block-filtering (hide a blocked/blocking user's profile) is retrofitted
  // here in the Trust & Safety phase — not built yet, see plan §7.
  async getPublic(userId: string): Promise<PublicProfileView> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) {
      throw new AppException(
        'PROFILE_NOT_FOUND',
        'Profile not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const view = toOwnView(profile);
    return {
      id: view.id,
      displayName: view.displayName,
      photoUrl: view.photoUrl,
      bio: view.bio,
      drinkPreference: view.drinkPreference,
      interests: view.interests,
      membershipStatus: view.membershipStatus,
      hostedCount: view.hostedCount,
      attendedCount: view.attendedCount,
    };
  }
}
