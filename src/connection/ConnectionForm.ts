/**
 * ConnectionForm - UI form for entering PostgreSQL connection details.
 *
 * Renders a form with fields for host, port, database, user and password,
 * handles user input, and submits the connection to the backend on submit.
 *
 * Usage:
 *   const form = new ConnectionForm({ container: document.getElementById('connection-form') });
 *
 * Accessibility:
 *   - Semantic <form>, <label> and <input> elements with for/id associations.
 *   - Password field uses type="password".
 *   - Port field uses type="number" with min/max constraints.
 *   - Submit button announces loading/disabled state via aria-busy and disabled.
 *   - Status messages are exposed to assistive technology via role="status".
 */

import type { ConnectionConfig, ConnectionResult } from '../types';
import { submitConnection } from './connectionApi';

export interface ConnectionFormOptions {
  container?: HTMLElement;
  submitConnection?: (
    config: ConnectionConfig,
  ) => Promise<ConnectionResult>;
}

const DEFAULT_HOST = 'localhost';
const DEFAULT_PORT = 5432;

interface FormElements {
  form: HTMLFormElement;
  host: HTMLInputElement;
  port: HTMLInputElement;
  database: HTMLInputElement;
  user: HTMLInputElement;
  password: HTMLInputElement;
  schema: HTMLInputElement;
  submitButton: HTMLButtonElement;
  status: HTMLElement;
}

/**
 * The ConnectionForm component.
 */
export class ConnectionForm {
  private readonly container: HTMLElement;
  private readonly elements: FormElements;
  private readonly apiSubmit: (config: ConnectionConfig) => Promise<ConnectionResult>;
  private submitting = false;

  constructor(options: ConnectionFormOptions = {}) {
    this.container =
      options.container ??
      (() => {
        const el = document.createElement('div');
        el.id = 'connection-form-root';
        document.body.appendChild(el);
        return el;
      })();

    this.apiSubmit = options.submitConnection ?? submitConnection;
    this.elements = this.render();
    this.bindEvents();
    this.setDefaults();
  }

  /**
   * Builds the form DOM inside the container.
   */
  private render(): FormElements {
    const container = this.container;
    container.innerHTML = '';

    const form = document.createElement('form');
    form.className = 'connection-form';
    form.noValidate = true;

    const hostLabel = document.createElement('label');
    hostLabel.htmlFor = 'conn-host';
    hostLabel.textContent = 'Host';
    const hostInput = document.createElement('input');
    hostInput.id = 'conn-host';
    hostInput.name = 'host';
    hostInput.type = 'text';
    hostInput.placeholder = 'e.g. localhost';
    hostInput.required = true;
    hostInput.autocomplete = 'on';

    const portLabel = document.createElement('label');
    portLabel.htmlFor = 'conn-port';
    portLabel.textContent = 'Port';
    const portInput = document.createElement('input');
    portInput.id = 'conn-port';
    portInput.name = 'port';
    portInput.type = 'number';
    portInput.min = '1';
    portInput.max = '65535';
    portInput.placeholder = '5432';
    portInput.required = true;

    const databaseLabel = document.createElement('label');
    databaseLabel.htmlFor = 'conn-database';
    databaseLabel.textContent = 'Database';
    const databaseInput = document.createElement('input');
    databaseInput.id = 'conn-database';
    databaseInput.name = 'database';
    databaseInput.type = 'text';
    databaseInput.placeholder = 'e.g. postgres';
    databaseInput.required = true;

    const userLabel = document.createElement('label');
    userLabel.htmlFor = 'conn-user';
    userLabel.textContent = 'User';
    const userInput = document.createElement('input');
    userInput.id = 'conn-user';
    userInput.name = 'user';
    userInput.type = 'text';
    userInput.placeholder = 'e.g. postgres';
    userInput.required = true;

    const passwordLabel = document.createElement('label');
    passwordLabel.htmlFor = 'conn-password';
    passwordLabel.textContent = 'Password';
    const passwordInput = document.createElement('input');
    passwordInput.id = 'conn-password';
    passwordInput.name = 'password';
    passwordInput.type = 'password';
    passwordInput.placeholder = '••••••••';
    passwordInput.required = true;
    // Prevent the browser password manager from storing the credential on disk
    // (STORY-015: credentials must not persist beyond the current session).
    passwordInput.autocomplete = 'off';

    const schemaLabel = document.createElement('label');
    schemaLabel.htmlFor = 'conn-schema';
    schemaLabel.textContent = 'Schema';
    const schemaInput = document.createElement('input');
    schemaInput.id = 'conn-schema';
    schemaInput.name = 'schema';
    schemaInput.type = 'text';
    schemaInput.placeholder = 'public';
    schemaInput.required = true;

    const submitButton = document.createElement('button');
    submitButton.type = 'submit';
    submitButton.textContent = 'Connect';

    const status = document.createElement('div');
    status.id = 'connection-status';
    status.className = 'connection-status';
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.hidden = true;

    form.appendChild(hostLabel);
    form.appendChild(hostInput);
    form.appendChild(portLabel);
    form.appendChild(portInput);
    form.appendChild(databaseLabel);
    form.appendChild(databaseInput);
    form.appendChild(userLabel);
    form.appendChild(userInput);
    form.appendChild(passwordLabel);
    form.appendChild(passwordInput);
    form.appendChild(schemaLabel);
    form.appendChild(schemaInput);
    form.appendChild(submitButton);
    form.appendChild(status);

    container.appendChild(form);

    return {
      form,
      host: hostInput,
      port: portInput,
      database: databaseInput,
      user: userInput,
      password: passwordInput,
      schema: schemaInput,
      submitButton,
      status,
    };
  }

  /**
   * Wires up input and submit event handlers.
   */
  private bindEvents(): void {
    const { form, submitButton } = this.elements;

    // Clear any status message when the user starts editing again.
    this.elements.form.addEventListener('input', () => {
      if (this.elements.status.hidden) return;
      this.elements.status.hidden = true;
      this.elements.status.textContent = '';
      this.elements.status.removeAttribute('class');
      this.elements.status.className = 'connection-status';
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      this.handleSubmit();
    });

    // Expose the submit button for programmatic focus / blur in tests.
    submitButton.addEventListener('click', (event) => {
      if (submitButton.disabled) {
        event.preventDefault();
      }
    });
  }

  /**
   * Fills in sensible default values so the form is usable out of the box.
   */
  private setDefaults(): void {
    this.elements.host.value = DEFAULT_HOST;
    this.elements.port.value = String(DEFAULT_PORT);
  }

  /**
   * Reads the current values from every field.
   */
  private getValues(): ConnectionConfig {
    return {
      host: this.elements.host.value.trim(),
      port: Number(this.elements.port.value) || 0,
      database: this.elements.database.value.trim(),
      user: this.elements.user.value.trim(),
      password: this.elements.password.value,
      schema: this.elements.schema.value.trim() || 'public',
    };
  }

  /**
   * Handles form submission: validates, calls the API, and updates status.
   */
  private async handleSubmit(): Promise<void> {
    if (this.submitting) {
      return;
    }

    const config = this.getValues();
    this.submitting = true;
    this.setSubmitting(true);
    this.clearStatus();

    try {
      const result: ConnectionResult = await this.apiSubmit(config);
      if (result.success) {
        this.setStatus(result.message ?? 'Connection saved', 'success');
        this.elements.form.reset();
        this.setDefaults();
      } else {
        this.setStatus(result.error ?? 'Failed to save connection', 'error');
      }
    } catch {
      this.setStatus('Unexpected error while connecting', 'error');
    } finally {
      this.submitting = false;
      this.setSubmitting(false);
    }
  }

  /**
   * Shows a status message to the user and to assistive technology.
   */
  private setStatus(message: string, type: 'success' | 'error'): void {
    const { status } = this.elements;
    status.textContent = message;
    status.className = `connection-status connection-status--${type}`;
    status.hidden = false;
  }

  /**
   * Clears any visible status message.
   */
  private clearStatus(): void {
    const { status } = this.elements;
    status.hidden = true;
    status.textContent = '';
    status.className = 'connection-status';
  }

  /**
   * Enables or disables the submit button while a request is in flight.
   */
  private setSubmitting(submitting: boolean): void {
    const { submitButton } = this.elements;
    submitButton.disabled = submitting;
    submitButton.setAttribute('aria-busy', String(submitting));
    submitButton.textContent = submitting ? 'Connecting…' : 'Connect';
  }

  /**
   * Returns the current form values (useful for tests).
   */
  getValuesSnapshot(): ConnectionConfig {
    return this.getValues();
  }

  /**
   * Returns the last status message shown, or null if none.
   */
  getStatus(): { message: string; type: 'success' | 'error' } | null {
    const { status } = this.elements;
    if (status.hidden || !status.textContent) {
      return null;
    }
    const type = status.classList.contains('connection-status--success')
      ? 'success'
      : 'error';
    return { message: status.textContent, type };
  }

  /**
   * Removes the form from the DOM and detaches listeners.
   */
  destroy(): void {
    const { form } = this.elements;
    form.removeEventListener('submit', this.handleSubmit.bind(this));
    this.container.innerHTML = '';
  }
}
