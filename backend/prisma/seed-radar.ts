import { PrismaClient } from '@prisma/client';

// Dev-only radar data so the Home "Padis" map has something to show. Makes a
// set of demo users share a FRESH live location near the map's default center
// (Victoria Island, Lagos) and wires padi connections so they surface for the
// hub user. Run AFTER prisma:seed:demo. Re-run anytime to refresh freshness —
// LiveLocation is only "nearby" for 2h (RadarService.LOCATION_FRESH_MS).
const prisma = new PrismaClient();

// Matches frontend DEFAULT_CENTER in app/home/page.tsx.
const CENTER = { lat: 6.4281, lng: 3.4219 };
const emailFor = (key: string) => `demo.${key}@example.com`;

// The account you log in as to see a populated map.
const HUB = 'tunde';
// Become HUB's padis and share a location → appear via GET /radar/padis.
const PADIS = ['ngozi', 'emeka', 'funke', 'kemi', 'obinna', 'segun'];
// Discoverable strangers near center → appear via GET /radar/discover
// (only when the viewer's browser location is also near Lagos).
const DISCOVERABLE = ['halima', 'dayo'];

// Spread pins ~400m around center, with a little per-run jitter so the upsert
// changes a column and @updatedAt refreshes to now (keeps them "fresh").
function near(i: number, count: number) {
  const ring = 0.004;
  const ang = (i / count) * Math.PI * 2;
  const jitter = () => (Math.random() - 0.5) * 0.0006;
  return { lat: CENTER.lat + Math.cos(ang) * ring + jitter(), lng: CENTER.lng + Math.sin(ang) * ring + jitter() };
}

async function userId(key: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { email: emailFor(key) }, select: { id: true } });
  return u?.id ?? null;
}

async function connect(ownerId: string, targetId: string) {
  await prisma.padiConnection.upsert({
    where: { userId_padiId: { userId: ownerId, padiId: targetId } },
    create: { userId: ownerId, padiId: targetId },
    update: {},
  });
}

async function share(id: string, lat: number, lng: number) {
  await prisma.liveLocation.upsert({
    where: { userId: id },
    create: { userId: id, latitude: lat, longitude: lng },
    update: { latitude: lat, longitude: lng },
  });
}

async function main() {
  const hubId = await userId(HUB);
  if (!hubId) throw new Error(`${HUB} not found — run \`npm run prisma:seed:demo\` first.`);

  const total = PADIS.length + DISCOVERABLE.length;
  let i = 0;

  for (const key of PADIS) {
    const id = await userId(key);
    if (!id) continue;
    await connect(id, hubId); // they added the hub → hub sees them on radar
    await connect(hubId, id); // hub added them back → isPadi=true + in directory
    const { lat, lng } = near(i++, total);
    await share(id, lat, lng);
  }

  for (const key of DISCOVERABLE) {
    const id = await userId(key);
    if (!id) continue;
    await prisma.profile.update({ where: { userId: id }, data: { radarDiscoverable: true } });
    const { lat, lng } = near(i++, total);
    await share(id, lat, lng);
  }

  console.log(`Radar seed: ${PADIS.length} padis sharing near center for "${HUB}"; ${DISCOVERABLE.length} discoverable strangers.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void prisma.$disconnect());
