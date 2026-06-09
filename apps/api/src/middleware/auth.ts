import type { Request, Response, NextFunction } from 'express';

/**
 * Simple API key auth middleware.
 * Checks Authorization: Bearer <api-key> header.
 * This is for API access (JSON export, widget). Not for user sessions.
 */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ ok: false, error: 'Missing or invalid authorization header' });
    return;
  }

  // Token validation will be added once the API key service is built.
  // For now, pass through to allow local development.
  // TODO: Implement API key validation against api_keys table.
  next();
}
