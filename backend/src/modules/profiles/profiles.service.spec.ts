/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { DrinkPreference, Prisma } from '@prisma/client';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { PrismaService } from '../../database/prisma.service';
import { BlocksService } from '../blocks/blocks.service';
import { ProfilesService } from './profiles.service';

function baseProfile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'profile-1',
    userId: 'user-1',
    displayName: null,
    photoUrl: null,
    photoPublicId: null,
    bio: null,
    drinkPreference: DrinkPreference.BOTH,
    interests: [] as string[],
    wantsToBeInvitedFor: null,
    padiPoints: 0,
    user: {
      fullName: 'Ada Obi',
      email: 'ada@example.com',
      phone: null,
      dateOfBirth: null,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeService(profileOverrides: Partial<Record<string, unknown>> = {}) {
  const profile = baseProfile(profileOverrides);
  const prisma = {
    profile: {
      upsert: jest.fn().mockResolvedValue(profile),
      update: jest.fn().mockResolvedValue(profile),
      findUnique: jest.fn().mockResolvedValue(profile),
    },
    event: { count: jest.fn().mockResolvedValue(3) },
    rsvp: { count: jest.fn().mockResolvedValue(5) },
    padiConnection: { count: jest.fn().mockResolvedValue(7) },
    radarHide: { findUnique: jest.fn().mockResolvedValue(null) },
    user: { update: jest.fn().mockResolvedValue({}) },
  } as unknown as PrismaService;
  const cloudinary = {
    getSignedUploadParams: jest.fn().mockReturnValue({ signature: 'sig' }),
  } as unknown as CloudinaryService;

  return {
    service: new ProfilesService(prisma, cloudinary, {
      assertNotBlocked: jest.fn(),
    } as unknown as BlocksService),
    prisma,
    cloudinary,
    profile,
  };
}

describe('ProfilesService', () => {
  it('getOwn lazily creates the profile via upsert and never exposes padiPoints in the public view type', async () => {
    const { service, prisma } = makeService({ padiPoints: 42 });
    const result = await service.getOwn('user-1');

    expect(prisma.profile.upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      update: {},
      create: { userId: 'user-1' },
      include: expect.any(Object) as object,
    });
    expect(result.padiPoints).toBe(42);
    expect(result.hostedCount).toBe(3);
    expect(result.attendedCount).toBe(5);
    expect(result.padiCount).toBe(7);
    expect(result.email).toBe('ada@example.com');
  });

  it('getOwn derives age in whole years from the account date of birth', async () => {
    const dob = new Date();
    dob.setUTCFullYear(dob.getUTCFullYear() - 27);
    dob.setUTCDate(dob.getUTCDate() - 1); // ensure the birthday has passed
    const { service } = makeService({
      user: {
        fullName: 'Ada Obi',
        email: 'ada@example.com',
        phone: null,
        dateOfBirth: dob,
      },
    });
    const result = await service.getOwn('user-1');
    expect(result.age).toBe(27);
  });

  it('getOwn returns a null age when no date of birth is set', async () => {
    const { service } = makeService();
    const result = await service.getOwn('user-1');
    expect(result.age).toBeNull();
  });

  it('updateOwn only forwards defined fields to Prisma', async () => {
    const { service, prisma } = makeService();
    await service.updateOwn('user-1', { displayName: 'Ada' });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { displayName: 'Ada' },
      include: expect.any(Object) as object,
    });
  });

  it('updateOwn forwards the onboarding location fields', async () => {
    const { service, prisma } = makeService();
    await service.updateOwn('user-1', {
      country: 'Nigeria',
      nationality: 'Nigeria',
      state: 'Lagos',
    });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { country: 'Nigeria', nationality: 'Nigeria', state: 'Lagos' },
      include: expect.any(Object) as object,
    });
  });

  it('updateOwn maps a duplicate phone to PHONE_IN_USE', async () => {
    const { service, prisma } = makeService();
    (prisma.user.update as jest.Mock).mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    await expect(
      service.updateOwn('user-1', { phone: '+2348012345678' }),
    ).rejects.toMatchObject({ code: 'PHONE_IN_USE' });
  });

  it('getPublic omits the onboarding location fields', async () => {
    const { service } = makeService({
      country: 'Nigeria',
      nationality: 'Nigeria',
      state: 'Lagos',
    });
    const result = await service.getPublic('user-1');

    expect(result).not.toHaveProperty('country');
    expect(result).not.toHaveProperty('nationality');
    expect(result).not.toHaveProperty('state');
  });

  it('getPublic omits padiPoints from the returned object', async () => {
    const { service } = makeService({ padiPoints: 99 });
    const result = await service.getPublic('user-1');

    expect(result).not.toHaveProperty('padiPoints');
    expect(result).not.toHaveProperty('email');
    expect(result).not.toHaveProperty('phone');
  });

  it('getPublic throws PROFILE_NOT_FOUND when no profile exists', async () => {
    const { service, prisma } = makeService();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getPublic('nobody')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
  });

  it('getPublic hides a profile from a viewer the owner has hidden from', async () => {
    const { service, prisma } = makeService();
    (prisma.radarHide.findUnique as jest.Mock).mockResolvedValue({
      userId: 'user-1',
    });

    await expect(service.getPublic('user-1', 'viewer-2')).rejects.toMatchObject(
      {
        code: 'PROFILE_NOT_FOUND',
      },
    );
  });

  it('getAvatarUploadSignature signs a deterministic per-user public_id with overwrite enabled', () => {
    const { service, cloudinary } = makeService();
    service.getAvatarUploadSignature('user-1');

    expect(cloudinary.getSignedUploadParams).toHaveBeenCalledWith(
      'avatars',
      'avatars/user-1',
      true,
    );
  });
});
