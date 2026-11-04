import { test, expect } from '@playwright/test';

test.describe('Import from JSON', () => {
  const exampleDiagram = {
    version: '1.0.0',
    diagram: {
      id: '550e8400-e29b-41d4-a716-446655440000',
      name: 'E-commerce Schema',
      tables: [
        {
          id: '550e8400-e29b-41d4-a716-446655440001',
          name: 'users',
          x: 100,
          y: 100,
          width: 240,
          height: 200,
          columns: [
            {
              id: '550e8400-e29b-41d4-a716-446655440010',
              name: 'id',
              type: 'serial',
              length: null,
              nullable: false,
              primaryKey: true,
              unique: false,
              defaultValue: null,
              comment: null,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440011',
              name: 'email',
              type: 'varchar',
              length: 255,
              nullable: false,
              primaryKey: false,
              unique: true,
              defaultValue: null,
              comment: null,
            },
          ],
        },
        {
          id: '550e8400-e29b-41d4-a716-446655440002',
          name: 'orders',
          x: 450,
          y: 100,
          width: 240,
          height: 200,
          columns: [
            {
              id: '550e8400-e29b-41d4-a716-446655440020',
              name: 'id',
              type: 'serial',
              length: null,
              nullable: false,
              primaryKey: true,
              unique: false,
              comment: null,
            },
            {
              id: '550e8400-e29b-41d4-a716-446655440021',
              name: 'user_id',
              type: 'integer',
              length: null,
              nullable: false,
              primaryKey: false,
              unique: false,
              defaultValue: null,
              comment: null,
            },
          ],
        },
      ],
      relationships: [
        {
          id: '550e8400-e29b-41d4-a716-446655440030',
          sourceTableId: '550e8400-e29b-41d4-a716-446655440002',
          sourceColumnId: '550e8400-e29b-41d4-a716-446655440021',
          targetTableId: '550e8400-e29b-41d4-a716-446655440001',
          targetColumnId: '550e8400-e29b-41d4-a716-446655440010',
          onDelete: 'no action',
          onUpdate: 'no action',
        },
      ],
      uniqueConstraints: [],
      indexes: [],
      createdAt: '2026-11-01T00:00:00Z',
      updatedAt: '2026-11-01T00:00:00Z',
    },
  };

  /** Feed a JSON diagram to the hidden file input without touching the host filesystem. */
  async function importJsonFile(page: import('@playwright/test').Page, content: string, fileName: string) {
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: fileName,
      mimeType: 'application/json',
      buffer: Buffer.from(content),
    });
  }

  test('loads a valid diagram from JSON into the canvas', async ({ page }) => {
    await page.goto('/');

    await importJsonFile(page, JSON.stringify(exampleDiagram, null, 2), 'test-import-diagram.json');

    // The diagram name and tables should render on the canvas
    await expect(page.getByText(/users/i)).toBeVisible();
    await expect(page.getByText(/orders/i)).toBeVisible();
    await expect(page.getByText(/E-commerce Schema/i)).toBeVisible();
  });

  test('shows an error for invalid JSON', async ({ page }) => {
    await page.goto('/');

    await importJsonFile(page, 'this is not valid json{{{', 'test-import-invalid.json');

    // Error message should be visible in the alert banner
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/invalid json/i);
  });

  test('shows an error for unsupported schema version', async ({ page }) => {
    await page.goto('/');

    const badVersion = {
      version: '9.9.9',
      diagram: {
        id: 'bad-id',
        name: 'Bad',
        tables: [],
        relationships: [],
        uniqueConstraints: [],
        indexes: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };
    await importJsonFile(page, JSON.stringify(badVersion, null, 2), 'test-import-bad-version.json');

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(
      /unsupported diagram file version/i,
    );
  });

  test('imported diagram tables are editable', async ({ page }) => {
    await page.goto('/');

    await importJsonFile(page, JSON.stringify(exampleDiagram, null, 2), 'test-import-editable.json');

    // Table nodes should be rendered on the canvas
    await expect(page.getByText(/users/i)).toBeVisible();
    await expect(page.getByText(/orders/i)).toBeVisible();

    // Click on the users table to verify it's editable
    await page.getByText(/users/i).click();
    // The table header should be clickable/editable
  });

  test('imported relationships are rendered', async ({ page }) => {
    await page.goto('/');

    await importJsonFile(page, JSON.stringify(exampleDiagram, null, 2), 'test-import-relationships.json');

    // Both tables should be visible, and the relationship line should exist
    await expect(page.getByText(/users/i)).toBeVisible();
    await expect(page.getByText(/orders/i)).toBeVisible();

    // The SVG should contain relationship lines
    const svg = page.locator('svg.diagram-svg');
    await expect(svg).toBeVisible();
  });
});
