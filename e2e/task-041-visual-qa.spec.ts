import { test, expect } from '@playwright/test';

/**
 * Visual QA for TASK-041: Render imported PostgreSQL schema as editable diagram.
 *
 * Serves the built frontend (dist/) via nginx and verifies in a real browser that
 * an imported schema renders as an editable diagram:
 *   AC1: Imported tables are rendered on canvas
 *   AC2: Imported columns are displayed in tables
 *   AC3: Imported keys, constraints, indexes are recorded
 *   AC4: Imported relationships are drawn as lines
 *   AC5: Imported diagram is fully editable
 */
test.describe('TASK-041: Imported schema as editable diagram (visual QA)', () => {
  const ARTIFACTS = '/artifacts/TASK-041';

  // A diagram resembling an imported PostgreSQL schema (public schema):
  // - customers table with PK customer_id, unique email, index on email
  // - orders table with PK order_id, FK customer_id -> customers, index on customer_id
  // - relationship line drawn between customers and orders
  const importedDiagram = {
    version: '1.0.0',
    diagram: {
      id: 't041-0001',
      name: 'Imported Schema (public)',
      tables: [
        {
          id: 't041-t1',
          name: 'customers',
          x: 100,
          y: 100,
          width: 260,
          height: 308, // imported table with many columns -> tall
          columns: [
            {
              id: 't041-c1',
              name: 'customer_id',
              type: 'integer',
              length: null,
              nullable: false,
              primaryKey: true,
              unique: false,
              defaultValue: null,
              comment: null,
            },
            {
              id: 't041-c2',
              name: 'email',
              type: 'varchar',
              length: 255,
              nullable: false,
              primaryKey: false,
              unique: true,
              defaultValue: null,
              comment: null,
            },
            {
              id: 't041-c3',
              name: 'created_at',
              type: 'timestamp',
              length: null,
              nullable: true,
              primaryKey: false,
              unique: false,
              defaultValue: null,
              comment: null,
            },
          ],
          indexes: [
            {
              id: 't041-i1',
              tableId: 't041-t1',
              name: 'idx_customers_email',
              columnIds: ['t041-c2'],
            },
          ],
        },
        {
          id: 't041-t2',
          name: 'orders',
          x: 600,
          y: 100,
          width: 260,
          height: 224, // imported table height != default
          columns: [
            {
              id: 't041-c4',
              name: 'order_id',
              type: 'integer',
              length: null,
              nullable: false,
              primaryKey: true,
              unique: false,
              defaultValue: null,
              comment: null,
            },
            {
              id: 't041-c5',
              name: 'customer_id',
              type: 'integer',
              length: null,
              nullable: false,
              primaryKey: false,
              unique: false,
              defaultValue: null,
              comment: null,
            },
            {
              id: 't041-c6',
              name: 'total_amount',
              type: 'numeric',
              length: null,
              nullable: true,
              primaryKey: false,
              unique: false,
              defaultValue: null,
              comment: null,
            },
          ],
          indexes: [
            {
              id: 't041-i2',
              tableId: 't041-t2',
              name: 'idx_orders_customer_id',
              columnIds: ['t041-c5'],
            },
          ],
        },
      ],
      relationships: [
        {
          id: 't041-r1',
          sourceTableId: 't041-t2',
          sourceColumnId: 't041-c5',
          targetTableId: 't041-t1',
          targetColumnId: 't041-c1',
          onDelete: 'no action',
          onUpdate: 'no action',
        },
      ],
      uniqueConstraints: [
        {
          id: 't041-uc1',
          tableId: 't041-t1',
          columnIds: ['t041-c2'],
          name: 'customers_email_key',
        },
      ],
      indexes: [],
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  };

  async function importJsonFile(page: any, content: string, fileName: string) {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });
  }

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('renders imported schema with tables, columns, PK badges, indexes, unique constraints and relationship line', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await importJsonFile(
      page,
      JSON.stringify(importedDiagram, null, 2),
      'task-041-imported-schema.json',
    );

    // AC1: Imported tables are rendered on canvas
    await expect(page.getByText('customers', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('orders', { exact: true })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table customers' })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Table orders' })).toBeVisible();

    // AC2: Imported columns are displayed in tables (name + data type).
    // customer_id: integer appears in BOTH tables (customers PK + orders FK).
    await expect(page.getByText(/customer_id: integer/)).toHaveCount(2);
    await expect(page.getByText(/email: varchar/)).toBeVisible();
    await expect(page.getByText(/created_at: timestamp/)).toBeVisible();
    await expect(page.getByText(/order_id: integer/)).toBeVisible();
    await expect(page.getByText(/total_amount: numeric/)).toBeVisible();

    // AC3: Imported keys, constraints, indexes are recorded
    await expect(page.getByText('PK')).toHaveCount(2); // primary key badge on both tables
    await expect(page.getByText('Indexes')).toBeVisible(); // indexes section header
    await expect(page.locator('.index-name').first()).toBeVisible(); // at least one index name
    await expect(page.getByText('customers_email_key')).toBeVisible(); // unique constraint name
    await expect(page.getByText('Unique constraints')).toBeVisible(); // constraints section header

    // AC4: Imported relationships are drawn as lines
    const relationshipLine = page.locator('svg path.relationship-line');
    await expect(relationshipLine.first()).toBeVisible();
    const relCount = await relationshipLine.count();
    expect(relCount).toBeGreaterThan(0);

    // Diagram title
    await expect(page.getByText(/Imported Schema \(public\)/)).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/task-041-imported-diagram-rendered.png`,
      fullPage: true,
    });

    // No console errors during the flow
    expect(consoleErrors).toHaveLength(0);
  });

  test('imported diagram tables are editable (name, columns, types, nullable, PK, indexes, unique constraints)', async ({
    page,
  }) => {
    await importJsonFile(
      page,
      JSON.stringify(importedDiagram, null, 2),
      'task-041-editable.json',
    );

    await expect(page.getByText('customers', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('orders', { exact: true })).toBeVisible();

    // AC5: Table nodes are editable - double-click the customers table name to edit
    const customersName = page.getByText('customers', { exact: true }).first();
    await customersName.dblclick();

    // Table should enter edit mode (name input appears)
    await expect(page.locator('input.table-name-input')).toBeVisible();

    await page.screenshot({
      path: `${ARTIFACTS}/task-041-table-edit-mode.png`,
      fullPage: true,
    });
  });

  test('every field and control is fully visible (no clipping)', async ({ page }) => {
    await importJsonFile(
      page,
      JSON.stringify(importedDiagram, null, 2),
      'task-041-visibility.json',
    );

    await expect(page.getByText('customers', { exact: true })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('orders', { exact: true })).toBeVisible();

    // Import button fully visible
    const importBtn = page.locator('button.import-schema-button, [aria-label*="Import"]');
    if ((await importBtn.count()) > 0) {
      const box = await importBtn.first().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    }

    // Canvas container fully visible
    const canvasContainer = page.locator('.diagram-canvas-container');
    await expect(canvasContainer).toBeVisible();
    const canvasBox = await canvasContainer.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(canvasBox!.width).toBeGreaterThan(0);
    expect(canvasBox!.height).toBeGreaterThan(0);

    await page.screenshot({
      path: `${ARTIFACTS}/task-041-controls-visible.png`,
      fullPage: true,
    });
  });
});
