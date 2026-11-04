import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';
import * as connectionApi from '../connection/connectionApi';
import * as ddlApi from '../connection/ddlApi';

const TEST_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'app_test',
  user: 'postgres',
  password: 'secret',
};

function ensureRandomUUID(): void {
  const globalCrypto = globalThis as {
    crypto?: { randomUUID?: () => string };
  };
  if (!globalCrypto.crypto?.randomUUID) {
    globalCrypto.crypto = { randomUUID: () => 'test-table-uuid' };
  }
}

describe('App', () => {
  it('displays the New Diagram button', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Create a new empty diagram/i }),
    ).toBeInTheDocument();
  });

  it('displays an Add Table button', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    ).toBeInTheDocument();
  });

  it('shows an empty canvas on load', () => {
    render(<App />);
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
  });

  it('clears and resets canvas when New Diagram is clicked', () => {
    render(<App />);
    const newDiagramButton = screen.getByRole('button', {
      name: /Create a new empty diagram/i,
    });
    fireEvent.click(newDiagramButton);
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
  });

  it('opens the Add Table modal when Add Table is clicked', () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    expect(screen.getByLabelText('Table name')).toBeInTheDocument();
    expect(screen.getByText('Columns')).toBeInTheDocument();
  });

  it('adds a table to the canvas when the Add Table form is submitted', () => {
    ensureRandomUUID();
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    const nameInput = screen.getByLabelText('Table name');
    fireEvent.change(nameInput, { target: { value: 'users' } });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(screen.queryByText(/Empty diagram canvas/i)).not.toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
  });

  it('adds columns to the created table on the canvas', () => {
    ensureRandomUUID();
    render(<App />);
    fireEvent.click(
      screen.getByRole('button', { name: /Add a new table to the canvas/i }),
    );
    fireEvent.change(screen.getByLabelText('Table name'), {
      target: { value: 'orders' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add column/i }));
    fireEvent.change(screen.getAllByPlaceholderText('Column name')[0], {
      target: { value: 'order_id' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create table/i }));
    expect(screen.getByText('orders')).toBeInTheDocument();
    expect(screen.getByText(/order_id: text/)).toBeInTheDocument();
  });
});

describe('App - apply-schema flow', () => {
  let submitConnectionMock: ReturnType<typeof vi.fn>;
  let applyDdlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    ensureRandomUUID();

    submitConnectionMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Connection established',
    });
    vi.spyOn(connectionApi, 'submitConnection').mockImplementation(
      submitConnectionMock,
    );

    applyDdlMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Schema applied successfully',
      ddlPreview: 'CREATE TABLE "test" ("id" SERIAL PRIMARY KEY);',
    });
    vi.spyOn(ddlApi, 'applyDDL').mockImplementation(applyDdlMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function connectViaForm(): Promise<void> {
    // The ConnectionForm is created imperatively in a useEffect; wait for it.
    await waitFor(() => {
      expect(screen.getByLabelText(/^Host$/i)).toBeInTheDocument();
    });

    // Fill in connection form fields directly (ConnectionForm reads DOM values).
    const hostInput = document.getElementById('conn-host') as HTMLInputElement;
    const portInput = document.getElementById('conn-port') as HTMLInputElement;
    const databaseInput = document.getElementById(
      'conn-database',
    ) as HTMLInputElement;
    const userInput = document.getElementById('conn-user') as HTMLInputElement;
    const passwordInput = document.getElementById(
      'conn-password',
    ) as HTMLInputElement;

    hostInput.value = TEST_CONFIG.host;
    portInput.value = String(TEST_CONFIG.port);
    databaseInput.value = TEST_CONFIG.database;
    userInput.value = TEST_CONFIG.user;
    passwordInput.value = TEST_CONFIG.password;

    [hostInput, portInput, databaseInput, userInput, passwordInput].forEach(
      (input) => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
    );

    // Dispatch submit event on the connection form (jsdom does not auto-submit on button click).
    const form = document.querySelector(
      '.connection-form',
    ) as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { cancelable: true }));

    await waitFor(() => {
      expect(screen.getByText(/connection established/i)).toBeInTheDocument();
    });
  }

  it('shows Export to PostgreSQL button only when connected', () => {
    render(<App />);
    // Not connected yet: button should not be visible.
    expect(
      screen.queryByRole('button', { name: /export diagram to postgresql/i }),
    ).not.toBeInTheDocument();
  });

  it('calls apply-schema endpoint after user confirmation and shows success', async () => {
    render(<App />);
    await connectViaForm();

    // Export to PostgreSQL button is now visible (may need a render cycle).
    const exportButton = await screen.findByRole('button', {
      name: /export diagram to postgresql/i,
    });
    fireEvent.click(exportButton);

    // DdlPreview modal opens and shows generated DDL.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/review ddl before execution/i)).toBeInTheDocument();

    // Execute DDL is disabled until confirmation is checked.
    const executeButton = screen.getByRole('button', { name: /execute ddl/i });
    expect(executeButton).toBeDisabled();

    // Check the confirmation checkbox.
    const checkbox = screen.getByLabelText(
      /i confirm i want to execute this ddl on the database/i,
    );
    fireEvent.click(checkbox);
    expect(executeButton).not.toBeDisabled();

    // Click Execute DDL.
    fireEvent.click(executeButton);

    // applyDDL was called with confirm=true.
    await waitFor(() => {
      expect(applyDdlMock).toHaveBeenCalledWith(
        expect.any(String),
        TEST_CONFIG,
        true,
        '/api/apply-schema',
      );
    });

    // Success message is displayed at the App level.
    await waitFor(() => {
      expect(screen.getByText('Schema applied successfully')).toBeInTheDocument();
    });
  });

  it('shows descriptive error when DDL execution fails', async () => {
    applyDdlMock.mockResolvedValueOnce({
      success: false,
      message: 'DROP not allowed',
      ddlPreview: 'DROP TABLE test;',
    });

    render(<App />);
    await connectViaForm();

    const exportButton = await screen.findByRole('button', {
      name: /export diagram to postgresql/i,
    });
    fireEvent.click(exportButton);

    const checkbox = screen.getByLabelText(
      /i confirm i want to execute this ddl on the database/i,
    );
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole('button', { name: /execute ddl/i }));

    // Error message is displayed at the App level.
    await waitFor(() => {
      expect(screen.getByText('DROP not allowed')).toBeInTheDocument();
    });
  });

  it('does not call applyDDL without confirmation', async () => {
    render(<App />);
    await connectViaForm();

    const exportButton = await screen.findByRole('button', {
      name: /export diagram to postgresql/i,
    });
    fireEvent.click(exportButton);

    fireEvent.click(screen.getByRole('button', { name: /execute ddl/i }));

    expect(applyDdlMock).not.toHaveBeenCalled();
  });

  it('submits connection config to backend when connecting', async () => {
    render(<App />);
    await connectViaForm();

    expect(submitConnectionMock).toHaveBeenCalledTimes(1);
    expect(submitConnectionMock).toHaveBeenCalledWith(TEST_CONFIG);
  });
});
