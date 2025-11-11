import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { authenticatedOnly } from "../middleware/auth";
import type { HonoContext } from "../types";
import { repositories, stars, users } from "../db/schema";
import { eq, desc, asc, sql, like, and, or } from "drizzle-orm";

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  language: z.string().optional(),
  isPrivate: z.boolean().default(false),
  readme: z.string().optional(),
});

const updateRepoSchema = z.object({
  description: z.string().max(500).optional(),
  language: z.string().optional(),
  readme: z.string().optional(),
});

export const repositoryRoutes = new Hono<HonoContext>()
  .get("/", async (c) => {
    const db = c.get("db");
    const query = c.req.query();
    const search = query.search;
    const language = query.language;
    const sortBy = query.sortBy || "updated";
    const limit = Math.min(parseInt(query.limit || "20"), 100);
    const offset = parseInt(query.offset || "0");

    let conditions = [];
    if (search) {
      conditions.push(
        or(
          like(repositories.name, `%${search}%`),
          like(repositories.description, `%${search}%`)
        )
      );
    }
    if (language) {
      conditions.push(eq(repositories.language, language));
    }
    conditions.push(eq(repositories.isPrivate, false));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let orderBy;
    switch (sortBy) {
      case "stars":
        orderBy = desc(repositories.starsCount);
        break;
      case "forks":
        orderBy = desc(repositories.forksCount);
        break;
      case "name":
        orderBy = asc(repositories.name);
        break;
      default:
        orderBy = desc(repositories.updatedAt);
    }

    const results = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        language: repositories.language,
        starsCount: repositories.starsCount,
        forksCount: repositories.forksCount,
        watchersCount: repositories.watchersCount,
        createdAt: repositories.createdAt,
        updatedAt: repositories.updatedAt,
        owner: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(repositories)
      .leftJoin(users, eq(repositories.ownerId, users.id))
      .where(whereClause)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);

    return c.json({ repositories: results, total: results.length });
  })

  .get("/:id", async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = c.req.param("id");

    const [repo] = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        language: repositories.language,
        starsCount: repositories.starsCount,
        forksCount: repositories.forksCount,
        watchersCount: repositories.watchersCount,
        isPrivate: repositories.isPrivate,
        readme: repositories.readme,
        createdAt: repositories.createdAt,
        updatedAt: repositories.updatedAt,
        owner: {
          id: users.id,
          name: users.name,
          image: users.image,
        },
      })
      .from(repositories)
      .leftJoin(users, eq(repositories.ownerId, users.id))
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.isPrivate && (!user || repo.owner.id !== user.id)) {
      return c.json({ error: "Repository not found" }, 404);
    }

    let isStarred = false;
    if (user) {
      const [star] = await db
        .select()
        .from(stars)
        .where(
          and(eq(stars.userId, user.id), eq(stars.repositoryId, id))
        )
        .limit(1);
      isStarred = !!star;
    }

    return c.json({ ...repo, isStarred });
  })

  .post("/", authenticatedOnly, zValidator("json", createRepoSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(repositories)
      .where(
        and(
          eq(repositories.name, data.name),
          eq(repositories.ownerId, user.id)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Repository with this name already exists" }, 400);
    }

    const [repo] = await db
      .insert(repositories)
      .values({
        name: data.name,
        description: data.description,
        language: data.language,
        isPrivate: data.isPrivate,
        readme: data.readme || `# ${data.name}\n\n${data.description || ""}`,
        ownerId: user.id,
      })
      .returning();

    return c.json(repo, 201);
  })

  .patch("/:id", authenticatedOnly, zValidator("json", updateRepoSchema), async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.ownerId !== user.id) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    const [updated] = await db
      .update(repositories)
      .set(data)
      .where(eq(repositories.id, id))
      .returning();

    return c.json(updated);
  })

  .delete("/:id", authenticatedOnly, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = c.req.param("id");

    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    if (repo.ownerId !== user.id) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    await db.delete(repositories).where(eq(repositories.id, id));

    return c.json({ success: true });
  })

  .post("/:id/star", authenticatedOnly, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = c.req.param("id");

    const [repo] = await db
      .select()
      .from(repositories)
      .where(eq(repositories.id, id))
      .limit(1);

    if (!repo) {
      return c.json({ error: "Repository not found" }, 404);
    }

    const existing = await db
      .select()
      .from(stars)
      .where(
        and(eq(stars.userId, user.id), eq(stars.repositoryId, id))
      )
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Already starred" }, 400);
    }

    await db.insert(stars).values({
      userId: user.id,
      repositoryId: id,
    });

    await db
      .update(repositories)
      .set({ starsCount: sql`${repositories.starsCount} + 1` })
      .where(eq(repositories.id, id));

    return c.json({ success: true });
  })

  .delete("/:id/star", authenticatedOnly, async (c) => {
    const db = c.get("db");
    const user = c.get("user");
    const id = c.req.param("id");

    const result = await db
      .delete(stars)
      .where(
        and(eq(stars.userId, user.id), eq(stars.repositoryId, id))
      )
      .returning();

    if (result.length === 0) {
      return c.json({ error: "Not starred" }, 400);
    }

    await db
      .update(repositories)
      .set({ starsCount: sql`MAX(0, ${repositories.starsCount} - 1)` })
      .where(eq(repositories.id, id));

    return c.json({ success: true });
  })

  .get("/user/:userId", async (c) => {
    const db = c.get("db");
    const currentUser = c.get("user");
    const userId = c.req.param("userId");
    const limit = Math.min(parseInt(c.req.query("limit") || "20"), 100);
    const offset = parseInt(c.req.query("offset") || "0");

    let whereClause;
    if (currentUser?.id === userId) {
      whereClause = eq(repositories.ownerId, userId);
    } else {
      whereClause = and(
        eq(repositories.ownerId, userId),
        eq(repositories.isPrivate, false)
      );
    }

    const results = await db
      .select({
        id: repositories.id,
        name: repositories.name,
        description: repositories.description,
        language: repositories.language,
        starsCount: repositories.starsCount,
        forksCount: repositories.forksCount,
        watchersCount: repositories.watchersCount,
        isPrivate: repositories.isPrivate,
        createdAt: repositories.createdAt,
        updatedAt: repositories.updatedAt,
      })
      .from(repositories)
      .where(whereClause)
      .orderBy(desc(repositories.updatedAt))
      .limit(limit)
      .offset(offset);

    return c.json({ repositories: results });
  });
