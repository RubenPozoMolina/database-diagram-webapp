import { test, expect, type Page, type Locator } from '@playwright/test';

test.describe('Drag, move, and resize canvas elements (TASK-022)', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
    });
    page.on('pageerror', (err) => errors.push(`PAGE ERROR: ${err.message}`));
    await page.goto('/', { waitUntil: 'networkidle' });
    (page as any)._t022Errors = errors;
  });

  async function createTable(page: any, tableName: string) {
    await page.getByRole('button', { name: /add a new table/i }).click();
    await page.getByLabel('Table name').fill(tableName);
    await page.getByRole('button', { name: /create table/i }).click();
    return page.getByRole('region', { name: `Table ${tableName}` });
  }

  /* React's TableNode listens for native pointer events
   * (onPointerDown on header/resize-handle, window pointermove/up).
   * Playwright's page.mouse dispatches mouse events, so we drive the drag
   * with pointer events dispatched directly on the elements.
   */
  async function dragByPointer(
    page: Page,
    locator: Locator,
    dx: number,
    dy: number,
    steps = 8,
  ) {
    const el = locator.first();
    const box = await el.boundingBox();
    expect(box).toBeTruthy();
    const startX = box!.x + box!.width / 2;
    const startY = box!.y + box!.height / 2;
    const pointerId = 9;

    await el.dispatchEvent('pointerdown', {
      button: 0,
      buttons: 1,
      detail: 1,
      clientX: startX,
      clientY: startY,
      pointerId,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    });

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await page.locator('body').dispatchEvent('pointermove', {
        button: 0,
        buttons: 1,
        detail: 1,
        clientX: startX + dx * t,
        clientY: startY + dy * t,
        pointerId,
        pointerType: 'mouse',
        bubbles: true,
        cancelable: true,
      });
      await page.waitForTimeout(8);
    }

    await page.locator('body').dispatchEvent('pointerup', {
      button: 0,
      buttons: 0,
      detail: 1,
      pointerId,
      pointerType: 'mouse',
      bubbles: true,
      cancelable: true,
    });
  }

  test('AC1: User can drag a table to reposition on the canvas', async ({
    page,
  }) => {
    const table = await createTable(page, 'users');

    const initialBox = await table.boundingBox();
    expect(initialBox).toBeTruthy();

    const header = table.locator('.table-header');
    await dragByPointer(page, header, 160, 110);

    await page.waitForTimeout(300);

    const movedBox = await table.boundingBox();
    expect(movedBox).toBeTruthy();
    expect(movedBox!.x).not.toBe(initialBox!.x);
    expect(movedBox!.y).not.toBe(initialBox!.y);

    await page.screenshot({
      path: '/artifacts/task-022-ac1-dragged-table.png',
      fullPage: true,
    });
  });

  test('AC2: User can resize a table element using the resize handle', async ({
    page,
  }) => {
    const table = await createTable(page, 'users');

    const initialBox = await table.boundingBox();
    expect(initialBox).toBeTruthy();

    const handle = page.getByTestId('table-resize-handle');
    await expect(handle).toBeVisible();

    await dragByPointer(page, handle, 120, 100);

    await page.waitForTimeout(300);

    const resizedBox = await table.boundingBox();
    expect(resizedBox).toBeTruthy();
    expect(resizedBox!.width).toBeGreaterThan(initialBox!.width);
    expect(resizedBox!.height).toBeGreaterThan(initialBox!.height);

    await page.screenshot({
      path: '/artifacts/task-022-ac2-resized-table.png',
      fullPage: true,
    });
  });

  test('AC3: Canvas updates when elements are moved or resized', async ({
    page,
  }) => {
    const table = await createTable(page, 'users');

    const initialBox = await table.boundingBox();
    expect(initialBox).toBeTruthy();

    const header = table.locator('.table-header');
    await dragByPointer(page, header, 250, 160);

    await page.waitForTimeout(300);

    const movedBox = await table.boundingBox();
    expect(movedBox).toBeTruthy();
    expect(movedBox!.x).toBeGreaterThan(initialBox!.x);
    expect(movedBox!.y).toBeGreaterThan(initialBox!.y);

    const handle = page.getByTestId('table-resize-handle');
    await expect(handle).toBeVisible();

    await dragByPointer(page, handle, 100, 80);

    await page.waitForTimeout(300);

    const resizedBox = await table.boundingBox();
    expect(resizedBox).toBeTruthy();
    expect(resizedBox!.width).toBeGreaterThan(movedBox!.width);
    expect(resizedBox!.height).toBeGreaterThan(movedBox!.height);

    await expect(table).toBeVisible();

    await page.screenshot({
      path: '/artifacts/task-022-ac3-moved-and-resized.png',
      fullPage: true,
    });
  });

  test('Resize handle is fully visible and accessible', async ({ page }) => {
    const table = await createTable(page, 'users');

    const handle = page.getByTestId('table-resize-handle');
    await expect(handle).toBeVisible();
    await expect(handle).toHaveAttribute('role', 'button');
    await expect(handle).toHaveAttribute('aria-roledescription', 'resize handle');
    await expect(handle).toHaveAttribute('aria-label', 'Resize table');

    await page.screenshot({
      path: '/artifacts/task-022-resize-handle-visible.png',
      fullPage: true,
    });
  });

  test('Debug: check if resize handle click registers any state change', async ({
    page,
  }) => {
    const table = await createTable(page, 'users');

    const handle = page.getByTestId('table-resize-handle');
    await expect(handle).toBeVisible();

    // Click on the handle
    await handle.click();
    await page.waitForTimeout(500);

    // Check if any errors were logged
    const errors = (page as any)._t022Errors;
    if (errors && errors.length > 0) {
      console.log('Errors during handle click:', errors);
    }

    // Check table still has same size
    const box = await table.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBe(240);

    await page.screenshot({
      path: '/artifacts/task-022-debug-handle-click.png',
      fullPage: true,
    });
  });
});
