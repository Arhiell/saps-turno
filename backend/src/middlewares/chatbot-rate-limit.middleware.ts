import { AppError } from '../utils/app-error.js';

interface WindowCount { start: number; count: number }
export class ChatbotRateLimiter {
  private users = new Map<string, WindowCount>();
  private active = new Set<string>();
  private minute: WindowCount = { start: 0, count: 0 };
  private day: WindowCount = { start: 0, count: 0 };

  constructor(private readonly now = Date.now) {}

  reserve(userId: string) {
    const time = this.now();
    for (const [id, window] of this.users) {
      if (time - window.start >= 60_000 && !this.active.has(id)) this.users.delete(id);
    }
    if (time - this.minute.start >= 60_000) this.minute = { start: time, count: 0 };
    if (time - this.day.start >= 86_400_000) this.day = { start: time, count: 0 };
    const user = this.users.get(userId) ?? { start: time, count: 0 };
    const limited = this.active.has(userId) || user.count >= 5 || this.minute.count >= 10 ||
      this.day.count >= 100 || (!this.users.has(userId) && this.users.size >= 1_000);
    if (limited) {
      const retryAfter = this.day.count >= 100
        ? Math.ceil((this.day.start + 86_400_000 - time) / 1_000) : 60;
      throw new AppError('El asistente alcanzó su límite de uso. Intentá más tarde.', 429,
        'CHATBOT_RATE_LIMIT', { retryAfter });
    }
    user.count++;
    this.users.set(userId, user);
    this.minute.count++;
    this.day.count++;
    this.active.add(userId);
    return () => { this.active.delete(userId); };
  }
}
