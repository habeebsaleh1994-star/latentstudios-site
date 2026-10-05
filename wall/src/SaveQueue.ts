import type { Site } from "./model";
// Exactly one owner serializes revisions. A failure must never replace a newer
// in-memory edit with the older snapshot that happened to fail.
export class SaveQueue {
  revision: number;
  pending: Site | null = null;
  saving = false;
  error: Error | null = null;
  private idleWaiters: Array<() => void> = [];
  constructor(
    revision: number,
    private write: (site: Site, revision: number) => Promise<number>,
    private changed: (queue: SaveQueue) => void,
    private committed: (revision: number) => void,
  ) {
    this.revision = revision;
  }
  enqueue(site: Site) {
    this.pending = site;
    this.changed(this);
    void this.flush();
  }
  async flush() {
    if (this.saving || this.error) return;
    this.saving = true;
    this.changed(this);
    while (this.pending && !this.error) {
      const next = this.pending;
      this.pending = null;
      try {
        this.revision = await this.write(next, this.revision);
        this.committed(this.revision);
      } catch (error) {
        this.pending = this.pending ?? next;
        this.error =
          error instanceof Error
            ? error
            : new Error("The local save could not finish.");
      }
    }
    this.saving = false;
    this.changed(this);
    this.idleWaiters.splice(0).forEach((resolve) => resolve());
  }
  interrupt(message: string) {
    this.error = new Error(message);
    this.changed(this);
  }
  retry() {
    this.error = null;
    void this.flush();
  }
  async idle() {
    if (this.saving)
      await new Promise<void>((resolve) => this.idleWaiters.push(resolve));
  }
  get dirty() {
    return this.saving || !!this.pending;
  }
}
