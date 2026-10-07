import { DrinkPreference, EventDrinkCategory, PrismaClient, RsvpStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Dev-only demo data: active hosts + guests (all share one password) and
// upcoming hangouts with a mix of approved / pending RSVPs. Idempotent —
// users are upserted by email, events are skipped if the host already has
// one with the same title. Run with `npm run prisma:seed:demo`.
const PASSWORD = 'Sup3rSecret!';
const IMG = '/images/seed/venues';
// Served by the frontend from public/images/seed/avatars/<key>.jpg.
const AVATARS = '/images/seed/avatars';

type DemoUser = {
  key: string;
  fullName: string;
  phone: string;
  bio: string;
  drink: DrinkPreference;
  interests: string[];
};

const HOSTS: DemoUser[] = [
  { key: 'tunde', fullName: 'Tunde Bakare', phone: '+2348100000001', bio: 'Rooftop evenings and Afrobeats. Always bringing the vibes.', drink: 'BOTH', interests: ['Afrobeats', 'Live music', 'Rooftops'] },
  { key: 'amaka', fullName: 'Amaka Obi', phone: '+2348100000002', bio: 'Brunch queen. Board games, good coffee, better company.', drink: 'NON_ALCOHOLIC', interests: ['Brunch', 'Board games', 'Coffee'] },
  { key: 'segun', fullName: 'Segun Adeyemi', phone: '+2348100000003', bio: 'Suya nights and football screenings every weekend.', drink: 'ALCOHOLIC', interests: ['Football', 'Suya', 'Lounges'] },
  { key: 'zainab', fullName: 'Zainab Bello', phone: '+2348100000004', bio: 'Karaoke enthusiast. I host, you sing.', drink: 'BOTH', interests: ['Karaoke', 'Cocktails', 'Live music'] },
  { key: 'chidi', fullName: 'Chidi Eze', phone: '+2348100000005', bio: 'Tech meetups that end at the grill.', drink: 'BOTH', interests: ['Tech', 'Networking', 'Grills'] },
];

const GUESTS: DemoUser[] = [
  { key: 'ngozi', fullName: 'Ngozi Okafor', phone: '+2348100000101', bio: 'New to Lagos, looking for padis.', drink: 'BOTH', interests: ['Brunch', 'Afrobeats'] },
  { key: 'emeka', fullName: 'Emeka Nwosu', phone: '+2348100000102', bio: 'Football and good food.', drink: 'ALCOHOLIC', interests: ['Football', 'Suya'] },
  { key: 'funke', fullName: 'Funke Ajayi', phone: '+2348100000103', bio: 'Coffee first, then everything else.', drink: 'NON_ALCOHOLIC', interests: ['Coffee', 'Board games'] },
  { key: 'ibrahim', fullName: 'Ibrahim Musa', phone: '+2348100000104', bio: 'Weekend explorer.', drink: 'BOTH', interests: ['Rooftops', 'Live music'] },
  { key: 'kemi', fullName: 'Kemi Adebayo', phone: '+2348100000105', bio: 'Karaoke is my cardio.', drink: 'BOTH', interests: ['Karaoke', 'Cocktails'] },
  { key: 'obinna', fullName: 'Obinna Okeke', phone: '+2348100000106', bio: 'Product designer, grill master.', drink: 'BOTH', interests: ['Tech', 'Grills'] },
  { key: 'halima', fullName: 'Halima Yusuf', phone: '+2348100000107', bio: 'Here for the music.', drink: 'NON_ALCOHOLIC', interests: ['Live music', 'Afrobeats'] },
  { key: 'dayo', fullName: 'Dayo Ogunleye', phone: '+2348100000108', bio: 'Always down for suya.', drink: 'ALCOHOLIC', interests: ['Suya', 'Lounges'] },
];

const emailFor = (key: string) => `demo.${key}@example.com`;

const inDays = (days: number, hour: number) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const EVENTS: Array<{
  host: string;
  title: string;
  description: string;
  addressText: string;
  latitude: number;
  longitude: number;
  startAt: Date;
  hours: number;
  capacity: number;
  priceKobo?: number;
  coverImageUrl: string;
  drinkCategory: EventDrinkCategory;
  tags: string[];
  approved: string[];
  requested: string[];
}> = [
  { host: 'tunde', title: 'Friday rooftop Afrobeats night', description: 'Skyline views, a DJ set and good company. Come through after work.', addressText: '25 Akin Adesola St, Victoria Island, Lagos', latitude: 6.4318, longitude: 3.4251, startAt: inDays(3, 19), hours: 4, capacity: 12, priceKobo: 500_000, coverImageUrl: `${IMG}/rooftop-25.png`, drinkCategory: 'BOTH', tags: ['Afrobeats', 'Rooftops'], approved: ['ngozi', 'ibrahim', 'halima'], requested: ['kemi'] },
  { host: 'tunde', title: 'Sunday chill & grill', description: 'Low-key grill session to close the weekend.', addressText: '12 Adeola Odeku St, Victoria Island, Lagos', latitude: 6.4296, longitude: 3.4176, startAt: inDays(5, 15), hours: 4, capacity: 8, coverImageUrl: `${IMG}/sip-and-grill.png`, drinkCategory: 'BOTH', tags: ['Grills'], approved: ['emeka'], requested: ['obinna', 'dayo'] },
  { host: 'amaka', title: 'Board games & brunch', description: 'Catan, Ludo and pancakes. Non-alcoholic, all welcome.', addressText: '7 Ajose Adeogun St, Victoria Island, Lagos', latitude: 6.4335, longitude: 3.4285, startAt: inDays(2, 11), hours: 3, capacity: 6, coverImageUrl: `${IMG}/sip-and-grill.png`, drinkCategory: 'NON_ALCOHOLIC', tags: ['Brunch', 'Board games'], approved: ['funke', 'ngozi'], requested: ['halima'] },
  { host: 'amaka', title: 'Coffee crawl Lekki', description: 'Three cafés, one afternoon.', addressText: 'Admiralty Way, Lekki Phase 1, Lagos', latitude: 6.4474, longitude: 3.4723, startAt: inDays(8, 13), hours: 3, capacity: 5, coverImageUrl: `${IMG}/chicken-republic-lekki.png`, drinkCategory: 'NON_ALCOHOLIC', tags: ['Coffee'], approved: [], requested: ['funke'] },
  { host: 'segun', title: 'Big match screening + suya', description: 'Big screen, loud fans, fresh suya.', addressText: '4 Saka Tinubu St, Victoria Island, Lagos', latitude: 6.4262, longitude: 3.4232, startAt: inDays(4, 17), hours: 3, capacity: 15, priceKobo: 300_000, coverImageUrl: `${IMG}/vibes-on-ground.png`, drinkCategory: 'ALCOHOLIC', tags: ['Football', 'Suya'], approved: ['emeka', 'dayo', 'ibrahim'], requested: ['obinna'] },
  { host: 'zainab', title: 'Karaoke night: 90s & 2000s', description: 'Bring your best throwback. Mic is open all night.', addressText: '4 Saka Tinubu St, Victoria Island, Lagos', latitude: 6.4262, longitude: 3.4232, startAt: inDays(6, 20), hours: 4, capacity: 10, coverImageUrl: `${IMG}/vibes-on-ground.png`, drinkCategory: 'BOTH', tags: ['Karaoke', 'Cocktails'], approved: ['kemi', 'halima'], requested: ['ngozi', 'funke'] },
  { host: 'chidi', title: 'Tech & grills meetup', description: 'Lightning talks, then the grill. Builders of all kinds welcome.', addressText: '12 Adeola Odeku St, Victoria Island, Lagos', latitude: 6.4296, longitude: 3.4176, startAt: inDays(7, 18), hours: 3, capacity: 20, coverImageUrl: `${IMG}/sip-and-grill.png`, drinkCategory: 'BOTH', tags: ['Tech', 'Networking', 'Grills'], approved: ['obinna'], requested: ['ibrahim', 'emeka'] },
  { host: 'chidi', title: 'Founders after-hours', description: 'Small group, honest conversations.', addressText: '25 Akin Adesola St, Victoria Island, Lagos', latitude: 6.4318, longitude: 3.4251, startAt: inDays(12, 19), hours: 3, capacity: 6, coverImageUrl: `${IMG}/rooftop-25.png`, drinkCategory: 'BOTH', tags: ['Networking'], approved: [], requested: [] },
];

async function upsertUser(u: DemoUser, passwordHash: string) {
  const profile = {
    displayName: u.fullName.split(' ')[0],
    photoUrl: `${AVATARS}/${u.key}.jpg`,
    bio: u.bio,
    drinkPreference: u.drink,
    interests: u.interests,
    country: 'Nigeria',
    nationality: 'Nigerian',
    state: 'Lagos',
  };
  const user = await prisma.user.upsert({
    where: { email: emailFor(u.key) },
    update: { fullName: u.fullName, passwordHash, status: 'ACTIVE' },
    create: {
      email: emailFor(u.key),
      fullName: u.fullName,
      phone: u.phone,
      passwordHash,
      dateOfBirth: new Date('1996-05-14'),
      status: 'ACTIVE',
    },
  });
  await prisma.profile.upsert({
    where: { userId: user.id },
    update: profile,
    create: { userId: user.id, ...profile },
  });
  return user.id;
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const ids: Record<string, string> = {};
  for (const u of [...HOSTS, ...GUESTS]) ids[u.key] = await upsertUser(u, passwordHash);

  let created = 0;
  for (const { host, hours, approved, requested, ...e } of EVENTS) {
    const hostId = ids[host];
    if (await prisma.event.findFirst({ where: { hostId, title: e.title } })) continue;
    await prisma.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: { ...e, hostId, endAt: new Date(e.startAt.getTime() + hours * 3_600_000) },
      });
      // Mirrors GeoRepository.syncEventLocation (feed/nearby queries use it).
      await tx.$executeRaw`
        UPDATE "Event"
        SET "location" = ST_SetSRID(ST_MakePoint(${e.longitude}, ${e.latitude}), 4326)
        WHERE "id" = ${event.id}
      `;
      const conversation = await tx.conversation.create({
        data: { type: 'EVENT', eventId: event.id },
      });
      const members = [hostId, ...approved.map((k) => ids[k])];
      await tx.conversationParticipant.createMany({
        data: members.map((userId) => ({ conversationId: conversation.id, userId })),
      });
      const rsvps: Array<[string, RsvpStatus]> = [
        ...approved.map((k): [string, RsvpStatus] => [k, 'APPROVED']),
        ...requested.map((k): [string, RsvpStatus] => [k, 'REQUESTED']),
      ];
      await tx.rsvp.createMany({
        data: rsvps.map(([k, status]) => ({
          eventId: event.id,
          userId: ids[k],
          status,
          message: status === 'REQUESTED' ? "Hey! I'd love to join." : null,
          respondedAt: status === 'APPROVED' ? new Date() : null,
        })),
      });
    });
    created++;
  }

  console.log(`Demo seed: ${HOSTS.length} hosts, ${GUESTS.length} guests upserted; ${created} events created.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
