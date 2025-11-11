import { Hono } from "hono";
import type { HonoContext } from "../types";
import { adminRoutes } from "./admin-routes";
import { aiRoutes } from "./ai-routes";
import { authRoutes } from "./auth-routes";
import { repositoryRoutes } from "./repositories";
import { userRoutes } from "./users";

export const apiRoutes = new Hono<HonoContext>()
.route("/admin", adminRoutes)
.route("/ai", aiRoutes)
.route("/auth", authRoutes)
.route("/repositories", repositoryRoutes)
.route("/users", userRoutes)