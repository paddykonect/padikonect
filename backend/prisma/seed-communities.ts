import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Dev-only demo communities matching the Figma "COMMUNITIES" board. Idempotent:
// users upserted by email, a community is skipped if one with the same name
// exists. Run with `npm run prisma:seed:communities`.
const PASSWORD = 'Sup3rSecret!';

// A shared pool of people (owners + members). photoUrl is left null so the
// Avatar falls back to initials, matching the Figma member list.
const PEOPLE: Array<{ key: string; fullName: string }> = [
  { key: 'chidi', fullName: 'Chidi Okonkwo' },
  { key: 'tunde', fullName: 'Tunde Bakare' },
  { key: 'amina', fullName: 'Amina Yusuf' },
  { key: 'bola', fullName: 'Bola Ade' },
  { key: 'chinelo', fullName: 'Chinelo Eze' },
  { key: 'david', fullName: 'David Mba' },
  { key: 'evelyn', fullName: 'Evelyn Okafor' },
  { key: 'ada', fullName: 'Ada Nwosu' },
  { key: 'dhanush', fullName: 'Dhanush Rao' },
  { key: 'akshay', fullName: 'Akshay Mehta' },
  { key: 'tobi', fullName: 'Tobi Adisa' },
  { key: 'faith', fullName: 'Faith Momoh' },
  { key: 'ngozi', fullName: 'Ngozi Balogun' },
  { key: 'emeka', fullName: 'Emeka Obi' },
  { key: 'funke', fullName: 'Funke Ajayi' },
  { key: 'ibrahim', fullName: 'Ibrahim Sani' },
  { key: 'kemi', fullName: 'Kemi Adeyemi' },
  { key: 'zara', fullName: 'Zara Bello' },
];

const everyone = PEOPLE.map((p) => p.key);

interface DemoCommunity {
  name: string;
  emoji: string;
  description: string;
  city: string;
  minAge: number;
  maxAge: number;
  cover: string;
  vibe: string[];
  rules: string[];
  owner: string;
  members: string[];
}

const COVER = (slug: string) => `https://picsum.photos/seed/padi-${slug}/800/450`;

const COMMUNITIES: DemoCommunity[] = [
  {
    name: 'Coffee & Culture Explore',
    emoji: '☕',
    description:
      'For anyone who lives to eat — we trade recommendations, host pop-up tastings, and turn up for every new restaurant opening in Lekki.',
    city: 'Lagos',
    minAge: 18,
    maxAge: 45,
    cover: COVER('coffee-culture'),
    vibe: ['Foodie meetups', 'New spots weekly', 'Small groups'],
    rules: [
      'Be kind — no food shaming, ever.',
      'RSVP only if you can actually show up.',
      'Tag the spot when you post photos.',
    ],
    owner: 'chidi',
    members: everyone,
  },
  {
    name: 'Cineplex Tuesdays',
    emoji: '🎬',
    description: 'Half-price Tuesdays, big releases and good company every week.',
    city: 'Lagos',
    minAge: 18,
    maxAge: 45,
    cover: COVER('cineplex'),
    vibe: ['Movie nights', 'Half-price Tuesdays', 'Chill crowd'],
    rules: ['No spoilers in the chat.', 'Grab your ticket early.'],
    owner: 'chidi',
    members: ['ada', 'tobi', 'faith', 'ngozi', 'emeka', 'kemi'],
  },
  {
    name: 'Island Downtowners',
    emoji: '🌆',
    description: 'The VI/Lekki after-work crew — rooftops, lounges and link-ups.',
    city: 'Lagos',
    minAge: 18,
    maxAge: 99,
    cover: COVER('island'),
    vibe: ['After-work', 'Rooftops', 'Networking'],
    rules: ['Keep it classy.', 'Pull up on time.'],
    owner: 'tunde',
    members: ['ada', 'dhanush', 'akshay', 'funke', 'ibrahim', 'zara', 'kemi'],
  },
  {
    name: 'Soccer in the 6ix',
    emoji: '⚽',
    description: 'Five-a-side kickabouts and match screenings. All levels welcome.',
    city: 'Lagos',
    minAge: 18,
    maxAge: 49,
    cover: COVER('soccer'),
    vibe: ['5-a-side', 'Match screenings', 'Weekend games'],
    rules: ['Respect every player.', 'Confirm so we can balance teams.'],
    owner: 'amina',
    members: ['emeka', 'ibrahim', 'david', 'tobi', 'dhanush'],
  },
  {
    name: 'Photography Club',
    emoji: '📸',
    description: 'Photo walks, golden-hour shoots and honest feedback.',
    city: 'Abuja',
    minAge: 18,
    maxAge: 50,
    cover: COVER('photography'),
    vibe: ['Photo walks', 'Golden hour', 'Feedback welcome'],
    rules: ['Credit each other’s work.', 'Share your edits in the chat.'],
    owner: 'bola',
    members: ['evelyn', 'zara', 'akshay', 'funke'],
  },
  {
    name: 'Coding Bootcamp',
    emoji: '💻',
    description: 'Builders learning in public — pair sessions and demo nights.',
    city: 'Port Harcourt',
    minAge: 18,
    maxAge: 40,
    cover: COVER('coding'),
    vibe: ['Pair programming', 'Demo nights', 'Learn in public'],
    rules: ['No gatekeeping.', 'Ship something, anything.'],
    owner: 'chinelo',
    members: ['dhanush', 'akshay', 'david', 'ada'],
  },
  {
    name: 'Book Lovers',
    emoji: '📚',
    description: 'A monthly read and a cosy meet-up to talk about it.',
    city: 'Ibadan',
    minAge: 18,
    maxAge: 60,
    cover: COVER('books'),
    vibe: ['Monthly reads', 'Cosy meet-ups', 'All genres'],
    rules: ['Finish the chapter.', 'Everyone gets to speak.'],
    owner: 'david',
    members: ['evelyn', 'faith', 'funke', 'kemi', 'ngozi'],
  },
  {
    name: 'Travel Enthusiasts',
    emoji: '🧳',
    description: 'Road trips, staycations and finding the next hidden gem.',
    city: 'Enugu',
    minAge: 18,
    maxAge: 55,
    cover: COVER('travel'),
    vibe: ['Road trips', 'Staycations', 'Hidden gems'],
    rules: ['Share the plan early.', 'Split costs fairly.'],
    owner: 'evelyn',
    members: ['tobi', 'zara', 'ibrahim', 'ada'],
  },
];

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

// A couple of events for the Coffee & Culture community (its Events tab).
const COMMUNITY_EVENTS = [
  {
    community: 'Coffee & Culture Explore',
    title: 'Suya & small chops crawl',
    description: 'Three spots, one evening of the best suya and small chops in Lekki.',
    addressText: 'Lekki Phase 1, Lagos',
    latitude: 6.4474,
    longitude: 3.4723,
    startAt: inDays(6, 18),
    cover: COVER('suya-crawl'),
  },
  {
    community: 'Coffee & Culture Explore',
    title: 'New restaurant tasting — Nok by Alara',
    description: 'A group tasting at the newly opened Nok by Alara. Come hungry.',
    addressText: 'Victoria Island, Lagos',
    latitude: 6.4281,
    longitude: 3.4219,
    startAt: inDays(10, 19),
    cover: COVER('nok-tasting'),
  },
];

async function upsertPerson(
  key: string,
  fullName: string,
  passwordHash: string,
): Promise<string> {
  const email = `community.${key}@example.com`;
  const user = await prisma.user.upsert({
    where: { email },
    update: { fullName, status: 'ACTIVE' },
    create: {
      email,
      fullName,
      passwordHash,
      dateOfBirth: new Date('1996-05-14'),
      status: 'ACTIVE',
    },
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      displayName: fullName.split(' ')[0],
      country: 'Nigeria',
      nationality: 'Nigerian',
      state: 'Lagos',
    },
  });
  return user.id;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, string> = {};
  for (const p of PEOPLE) ids[p.key] = await upsertPerson(p.key, p.fullName, passwordHash);

  let created = 0;
  for (const c of COMMUNITIES) {
    if (await prisma.community.findFirst({ where: { name: c.name } })) continue;
    const memberKeys = Array.from(new Set([c.owner, ...c.members]));
    await prisma.$transaction(async (tx) => {
      const community = await tx.community.create({
        data: {
          name: c.name,
          description: c.description,
          emoji: c.emoji,
          city: c.city,
          minAge: c.minAge,
          maxAge: c.maxAge,
          coverImageUrl: c.cover,
          vibe: c.vibe,
          rules: c.rules,
          creatorId: ids[c.owner],
          members: {
            create: memberKeys.map((k) => ({
              userId: ids[k],
              role: k === c.owner ? 'OWNER' : 'MEMBER',
            })),
          },
        },
      });
      await tx.conversation.create({
        data: {
          type: 'COMMUNITY',
          communityId: community.id,
          participants: {
            create: memberKeys.map((k) => ({ userId: ids[k] })),
          },
        },
      });
    });
    created++;
  }

  let events = 0;
  for (const e of COMMUNITY_EVENTS) {
    const community = await prisma.community.findFirst({
      where: { name: e.community },
      select: { id: true, creatorId: true },
    });
    if (!community) continue;
    if (
      await prisma.event.findFirst({
        where: { communityId: community.id, title: e.title },
      })
    )
      continue;
    const event = await prisma.event.create({
      data: {
        hostId: community.creatorId,
        communityId: community.id,
        title: e.title,
        description: e.description,
        addressText: e.addressText,
        latitude: e.latitude,
        longitude: e.longitude,
        startAt: e.startAt,
        endAt: new Date(e.startAt.getTime() + 3 * 3_600_000),
        capacity: 20,
        coverImageUrl: e.cover,
        status: 'PUBLISHED',
      },
    });
    await prisma.$executeRaw`
      UPDATE "Event"
      SET "location" = ST_SetSRID(ST_MakePoint(${e.longitude}, ${e.latitude}), 4326)
      WHERE "id" = ${event.id}
    `;
    events++;
  }

  console.log(
    `Communities seed: ${PEOPLE.length} people upserted; ${created} communities + ${events} community events created.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
