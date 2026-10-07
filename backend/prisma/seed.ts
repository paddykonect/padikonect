import { PrismaClient, VenueCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Dev-only sample venues (Victoria Island / Lekki, Lagos) matching the Home
// design (Figma node 590:8834). Cover images are served by the frontend from
// public/images/seed/venues — replace with real Cloudinary URLs in prod.
// Detail fields + menus back the Venue detail screens (Figma 407:4367 etc.).
type MenuSeed = Array<{ section: string; name: string; priceKobo: number }>;

const IMG = '/images/seed/venues';
const DEFAULT_MENU: MenuSeed = [
  { section: 'Small chops', name: 'Suya platter', priceKobo: 450_000 },
  { section: 'Small chops', name: 'Peppered snails', priceKobo: 600_000 },
  { section: 'Small chops', name: 'Puff puff (6 pcs)', priceKobo: 150_000 },
  { section: 'Drinks', name: 'Chapman (non-alcoholic)', priceKobo: 250_000 },
  { section: 'Drinks', name: 'Zobo cooler', priceKobo: 200_000 },
  { section: 'Drinks', name: 'Chilled Heineken', priceKobo: 280_000 },
];

const VENUES: Array<{
  name: string;
  category: VenueCategory;
  addressText: string;
  latitude: number;
  longitude: number;
  coverImageUrl: string | null;
  description?: string;
  phone?: string;
  photos?: string[];
  amenities?: string[];
  opensAt?: string;
  closesAt?: string;
  menu?: MenuSeed;
}> = [
  {
    name: 'Sip & Grill Lounge',
    category: VenueCategory.RESTAURANT,
    addressText: '12 Adeola Odeku St, Victoria Island, Lagos',
    latitude: 6.4296,
    longitude: 3.4176,
    coverImageUrl: '/images/seed/venues/sip-and-grill.png',
    description:
      'Sip & Grill Lounge is a rooftop restaurant and bar in Victoria Island, known for grilled small chops, weekend live music, and a padi-friendly non-alcoholic menu.',
    phone: '+2349012345678',
    photos: [
      `${IMG}/sip-and-grill.png`,
      `${IMG}/rooftop-25.png`,
      `${IMG}/vibes-on-ground.png`,
    ],
    amenities: [
      'Outdoor seating',
      'Live music',
      'Non-alcoholic options',
      'Free WiFi',
    ],
    opensAt: '12:00',
    closesAt: '23:00',
    menu: DEFAULT_MENU,
  },
  {
    name: 'Vibes on Ground',
    category: VenueCategory.LOUNGE,
    addressText: '4 Saka Tinubu St, Victoria Island, Lagos',
    latitude: 6.4262,
    longitude: 3.4232,
    coverImageUrl: '/images/seed/venues/vibes-on-ground.png',
    description:
      'A buzzing lounge with Afrobeats every night, shisha on the terrace and a long cocktail list.',
    phone: '+2349087654321',
    photos: [`${IMG}/vibes-on-ground.png`, `${IMG}/sip-and-grill.png`],
    amenities: ['DJ nights', 'Terrace', 'Card payments'],
    opensAt: '16:00',
    closesAt: '02:00',
    menu: [
      { section: 'Bites', name: 'Asun', priceKobo: 350_000 },
      { section: 'Bites', name: 'Grilled croaker', priceKobo: 900_000 },
      { section: 'Drinks', name: 'Mojito', priceKobo: 450_000 },
      { section: 'Drinks', name: 'Virgin mojito', priceKobo: 300_000 },
    ],
  },
  {
    name: 'Rooftop 25',
    category: VenueCategory.REGISTERED_LOUNGE,
    addressText: '25 Akin Adesola St, Victoria Island, Lagos',
    latitude: 6.4318,
    longitude: 3.4251,
    coverImageUrl: '/images/seed/venues/rooftop-25.png',
    description:
      'Rooftop lounge with skyline views over Victoria Island and live bands on Saturdays.',
    phone: '+2348023456789',
    photos: [`${IMG}/rooftop-25.png`, `${IMG}/sip-and-grill.png`],
    amenities: ['Rooftop', 'Live music', 'Reservations'],
    opensAt: '17:00',
    closesAt: '01:00',
    menu: DEFAULT_MENU,
  },
  {
    name: 'Chicken Republic Lekki',
    category: VenueCategory.RESTAURANT,
    addressText: 'Admiralty Way, Lekki Phase 1, Lagos',
    latitude: 6.4474,
    longitude: 3.4723,
    coverImageUrl: '/images/seed/venues/chicken-republic-lekki.png',
    description: 'Quick, affordable meals in the heart of Lekki Phase 1.',
    phone: '+2348034567890',
    photos: [`${IMG}/chicken-republic-lekki.png`],
    amenities: ['Takeaway', 'Family friendly', 'Non-alcoholic options'],
    opensAt: '08:00',
    closesAt: '22:00',
    menu: [
      { section: 'Meals', name: 'Refuel meal', priceKobo: 250_000 },
      { section: 'Meals', name: 'Citizens meal', priceKobo: 380_000 },
      { section: 'Drinks', name: 'Chapman', priceKobo: 120_000 },
    ],
  },
  {
    name: "Padi's Garden",
    category: VenueCategory.CAFE,
    addressText: '7 Ajose Adeogun St, Victoria Island, Lagos',
    latitude: 6.4241,
    longitude: 3.4285,
    coverImageUrl: null,
    description:
      'A shady garden café for slow brunches and board-game afternoons.',
    phone: '+2348045678901',
    amenities: ['Outdoor seating', 'Free WiFi', 'Board games'],
    opensAt: '09:00',
    closesAt: '20:00',
  },
];

async function main() {
  // Idempotent: re-running updates existing venues by name.
  for (const { menu = [], ...venue } of VENUES) {
    const existing = await prisma.venue.findFirst({
      where: { name: venue.name },
    });
    const { id } = existing
      ? await prisma.venue.update({ where: { id: existing.id }, data: venue })
      : await prisma.venue.create({ data: venue });
    await prisma.venueMenuItem.deleteMany({ where: { venueId: id } });
    await prisma.venueMenuItem.createMany({
      data: menu.map((item, position) => ({ ...item, venueId: id, position })),
    });
  }
  console.log(`Seed: ${VENUES.length} venues upserted.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
