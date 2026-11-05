/**
 * Mock backend API server for STORY-013 visual QA.
 *
 * Serves the built frontend static files and provides mock implementations of:
 *   POST /api/v1/connections/test  -> { success: true, message: 'Connection established' }
 *   POST /api/read-schema          -> mock ReadSchemaResponse with tables, columns,
 *                                     primary keys, foreign keys, unique constraints, indexes
 *
 * No real database is used; this lets us exercise the real frontend UI end-to-end
 * in a containerized browser without provisioning PostgreSQL.
 *
 * Usage:
 *   node qa-tools/mock-schema-backend.js
 *   (serves on port 8080)
 */

import fs from 'fs';
import path from 'path';
import { createServer } from 'http';

const PORT = 8080;
const DIST_DIR = path.resolve(process.argv[2] || 'dist');

const MOCK_SCHEMA = {
  success: true,
  schema: 'public',
  tables: [
    {
      name: 'customers',
      columns: [
        { name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
        { name: 'first_name', dataType: 'text', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
        { name: 'last_name', dataType: 'text', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
        { name: 'email', dataType: 'text', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
      ],
      primaryKeys: [{ constraintName: 'customers_pkey', columns: ['customer_id'] }],
      foreignKeys: [],
      uniqueConstraints: [{ constraintName: 'customers_email_key', columns: ['email'] }],
      indexes: [
        { name: 'customers_email_key', columns: ['email'], isUnique: true, isPrimary: false, isValid: true, indexType: 'btree', definition: 'CREATE UNIQUE INDEX customers_email_key ON customers USING btree (email)' },
      ],
    },
    {
      name: 'orders',
      columns: [
        { name: 'order_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
        { name: 'customer_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
        { name: 'order_date', dataType: 'date', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
        { name: 'total_amount', dataType: 'numeric', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 10, numericScale: 2, datetimePrecision: null, intervalType: null },
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
      indexes: [
        { name: 'orders_customer_id_idx', columns: ['customer_id'], isUnique: false, isPrimary: false, isValid: true, indexType: 'btree', definition: 'CREATE INDEX orders_customer_id_idx ON orders USING btree (customer_id)' },
      ],
    },
    {
      name: 'products',
      columns: [
        { name: 'product_id', dataType: 'integer', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 32, numericScale: 0, datetimePrecision: null, intervalType: null },
        { name: 'name', dataType: 'text', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
        { name: 'price', dataType: 'numeric', isNullable: false, columnDefault: null, maxLength: null, numericPrecision: 10, numericScale: 2, datetimePrecision: null, intervalType: null },
        { name: 'sku', dataType: 'text', isNullable: true, columnDefault: null, maxLength: null, numericPrecision: null, numericScale: null, datetimePrecision: null, intervalType: null },
      ],
      primaryKeys: [{ constraintName: 'products_pkey', columns: ['product_id'] }],
      foreignKeys: [],
      uniqueConstraints: [{ constraintName: 'products_sku_key', columns: ['sku'] }],
      indexes: [
        { name: 'products_sku_key', columns: ['sku'], isUnique: true, isPrimary: false, isValid: true, indexType: 'btree', definition: 'CREATE UNIQUE INDEX products_sku_key ON products USING btree (sku)' },
      ],
    },
  ],
};

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch {
    return null;
  }
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
  };
  return types[ext] || 'application/octet-stream';
}

function serveStatic(req, res) {
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  // Prevent directory traversal.
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  const content = readFile(resolved);
  if (!content) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': mimeType(resolved) });
  res.end(content);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(payload);
}

function collectBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight.
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  // API: mock connection test.
  if (pathname === '/api/v1/connections/test' && req.method === 'POST') {
    await collectBody(req);
    sendJson(res, 200, { success: true, message: 'Connection established' });
    return;
  }

  // API: mock read-schema.
  if (pathname === '/api/read-schema' && req.method === 'POST') {
    await collectBody(req);
    sendJson(res, 200, MOCK_SCHEMA);
    return;
  }

  // Serve static frontend files.
  serveStatic(req, res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock schema backend listening on http://0.0.0.0:${PORT} (serving ${DIST_DIR})`);
});
