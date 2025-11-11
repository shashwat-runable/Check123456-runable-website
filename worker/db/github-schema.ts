import { integer, sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
import { users } from "./auth-schema";

export const repositories = sqliteTable("repositories", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  language: text("language"),
  starsCount: integer("stars_count").default(0).notNull(),
  forksCount: integer("forks_count").default(0).notNull(),
  watchersCount: integer("watchers_count").default(0).notNull(),
  isPrivate: integer("is_private", { mode: "boolean" }).default(false).notNull(),
  readme: text("readme"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const stars = sqliteTable("stars", {
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  repositoryId: text("repository_id")
    .notNull()
    .references(() => repositories.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.userId, table.repositoryId] }),
}));

export const follows = sqliteTable("follows", {
  followerId: text("follower_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  followingId: text("following_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .defaultNow()
    .notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.followerId, table.followingId] }),
}));
