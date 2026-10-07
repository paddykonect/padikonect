import { PrismaService } from '../../database/prisma.service';

// True when `hiderId` has hidden themselves from `viewerId` via the radar eye
// toggle. Such a user must be invisible to the viewer on radar AND in profile
// views, silently (indistinguishable from "not found"). Shared by RadarService,
// ProfilesService and PadisService to keep the rule in one place.
export async function isHiddenFrom(
  prisma: PrismaService,
  hiderId: string,
  viewerId: string,
): Promise<boolean> {
  if (hiderId === viewerId) return false;
  const row = await prisma.radarHide.findUnique({
    where: { userId_hiddenFromId: { userId: hiderId, hiddenFromId: viewerId } },
    select: { userId: true },
  });
  return !!row;
}
