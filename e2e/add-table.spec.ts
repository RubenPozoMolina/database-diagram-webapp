import { test, expect } from '@playwright/test';

test.describe('Add Table', () => {
  test('adds a table with a name and editable columns', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Add a new table to the canvas/i }).click();

    // The table appears on the canvas with a name.
    await expect(page.getByText('Table 1')).toBeVisible();

    // The table exposes an editable list of columns.
    await expect(page.getByLabelText('Add column')).toBeVisible();
    await expect(page.getByLabelText('Column name')).toBeVisible();
    await expect(page.getByLabelText('Data type')).toBeVisible();
  });

  test('editing a column name persists on the canvas', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /Add a new table to the canvas/i }).click();

    const nameInput = page.getByLabelText('Column name').first();
    await nameInput.fill('identifier');

    await expect(nameInput).toHaveValue('identifier');
    await expect(page.getByText('Table 1')).toBeVisible();
  });

  test('can add multiple tables', async ({ page }) => {
    await page.goto('/');

    const addTableButton = page.getByRole('button', {
      name: /Add a new table to the canvas/i,
    });
    await addTableButton.click();
    await addTableButton.click();

    await expect(page.getByText('Table 1')).toBeVisible();
    await expect(page.getByText('Table 2')).toBeVisible();
  });
});
