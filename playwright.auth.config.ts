import { defineConfig } from "@playwright/test";
export default defineConfig({
  outputDir: "test-results/auth",
  testDir: "./tests/auth-browser",
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  // Run against the separately configured local development app. Credentials
  // stay in Node. No traces, videos or screenshots of real account screens.
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    reducedMotion: "reduce",
    trace: "off",
    video: "off",
    screenshot: "off",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
