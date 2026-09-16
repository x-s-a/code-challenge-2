import {
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
  pgSequence,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const usersPublicIdSequence = pgSequence('users_public_id_seq');
export const threadsPublicIdSequence = pgSequence('threads_public_id_seq');

export const users = pgTable('users', {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: varchar('public_id',  { length: 20 }).unique().notNull().default(
  sql`'U' || replace(format('%3s', nextval('users_public_id_seq')), ' ', '0')`,
),
    username: varchar('username', { length: 30 }).unique().notNull(),
    email: varchar('email', { length: 254 }).unique().notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const threads = pgTable('threads', {
    id: uuid('id').primaryKey().defaultRandom(),
    publicId: varchar('public_id', { length: 20 }).unique().notNull().default(
  sql`'T' || replace(format('%3s', nextval('threads_public_id_seq')), ' ', '0')`,
),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 60 }).notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});