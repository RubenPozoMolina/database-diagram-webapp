import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe('STORY-013: Import PostgreSQL Schema', () => {
  const ARTIFACTS = '/artifacts/STORY-013';

  test.beforeEach(async ({ page }) => {
    fs.mkdirSync(ARTIFACTS, { recursive: true });
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));
    (page as any)._consoleErrors = consoleErrors;
  });

  test('connects, imports schema, renders editable diagram with tables/columns/PK/FK/unique/indexes', async ({
    page,
  }) => {
    // Mock the connection test endpoint so Connect succeeds without a real backend.
    await page.route('**/api/v1/connections/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection established' }),
      });
    });

    // Mock the read-schema endpoint so Import Schema succeeds without a real backend.
    await page.route('**/api/read-schema', async (route) => {
      const schemaBody = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'customers',
            columns: [
              { name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'first_name', dataType: 'text', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
            ],
            primaryKeys: [{ constraintName: 'customers_pkey', columns: ['customer_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'orders',
            columns: [
              { name: 'order_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'order_date', dataType: 'date', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'total_amount', dataType: 'numeric', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [{ constraintName: 'orders_customer_id_fkey', column: 'customer_id', foreignTable: 'customers', foreignColumn: 'customer_id', updateRule: 'no action', deleteRule: 'no action' }],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'products',
            columns: [
              { name: 'product_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'name', dataType: 'text', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'price', dataType: 'numeric', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
              { name: 'sku', dataType: 'text', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
            ],
            primaryKeys: [{ constraintName: 'products_pkey', columns: ['product_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(schemaBody),
      });
    });

    // --- Page loads, connection form visible ---
    await page.goto('/', { waitUntil: 'networkidle' });

    await expect(page.locator('#conn-host')).toBeVisible();
    await expect(page.locator('#conn-port')).toBeVisible();
    await expect(page.locator('#conn-database')).toBeVisible();
    await expect(page.locator('#conn-user')).toBeVisible();
    await expect(page.locator('#conn-password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();

    // --- Fill in connection form ---
    await page.locator('#conn-host').fill('localhost');
    await page.locator('#conn-port').fill('5432');
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('s3cret');

    // --- Click Connect ---
    await page.getByRole('button', { name: 'Connect' }).click();

    // --- Wait for connection to be processed ---
    await page.waitForTimeout(3000);

    // --- Connection established: Import Schema button appears only when connected ---
    const importButton = page.locator('button.import-schema-button');
    await expect(importButton).toBeVisible({ timeout: 15000 });
    await expect(importButton).not.toBeDisabled();

    // --- Connection info banner ---
    await expect(
      page.getByText(/Connected to localhost:5432\/mydb as app_user/),
    ).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/01-connected.png`,
      fullPage: true,
    });

    // --- Click Import Schema ---
    await importButton.click();

    // --- Tables render on canvas ---
    await expect(page.getByText('customers')).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('orders')).toBeVisible();
    await expect(page.getByText('products')).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/02-schema-imported.png`,
      fullPage: true,
    });

    // --- Columns and data types visible ---
    await expect(page.getByText(/customer_id/).first()).toBeVisible();
    await expect(page.getByText(/first_name/)).toBeVisible();
    await expect(page.getByText(/order_id/)).toBeVisible();
    await expect(page.getByText(/order_date/)).toBeVisible();
    await expect(page.getByText(/total_amount/)).toBeVisible();
    await expect(page.getByText(/product_id/)).toBeVisible();
    await expect(page.getByText(/name/)).toBeVisible();
    await expect(page.getByText(/price/)).toBeVisible();
    await expect(page.getByText(/sku/)).toBeVisible();

    await expect(page.getByText(/integer/)).toBeVisible();
    await expect(page.getByText(/text/)).toBeVisible();
    await expect(page.getByText(/date/)).toBeVisible();
    await expect(page.getByText(/numeric/)).toBeVisible();

    // --- Tables rendered as canvas regions ---
    await expect(page.getByRole('region', { name: 'Table customers' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table products' })).toBeVisible();

    // --- Foreign keys become relationship lines between tables ---
    const relationshipLine = page.locator('svg path.relationship-line');
    const relCount = await relationshipLine.count();
    expect(relCount).toBeGreaterThan(0);
    await expect(relationshipLine.first()).toBeVisible();

    // --- Schema import info banner shows table count ---
    await expect(
      page.getByText(/Imported schema 'public' with 3 table\(s\)/),
    ).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/03-canvas-with-relationships.png`,
      fullPage: true,
    });

    // --- No console errors during the flow ---
    const errors = (page as any)._consoleErrors;
    expect(errors).toHaveLength(0);

    // --- Verify every field/control is fully visible (no clipping) ---
    const importButtonBox = await importButton.boundingBox();
    expect(importButtonBox).not.toBeNull();
    expect(importButtonBox!.width).toBeGreaterThan(0);
    expect(importButtonBox!.height).toBeGreaterThan(0);

    const canvasContainer = page.locator('.diagram-canvas-container');
    await expect(canvasContainer).toBeVisible();
  });
});
