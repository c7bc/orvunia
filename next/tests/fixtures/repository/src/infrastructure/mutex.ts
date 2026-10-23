export class Mutex {
  private tail: Promise<void> = Promise.resolve();

  async exclusive<Result>(operation: () => Result): Promise<Result> {
    const preceding = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>((resolve) => { release = resolve; });
    await preceding;
    try {
      return operation();
    } finally {
      release();
    }
  }
}
