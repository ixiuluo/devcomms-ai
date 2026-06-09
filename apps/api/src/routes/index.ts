import { Router } from 'express';
import changelogRoutes from './changelogs.js';
import entryRoutes from './entries.js';
import exportRoutes from './exports.js';
import githubRoutes from './github.js';
import teamRoutes from './teams.js';
import subscriberRoutes from './subscribers.js';
import subscriptionRoutes from './subscriptions.js';
import slackRoutes from './slack.js';
import publicRoutes from './public.js';
import analyticsRoutes from './analytics.js';

const router = Router();

router.use('/teams', teamRoutes);
router.use('/changelogs', exportRoutes); // mount before changelogs so /:id/export.* takes priority
router.use('/changelogs', changelogRoutes);
router.use('/entries', entryRoutes);
router.use('/github', githubRoutes);
router.use('/subscribers', subscriberRoutes);
router.use('/subscriptions', subscriptionRoutes);
router.use('/slack', slackRoutes);
router.use('/public', publicRoutes);
router.use('/analytics', analyticsRoutes);

export default router;
