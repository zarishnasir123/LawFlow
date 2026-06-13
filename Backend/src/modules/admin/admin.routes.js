import { Router } from "express";

import { getDashboardStatsHandler } from "./admin.controller.js";
import { asyncHandler } from "../../middleware/asyncHandler.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorizeRoles } from "../../middleware/authorizeRoles.js";

const router = Router();

// Every admin endpoint here is admin-only. Mirrors the registrar module's
// router-level gate so individual routes don't repeat the middleware.
router.use(authenticate, authorizeRoles("admin"));

router.get("/dashboard-stats", asyncHandler(getDashboardStatsHandler));

export default router;
