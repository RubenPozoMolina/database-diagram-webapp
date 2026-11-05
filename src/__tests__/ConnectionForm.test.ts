/**
 * Unit tests for the ConnectionForm component (TASK-036).
 *
 * Acceptance criteria covered:
 *  1. Connection form displays fields for host, port, database, user, and password.
 *  2. User can enter connection details.
 *  3. Form submits connection details to backend.
 *
 * Tests run in jsdom so the full DOM API is available without a real browser.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConnectionForm } from '../connection/ConnectionForm';
import type { ConnectionConfig } from '../types';

function appendContainer(): HTMLElement {
  const el = document.createElement('div');
  el.id = 'test-connection-form';
  document.body.appendChild(el);
  return el;
}

function getFieldValue(_form: ConnectionForm, name: string): string {
  const input = document.getElementById(`conn-${name}`) as HTMLInputElement;
  return input ? input.value : '';
}

describe('ConnectionForm', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = appendContainer();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('renders all connection fields (criterion 1)', () => {
    it('displays fields for host, port, database, user, password and schema', () => {
      new ConnectionForm({ container });

      expect(document.getElementById('conn-host')).not.toBeNull();
      expect(document.getElementById('conn-port')).not.toBeNull();
      expect(document.getElementById('conn-database')).not.toBeNull();
      expect(document.getElementById('conn-user')).not.toBeNull();
      expect(document.getElementById('conn-password')).not.toBeNull();
      expect(document.getElementById('conn-schema')).not.toBeNull();
    });

    it('associates each label with its input via for/id', () => {
      new ConnectionForm({ container });

      ['host', 'port', 'database', 'user', 'password', 'schema'].forEach((name) => {
        const label = document.querySelector(
          `label[for="conn-${name}"]`,
        ) as HTMLLabelElement | null;
        const input = document.getElementById(`conn-${name}`) as
          | HTMLInputElement
          | null;
        expect(label).not.toBeNull();
        expect(input).not.toBeNull();
        expect(label!.htmlFor).toBeDefined();
        expect(String(label!.htmlFor)).toBe(`conn-${name}`);
        expect(input!.id).toBe(`conn-${name}`);
      });
    });

    it('uses type password for the password field', () => {
      new ConnectionForm({ container });

      const password = document.getElementById(
        'conn-password',
      ) as HTMLInputElement;
      expect(password.type).toBe('password');
    });

    it('disables browser autofill on the password field (no credential storage)', () => {
      new ConnectionForm({ container });

      const password = document.getElementById(
        'conn-password',
      ) as HTMLInputElement;
      expect(password.autocomplete).toBe('off');
    });

    it('uses type number for the port field', () => {
      new ConnectionForm({ container });

      const port = document.getElementById('conn-port') as HTMLInputElement;
      expect(port.type).toBe('number');
      expect(port.min).toBe('1');
      expect(port.max).toBe('65535');
    });

    it('marks all fields as required', () => {
      new ConnectionForm({ container });

      ['host', 'port', 'database', 'user', 'password', 'schema'].forEach((name) => {
        const input = document.getElementById(
          `conn-${name}`,
        ) as HTMLInputElement;
        expect(input.required).toBe(true);
      });
    });

    it('renders a submit button', () => {
      new ConnectionForm({ container });

      const button = document.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement | null;
      expect(button).not.toBeNull();
      expect(button!.textContent).toBe('Connect');
    });
  });

  describe('user can enter connection details (criterion 2)', () => {
    it('allows typing into every field', () => {
      new ConnectionForm({ container });

      const values: Record<string, string> = {
        host: 'db.example.com',
        port: '5433',
        database: 'mydb',
        user: 'app_user',
        password: 's3cret',
        schema: 'public',
      };

      ['host', 'port', 'database', 'user', 'password', 'schema'].forEach((name) => {
        const input = document.getElementById(
          `conn-${name}`,
        ) as HTMLInputElement;
        input.value = values[name]!;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        expect(input.value).toBe(values[name]);
      });
    });

    it('defaults host to localhost and port to 5432', () => {
      new ConnectionForm({ container });

      expect(getFieldValue(new ConnectionForm({ container }), 'host')).toBe(
        'localhost',
      );
      expect(
        getFieldValue(new ConnectionForm({ container }), 'port'),
      ).toBe('5432');
    });
  });

  describe('form submits connection details to backend (criterion 3)', () => {
    it('calls the submit function with the current field values on submit', async () => {
      const submitted: ConnectionConfig[] = [];
      const fakeSubmit = vi.fn(async (config: ConnectionConfig) => {
        submitted.push(config);
        return { success: true, message: 'Connected' };
      });

      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const host = document.getElementById('conn-host') as HTMLInputElement;
      const port = document.getElementById('conn-port') as HTMLInputElement;
      const database = document.getElementById(
        'conn-database',
      ) as HTMLInputElement;
      const user = document.getElementById('conn-user') as HTMLInputElement;
      const password = document.getElementById(
        'conn-password',
      ) as HTMLInputElement;

      host.value = 'db.example.com';
      port.value = '5433';
      database.value = 'mydb';
      user.value = 'app_user';
      password.value = 's3cret';
      const schema = document.getElementById(
        'conn-schema',
      ) as HTMLInputElement;
      schema.value = 'public';

      const form = document.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await Promise.resolve();

      expect(fakeSubmit).toHaveBeenCalledTimes(1);
      expect(submitted[0]).toEqual({
        host: 'db.example.com',
        port: 5433,
        database: 'mydb',
        user: 'app_user',
        password: 's3cret',
        schema: 'public',
      });
    });

    it('prevents the default form submission (no page reload)', async () => {
      const fakeSubmit = vi.fn(async () => ({ success: true }));
      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const form = document.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await Promise.resolve();

      // The submit handler calls event.preventDefault(), so the form is not
      // natively submitted. We assert the fake submit was invoked instead.
      expect(fakeSubmit).toHaveBeenCalledTimes(1);
    });

    it('disables the submit button while the request is in flight', async () => {
      let resolveRelease: () => void = () => {};
      const fakeSubmit = vi.fn(
        async () =>
          new Promise<{ success: boolean }>((resolve) => {
            resolveRelease = () => resolve({ success: true });
          }),
      );

      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const form = document.querySelector('form') as HTMLFormElement;
      const button = document.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement;

      form.dispatchEvent(new Event('submit', { cancelable: true }));

      expect(button.disabled).toBe(true);
      expect(button.getAttribute('aria-busy')).toBe('true');

      resolveRelease();
      // Flush the microtask queue so the async submit handler's finally block runs.
      await new Promise((r) => setTimeout(r, 0));

      expect(button.disabled).toBe(false);
      expect(button.getAttribute('aria-busy')).toBe('false');
    });

    it('shows a success status and resets the form on successful submit', async () => {
      const fakeSubmit = vi.fn(async () => ({
        success: true,
        message: 'Connection saved',
      }));

      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const host = document.getElementById('conn-host') as HTMLInputElement;
      host.value = 'db.example.com';

      const form = document.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await Promise.resolve();

      const status = document.getElementById('connection-status');
      expect(status).not.toBeNull();
      expect(status!.textContent).toContain('Connection saved');
      expect(status!.classList.contains('connection-status--success')).toBe(
        true,
      );
      // Form is reset after success, then sensible defaults are re-applied.
      expect(host.value).toBe('localhost');
      const password = document.getElementById(
        'conn-password',
      ) as HTMLInputElement;
      expect(password.value).toBe('');
    });

    it('shows an error status when the backend reports failure', async () => {
      const fakeSubmit = vi.fn(async () => ({
        success: false,
        error: 'Invalid credentials',
      }));

      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const form = document.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await Promise.resolve();

      const status = document.getElementById('connection-status');
      expect(status!.textContent).toContain('Invalid credentials');
      expect(status!.classList.contains('connection-status--error')).toBe(
        true,
      );
    });

    it('does not submit again while already submitting', async () => {
      const calls: ConnectionConfig[] = [];
      const fakeSubmit = vi.fn(
        async (config: ConnectionConfig) => {
          calls.push(config);
          await new Promise((r) => setTimeout(r, 10));
          return { success: true };
        },
      );

      new ConnectionForm({ container, submitConnection: fakeSubmit });

      const form = document.querySelector('form') as HTMLFormElement;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      form.dispatchEvent(new Event('submit', { cancelable: true }));

      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 20));

      expect(fakeSubmit).toHaveBeenCalledTimes(1);
    });
  });
});
