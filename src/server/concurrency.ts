// Reject excess work immediately instead of building an unbounded queue.
export class WorkLimit {
  private active = 0
  constructor(private maximum: number) {}
  async run<T>(work: () => Promise<T>): Promise<T> {
    if (this.active >= this.maximum)
      throw new Error('Image processing is busy. Try again shortly.')
    this.active++
    try {
      return await work()
    } finally {
      this.active--
    }
  }
}
