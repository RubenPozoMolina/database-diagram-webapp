import { test, expect } from '@playwright/test';

test.describe('Visual QA - Schema import orchestration UI (TASK-040)', () => {
  const testConnectionRoute = '**/api/v1/connections/test';
  const readSchemaRoute = '**/api/read-schema';

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  async function connectToDatabase(page: any) {
    // Mock the test-connection endpoint so we can reach the connected state
    await page.route(testConnectionRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    // Fill in the connection form using specific ID selectors
    await page.locator('#conn-host').fill('localhost');
    await page.locator('#conn-port').fill('5432');
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('s3cret');

    // Click Connect
    await page.getByRole('button', { name: /Connect/ }).click();

    // Wait for connected status
    await expect(
      page.getByText('Connection successful')
    ).toBeVisible();

    // The SchemaImportSelector should appear when connected
    await expect(page.getByLabel('Schema to import')).toBeVisible();
  }

  test('displays the schema import panel with all fields and controls visible', async ({
    page,
  }) => {
    await connectToDatabase(page);

    // Schema selector label and dropdown
    await expect(page.getByLabel('Schema to import')).toBeVisible();

    // Import button
    await expect(
      page.getByRole('button', { name: /Import PostgreSQL schema/i })
    ).toBeVisible();

    // Screenshot: schema import panel fully visible
    await page.screenshot({
      path: 'qa-artifacts/TASK-040-schema-import-panel-visible.png',
      fullPage: true,
    });
  });

  test('allows selecting a schema from the dropdown (public / information_schema)', async ({
    page,
  }) => {
    await connectToDatabase(page);

    const schemaSelect = page.getByLabel('Schema to import');

    // Default is 'public'
    await expect(schemaSelect).toHaveValue('public');

    // Select 'information_schema'
    await schemaSelect.selectOption('information_schema');
    await expect(schemaSelect).toHaveValue('information_schema');

    // Select back to 'public'
    await schemaSelect.selectOption('public');
    await expect(schemaSelect).toHaveValue('public');

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-schema-select-dropdown.png',
      fullPage: true,
    });
  });

  test('shows the custom schema input when "Other…" is selected and accepts typing', async ({
    page,
  }) => {
    await connectToDatabase(page);

    const schemaSelect = page.getByLabel('Schema to import');

    // Select 'Other…' (empty value)
    await schemaSelect.selectOption('');

    // The custom input should appear
    const customInput = page.getByLabel('Custom schema name');
    await expect(customInput).toBeVisible();

    // Type a custom schema name
    await customInput.fill('my_custom_schema');
    await expect(customInput).toHaveValue('my_custom_schema');

    // Clear it
    await customInput.fill('');
    await expect(customInput).toHaveValue('');

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-custom-schema-input.png',
      fullPage: true,
    });
  });

  test('sends the selected schema to the backend when importing', async ({
    page,
  }) => {
    // Mock both endpoints before connecting
    await page.route(testConnectionRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    await page.route(readSchemaRoute, async (route) => {
      const body = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      void body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          schema: 'public',
          tables: [
            {
              name: 'orders',
              columns: [
                {
                  name: 'order_id',
                  dataType: 'integer',
                  isNullable: false,
                  columnDefault: null,
                  maxLength: null,
                  numericPrecision: 32,
                  numericScale: 0,
                  datetimePrecision: null,
                  intervalType: null,
                },
                {
                  name: 'customer_id',
                  dataType: 'integer',
                  isNullable: false,
                  columnDefault: null,
                  maxLength: null,
                  numericPrecision: 32,
                  numericScale: 0,
                  datetimePrecision: null,
                  intervalType: null,
                },
              ],
              primaryKeys: [
                { constraintName: 'orders_pkey', columns: ['order_id'] },
              ],
              foreignKeys: [],
              uniqueConstraints: [],
              indexes: [],
            },
          ],
        }),
      });
    });

    await connectToDatabase(page);

    // Click Import Schema
    await page.getByRole('button', { name: /Import PostgreSQL schema/i }).click();

    // Wait for the response and verify the schema in the request
    const response = await page.waitForResponse(readSchemaRoute);
    const request = response.request();
    const postData = request.postDataJSON() as Record<string, unknown>;
    expect(postData.schema).toBe('public');

    // Wait for success message
    await expect(
      page.getByText(/Imported schema 'public' with 1 table\(s\)/)
    ).toBeVisible();

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-import-success.png',
      fullPage: true,
    });
  });

  test('sends a custom schema name entered via the "Other…" input to the backend', async ({
    page,
  }) => {
    // Mock both endpoints before connecting
    await page.route(testConnectionRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    await page.route(readSchemaRoute, async (route) => {
      const body = (await route.request().postDataJSON()) as Record<
        string,
        unknown
      >;
      void body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          schema: 'my_custom_schema',
          tables: [],
        }),
      });
    });

    await connectToDatabase(page);

    // Select 'Other…'
    const schemaSelect = page.getByLabel('Schema to import');
    await schemaSelect.selectOption('');

    // Type custom schema name
    const customInput = page.getByLabel('Custom schema name');
    await customInput.fill('my_custom_schema');

    // Click Import Schema
    await page.getByRole('button', { name: /Import PostgreSQL schema/i }).click();

    // Wait for the response and verify the custom schema in the request
    const response = await page.waitForResponse(readSchemaRoute);
    const request = response.request();
    const postData = request.postDataJSON() as Record<string, unknown>;
    expect(postData.schema).toBe('my_custom_schema');

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-custom-schema-import.png',
      fullPage: true,
    });
  });

  test('displays import progress while the request is in flight', async ({
    page,
  }) => {
    // Mock both endpoints before connecting
    await page.route(testConnectionRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    // Mock a slow read-schema endpoint
    await page.route(readSchemaRoute, async (route) => {
      // Hold the request open to test the progress indicator
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          schema: 'public',
          tables: [],
        }),
      });
    });

    await connectToDatabase(page);

    await page.getByRole('button', { name: /Import PostgreSQL schema/i }).click();

    // Import progress should appear while the request is in flight
    await expect(page.getByText('Importing schema…')).toBeVisible();

    // Wait for completion
    await expect(
      page.getByText(/Imported schema 'public' with 0 table\(s\)/)
    ).toBeVisible();

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-import-progress.png',
      fullPage: true,
    });
  });

  test('displays an error message when the import fails', async ({
    page,
  }) => {
    // Mock both endpoints before connecting
    await page.route(testConnectionRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    // Mock a failing read-schema endpoint
    await page.route(readSchemaRoute, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Schema not found' }),
      });
    });

    await connectToDatabase(page);

    await page.getByRole('button', { name: /Import PostgreSQL schema/i }).click();

    // Error should appear
    await expect(page.getByRole('alert')).toContainText(/Schema not found/);

    // Error should have a dismiss button
    await expect(page.getByRole('button', { name: /Dismiss import error/ })).toBeVisible();

    // Dismiss the error
    await page.getByRole('button', { name: /Dismiss import error/ }).click();
    await expect(page.getByRole('alert')).not.toBeVisible();

    await page.screenshot({
      path: 'qa-artifacts/TASK-040-import-error.png',
      fullPage: true,
    });
  });

  test('no console errors during schema import interactions', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await connectToDatabase(page);

    // Test all schema options
    const schemaSelect = page.getByLabel('Schema to import');
    await schemaSelect.selectOption('information_schema');
    await schemaSelect.selectOption('public');
    await schemaSelect.selectOption('');

    const customInput = page.getByLabel('Custom schema name');
    await customInput.fill('test_schema');
    await customInput.fill('');

    await page.getByRole('button', { name: /Import PostgreSQL schema/i }).click();

    expect(errors).toHaveLength(0);
  });
});
