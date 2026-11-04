import { test, expect } from '@playwright/test';

test.describe('Credential clearing on session end (TASK-048)', () => {
  const apiRoute = '**/api/v1/connections/test';

  test.beforeEach(async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('displays the connection form with all fields and controls fully visible', async ({
    page,
  }) => {
    // Every field and control must be fully visible (unique IDs avoid substring
    // matches on 'Export'/'Import' header buttons that contain 'port').
    await expect(page.locator('#conn-host')).toBeVisible();
    await expect(page.locator('#conn-port')).toBeVisible();
    await expect(page.locator('#conn-database')).toBeVisible();
    await expect(page.locator('#conn-user')).toBeVisible();
    await expect(page.locator('#conn-password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Connect', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: 'qa-artifacts/TASK-048-connection-form-visible.png',
      fullPage: true,
    });
  });

  test('clears credentials on page refresh and requires a new connection', async ({
    page,
  }) => {
    await page.route(apiRoute, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Connection successful' }),
      });
    });

    // Connect successfully.
    await page.locator('#conn-database').fill('mydb');
    await page.locator('#conn-user').fill('app_user');
    await page.locator('#conn-password').fill('s3cret');
    await page.getByRole('button', { name: 'Connect', exact: true }).click();

    // Reload the page (simulates page refresh / beforeunload session end).
    await page.reload({ waitUntil: 'networkidle' });

    // After session end, no connected state is shown: credentials are cleared
    // and not recoverable.
    const status = page.locator('#connection-status');
    await expect(status).not.toHaveClass(/connection-status--success/);
    await expect(page.locator('.connection-info')).not.toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Disconnect', exact: true }),
    ).not.toBeVisible();

    // Sensitive fields are empty: a new connection is required.
    await expect(page.locator('#conn-database')).toHaveValue('');
    await expect(page.locator('#conn-user')).toHaveValue('');
    await expect(page.locator('#conn-password')).toHaveValue('');
    await expect(
      page.getByRole('button', { name: 'Connect', exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: 'qa-artifacts/TASK-048-after-reload-cleared.png',
      fullPage: true,
    });
  });
});
