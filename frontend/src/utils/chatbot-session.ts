// Independiente de React y del mecanismo de autenticación: invalida solo el trabajo del chat.
export class ChatbotSession {
  private version = 0;
  private controller: AbortController | undefined;

  private readonly readIdentity: () => string | null;

  constructor(readIdentity: () => string | null) { this.readIdentity = readIdentity; }

  begin() {
    this.invalidate();
    this.controller = new AbortController();
    const version = this.version;
    const identity = this.readIdentity();
    const signal = this.controller.signal;
    return { signal, isCurrent: () => identity !== null && !signal.aborted &&
      version === this.version && identity === this.readIdentity() };
  }

  invalidate() {
    this.version++;
    this.controller?.abort();
    this.controller = undefined;
  }
}
