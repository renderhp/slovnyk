export type WorkerRequest = { id: number } & (
  | { type: 'init' }
  | { type: 'open'; file: string }
  | { type: 'close' }
  | { type: 'search'; text: string }
  | { type: 'entries'; word: string }
  | {
      type: 'install'
      file: string
      lang: string
      buildDate: string
      parts: string[]
      total: number
      uncompressedSize: number
    }
  | { type: 'verify'; file: string; lang: string; buildDate: string; uncompressedSize: number }
  | { type: 'remove'; file: string }
)

export type WorkerResponse =
  | { id: number; type: 'result'; result: unknown }
  | { id: number; type: 'error'; message: string }
  | { id: number; type: 'progress'; loaded: number; total: number }
  /** Another tab holds the storage; the request continues once it's released. */
  | { id: number; type: 'waiting' }

type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never
export type RequestBody = DistributiveOmit<WorkerRequest, 'id'>
