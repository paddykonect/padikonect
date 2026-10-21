import { PrismaClient } from '@prisma/client';

// Joins the demo LOGIN users (demo.<key>@example.com) to every seeded community
// and adds them as conversation participants, so the members-only "Community
// chat" row is visible when testing. Idempotent. Run after seed-demo +
// seed-communities. Override the DB with DATABASE_URL=<neon-url> for Neon.
const prisma = new PrismaClient();

const DEMO_KEYS = [
  'tunde', 'amaka', 'segun', 'zainab', 'chidi',
  'ngozi', 'emeka', 'funke', 'ibrahim', 'kemi', 'obinna', 'halima', 'dayo',
];

async function main() {
  const communities = await prisma.community.findMany({
    include: { conversation: { select: { id: true } } },
  });
  let memberships = 0;

  for (const key of DEMO_KEYS) {
    const user = await prisma.user.findUnique({
      where: { email: `demo.${key}@example.com` },
      select: { id: true },
    });
    if (!user) continue;

    for (const c of communities) {
      await prisma.communityMember.upsert({
        where: { communityId_userId: { communityId: c.id, userId: user.id } },
        create: { communityId: c.id, userId: user.id },
        update: {},
      });
      if (c.conversation) {
        await prisma.conversationParticipant.upsert({
          where: {
            conversationId_userId: {
              conversationId: c.conversation.id,
              userId: user.id,
            },
          },
          create: { conversationId: c.conversation.id, userId: user.id },
          update: { leftAt: null },
        });
      }
      memberships++;
    }
  }

  console.log(
    `Community join seed: ${DEMO_KEYS.length} demo users across ${communities.length} communities (${memberships} memberships).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
