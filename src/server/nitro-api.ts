import { fetchViteEnv } from 'nitro/vite/runtime'
import type { HTTPEvent } from 'nitro/h3'

export default function handleApi({ req }: HTTPEvent) {
  return fetchViteEnv('ssr', req)
}
