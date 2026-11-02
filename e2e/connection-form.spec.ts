import { test, expect } from '@playwright/test';

test.describe('Connection form - test-connection endpoint integration', () => {
  const apiRoute = '**/api/v1/connections/test';

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('displays the connection form with all fields and controls visible', async ({ page }) => {
    await expect(page.getByLabel('Host')).toBeVisible();
    await expect(page.getByLabel('Port')).toBeVisible();
    await expect(page.getByLabel('Database')).toBeVisible();
    await expect(page.getByLabel('User')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Connect/ }),
    ).toBeVisible();
    await page.screenshot({
      path: 'qa-artifacts/TASK-053-connection-form-visible.png',
      fullPage: true,
    });
  });

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

    await page.getByLabel('Database').fill('mydb');
    await page.getByLabel('User').fill('app_user');
    await page.getByLabel('Password').fill('s3cret');

    await page.getByRole('button', { name: /Connect/ }).click();

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

    await page.getByLabel('Database').fill('mydb');
    await page.getByLabel('User').fill('app_user');
    await page.getByLabel('Password').fill('wrong-password');

    await page.getByRole('button', { name: /Connect/ }).click();

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

    await page.getByLabel('Database').fill('mydb');
    await page.getByLabel('User').fill('app_user');
    await page.getByLabel('Password').fill('s3cret');

    await page.getByRole('button', { name: /Connect/ }).click();

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
