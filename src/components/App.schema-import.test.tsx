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

  it('calls the read-schema endpoint and renders imported tables on the canvas', async () => {
    render(<App />);

    const importButton = screen.getByRole('button', { name: /Import PostgreSQL schema/i });
    expect(importButton).toBeInTheDocument();

    fireEvent.click(importButton);

    await waitFor(() => {
      expect(mockedReadSchema).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(screen.getByText('orders')).toBeInTheDocument();
    });
    expect(screen.getByText('customers')).toBeInTheDocument();
  });
});
