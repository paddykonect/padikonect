import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma, Profile } from '@prisma/client';
import { AppException } from '../../common/exceptions/app.exception';
import { PrismaService } from '../../database/prisma.service';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { BlocksService } from '../blocks/blocks.service';
import { isHiddenFrom } from '../radar/radar-hide';
import { UpdateProfileDto } from './dto/update-profile.dto';

const AVATAR_FOLDER = 'avatars';

const userInclude = {
  user: {
    select: { fullName: true, email: true, phone: true, dateOfBirth: true },
  },
} satisfies Prisma.ProfileInclude;

export interface OwnProfileView {
  id: string;
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  // Derived from the account's date of birth; null if unknown.
  age: number | null;
  drinkPreference: Profile['drinkPreference'];
  interests: string[];
  // Profile card "Wants to be invited for" free-text hint.
  wantsToBeInvitedFor: string | null;
  country: string | null;
  nationality: string | null;
  state: string | null;
  // Account fields (own view only): email is read-only here; phone can be
  // added/changed (Google sign-in accounts start without one).
  fullName: string;
  email: string;
  phone: string | null;
  // Settings (own view only).
  invitePolicy: Profile['invitePolicy'];
  pushNotifications: boolean;
  locationServices: boolean;
  // Placeholder until the membership model exists — see plan §Data model.
  membershipStatus: 'FREE' | 'PREMIUM';
  padiPoints: number;
  hostedCount: number;
  attendedCount: number;
  padiCount: number;
}

// country/nationality/state are onboarding-only, kept private like padiPoints.
export type PublicProfileView = Omit<
  OwnProfileView,
  | 'padiPoints'
  | 'country'
  | 'nationality'
  | 'state'
  | 'fullName'
  | 'email'
  | 'phone'
  | 'invitePolicy'
  | 'pushNotifications'
  | 'locationServices'
>;

interface ProfileStats {
  hostedCount: number;
  attendedCount: number;
  padiCount: number;
}

type ProfileWithUser = Profile & {
  user: {
    fullName: string;
    email: string;
    phone: string | null;
    dateOfBirth: Date | null;
  };
};

function avatarPublicId(userId: string): string {
  return `${AVATAR_FOLDER}/${userId}`;
}

// Whole years elapsed since the date of birth, in UTC.
function ageFrom(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - dateOfBirth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dateOfBirth.getUTCMonth();
  if (
    monthDiff < 0 ||
    (monthDiff === 0 && now.getUTCDate() < dateOfBirth.getUTCDate())
  ) {
    age -= 1;
  }
  return age >= 0 ? age : null;
}

function toOwnView(
  profile: ProfileWithUser,
  stats: ProfileStats,
): OwnProfileView {
  return {
    id: profile.userId,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl,
    bio: profile.bio,
    age: ageFrom(profile.user.dateOfBirth),
    drinkPreference: profile.drinkPreference,
    interests: profile.interests,
    wantsToBeInvitedFor: profile.wantsToBeInvitedFor,
    country: profile.country,
    nationality: profile.nationality,
    state: profile.state,
    fullName: profile.user.fullName,
    email: profile.user.email,
    phone: profile.user.phone,
    invitePolicy: profile.invitePolicy,
    pushNotifications: profile.pushNotifications,
    locationServices: profile.locationServices,
    membershipStatus: 'FREE',
    padiPoints: profile.padiPoints,
    ...stats,
  };
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
    private readonly blocks: BlocksService,
  ) {}

  /** Lazily creates the Profile row on first access — no eager creation coupling into AuthModule. */
  private async findOrCreate(userId: string): Promise<ProfileWithUser> {
    return this.prisma.profile.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: userInclude,
    });
  }

  // Hosted = hangouts you host that weren't cancelled; attended = hangouts
  // you were approved for (or checked in to) that have already started.
  private async stats(userId: string): Promise<ProfileStats> {
    const [hostedCount, attendedCount, padiCount] = await Promise.all([
      this.prisma.event.count({
        where: { hostId: userId, status: { not: 'CANCELLED' } },
      }),
      this.prisma.rsvp.count({
        where: {
          userId,
          status: { in: ['APPROVED', 'ATTENDED'] },
          event: { status: { not: 'CANCELLED' }, startAt: { lt: new Date() } },
        },
      }),
      // Padis you've added (one-directional, like following).
      this.prisma.padiConnection.count({ where: { userId } }),
    ]);
    return { hostedCount, attendedCount, padiCount };
  }

  async getOwn(userId: string): Promise<OwnProfileView> {
    const profile = await this.findOrCreate(userId);
    return toOwnView(profile, await this.stats(userId));
  }

  async updateOwn(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<OwnProfileView> {
    await this.findOrCreate(userId);
    if (dto.phone !== undefined) {
      await this.updatePhone(userId, dto.phone);
    }
    const profile = await this.prisma.profile.update({
      where: { userId },
      include: userInclude,
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.drinkPreference !== undefined && {
          drinkPreference: dto.drinkPreference,
        }),
        ...(dto.interests !== undefined && { interests: dto.interests }),
        ...(dto.wantsToBeInvitedFor !== undefined && {
          wantsToBeInvitedFor: dto.wantsToBeInvitedFor,
        }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.nationality !== undefined && { nationality: dto.nationality }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.invitePolicy !== undefined && {
          invitePolicy: dto.invitePolicy,
        }),
        ...(dto.pushNotifications !== undefined && {
          pushNotifications: dto.pushNotifications,
        }),
        ...(dto.locationServices !== undefined && {
          locationServices: dto.locationServices,
        }),
      },
    });
    return toOwnView(profile, await this.stats(userId));
  }

  private async updatePhone(userId: string, phone: string): Promise<void> {
    try {
      await this.prisma.user.update({ where: { id: userId }, data: { phone } });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppException(
          'PHONE_IN_USE',
          'That phone number is already used by another account.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
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
      include: userInclude,
    });
    return toOwnView(profile, await this.stats(userId));
  }

  // A blocked/blocking user's profile is "not found" for the viewer.
  async getPublic(
    userId: string,
    viewerId?: string,
  ): Promise<PublicProfileView> {
    if (viewerId) await this.blocks.assertNotBlocked(viewerId, userId);
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      include: userInclude,
    });
    // A user who hid from the viewer (radar eye toggle) is "not found" too.
    if (
      !profile ||
      (viewerId && (await isHiddenFrom(this.prisma, userId, viewerId)))
    ) {
      throw new AppException(
        'PROFILE_NOT_FOUND',
        'Profile not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    const view = toOwnView(profile, await this.stats(userId));
    return {
      id: view.id,
      displayName: view.displayName,
      photoUrl: view.photoUrl,
      bio: view.bio,
      age: view.age,
      drinkPreference: view.drinkPreference,
      interests: view.interests,
      wantsToBeInvitedFor: view.wantsToBeInvitedFor,
      membershipStatus: view.membershipStatus,
      hostedCount: view.hostedCount,
      attendedCount: view.attendedCount,
      padiCount: view.padiCount,
    };
  }
}
