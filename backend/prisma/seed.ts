import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // No models exist yet (Phase 0). Phase 1+ will seed a dev user here, and
  // the documented "promote first admin" step (see plan §Admin/RBAC) lands
  // once the User model exists.
  console.log('Seed: nothing to do yet (Phase 0 — no models defined).');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
