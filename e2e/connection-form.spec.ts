import { test, expect } from '@playwright/test';

test.describe('Connection form - test-connection endpoint integration', () => {
  const apiRoute = '**/api/v1/connections/test';

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('displays the connection form with all fields and controls visible', async ({ page }) => {
    await expect(page.locator('#conn-host')).toBeVisible();
    await expect(page.locator('#conn-port')).toBeVisible();
    await expect(page.locator('#conn-database')).toBeVisible();
    await expect(page.locator('#conn-user')).toBeVisible();
    await expect(page.locator('#conn-password')).toBeVisible();
    await expect(page.locator('#conn-schema')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'qa-artifacts/TASK-053-connection-form-visible.png',
      fullPage: true,
    });
  });

  async function fillConnectionForm(page: any) {
    await page.locator('#conn-host').fill('localhost');
    await page.locator('#conn-port').fill('5432');
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('s3cret');
    await page.locator('#conn-schema').fill('public');
  }

  test('calls the test-connection endpoint and displays success on valid connection', async ({
    page,
  }) => {
    await page.route(apiRoute, async (route) => {
      const body = (await route.request().postDataJSON()) as Record<string, unknown>;
      void body;
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    await fillConnectionForm(page);

    await page.getByRole('button', { name: 'Connect' }).click();

    const status = page.locator('#connection-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/connection-status--success/);
    await expect(status).toContainText('Connection successful');
    await page.screenshot({
      path: 'qa-artifacts/TASK-053-connection-success.png',
      fullPage: true,
    });
  });

  test('displays a descriptive error on invalid connection (401)', async ({ page }) => {
    await page.route(apiRoute, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Invalid credentials' }),
      });
    });

    await page.locator('#conn-host').fill('localhost');
    await page.locator('#conn-port').fill('5432');
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('wrong-password');

    await page.getByRole('button', { name: 'Connect' }).click();

    const status = page.locator('#connection-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/connection-status--error/);
    await expect(status).toContainText('Invalid credentials');
    await page.screenshot({
      path: 'qa-artifacts/TASK-053-connection-error-401.png',
      fullPage: true,
    });
  });

  test('displays a descriptive error on network failure', async ({ page }) => {
    await page.route(apiRoute, async (route) => {
      await route.abort();
    });

    await page.locator('#conn-host').fill('localhost');
    await page.locator('#conn-port').fill('5432');
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('s3cret');

    await page.getByRole('button', { name: 'Connect' }).click();

    const status = page.locator('#connection-status');
    await expect(status).toBeVisible();
    await expect(status).toHaveClass(/connection-status--error/);
    await expect(status).toContainText('Failed to fetch');
    await page.screenshot({
      path: 'qa-artifacts/TASK-053-connection-error-network.png',
      fullPage: true,
    });
  });
});
