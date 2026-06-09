import { Router } from "express";
import changelogRoutes from "./changelogs.js";
import entryRoutes from "./entries.js";
import githubRoutes from "./github.js";
import teamRoutes from "./teams.js";
import subscriberRoutes from "./subscribers.js";
import subscriptionRoutes from "./subscriptions.js";
import slackRoutes from "./slack.js";

const router = Router();

router.use("/teams", teamRoutes);
router.use("/changelogs", changelogRoutes);
router.use("/entries", entryRoutes);
router.use("/github", githubRoutes);
router.use("/subscribers", subscriberRoutes);
router.use("/subscriptions", subscriptionRoutes);
router.use("/slack", slackRoutes);

export default router;
