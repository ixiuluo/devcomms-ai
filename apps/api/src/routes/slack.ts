import { Router } from 'express';
import { prisma } from '../db.js';

const router = Router();

// ── Slack Integration CRUD ───────────────────────────────────

// Create or update a Slack webhook integration for a team
router.post('/', async (req, res) => {
  try {
    const { teamId, webhookUrl, channel } = req.body as {
      teamId: string;
      webhookUrl: string;
      channel?: string;
    };

    if (!teamId || !webhookUrl) {
      res.status(400).json({ ok: false, error: 'teamId and webhookUrl are required' });
      return;
    }

    // Use findFirst + create/update since teamId+webhookUrl should be unique
    const existing = await prisma.slackIntegration.findFirst({
      where: { teamId, webhookUrl },
    });

    if (existing) {
      const updated = await prisma.slackIntegration.update({
        where: { id: existing.id },
        data: { channel, enabled: true },
      });
      res.json({ ok: true, data: updated });
    } else {
      const created = await prisma.slackIntegration.create({
        data: { teamId, webhookUrl, channel },
      });
      res.status(201).json({ ok: true, data: created });
    }
  } catch (err) {
    console.error('POST /slack error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to save Slack integration' });
  }
});

// List Slack integrations for a team
router.get('/', async (req, res) => {
  try {
    const teamId = req.query.teamId as string;
    if (!teamId) {
      res.status(400).json({ ok: false, error: 'teamId query param required' });
      return;
    }

    const integrations = await prisma.slackIntegration.findMany({
      where: { teamId },
    });
    res.json({ ok: true, data: integrations });
  } catch (err) {
    console.error('GET /slack error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to fetch Slack integrations' });
  }
});

// Toggle Slack integration enabled/disabled
router.patch('/:id/toggle', async (req, res) => {
  try {
    const integration = await prisma.slackIntegration.findUnique({
      where: { id: req.params.id },
    });
    if (!integration) {
      res.status(404).json({ ok: false, error: 'Slack integration not found' });
      return;
    }

    const updated = await prisma.slackIntegration.update({
      where: { id: req.params.id },
      data: { enabled: !integration.enabled },
    });
    res.json({ ok: true, data: updated });
  } catch (err) {
    console.error('PATCH /slack/:id/toggle error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to toggle Slack integration' });
  }
});

// Delete a Slack integration
router.delete('/:id', async (req, res) => {
  try {
    await prisma.slackIntegration.delete({ where: { id: req.params.id } });
    res.json({ ok: true, data: { message: 'Slack integration removed' } });
  } catch (err) {
    console.error('DELETE /slack/:id error:', (err as Error).message);
    res.status(500).json({ ok: false, error: 'Failed to delete Slack integration' });
  }
});

export default router;
