export type PlaybackIntent = { position: number; playing: boolean };
export function replacePlaybackSource<Source>(player: {
  replaceAsync(source: Source): Promise<void>;
  currentTime: number;
  play(): void;
  pause(): void;
}, source: Source, intent: PlaybackIntent): Promise<void>;
