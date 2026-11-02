import { test, expect } from '@playwright/test';

test.describe('Add Table', () => {
  test('adds a table with a name and columns to the canvas', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /add a new table/i }).click();

    await expect(page.getByLabel('Table name')).toBeVisible();
    await page.getByLabel('Table name').fill('users');

    await page.getByRole('button', { name: /add column/i }).click();
    await page.getByPlaceholder('Column name').fill('id');

    await page.getByRole('button', { name: /create table/i }).click();

    await expect(page.getByText('users')).toBeVisible();
    await expect(page.getByText(/id: text/)).toBeVisible();
  });

  test('shows an error when submitting without a table name', async ({
    page,
  }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.locator('form.create-table-form').dispatchEvent('submit');

    await expect(page.getByText(/table name is required/i)).toBeVisible();
  });
});
