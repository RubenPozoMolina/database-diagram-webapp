import { test, expect } from '@playwright/test';

test.describe('Unique Constraint UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Add a table with columns
    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.getByLabel('Table name').fill('users');
    await page.getByRole('button', { name: /add column/i }).click();
    await page.getByPlaceholder('Column name').fill('id');
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByText('users')).toBeVisible();
  });

  test('adds a unique constraint to a single column and shows UQ badge', async ({
    page,
  }) => {
    const table = page.getByRole('region', { name: 'Table users' });

    // Add a second column and rename it to 'email'
    await page
      .getByRole('button', { name: /add a new column to this table/i })
      .click();
    await table.locator('.column-text', { hasText: /new_column: text/ }).dblclick();
    await page.locator('input.column-name-input').fill('email');
    await page.keyboard.press('Enter');

    // Open unique constraint dialog
    await table
      .getByRole('button', { name: /add a new unique constraint to this table/i })
      .click();

    // Fill constraint name
    const nameInput = page.getByPlaceholder('Constraint name');
    await nameInput.fill('users_email_key');

    // Select email column checkbox
    const emailCheckbox = page.getByRole('checkbox', {
      name: 'Include email in unique constraint',
    });
    await emailCheckbox.click();

    // Save
    await page.getByRole('button', { name: /save/i }).click();

    // Verify UQ badge is shown on the table
    await expect(page.getByText('UQ')).toBeVisible();
    await expect(page.getByTitle(/users_email_key/)).toBeVisible();
    await expect(page.getByTitle(/email/)).toBeVisible();

    // Take screenshot
    await page.screenshot({ path: '/artifacts/unique-constraint-single-column.png' });
  });

  test('adds a unique constraint to a group of columns', async ({ page }) => {
    const table = page.getByRole('region', { name: 'Table users' });

    // Add two columns and rename them to 'email' and 'name'
    await page
      .getByRole('button', { name: /add a new column to this table/i })
      .click();
    await table.locator('.column-text', { hasText: /new_column: text/ }).first().dblclick();
    await page.locator('input.column-name-input').fill('email');
    await page.keyboard.press('Enter');

    await page
      .getByRole('button', { name: /add a new column to this table/i })
      .click();
    await table.locator('.column-text', { hasText: /new_column: text/ }).last().dblclick();
    await page.locator('input.column-name-input').fill('name');
    await page.keyboard.press('Enter');

    // Open unique constraint editor
    await table
      .getByRole('button', { name: /add a new unique constraint to this table/i })
      .click();

    await page.getByPlaceholder('Constraint name').fill('orders_user_product_key');

    // Select multiple columns (email and name)
    const checkbox1 = page.getByRole('checkbox', {
      name: 'Include email in unique constraint',
    });
    const checkbox2 = page.getByRole('checkbox', {
      name: 'Include name in unique constraint',
    });
    await checkbox1.click();
    await checkbox2.click();

    await page.getByRole('button', { name: /save/i }).click();

    // Verify UQ badge is shown
    await expect(page.getByText('UQ')).toBeVisible();
    await expect(page.getByTitle(/orders_user_product_key/)).toBeVisible();

    await page.screenshot({ path: '/artifacts/unique-constraint-column-group.png' });
  });

  test('removes a unique constraint', async ({ page }) => {
    const table = page.getByRole('region', { name: 'Table users' });

    // Add a column and rename it to email, then add a unique constraint
    await page
      .getByRole('button', { name: /add a new column to this table/i })
      .click();
    await table.locator('.column-text', { hasText: /new_column: text/ }).dblclick();
    await page.locator('input.column-name-input').fill('email');
    await page.keyboard.press('Enter');

    await table
      .getByRole('button', { name: /add a new unique constraint to this table/i })
      .click();

    await page.getByPlaceholder('Constraint name').fill('users_email_key');
    await page
      .getByRole('checkbox', { name: 'Include email in unique constraint' })
      .click();
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText('UQ')).toBeVisible();

    // Remove the constraint
    await page
      .getByRole('button', { name: /Remove unique constraint users_email_key/i })
      .click();

    await expect(page.getByText('UQ')).not.toBeVisible();
  });
});
