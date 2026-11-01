import { test, expect } from '@playwright/test';

test.describe('Create Diagram', () => {
  test('displays an empty canvas when the application loads', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByText(/Empty diagram canvas/i),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /create a new empty diagram/i }),
    ).toBeVisible();
  });

  test('New Diagram button clears and resets the canvas', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /create a new empty diagram/i })
      .click();
    await expect(
      page.getByText(/Empty diagram canvas/i),
    ).toBeVisible();
  });
});
