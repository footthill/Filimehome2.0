// This function does one explicit replacement attempt. A rejection leaves the
// caller's intent intact so the UI can offer retry without guessing a source.
export async function replacePlaybackSource(player, source, intent) {
  await player.replaceAsync(source);
  player.currentTime = Number.isFinite(intent.position) && intent.position >= 0 ? intent.position : 0;
  if (intent.playing) player.play();
  else player.pause();
}
