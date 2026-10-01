-- Hand-authored: PostGIS GIST index on Event.location, mandatory for
-- ST_DWithin "nearby" queries (Padi Board browse + PadiRadar) to scale.
-- Not declarable via the stable Prisma schema DSL as of the pinned client
-- version, so this migration is written by hand rather than generated.
CREATE INDEX "Event_location_gist_idx" ON "Event" USING GIST ("location");
