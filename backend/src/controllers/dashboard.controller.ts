import type { Request, Response, NextFunction } from 'express';
import { getDashboardSummary } from '../services/dashboard.service.js';

export async function getDashboardController(_req: Request, res: Response, next: NextFunction) {
  try {
    const data = await getDashboardSummary();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ ok: true, data });
  } catch (error) {
    next(error);
  }
}
