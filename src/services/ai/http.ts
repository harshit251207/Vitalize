const DEFAULT_TIMEOUT_MS = 20000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    const name = error instanceof Error ? error.name : '';
    if (name === 'AbortError') {
      throw new Error('The AI request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
