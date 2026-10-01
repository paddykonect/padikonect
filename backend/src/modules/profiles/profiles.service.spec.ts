/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { DrinkPreference } from '@prisma/client';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { PrismaService } from '../../database/prisma.service';
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
    padiPoints: 0,
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
  } as unknown as PrismaService;
  const cloudinary = {
    getSignedUploadParams: jest.fn().mockReturnValue({ signature: 'sig' }),
  } as unknown as CloudinaryService;

  return {
    service: new ProfilesService(prisma, cloudinary),
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
    });
    expect(result.padiPoints).toBe(42);
  });

  it('updateOwn only forwards defined fields to Prisma', async () => {
    const { service, prisma } = makeService();
    await service.updateOwn('user-1', { displayName: 'Ada' });

    expect(prisma.profile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: { displayName: 'Ada' },
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
    });
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
  });

  it('getPublic throws PROFILE_NOT_FOUND when no profile exists', async () => {
    const { service, prisma } = makeService();
    (prisma.profile.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getPublic('nobody')).rejects.toMatchObject({
      code: 'PROFILE_NOT_FOUND',
    });
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
