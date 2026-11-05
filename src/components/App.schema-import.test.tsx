import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../App';

vi.mock('../hooks/useConnection', () => ({
  useConnection: () => ({
    status: 'connected',
    isConnected: true,
    config: {
      host: 'localhost',
      port: 5432,
      database: 'mydb',
      user: 'app_user',
      password: 's3cret',
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    clearMessage: vi.fn(),
    error: null,
    message: null,
  }),
}));

vi.mock('../connection/readSchemaApi', () => ({
  readSchema: vi.fn(),
  setFetchForTesting: vi.fn(),
  resetFetchForTesting: vi.fn(),
}));

import { readSchema, type ReadSchemaResponse } from '../connection/readSchemaApi';

const mockedReadSchema = vi.mocked(readSchema);

const schemaResponse: ReadSchemaResponse = {
  success: true,
  schema: 'public',
  tables: [
    {
      name: 'orders',
      columns: [
        { name: 'order_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
        { name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
      ],
      primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
      foreignKeys: [
        {
          constraintName: 'orders_customer_id_fkey',
          column: 'customer_id',
          foreignTable: 'customers',
          foreignColumn: 'customer_id',
          updateRule: 'CASCADE',
          deleteRule: 'RESTRICT',
        },
      ],
      uniqueConstraints: [],
      indexes: [],
    },
    {
      name: 'customers',
      columns: [{ name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null }],
      primaryKeys: [{ constraintName: 'customers_pkey', columns: ['customer_id'] }],
      foreignKeys: [],
      uniqueConstraints: [],
      indexes: [],
    },
  ],
};

describe('App schema import integration', () => {
  beforeEach(() => {
    mockedReadSchema.mockReset();
    mockedReadSchema.mockResolvedValue(schemaResponse);

    const globalCrypto = globalThis as {
      crypto?: { randomUUID?: () => string };
    };
    if (!globalCrypto.crypto?.randomUUID) {
      globalCrypto.crypto = { randomUUID: () => 'test-uuid' };
    }
  });

  it('calls the read-schema endpoint with the default schema and renders imported tables', async () => {
    render(<App />);

    const importButton = screen.getByRole('button', { name: /Import PostgreSQL schema/i });
    expect(importButton).toBeInTheDocument();

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedReadSchema).toHaveBeenCalledTimes(1);
    });

    // Verify the default schema 'public' was sent to the backend.
    const lastCall = mockedReadSchema.mock.calls[mockedReadSchema.mock.calls.length - 1];
    expect(lastCall[2]).toBe('public');

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeInTheDocument();
    });
    expect(screen.getByText('customers')).toBeInTheDocument();
  });

  it('sends the user-selected schema to the backend when importing', async () => {
    render(<App />);

    // Select a different schema from the dropdown.
    const schemaSelect = screen.getByLabelText('Schema to import');
    fireEvent.change(schemaSelect, { target: { value: 'information_schema' } });

    const importButton = screen.getByRole('button', { name: /Import PostgreSQL schema/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedReadSchema).toHaveBeenCalledTimes(1);
    });

    // Verify the selected schema was sent to the backend.
    const lastCall = mockedReadSchema.mock.calls[mockedReadSchema.mock.calls.length - 1];
    expect(lastCall[2]).toBe('information_schema');
  });

  it('displays import progress while the request is in flight', async () => {
    let resolvePromise: (value: ReadSchemaResponse) => void = () => {};
    mockedReadSchema.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePromise = resolve;
        }) as Promise<ReadSchemaResponse>,
    );

    render(<App />);

    const importButton = screen.getByRole('button', { name: /Import PostgreSQL schema/i });
    fireEvent.click(importButton);

    // The import progress indicator should appear while the request is in flight.
    await waitFor(() => {
      expect(screen.getByText('Importing schema…')).toBeInTheDocument();
    });

    // Resolve the request.
    resolvePromise(schemaResponse);

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeInTheDocument();
    });
  });

  it('displays an error message when the import fails', async () => {
    mockedReadSchema.mockRejectedValue(new Error('Backend unavailable'));

    render(<App />);

    const importButton = screen.getByRole('button', { name: /Import PostgreSQL schema/i });
    fireEvent.click(importButton);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    expect(screen.getByRole('alert')).toHaveTextContent(/Unexpected error/);
  });
});
