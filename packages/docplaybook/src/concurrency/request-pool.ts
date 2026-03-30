import { label, verboseLog } from '../ui.js';

type Task<T> = () => Promise<T>;

interface QueuedTask<T> {
  task: Task<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

export class RequestPool {
  private readonly queue: Array<QueuedTask<any>> = [];
  private activeCount = 0;
  private currentLimit: number;

  public constructor(
    private readonly maxLimit: number,
    initialLimit: number
  ) {
    this.currentLimit = Math.max(1, Math.min(initialLimit, maxLimit));
  }

  public run<T>(task: Task<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      verboseLog(
        'queue',
        'cyan',
        `Queued request (active: ${this.activeCount}, queued: ${this.queue.length}, limit: ${this.currentLimit}).`
      );
      this.drain();
    });
  }

  public noteRateLimit(): void {
    if (this.currentLimit <= 1) {
      return;
    }

    this.currentLimit -= 1;
    console.warn(
      `${label('warning', 'yellow')} Rate limit detected. Lowering request concurrency to ${this.currentLimit}.`
    );
  }

  public getLimit(): number {
    return this.currentLimit;
  }

  private drain(): void {
    while (this.activeCount < this.currentLimit && this.queue.length > 0) {
      const next = this.queue.shift() as QueuedTask<any>;
      this.activeCount += 1;
      verboseLog(
        'queue',
        'cyan',
        `Starting request (active: ${this.activeCount}, queued: ${this.queue.length}, limit: ${this.currentLimit}).`
      );

      void next.task()
        .then(next.resolve, next.reject)
        .finally(() => {
          this.activeCount -= 1;
          verboseLog(
            'queue',
            'cyan',
            `Finished request (active: ${this.activeCount}, queued: ${this.queue.length}, limit: ${this.currentLimit}).`
          );
          this.drain();
        });
    }
  }
}
