// Subscribe before replacement: on Android replaceAsync may finish before ready.
export async function replacePlaybackSource(player, source, intent, timeoutMs = 30000) {
  let subscription;
  let timer;
  let rejectReady;
  const ready = player.addListener ? new Promise((resolve, reject) => {
    rejectReady = reject;
    subscription = player.addListener('statusChange', event => {
      if (event.status === 'readyToPlay') resolve();
      if (event.status === 'error') reject(new Error('Video source could not load.'));
    });
    timer = setTimeout(() => reject(new Error('Video loading timeout. Check your connection and retry.')), timeoutMs);
  }) : Promise.resolve();
  // Replacement may reject before readiness. Always consume both promises.
  ready.catch(() => {});
  try {
    await player.replaceAsync(source);
    if (player.status === 'readyToPlay') { clearTimeout(timer); subscription?.remove(); }
    else await ready;
    const position = Number.isFinite(intent.position) && intent.position >= 0 ? intent.position : 0;
    player.currentTime = Number.isFinite(player.duration) && player.duration > 0
      ? Math.min(position, Math.max(0, player.duration - 0.1)) : position;
    if (intent.playing) player.play(); else player.pause();
  } catch (error) { rejectReady?.(error); throw error; }
  finally { clearTimeout(timer); subscription?.remove(); }
}
