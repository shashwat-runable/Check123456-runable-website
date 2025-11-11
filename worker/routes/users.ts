import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authenticatedOnly } from "../middleware/auth";
import type { HonoContext } from "../types";
import { users, follows, repositories, stars } from "../db/schema";
import { eq, desc, and, sql } from "drizzle-orm";

const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
});

export const userRoutes = new Hono<HonoContext>()
  .get("/:id", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user");
    const userId = c.req.param("id");

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        bio: users.bio,
        location: users.location,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json({ error: "User not found" }, 404);
    }

    const [followerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followingId, userId));

    const [followingCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(follows)
      .where(eq(follows.followerId, userId));

    const [repoCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(repositories)
      .where(
        and(
          eq(repositories.ownerId, userId),
          eq(repositories.isPrivate, false)
        )
      );

    let isFollowing = false;
    if (currentUser && currentUser.id !== userId) {
      const [follow] = await db
        .select()
        .from(follows)
        .where(
          and(
            eq(follows.followerId, currentUser.id),
            eq(follows.followingId, userId)
          )
        )
        .limit(1);
      isFollowing = !!follow;
    }

    return c.json({
      ...user,
      followersCount: followerCount.count,
      followingCount: followingCount.count,
      repositoriesCount: repoCount.count,
      isFollowing,
    });
  })

  .patch("/me", authenticatedOnly, zValidator("json", updateProfileSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const data = c.req.valid("json");

    const [updated] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, user.id))
      .returning();

    return c.json(updated);
  })

  .post("/:id/follow", authenticatedOnly, async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user");
    const userId = c.req.param("id");

    if (currentUser.id === userId) {
      return c.json({ error: "Cannot follow yourself" }, 400);
    }

    const [targetUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const existing = await db
      .select()
      .from(follows)
      .where(
        and(
          eq(follows.followerId, currentUser.id),
          eq(follows.followingId, userId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Already following" }, 400);
    }

    await db.insert(follows).values({
      followerId: currentUser.id,
      followingId: userId,
    });

    return c.json({ success: true });
  })

  .delete("/:id/follow", authenticatedOnly, async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user");
    const userId = c.req.param("id");

    const result = await db
      .delete(follows)
      .where(
        and(
          eq(follows.followerId, currentUser.id),
          eq(follows.followingId, userId)
        )
      )
      .returning();

    if (result.length === 0) {
      return c.json({ error: "Not following" }, 400);
    }

    return c.json({ success: true });
  })

  .get("/:id/followers", async (c) => {
    const db = c.get("db");
    const userId = c.req.param("id");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    const results = await db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        bio: users.bio,
      })
      .from(follows)
      .leftJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, userId))
      .limit(limit)
      .offset(offset);

    return c.json({ users: results });
  })

  .get("/:id/following", async (c) => {
    const db = c.get("db");
    const userId = c.req.param("id");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    const results = await db
      .select({
        id: users.id,
        name: users.name,
        image: users.image,
        bio: users.bio,
      })
      .from(follows)
      .leftJoin(users, eq(follows.followingId, users.id))
      .where(eq(follows.followerId, userId))
      .limit(limit)
      .offset(offset);

    return c.json({ users: results });
  })

  .get("/:id/starred", async (c) => {
    const db = c.get("db");
    const userId = c.req.param("id");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    const results = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        language: repositories.language,
        starsCount: repositories.starsCount,
        forksCount: repositories.forksCount,
        watchersCount: repositories.watchersCount,
        updatedAt: repositories.updatedAt,
        owner: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(stars)
      .leftJoin(repositories, eq(stars.repositoryId, repositories.id))
      .leftJoin(users, eq(repositories.ownerId, users.id))
      .where(
        and(
          eq(stars.userId, userId),
          eq(repositories.isPrivate, false)
        )
      )
      .orderBy(desc(stars.createdAt))
      .limit(limit)
      .offset(offset);

    return c.json({ repositories: results });
  });
