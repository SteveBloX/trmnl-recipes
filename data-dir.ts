import path from "path";

/**
 * Where the app keeps what it writes while running: the scraped caches and the
 * proverb counters.
 *
 * Defaults to the working directory, so running it straight from a checkout
 * behaves exactly as before. The image sets DATA_DIR to a mounted volume —
 * without that, every redeploy would start from a container whose filesystem
 * is brand new, losing the counters and leaving `astrobin.json` missing until
 * its once-a-day cron fires.
 */
export const DATA_DIR = process.env.DATA_DIR || process.cwd();

export function dataPath(...segments: string[]): string {
  return path.join(DATA_DIR, ...segments);
}
