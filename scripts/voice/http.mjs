// One HTTP call with retries for the voice providers. Rate limits, 5xx and network errors back off and
// retry; any other 4xx fails at once, because a bad key, empty quota or bad request won't fix itself.
const RETRIES = 3;

export class HttpError extends Error {
  constructor(label, status, detail) {
    super(`${label} ${status}: ${detail}`);
    this.status = status;
  }
}

const retryable = (status) => status === 429 || status >= 500;
const wait = (ms) => new Promise((done) => setTimeout(done, ms));

export async function fetchWithRetry(url, init = {}, { label, timeoutMs = 120000, sleep = wait } = {}) {
  let lastError;
  for (let attempt = 0; attempt < RETRIES; attempt += 1) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return response;
      lastError = new HttpError(label, response.status, (await response.text()).slice(0, 300));
      if (!retryable(response.status)) throw lastError;
    } catch (error) {
      if (error instanceof HttpError && !retryable(error.status)) throw error;
      if (error.name === "TimeoutError") lastError = new Error(`${label} timed out after ${timeoutMs / 1000}s`);
      else if (!(error instanceof HttpError)) lastError = new Error(`${label} unreachable at ${new URL(url).origin}: ${error.cause?.code ?? error.message}`);
    }
    if (attempt < RETRIES - 1) await sleep(1000 * 2 ** attempt);
  }
  throw lastError;
}

/** A settings value that must be an http(s) URL; returned without a trailing slash. */
export function httpBase(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a URL like http://127.0.0.1:3900/v1, got "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`${name} must be an http or https URL, got "${url.protocol}"`);
  return value.replace(/\/+$/, "");
}
