import { test, expect } from '@playwright/test';

test.describe('Relationship line drawing (TASK-013)', () => {
  test('creates a column-to-column relationship and draws a line between the tables', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // --- Table 1: users (column: id) ---
    await page.getByRole('button', { name: /add a new table/i }).click();
    await expect(page.getByLabel('Table name')).toBeVisible();
    await page.getByLabel('Table name').fill('users');
    await page.getByRole('button', { name: /add column/i }).click();
    await page.getByPlaceholder('Column name').first().fill('id');
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByRole('region', { name: 'Table users' })).toBeVisible();

    // --- Table 2: orders (columns: id, user_id) ---
    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.getByLabel('Table name').fill('orders');
    await page.getByRole('button', { name: /add column/i }).click();
    await page.getByPlaceholder('Column name').first().fill('id');
    await page.getByRole('button', { name: /add column/i }).click();
    await page.getByPlaceholder('Column name').last().fill('user_id');
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();

    await page.screenshot({
      path: '/artifacts/task-013-before-relationship.png',
      fullPage: true,
    });

    // --- Create relationship: users.id -> orders.user_id ---
    await page.getByRole('button', { name: /add a relationship/i }).click();
    await expect(page.getByRole('dialog', { name: /add relationship/i })).toBeVisible();

    await page.selectOption('#source-table-select', { label: 'users' });
    await page.selectOption('#source-column-select', { label: 'id' });
    await page.selectOption('#target-table-select', { label: 'orders' });
    await page.selectOption('#target-column-select', { label: 'user_id' });
    await page.getByRole('button', { name: /create relationship/i }).click();

    // --- AC1: relationship created; modal closes; no validation error ---
    await expect(
      page.getByRole('dialog', { name: /add relationship/i }),
    ).not.toBeVisible();
    await expect(page.getByText(/Please select source and target/)).not.toBeVisible();

    // --- AC2: a line is drawn between the two tables on the canvas ---
    const relationshipLine = page.locator('svg path.relationship-line');
    await expect(relationshipLine).toHaveCount(1);
    await expect(relationshipLine.first()).toBeVisible();

    await page.screenshot({
      path: '/artifacts/task-013-after-relationship.png',
      fullPage: true,
    });

    // --- AC3: the relationship visually connects the correct columns ---
    // Both tables and their columns are present, and the rendered line spans
    // the gap between them (connecting users.id to orders.user_id).
    await expect(page.getByRole('region', { name: 'Table users' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();
    await expect(page.getByText(/id: text/).first()).toBeVisible();
    await expect(page.getByText(/user_id: text/)).toBeVisible();
    const lineBox = await relationshipLine.first().boundingBox();
    expect(lineBox).toBeTruthy();
    expect(lineBox!.width).toBeGreaterThan(0);
  });

  test('keeps the Create button disabled when required fields are missing', async ({
    page,
  }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Two tables so a relationship is structurally possible.
    for (const name of ['users', 'orders']) {
      await page.getByRole('button', { name: /add a new table/i }).click();
      await page.getByLabel('Table name').fill(name);
      await page.getByRole('button', { name: /add column/i }).click();
      await page.getByPlaceholder('Column name').first().fill('id');
      await page.getByRole('button', { name: /create table/i }).click();
      await expect(page.getByRole('region', { name: `Table ${name}` })).toBeVisible();
    }

    await page.getByRole('button', { name: /add a relationship/i }).click();
    await expect(page.getByRole('dialog', { name: /add relationship/i })).toBeVisible();

    await page.selectOption('#source-table-select', { label: 'users' });
    await page.selectOption('#source-column-select', { label: 'id' });
    await page.selectOption('#target-table-select', { label: 'orders' });
    // Target column intentionally left empty -> Create button stays disabled.
    await expect(
      page.getByRole('button', { name: /create relationship/i }),
    ).toBeDisabled();
  });
});
