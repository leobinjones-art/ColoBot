export interface Channel {
  id: string
  start(): Promise<void>
  stop(): Promise<void>
}
