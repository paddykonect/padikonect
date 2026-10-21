import { PrismaClient } from '@prisma/client';

// Gives demo users real avatar photos (pravatar) and marks the radar padis as
// online (recent lastSeenAt) so they render as online photo pins on the Home
// Padis map. lastSeenAt uses a 5-minute presence window — re-run to refresh
// "online". Override the DB with DATABASE_URL=<neon-url> for Neon.
const prisma = new PrismaClient();

const PHOTO_USERS: { key: string; img: number }[] = [
  { key: 'tunde', img: 12 }, { key: 'amaka', img: 45 }, { key: 'segun', img: 13 },
  { key: 'zainab', img: 47 }, { key: 'chidi', img: 15 }, { key: 'ngozi', img: 44 },
  { key: 'emeka', img: 33 }, { key: 'funke', img: 49 }, { key: 'ibrahim', img: 52 },
  { key: 'kemi', img: 26 }, { key: 'obinna', img: 59 }, { key: 'halima', img: 43 },
  { key: 'dayo', img: 68 },
];
// The radar padis that share a location — mark them online so the map shows
// online photo pins with a green presence dot.
const ONLINE_KEYS = ['ngozi', 'emeka', 'funke', 'kemi', 'obinna', 'segun', 'halima', 'dayo'];

async function idFor(key: string): Promise<string | null> {
  const u = await prisma.user.findUnique({
    where: { email: `demo.${key}@example.com` },
    select: { id: true },
  });
  return u?.id ?? null;
}

async function main() {
  let photos = 0;
  for (const { key, img } of PHOTO_USERS) {
    const id = await idFor(key);
    if (!id) continue;
    await prisma.profile.update({
      where: { userId: id },
      data: { photoUrl: `https://i.pravatar.cc/300?img=${img}` },
    });
    photos++;
  }

  let online = 0;
  for (const key of ONLINE_KEYS) {
    const id = await idFor(key);
    if (!id) continue;
    await prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
    online++;
  }

  console.log(`Demo photos: ${photos} avatars set; ${online} padis marked online.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
