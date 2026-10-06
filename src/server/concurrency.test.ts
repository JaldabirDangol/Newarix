import { expect, it } from 'vitest'
import { WorkLimit } from './concurrency'

it('rejects excess processing and releases capacity after failure', async () => {
  const work = new WorkLimit(1)
  let finish!: () => void
  const pending = work.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await expect(work.run(async () => 'excess')).rejects.toThrow('busy')
  finish()
  await pending
  await expect(
    work.run(async () => {
      throw new Error('processing failed')
    }),
  ).rejects.toThrow('processing failed')
  expect(await work.run(async () => 'recovered')).toBe('recovered')
})
