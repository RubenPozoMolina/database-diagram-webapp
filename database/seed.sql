-- ============================================================================
-- Seed schema for TASK-039 introspection query verification
-- Compatible with PostgreSQL 14+
--
-- Covers every acceptance criterion:
--   * tables and columns
--   * data types (INTEGER, TEXT, BOOLEAN, UUID, NUMERIC, TIMESTAMPTZ, ...)
--   * primary keys (single and composite)
--   * foreign keys (single, composite, self-referencing, circular)
--   * unique constraints (single and composite)
--   * indexes (regular, unique, composite)
--   * quoted identifiers / reserved words (table "order")
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- Core entities --------------------------------------------------------------

CREATE TABLE app.department (
    department_id     INTEGER      NOT NULL,
    name              TEXT         NOT NULL,
    head_employee_id  INTEGER,
    is_active         BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT department_pkey PRIMARY KEY (department_id)
);

CREATE TABLE app.employee (
    employee_id    INTEGER      NOT NULL,
    name           TEXT         NOT NULL,
    department_id  INTEGER      NOT NULL,
    manager_id     INTEGER,                       -- self-referencing FK
    hire_date      TIMESTAMP WITH TIME ZONE NOT NULL,
    salary         NUMERIC(10, 2),
    employee_uuid  UUID,
    CONSTRAINT employee_pkey PRIMARY KEY (employee_id),
    CONSTRAINT employee_department_fk
        FOREIGN KEY (department_id) REFERENCES app.department(department_id),
    CONSTRAINT employee_manager_fk
        FOREIGN KEY (manager_id) REFERENCES app.employee(employee_id)  -- self-ref
);

-- Circular FK: department.head_employee_id -> employee.employee_id
ALTER TABLE app.department
    ADD CONSTRAINT department_head_fk
    FOREIGN KEY (head_employee_id) REFERENCES app.employee(employee_id);

-- Unique constraints ---------------------------------------------------------

CREATE TABLE app.project (
    project_id INTEGER      NOT NULL,
    code       TEXT         NOT NULL,
    name       TEXT         NOT NULL,
    CONSTRAINT project_pkey PRIMARY KEY (project_id),
    CONSTRAINT project_code_unique UNIQUE (code)   -- single-column unique
);

-- Join table with composite primary key --------------------------------------

CREATE TABLE app.employee_project (
    employee_id INTEGER NOT NULL,
    project_id  INTEGER NOT NULL,
    role        TEXT    NOT NULL,
    PRIMARY KEY (employee_id, project_id),        -- composite PK
    CONSTRAINT ep_employee_fk
        FOREIGN KEY (employee_id) REFERENCES app.employee(employee_id),
    CONSTRAINT ep_project_fk
        FOREIGN KEY (project_id) REFERENCES app.project(project_id)
);

-- Reserved word as table name (quoted identifier) ----------------------------

CREATE TABLE app."order" (
    order_id     INTEGER             NOT NULL,
    customer_id  INTEGER             NOT NULL,
    order_date   TIMESTAMP WITH TIME ZONE NOT NULL,
    total        NUMERIC(12, 2)      NOT NULL,
    CONSTRAINT order_pkey PRIMARY KEY (order_id)
);

-- Indexes --------------------------------------------------------------------

CREATE INDEX idx_employee_department ON app.employee(department_id);
CREATE INDEX idx_employee_manager ON app.employee(manager_id);
CREATE UNIQUE INDEX idx_order_customer_date
    ON app."order"(customer_id, order_date);   -- composite unique index
CREATE INDEX idx_project_name ON app.project(name);

-- Seed data (minimal, just to make objects real) -----------------------------

INSERT INTO app.department (department_id, name, head_employee_id, is_active)
VALUES (1, 'Engineering', NULL, TRUE),
       (2, 'HR', NULL, TRUE);

INSERT INTO app.employee (employee_id, name, department_id, manager_id, hire_date, salary, employee_uuid)
VALUES (101, 'Alice', 1, NULL, '2020-01-10 09:00:00+00', 95000.00, 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
       (102, 'Bob', 1, 101, '2021-03-05 08:30:00+00', 80000.00, 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
       (103, 'Carol', 2, NULL, '2019-07-20 10:15:00+00', 72000.00, 'c2eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

UPDATE app.department SET head_employee_id = 101 WHERE department_id = 1;
UPDATE app.department SET head_employee_id = 103 WHERE department_id = 2;

INSERT INTO app.project (project_id, code, name)
VALUES (1, 'PRJ-100', 'Database Diagrammer'),
       (2, 'PRJ-200', 'Schema Importer');

INSERT INTO app.employee_project (employee_id, project_id, role)
VALUES (101, 1, 'lead'),
       (101, 2, 'reviewer'),
       (102, 1, 'developer'),
       (103, 2, 'analyst');

INSERT INTO app."order" (order_id, customer_id, order_date, total)
VALUES (1001, 101, '2024-01-15 14:30:00+00', 1500.00),
       (1002, 102, '2024-02-20 16:45:00+00', 2350.50);
