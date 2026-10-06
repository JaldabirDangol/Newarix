import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const mediaType = pgEnum('media_type', ['anime', 'manga'])

// One enum covers both media types. The UI shows "Watching" for anime and
// "Reading" for manga, but they mean the same thing in the data.
export const listStatus = pgEnum('list_status', [
  'current',
  'completed',
  'planned',
  'on_hold',
  'dropped',
])

export const historyAction = pgEnum('history_action', [
  'added',
  'status',
  'progress',
  'completed',
  'scored',
  'removed',
])

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash'),
  tokenVersion: integer('token_version').notNull().default(0),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
  googleId: text('google_id').unique(),
  avatarUrl: text('avatar_url'),
  avatarData: text('avatar_data'),
  bio: text('bio'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const authTokens = pgTable('auth_tokens', {
  hash: text('hash').primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['reset', 'verify'] }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
}, (t) => [index('auth_tokens_user_purpose_idx').on(t.userId, t.purpose)])

// Tracking data keyed by MAL id. title / image_url / total / genres are a
// snapshot taken from AniList when the entry is saved, so list pages, history
// and stats can render without one AniList request per row. AniList stays the
// source of truth; the snapshot is refreshed on every save from a detail page.
export const listEntries = pgTable(
  'list_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    malId: integer('mal_id').notNull(),
    mediaType: mediaType('media_type').notNull(),
    status: listStatus('status').notNull(),
    // Episodes for anime, chapters for manga.
    progress: integer('progress').notNull().default(0),
    progressVolumes: integer('progress_volumes').notNull().default(0),
    score: smallint('score'),
    notes: text('notes'),
    title: text('title').notNull(),
    imageUrl: text('image_url'),
    total: integer('total'),
    totalVolumes: integer('total_volumes'),
    genres: text('genres')
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('list_entries_user_media_uq').on(
      t.userId,
      t.mediaType,
      t.malId,
    ),
    index('list_entries_user_status_idx').on(t.userId, t.status, t.updatedAt),
    check('list_entries_score_ck', sql`${t.score} between 1 and 10`),
    check(
      'list_entries_progress_ck',
      sql`${t.progress} >= 0 and ${t.progressVolumes} >= 0`,
    ),
  ],
)

export const watchHistory = pgTable(
  'watch_history',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    malId: integer('mal_id').notNull(),
    mediaType: mediaType('media_type').notNull(),
    action: historyAction('action').notNull(),
    progress: integer('progress'),
    status: listStatus('status'),
    score: smallint('score'),
    title: text('title').notNull(),
    imageUrl: text('image_url'),
    positionSeconds: integer('position_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('watch_history_user_created_idx').on(t.userId, t.createdAt)],
)

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    malId: integer('mal_id').notNull(),
    mediaType: mediaType('media_type').notNull(),
    title: text('title').notNull(),
    imageUrl: text('image_url'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.mediaType, t.malId] })],
)

export type User = typeof users.$inferSelect
export type ListEntry = typeof listEntries.$inferSelect
export type HistoryEntry = typeof watchHistory.$inferSelect
export type Favorite = typeof favorites.$inferSelect
export type MediaType = (typeof mediaType.enumValues)[number]
export type ListStatus = (typeof listStatus.enumValues)[number]
