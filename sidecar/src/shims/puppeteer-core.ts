/**
 * puppeteer-core no-op shim for the sidecar.
 *
 * Web session mode (chat routing through a real browser) requires the
 * full desktop app environment. The sidecar always routes through the
 * Anthropic API directly. Routes that call puppeteer-core will get an
 * error, but they fall back to API mode gracefully.
 */

const puppeteer = {
  launch: async (_opts?: unknown): Promise<never> => {
    throw new Error('puppeteer-core: not available in sidecar mode — web session mode disabled');
  },
};

export default puppeteer;
