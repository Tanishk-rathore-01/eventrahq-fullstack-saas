import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src',
  testMatch: 'e2e.playwright.ts',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'on-first-retry' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_API_URL: 'http://127.0.0.1:5050/api',
      VITE_SUPABASE_URL: 'https://example.supabase.co',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'public-test-key'
    }
  }
});
