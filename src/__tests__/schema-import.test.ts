/**
 * Unit tests for schema import (TASK-042 / STORY-013).
 *
 * Verifies that PostgreSQL schema import correctly retrieves and renders
 * database schema as a diagram. Covers the full pipeline from the
 * read-schema API response through schemaToDiagram conversion to the
 * final renderable diagram model.
 *
 * Acceptance criteria covered:
 *   1. Unit tests verify table import from PostgreSQL
 *   2. Unit tests verify column and data type import
 *   3. Unit tests verify primary key import
 *   4. Unit tests verify foreign key import
 *   5. Unit tests verify unique constraint import
 *   6. Unit tests verify index import
 *   7. All tests pass
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  readSchema,
  setFetchForTesting,
  resetFetchForTesting,
  type ReadSchemaResponse,
} from '../connection/readSchemaApi';
import { schemaToDiagram } from '../connection/schemaToDiagram';
import type { ConnectionConfig } from '../types';

const config: ConnectionConfig = {
  host: 'localhost',
  port: 5432,
  database: 'mydb',
  user: 'app_user',
  password: 's3cret',
  schema: 'public',
};

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    statusText: 'OK',
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('schema import — full pipeline', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    resetFetchForTesting();
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // AC1: Unit tests verify table import from PostgreSQL
  // ------------------------------------------------------------------
  describe('table import', () => {
    it('imports all tables from the read-schema response into the diagram', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'employees',
            columns: [],
            primaryKeys: [],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'departments',
            columns: [],
            primaryKeys: [],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'projects',
            columns: [],
            primaryKeys: [],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.tables).toHaveLength(3);
      expect(diagram.tables.map((t) => t.name).sort()).toEqual([
        'departments',
        'employees',
        'projects',
      ]);
    });

    it('imports tables from the readSchema API response end-to-end', async () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: 32,
                numericScale: 0,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      globalThis.fetch = vi.fn(async () => okJson(response));
      setFetchForTesting(globalThis.fetch as typeof fetch);

      const result = await readSchema(config);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tables).toHaveLength(1);
        expect(result.tables[0].name).toBe('orders');

        const diagram = schemaToDiagram(result);
        expect(diagram.tables).toHaveLength(1);
        expect(diagram.tables[0].name).toBe('orders');
      }
    });

    it('returns an empty diagram when the schema has no tables', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.tables).toEqual([]);
      expect(diagram.name).toBe('Imported Schema');
    });
  });

  // ------------------------------------------------------------------
  // AC2: Unit tests verify column and data type import
  // ------------------------------------------------------------------
  describe('column and data type import', () => {
    it('imports columns with names, data types and nullability', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'products',
            columns: [
              {
                name: 'product_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: 32,
                numericScale: 0,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'name',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'description',
                dataType: 'text',
                isNullable: true,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'price',
                dataType: 'numeric',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: 10,
                numericScale: 2,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'created_at',
                dataType: 'timestamptz',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'is_active',
                dataType: 'boolean',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'products_pkey', columns: ['product_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'products');

      expect(table).toBeDefined();
      expect(table!.columns).toHaveLength(6);

      const idCol = table!.columns.find((c) => c.name === 'product_id');
      expect(idCol).toMatchObject({ name: 'product_id', dataType: 'integer', nullable: false });

      const nameCol = table!.columns.find((c) => c.name === 'name');
      expect(nameCol).toMatchObject({ name: 'name', dataType: 'varchar', nullable: false });

      const descCol = table!.columns.find((c) => c.name === 'description');
      expect(descCol).toMatchObject({ name: 'description', dataType: 'text', nullable: true });

      const priceCol = table!.columns.find((c) => c.name === 'price');
      expect(priceCol).toMatchObject({ name: 'price', dataType: 'numeric', nullable: false });

      const tsCol = table!.columns.find((c) => c.name === 'created_at');
      expect(tsCol).toMatchObject({ name: 'created_at', dataType: 'timestamptz', nullable: false });

      const boolCol = table!.columns.find((c) => c.name === 'is_active');
      expect(boolCol).toMatchObject({ name: 'is_active', dataType: 'boolean', nullable: false });
    });

    it('preserves column default values when present', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'audit_log',
            columns: [
              {
                name: 'id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'created_at',
                dataType: 'timestamptz',
                isNullable: false,
                columnDefault: 'CURRENT_TIMESTAMP',
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'audit_log_pkey', columns: ['id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'audit_log');
      const tsCol = table!.columns.find((c) => c.name === 'created_at');

      expect(tsCol.defaultValue).toBe('CURRENT_TIMESTAMP');
    });

    it('preserves max length for character types', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'username',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 50,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'email',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'users');

      const usernameCol = table!.columns.find((c) => c.name === 'username');
      expect(usernameCol.length).toBe(50);

      const emailCol = table!.columns.find((c) => c.name === 'email');
      expect(emailCol.length).toBe(255);
    });
  });

  // ------------------------------------------------------------------
  // AC3: Unit tests verify primary key import
  // ------------------------------------------------------------------
  describe('primary key import', () => {
    it('marks primary key columns as primaryKey=true', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'customer_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'orders');

      const orderIdCol = table!.columns.find((c) => c.name === 'order_id');
      const customerIdCol = table!.columns.find((c) => c.name === 'customer_id');

      expect(orderIdCol.primaryKey).toBe(true);
      expect(customerIdCol.primaryKey).toBe(false);
    });

    it('imports composite primary keys with multiple columns', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'employee_project',
            columns: [
              {
                name: 'employee_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'project_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'role',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [
              {
                constraintName: 'employee_project_pkey',
                columns: ['employee_id', 'project_id'],
              },
            ],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'employee_project');

      const employeeIdCol = table!.columns.find((c) => c.name === 'employee_id');
      const projectIdCol = table!.columns.find((c) => c.name === 'project_id');
      const roleCol = table!.columns.find((c) => c.name === 'role');

      expect(employeeIdCol.primaryKey).toBe(true);
      expect(projectIdCol.primaryKey).toBe(true);
      expect(roleCol.primaryKey).toBe(false);
    });

    it('imports tables without primary keys', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'log_entries',
            columns: [
              {
                name: 'message',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'log_entries');

      const messageCol = table!.columns.find((c) => c.name === 'message');
      expect(messageCol.primaryKey).toBe(false);
    });
  });

  // ------------------------------------------------------------------
  // AC4: Unit tests verify foreign key import
  // ------------------------------------------------------------------
  describe('foreign key import', () => {
    it('imports foreign keys as diagram relationships', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'customer_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
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
            columns: [
              {
                name: 'customer_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'customers_pkey', columns: ['customer_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.relationships).toHaveLength(1);
      const [rel] = diagram.relationships;

      const ordersTable = diagram.tables.find((t) => t.name === 'orders');
      const customersTable = diagram.tables.find((t) => t.name === 'customers');

      expect(rel.sourceTableId).toBe(ordersTable!.id);
      expect(rel.targetTableId).toBe(customersTable!.id);
      expect(rel.sourceColumnId).toBeDefined();
      expect(rel.targetColumnId).toBeDefined();
    });

    it('imports self-referencing foreign keys', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'employees',
            columns: [
              {
                name: 'employee_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'manager_id',
                dataType: 'integer',
                isNullable: true,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'employees_pkey', columns: ['employee_id'] }],
            foreignKeys: [
              {
                constraintName: 'employees_manager_fk',
                column: 'manager_id',
                foreignTable: 'employees',
                foreignColumn: 'employee_id',
                updateRule: 'CASCADE',
                deleteRule: 'SET NULL',
              },
            ],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.relationships).toHaveLength(1);
      const [rel] = diagram.relationships;

      const employeesTable = diagram.tables.find((t) => t.name === 'employees');
      expect(rel.sourceTableId).toBe(employeesTable!.id);
      expect(rel.targetTableId).toBe(employeesTable!.id);
    });

    it('imports circular foreign keys between two tables', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'department',
            columns: [
              {
                name: 'department_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'head_employee_id',
                dataType: 'integer',
                isNullable: true,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'department_pkey', columns: ['department_id'] }],
            foreignKeys: [
              {
                constraintName: 'department_head_fk',
                column: 'head_employee_id',
                foreignTable: 'employee',
                foreignColumn: 'employee_id',
                updateRule: 'CASCADE',
                deleteRule: 'SET NULL',
              },
            ],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'employee',
            columns: [
              {
                name: 'employee_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'department_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'employee_pkey', columns: ['employee_id'] }],
            foreignKeys: [
              {
                constraintName: 'employee_department_fk',
                column: 'department_id',
                foreignTable: 'department',
                foreignColumn: 'department_id',
                updateRule: 'CASCADE',
                deleteRule: 'RESTRICT',
              },
            ],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.relationships).toHaveLength(2);
      expect(diagram.relationships.some((r) => r.sourceTableId !== r.targetTableId)).toBe(true);
    });

    it('ignores foreign keys that point to missing tables', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [
              {
                constraintName: 'orders_missing_fk',
                column: 'missing_id',
                foreignTable: 'nonexistent_table',
                foreignColumn: 'id',
                updateRule: 'CASCADE',
                deleteRule: 'RESTRICT',
              },
            ],
            uniqueConstraints: [],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.tables).toHaveLength(1);
      expect(diagram.relationships).toHaveLength(0);
    });
  });

  // ------------------------------------------------------------------
  // AC5: Unit tests verify unique constraint import
  // ------------------------------------------------------------------
  describe('unique constraint import', () => {
    it('imports unique constraints at the diagram level', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'user_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'email',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'users_pkey', columns: ['user_id'] }],
            foreignKeys: [],
            uniqueConstraints: [
              { constraintName: 'users_email_key', columns: ['email'] },
            ],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.uniqueConstraints).toHaveLength(1);
      const [uc] = diagram.uniqueConstraints;

      const usersTable = diagram.tables.find((t) => t.name === 'users');
      expect(uc.tableId).toBe(usersTable!.id);
      expect(uc.name).toBe('users_email_key');
      expect(uc.columnIds).toHaveLength(1);
    });

    it('imports composite unique constraints with multiple columns', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'customer_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'order_date',
                dataType: 'date',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [],
            uniqueConstraints: [
              {
                constraintName: 'orders_customer_date_unique',
                columns: ['customer_id', 'order_date'],
              },
            ],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.uniqueConstraints).toHaveLength(1);
      const [uc] = diagram.uniqueConstraints;

      expect(uc.name).toBe('orders_customer_date_unique');
      expect(uc.columnIds).toHaveLength(2);
    });

    it('associates unique constraints with the correct table', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'user_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'email',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 255,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'users_pkey', columns: ['user_id'] }],
            foreignKeys: [],
            uniqueConstraints: [
              { constraintName: 'users_email_key', columns: ['email'] },
            ],
            indexes: [],
          },
          {
            name: 'products',
            columns: [
              {
                name: 'product_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'sku',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 50,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'products_pkey', columns: ['product_id'] }],
            foreignKeys: [],
            uniqueConstraints: [
              { constraintName: 'products_sku_key', columns: ['sku'] },
            ],
            indexes: [],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      expect(diagram.uniqueConstraints).toHaveLength(2);

      const usersTable = diagram.tables.find((t) => t.name === 'users');
      const productsTable = diagram.tables.find((t) => t.name === 'products');

      const emailConstraint = diagram.uniqueConstraints.find(
        (uc) => uc.name === 'users_email_key',
      );
      expect(emailConstraint?.tableId).toBe(usersTable!.id);

      const skuConstraint = diagram.uniqueConstraints.find(
        (uc) => uc.name === 'products_sku_key',
      );
      expect(skuConstraint?.tableId).toBe(productsTable!.id);
    });
  });

  // ------------------------------------------------------------------
  // AC6: Unit tests verify index import
  // ------------------------------------------------------------------
  describe('index import', () => {
    it('imports indexes per table with column mappings', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'employees',
            columns: [
              {
                name: 'employee_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'department_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'name',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'employees_pkey', columns: ['employee_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [
              {
                name: 'idx_employees_department',
                columns: ['department_id'],
                isUnique: false,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE INDEX idx_employees_department ON public.employees USING btree (department_id)',
              },
              {
                name: 'idx_employees_name',
                columns: ['name'],
                isUnique: false,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE INDEX idx_employees_name ON public.employees USING btree (name)',
              },
            ],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'employees');

      expect(table!.indexes).toHaveLength(2);

      const deptIdx = table!.indexes.find((i) => i.name === 'idx_employees_department');
      expect(deptIdx).toBeDefined();
      expect(deptIdx!.columnIds).toHaveLength(1);
      expect(deptIdx!.tableId).toBe(table!.id);

      const nameIdx = table!.indexes.find((i) => i.name === 'idx_employees_name');
      expect(nameIdx).toBeDefined();
      expect(nameIdx!.columnIds).toHaveLength(1);
    });

    it('imports composite indexes with multiple columns', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'orders',
            columns: [
              {
                name: 'order_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'customer_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'order_date',
                dataType: 'date',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'orders_pkey', columns: ['order_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [
              {
                name: 'idx_orders_customer_date',
                columns: ['customer_id', 'order_date'],
                isUnique: false,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE INDEX idx_orders_customer_date ON public.orders USING btree (customer_id, order_date)',
              },
            ],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'orders');

      expect(table!.indexes).toHaveLength(1);
      const [idx] = table!.indexes;
      expect(idx.name).toBe('idx_orders_customer_date');
      expect(idx.columnIds).toHaveLength(2);
    });

    it('imports unique indexes', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'users',
            columns: [
              {
                name: 'user_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'username',
                dataType: 'varchar',
                isNullable: false,
                columnDefault: null,
                maxLength: 50,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'users_pkey', columns: ['user_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [
              {
                name: 'users_username_key',
                columns: ['username'],
                isUnique: true,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username)',
              },
            ],
          },
        ],
      };

      const diagram = schemaToDiagram(response);
      const table = diagram.tables.find((t) => t.name === 'users');

      expect(table!.indexes).toHaveLength(1);
      expect(table!.indexes[0].name).toBe('users_username_key');
    });
  });

  // ------------------------------------------------------------------
  // AC7: All tests pass — end-to-end import verification
  // ------------------------------------------------------------------
  describe('end-to-end schema import', () => {
    it('imports a complete schema with all element types into a renderable diagram', () => {
      const response: ReadSchemaResponse = {
        success: true,
        schema: 'public',
        tables: [
          {
            name: 'department',
            columns: [
              {
                name: 'department_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'name',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'department_pkey', columns: ['department_id'] }],
            foreignKeys: [],
            uniqueConstraints: [],
            indexes: [],
          },
          {
            name: 'employee',
            columns: [
              {
                name: 'employee_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'name',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'department_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'manager_id',
                dataType: 'integer',
                isNullable: true,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'employee_pkey', columns: ['employee_id'] }],
            foreignKeys: [
              {
                constraintName: 'employee_department_fk',
                column: 'department_id',
                foreignTable: 'department',
                foreignColumn: 'department_id',
                updateRule: 'CASCADE',
                deleteRule: 'RESTRICT',
              },
              {
                constraintName: 'employee_manager_fk',
                column: 'manager_id',
                foreignTable: 'employee',
                foreignColumn: 'employee_id',
                updateRule: 'CASCADE',
                deleteRule: 'SET NULL',
              },
            ],
            uniqueConstraints: [],
            indexes: [
              {
                name: 'idx_employee_department',
                columns: ['department_id'],
                isUnique: false,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE INDEX idx_employee_department ON public.employee USING btree (department_id)',
              },
            ],
          },
          {
            name: 'project',
            columns: [
              {
                name: 'project_id',
                dataType: 'integer',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
              {
                name: 'code',
                dataType: 'text',
                isNullable: false,
                columnDefault: null,
                maxLength: null,
                numericPrecision: null,
                numericScale: null,
                datetimePrecision: null,
                intervalType: null,
              },
            ],
            primaryKeys: [{ constraintName: 'project_pkey', columns: ['project_id'] }],
            foreignKeys: [],
            uniqueConstraints: [
              { constraintName: 'project_code_unique', columns: ['code'] },
            ],
            indexes: [
              {
                name: 'idx_project_name',
                columns: ['code'],
                isUnique: false,
                isPrimary: false,
                isValid: true,
                indexType: 'btree',
                definition:
                  'CREATE INDEX idx_project_name ON public.project USING btree (code)',
              },
            ],
          },
        ],
      };

      const diagram = schemaToDiagram(response);

      // Tables
      expect(diagram.tables).toHaveLength(3);
      expect(diagram.tables.map((t) => t.name).sort()).toEqual([
        'department',
        'employee',
        'project',
      ]);

      // Columns with data types
      const employeeTable = diagram.tables.find((t) => t.name === 'employee');
      expect(employeeTable!.columns).toHaveLength(4);

      // Primary keys
      const empIdCol = employeeTable!.columns.find((c) => c.name === 'employee_id');
      expect(empIdCol.primaryKey).toBe(true);

      // Foreign keys (relationships)
      expect(diagram.relationships).toHaveLength(2);
      const selfRefRel = diagram.relationships.find(
        (r) => r.sourceTableId === r.targetTableId,
      );
      expect(selfRefRel).toBeDefined();

      // Unique constraints
      expect(diagram.uniqueConstraints).toHaveLength(1);
      expect(diagram.uniqueConstraints[0].name).toBe('project_code_unique');

      // Indexes
      const projTable = diagram.tables.find((t) => t.name === 'project');
      expect(projTable!.indexes).toHaveLength(1);
      expect(projTable!.indexes[0].name).toBe('idx_project_name');

      const empTable = diagram.tables.find((t) => t.name === 'employee');
      expect(empTable!.indexes).toHaveLength(1);
      expect(empTable!.indexes[0].name).toBe('idx_employee_department');

      // Diagram is ready for rendering
      expect(diagram.name).toBe('Imported Schema');
      expect(diagram.id).toBeDefined();
    });
  });
});
