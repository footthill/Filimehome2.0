/** Bound the whole operation, including waits before fetch (for example auth locks). */
export async function withDeadline<T>(work: (signal: AbortSignal) => PromiseLike<T>, milliseconds = 15000, label = 'Request'): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${milliseconds / 1000}s. Check your connection and retry.`));
      controller.abort();
    }, milliseconds);
  });
  try { return await Promise.race([Promise.resolve().then(() => work(controller.signal)), timeout]); }
  finally { clearTimeout(timer); }
}
