export class AudioConfirmation {
  sent = 0;
  committed = 0;
  confirmed = 0;
  failure: Error | null = null;
  deliveriesPending = 0;
  private readonly flushes = new Map<string, number>();
  append(bytes: number) { this.sent += bytes; }
  commit() { this.committed = this.sent; }
  confirm(bytes: number) { this.confirmed = Math.max(this.confirmed, bytes); }
  flushing(id: string) {
    if (this.flushes.size >= 32) throw Error("Audio confirmation backlog exceeded");
    this.flushes.set(id, this.sent);
  }
  flushed(id: string) {
    const bytes = this.flushes.get(id);
    this.flushes.delete(id);
    return bytes;
  }
  get error() {
    return this.failure ?? (this.sent > this.confirmed || this.deliveriesPending > 0
      ? Error("Uma fala ficou sem confirmação final. Confira a transcrição.") : null);
  }
}
