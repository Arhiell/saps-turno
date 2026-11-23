import type { RequestHandler } from 'express';
import { replyToChatbot } from '../services/chatbot.service.js';

export const chatbotController: RequestHandler = async (req, res, next) => {
  const controller = new AbortController();
  const cancel = () => { if (!res.writableEnded) controller.abort(); };
  res.once('close', cancel);
  try {
    const reply = await replyToChatbot(req.body, req.user!, controller.signal);
    if (!controller.signal.aborted && !res.destroyed) {
      res.set('Cache-Control', 'no-store').json({ success: true, data: { reply } });
    }
  } catch (error) {
    if (!controller.signal.aborted && !res.destroyed) next(error);
  } finally { res.off('close', cancel); }
};
