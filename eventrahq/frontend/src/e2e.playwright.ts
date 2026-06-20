import { expect, test } from '@playwright/test';

test('public landing and authentication surfaces are usable', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Plan, sell, and operate events/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Explore events/i })).toBeVisible();
  await page.getByRole('link', { name: /Sign in/i }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email')).toBeVisible();
});
