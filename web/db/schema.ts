import {
  sqliteTable,
  text,
  integer,
  real,
  primaryKey,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
export const waterChecks = sqliteTable(
  'water_checks',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    sourceId: text('source_id').notNull(),
    clientId: text('client_id').notNull(),
    status: text('status').notNull(),
    visitDate: text('visit_date').notNull(),
    note: text('note').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    uniqueIndex('water_checks_retry').on(t.ownerId, t.clientId),
    index('water_checks_owner_source').on(t.ownerId, t.sourceId, t.createdAt),
  ],
);
export const trips = sqliteTable('trips', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id').notNull(),
  name: text('name').notNull(),
  mode: text('mode').notNull(),
  originJson: text('origin_json').notNull(),
  destinationJson: text('destination_json').notNull(),
  speed: real('speed').notNull(),
  profile: text('profile').notNull(),
  selectedRouteId: text('selected_route_id'),
  replayDistance: real('replay_distance').notNull().default(0),
  revision: integer('revision').notNull().default(1),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  supplierFixAt: text('supplier_fix_at'),
  recipientFixAt: text('recipient_fix_at'),
  regionId: text('region_id').notNull().default('dacope'),
});
export const memberships = sqliteTable(
  'memberships',
  {
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id),
    userId: text('user_id').notNull(),
    role: text('role').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [primaryKey({ columns: [t.tripId, t.userId] }), index('memberships_user').on(t.userId)],
);
export const fixes = sqliteTable(
  'fixes',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id),
    actorId: text('actor_id').notNull(),
    role: text('role').notNull(),
    source: text('source').notNull(),
    clientFixId: text('client_fix_id').notNull(),
    latitude: real('latitude').notNull(),
    longitude: real('longitude').notNull(),
    accuracyM: real('accuracy_m').notNull(),
    speedMps: real('speed_mps'),
    heading: real('heading'),
    capturedAt: text('captured_at').notNull(),
    receivedAt: text('received_at').notNull(),
    metadataJson: text('metadata_json').notNull(),
  },
  (t) => [
    uniqueIndex('fixes_client').on(t.tripId, t.role, t.clientFixId),
    index('fixes_trip_time').on(t.tripId, t.role, t.capturedAt),
  ],
);
export const closures = sqliteTable(
  'closures',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id')
      .notNull()
      .references(() => trips.id),
    actorId: text('actor_id').notNull(),
    edgeIdsJson: text('edge_ids_json').notNull(),
    latitude: real('latitude'),
    longitude: real('longitude'),
    radiusM: real('radius_m'),
    reason: text('reason').notNull(),
    sourceKind: text('source_kind').notNull(),
    sourceLabel: text('source_label').notNull(),
    sourceUrl: text('source_url'),
    expiresAt: text('expires_at').notNull(),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [index('closures_trip_expiry').on(t.tripId, t.expiresAt)],
);
export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  tripId: text('trip_id')
    .notNull()
    .references(() => trips.id),
  tokenHash: text('token_hash').notNull().unique(),
  role: text('role').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  consumedAt: text('consumed_at'),
  consumedBy: text('consumed_by'),
  acceptedNonce: text('accepted_nonce'),
});
export const observations = sqliteTable(
  'observations',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    dataJson: text('data_json').notNull(),
    metadataJson: text('metadata_json').notNull(),
    contentHash: text('content_hash').notNull(),
    clientId: text('client_id'),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('observations_owner').on(t.ownerId),
    uniqueIndex('observations_retry').on(t.ownerId, t.clientId),
  ],
);
export const cases = sqliteTable(
  'cases',
  {
    id: text('id').primaryKey(),
    ownerId: text('owner_id').notNull(),
    observationId: text('observation_id')
      .notNull()
      .references(() => observations.id),
    title: text('title').notNull(),
    status: text('status').notNull(),
    note: text('note'),
    clientId: text('client_id'),
    revision: integer('revision').notNull().default(1),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (t) => [index('cases_owner').on(t.ownerId), uniqueIndex('cases_retry').on(t.ownerId, t.clientId)],
);
export const events = sqliteTable(
  'events',
  {
    id: text('id').primaryKey(),
    tripId: text('trip_id').references(() => trips.id),
    ownerId: text('owner_id').notNull(),
    actorId: text('actor_id').notNull(),
    type: text('type').notNull(),
    subjectId: text('subject_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('events_trip').on(t.tripId, t.createdAt),
    index('events_owner').on(t.ownerId, t.createdAt),
  ],
);
