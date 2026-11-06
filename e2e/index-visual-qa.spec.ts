import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('Visual QA - Index data model (TASK-020)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  async function createTableWithColumns(page: any, tableName: string, columnNames: string[]) {
    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.getByLabel('Table name').fill(tableName);
    for (const colName of columnNames) {
      await page.getByRole('button', { name: /add column/i }).click();
      const inputs = page.getByPlaceholder('Column name');
      await inputs.last().fill(colName);
    }
    await page.getByRole('button', { name: /create table/i }).click();
    await expect(page.getByText(tableName)).toBeVisible();
    return page.getByRole('region', { name: `Table ${tableName}` });
  }

  async function addIndex(page: any, indexName: string, columnName: string) {
    const table = page.getByRole('region', { name: 'Table users' });
    await table.getByRole('button', { name: /add a new index to this table/i }).click();
    await page.getByPlaceholder('Index name').fill(indexName);
    await page.selectOption('select[aria-label="Column to index"]', columnName);
    await page.getByRole('button', { name: /save/i }).click();
  }

  test('adds a single-column index, shows IX badge and index list entry', async ({
    page,
  }) => {
    await createTableWithColumns(page, 'users', ['id', 'email']);

    const table = page.getByRole('region', { name: 'Table users' });
    await expect(table.locator('.column-text', { hasText: /id: text/ })).toBeVisible();
    await expect(table.locator('.column-text', { hasText: /email: text/ })).toBeVisible();

    await addIndex(page, 'idx_email', 'email');

    // Verify IX badge appears on the indexed column
    await expect(page.getByTitle(/IX/)).toBeVisible();

    // Verify index appears in the index list
    await expect(page.getByText('idx_email')).toBeVisible();
    await expect(page.getByText(/on email/)).toBeVisible();

    // Screenshot: index added with IX badge
    await page.screenshot({
      path: '/artifacts/index-single-column.png',
      fullPage: true,
    });
  });

  test('edits an index name and column', async ({ page }) => {
    await createTableWithColumns(page, 'users', ['id', 'email']);

    const table = page.getByRole('region', { name: 'Table users' });

    // Add an index on the id column
    await addIndex(page, 'idx_id', 'id');

    // Edit the index
    await page.getByRole('button', { name: /Edit index idx_id/i }).click();
    await page.getByPlaceholder('Index name').fill('idx_user_id');
    await page.selectOption('select[aria-label="Column to index"]', 'email');
    await page.getByRole('button', { name: /save/i }).click();

    // Verify updated name and column
    await expect(page.getByText('idx_user_id')).toBeVisible();
    await expect(page.getByText(/on email/)).toBeVisible();
    await expect(page.getByText('idx_id')).not.toBeVisible();

    await page.screenshot({
      path: '/artifacts/index-edited.png',
      fullPage: true,
    });
  });

  test('removes an index and IX badge disappears', async ({ page }) => {
    await createTableWithColumns(page, 'users', ['id']);

    const table = page.getByRole('region', { name: 'Table users' });
    await addIndex(page, 'idx_id', 'id');

    await expect(page.getByTitle(/IX/)).toBeVisible();

    // Remove the index
    await page.getByRole('button', { name: /Remove index idx_id/i }).click();

    // Verify IX badge is gone
    await expect(page.getByTitle(/IX/)).not.toBeVisible();
    await expect(page.getByText('idx_id')).not.toBeVisible();

    await page.screenshot({
      path: '/artifacts/index-removed.png',
      fullPage: true,
    });
  });

  test('removing a column removes its associated index', async ({
    page,
  }) => {
    await createTableWithColumns(page, 'users', ['id', 'email']);

    const table = page.getByRole('region', { name: 'Table users' });
    await addIndex(page, 'idx_email', 'email');

    await expect(page.getByTitle(/IX/)).toBeVisible();
    await expect(page.getByText('idx_email')).toBeVisible();

    // Double-click email column to edit, then remove it
    await page.getByText(/email: text/).dblclick();
    // Wait for the edit row's Remove button to appear
    const removeButton = page.getByRole('button', { name: /Remove column email/i });
    await expect(removeButton).toBeVisible();
    await removeButton.click({ force: true });
    // Wait for React to re-render after column removal
    await page.waitForTimeout(1000);

    // Verify column and index are gone
    await expect(table.locator('.column-text', { hasText: /email: text/ })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText('idx_email')).not.toBeVisible();
    await expect(page.getByTitle(/IX/)).not.toBeVisible();

    await page.screenshot({
      path: '/artifacts/index-removed-with-column.png',
      fullPage: true,
    });
  });

  test('exported JSON contains indexes with tableId and columnIds', async ({
    page,
  }) => {
    await createTableWithColumns(page, 'users', ['id']);

    const table = page.getByRole('region', { name: 'Table users' });
    await addIndex(page, 'idx_id', 'id');

    // Export JSON
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /export diagram to json/i }).click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath!, 'utf-8');
    const json = JSON.parse(content);

    // Verify indexes array exists and contains our index
    expect(Array.isArray(json.diagram.indexes)).toBe(true);
    expect(json.diagram.indexes).toHaveLength(1);

    const index = json.diagram.indexes[0];
    expect(index.name).toBe('idx_id');
    expect(typeof index.tableId).toBe('string');
    expect(index.tableId.length).toBeGreaterThan(0);
    expect(Array.isArray(index.columnIds)).toBe(true);
    expect(index.columnIds).toHaveLength(1);
    expect(typeof index.columnIds[0]).toBe('string');

    await page.screenshot({
      path: '/artifacts/index-export-json.png',
      fullPage: true,
    });
  });

  test('no console errors during index interactions', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await createTableWithColumns(page, 'users', ['id']);

    const table = page.getByRole('region', { name: 'Table users' });
    await addIndex(page, 'idx_id', 'id');

    await expect(page.getByTitle(/IX/)).toBeVisible();

    expect(errors).toHaveLength(0);
  });
});
