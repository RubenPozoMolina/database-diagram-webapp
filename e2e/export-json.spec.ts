import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test.describe('Export to JSON', () => {
  test('downloads a JSON file containing the diagram model', async ({ page }) => {
    await page.goto('/');

    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: /export diagram to json/i })
      .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.json$/);

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath!, 'utf-8');
    const json = JSON.parse(content);

    expect(json.version).toBe('1.0.0');
    expect(json.diagram).toBeDefined();
    expect(json.diagram.id).toBeDefined();
    expect(json.diagram.name).toBeDefined();
    expect(Array.isArray(json.diagram.tables)).toBe(true);
    expect(Array.isArray(json.diagram.relationships)).toBe(true);
    expect(Array.isArray(json.diagram.uniqueConstraints)).toBe(true);
    expect(Array.isArray(json.diagram.indexes)).toBe(true);
  });

  test('exported JSON contains no database credentials', async ({ page }) => {
    await page.goto('/');

    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: /export diagram to json/i })
      .click();
    const download = await downloadPromise;

    const filePath = await download.path();
    expect(filePath).toBeTruthy();
    const content = fs.readFileSync(filePath!, 'utf-8').toLowerCase();

    for (const credential of [
      'host',
      'port',
      'database',
      '"user"',
      'password',
    ]) {
      expect(content).not.toContain(credential);
    }
  });
});
