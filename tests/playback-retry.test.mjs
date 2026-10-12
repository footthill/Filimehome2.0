import test from 'node:test';
import assert from 'node:assert/strict';
import { replacePlaybackSource } from '../shared/playback.mjs';
import { videoContentType } from '../shared/domain.mjs';

// These fake-player tests verify replacement orchestration, not native decoding.
function fakePlayer(failures = 0) {
  let currentTime = 0;
  const calls = [];
  return {
    calls,
    get currentTime() { return currentTime; },
    set currentTime(value) { calls.push(['seek', value]); currentTime = value; },
    async replaceAsync(source) {
      calls.push(['replace', source]);
      if (failures-- > 0) throw new Error('Media request failed');
    },
    play() { calls.push(['play']); },
    pause() { calls.push(['pause']); },
  };
}

test('failed replacement surfaces the error and waits for an explicit retry of the same selected source', async () => {
  const player = fakePlayer(1);
  const selectedSource = { uri: 'https://media.example/720.m3u8#track', contentType: videoContentType('https://media.example/720.m3u8#track') };
  const intent = { position: 73, playing: true };
  await assert.rejects(replacePlaybackSource(player, selectedSource, intent), /Media request failed/);
  assert.deepEqual(player.calls, [['replace', selectedSource]]);
  assert.deepEqual(intent, { position: 73, playing: true });

  await replacePlaybackSource(player, selectedSource, intent);
  assert.deepEqual(player.calls, [
    ['replace', selectedSource], ['replace', selectedSource], ['seek', 73], ['play'],
  ]);
  assert.equal(selectedSource.contentType, 'hls');
});

test('successful replacement restores position without starting paused playback', async () => {
  const player = fakePlayer();
  const source = { uri: 'https://media.example/owned.mp4', contentType: 'progressive' };
  await replacePlaybackSource(player, source, { position: 42, playing: false });
  assert.deepEqual(player.calls, [['replace', source], ['seek', 42], ['pause']]);
});

test('repeated replacement failures never seek, play or silently fall back to another URL', async () => {
  const player = fakePlayer(2);
  const source = { uri: 'https://media.example/1080.mp4', contentType: 'progressive' };
  const intent = { position: 19, playing: false };
  await assert.rejects(replacePlaybackSource(player, source, intent));
  await assert.rejects(replacePlaybackSource(player, source, intent));
  assert.deepEqual(player.calls, [['replace', source], ['replace', source]]);
  await replacePlaybackSource(player, source, intent);
  assert.deepEqual(player.calls.slice(2), [['replace', source], ['seek', 19], ['pause']]);
});

test('invalid stored positions reset safely after successful replacement', async () => {
  for (const position of [-1, NaN, Infinity]) {
    const player = fakePlayer();
    await replacePlaybackSource(player, 'local-authorized-source', { position, playing: false });
    assert.equal(player.currentTime, 0);
    assert.deepEqual(player.calls.at(-1), ['pause']);
  }
});
