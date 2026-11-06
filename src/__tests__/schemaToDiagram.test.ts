/**
 * Unit tests for the schema-to-diagram conversion (TASK-058 / STORY-017).
 *
 * Verifies that a structured read-schema response is translated into the
 * diagram data model: tables, columns (with primary keys), relationships
 * (from foreign keys), unique constraints and indexes.
 */

import { describe, it, expect } from 'vitest';
import { schemaToDiagram } from '../connection/schemaToDiagram';
import type { ReadSchemaResponse } from '../connection/readSchemaApi';

const successResponse: ReadSchemaResponse = {
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
        {
          name: 'customer_id',
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
          name: 'order_number',
          dataType: 'varchar',
          isNullable: true,
          columnDefault: null,
          maxLength: 100,
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
      uniqueConstraints: [
        { constraintName: 'orders_order_number_key', columns: ['order_number'] },
      ],
      indexes: [
        {
          name: 'idx_orders_customer_id',
          columns: ['customer_id'],
          isUnique: false,
          isPrimary: false,
          isValid: true,
          indexType: 'btree',
          definition:
            'CREATE INDEX idx_orders_customer_id ON public.orders USING btree (customer_id)',
        },
      ],
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
          numericPrecision: 32,
          numericScale: 0,
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
      primaryKeys: [{ constraintName: 'customers_pkey', columns: ['customer_id'] }],
      foreignKeys: [],
      uniqueConstraints: [
        { constraintName: 'customers_email_key', columns: ['email'] },
      ],
      indexes: [],
    },
  ],
};

describe('schemaToDiagram', () => {
  it('converts tables and columns into diagram tables', () => {
    const diagram = schemaToDiagram(successResponse);

    expect(diagram.tables).toHaveLength(2);
    expect(diagram.name).toBe('Imported Schema');

    const orders = diagram.tables.find((table) => table.name === 'orders');
    expect(orders).toBeDefined();
    expect(orders?.columns).toHaveLength(3);
    expect(orders?.columns[0]).toMatchObject({
      name: 'order_id',
      dataType: 'integer',
      nullable: false,
    });
    expect(orders?.columns[1]).toMatchObject({
      name: 'customer_id',
      dataType: 'integer',
      nullable: false,
    });
    expect(orders?.columns[2]).toMatchObject({
      name: 'order_number',
      dataType: 'varchar',
      nullable: true,
    });
  });

  it('marks primary key columns', () => {
    const diagram = schemaToDiagram(successResponse);
    const orders = diagram.tables.find((table) => table.name === 'orders');
    const orderIdColumn = orders?.columns.find((c) => c.name === 'order_id');
    const customerIdColumn = orders?.columns.find((c) => c.name === 'customer_id');

    expect(orderIdColumn?.primaryKey).toBe(true);
    expect(customerIdColumn?.primaryKey).toBe(false);

    const customers = diagram.tables.find((table) => table.name === 'customers');
    const customerId = customers?.columns.find((c) => c.name === 'customer_id');
    expect(customerId?.primaryKey).toBe(true);
  });

  it('converts foreign keys into relationships', () => {
    const diagram = schemaToDiagram(successResponse);

    expect(diagram.relationships).toHaveLength(1);
    const [relationship] = diagram.relationships;
    expect(relationship.sourceTableId).toBe(
      diagram.tables.find((table) => table.name === 'orders')!.id,
    );
    expect(relationship.targetTableId).toBe(
      diagram.tables.find((table) => table.name === 'customers')!.id,
    );
    expect(relationship.sourceColumnId).toBeDefined();
    expect(relationship.targetColumnId).toBeDefined();
  });

  it('converts unique constraints at the diagram level', () => {
    const diagram = schemaToDiagram(successResponse);

    expect(diagram.uniqueConstraints).toHaveLength(2);
    const ordersConstraint = diagram.uniqueConstraints.find(
      (uc) => uc.name === 'orders_order_number_key',
    );
    expect(ordersConstraint).toBeDefined();
    expect(ordersConstraint?.columnIds).toHaveLength(1);

    const orders = diagram.tables.find((table) => table.name === 'orders');
    expect(ordersConstraint?.tableId).toBe(orders?.id);
  });

  it('converts indexes per table', () => {
    const diagram = schemaToDiagram(successResponse);
    const orders = diagram.tables.find((table) => table.name === 'orders');

    expect(orders?.indexes).toHaveLength(1);
    expect(orders?.indexes[0].name).toBe('idx_orders_customer_id');
    expect(orders?.indexes[0].columnIds).toHaveLength(1);
    expect(typeof orders?.indexes[0].columnIds[0]).toBe('string');
  });

  it('positions tables in a grid', () => {
    const diagram = schemaToDiagram(successResponse);

    const orders = diagram.tables.find((table) => table.name === 'orders');
    const customers = diagram.tables.find((table) => table.name === 'customers');

    expect(orders?.x).toBe(100);
    expect(orders?.y).toBe(100);
    // Second table in the same row is placed to the right.
    expect(customers?.x).toBe(orders!.x + 240 + 40);
    expect(customers?.y).toBe(orders!.y);
    expect(orders?.width).toBe(240);
    expect(orders?.height).toBeGreaterThan(0);
  });

  it('returns an empty diagram for a schema without tables', () => {
    const empty: ReadSchemaResponse = { success: true, schema: 'public', tables: [] };
    const diagram = schemaToDiagram(empty);

    expect(diagram.tables).toEqual([]);
    expect(diagram.relationships).toEqual([]);
    expect(diagram.uniqueConstraints).toEqual([]);
    expect(diagram.name).toBe('Imported Schema');
  });

  it('ignores foreign keys that point to missing tables', () => {
    const dangling: ReadSchemaResponse = {
      success: true,
      schema: 'public',
      tables: [
        {
          name: 'orders',
          columns: [{ name: 'id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null }],
          primaryKeys: [],
          foreignKeys: [{ constraintName: 'fkey', column: 'id', foreignTable: 'missing', foreignColumn: 'id', updateRule: 'CASCADE', deleteRule: 'RESTRICT' }],
          uniqueConstraints: [],
          indexes: [],
        },
      ],
    };

    const diagram = schemaToDiagram(dangling);
    expect(diagram.tables).toHaveLength(1);
    expect(diagram.relationships).toHaveLength(0);
  });
});
