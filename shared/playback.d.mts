export type PlaybackIntent = { position: number; playing: boolean };
export function replacePlaybackSource<Source>(player: {
  replaceAsync(source: Source): Promise<void>;
  currentTime: number;
  play(): void;
  pause(): void;
  status?: string;
  addListener?(event: 'statusChange', listener: (event: { status: string }) => void): { remove(): void };
}, source: Source, intent: PlaybackIntent, timeoutMs?: number): Promise<void>;
