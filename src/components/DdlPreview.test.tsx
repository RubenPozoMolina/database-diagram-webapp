import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DdlPreview } from './DdlPreview';
import { createEmptyDiagram } from '../types/diagram';
import type { ConnectionConfig } from '../types';
import * as ddlApi from '../connection/ddlApi';
import * as ddlGenerator from '../ddl/ddlGenerator';

const TEST_CONFIG: ConnectionConfig = {
  host: 'localhost',
  port: 5432,
  database: 'app_test',
  user: 'postgres',
  password: 'secret',
};

const TEST_DDL = 'CREATE TABLE "users" ("id" SERIAL NOT NULL PRIMARY KEY);';

function buildDiagram() {
  const diagram = createEmptyDiagram('Test Schema');
  diagram.tables.push({
    id: 'table-users',
    name: 'users',
    x: 100,
    y: 100,
    width: 240,
    height: 200,
    columns: [
      {
        id: 'col-users-id',
        name: 'id',
        dataType: 'serial',
        nullable: false,
        primaryKey: true,
      },
      {
        id: 'col-users-email',
        name: 'email',
        dataType: 'varchar',
        nullable: false,
        primaryKey: false,
      },
    ],
  });
  return diagram;
}

describe('DdlPreview', () => {
  let applyDdlMock: ReturnType<typeof vi.fn>;
  let generateDdlMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    applyDdlMock = vi.fn().mockResolvedValue({
      success: true,
      message: 'Schema applied successfully',
      ddlPreview: TEST_DDL,
    });
    vi.spyOn(ddlApi, 'applyDDL').mockImplementation(applyDdlMock);

    generateDdlMock = vi.fn().mockReturnValue(TEST_DDL);
    vi.spyOn(ddlGenerator, 'generateDDL').mockImplementation(generateDdlMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is hidden when isOpen is false', () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen={false}
        onClose={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows the review dialog when isOpen is true', () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Review DDL Before Execution/i)).toBeInTheDocument();
  });

  it('displays the generated DDL in a code block', () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(TEST_DDL)).toBeInTheDocument();
    expect(generateDdlMock).toHaveBeenCalledTimes(1);
  });

  it('shows a "Generating DDL…" state before generation completes', () => {
    generateDdlMock.mockImplementation(() => {
      throw new Error('Generation failed');
    });
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Generating DDL…/)).toBeInTheDocument();
  });

  it('shows an error when DDL generation fails', () => {
    generateDdlMock.mockImplementation(() => {
      throw new Error('Generation failed');
    });
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Failed to generate DDL/)).toBeInTheDocument();
  });

  it('disables Execute DDL until the confirmation checkbox is checked', () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    const executeButton = screen.getByRole('button', { name: /Execute DDL/i });
    expect(executeButton).toBeDisabled();

    const checkbox = screen.getByLabelText(
      /I confirm I want to execute this DDL on the database/i,
    );
    fireEvent.click(checkbox);

    expect(executeButton).not.toBeDisabled();
  });

  it('does not call applyDDL without confirmation', async () => {
    const onClose = vi.fn();
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Execute DDL/i }));

    expect(applyDdlMock).not.toHaveBeenCalled();
  });

  it('calls applyDDL with confirm=true when user confirms', async () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(
      /I confirm I want to execute this DDL on the database/i,
    );
    fireEvent.click(checkbox);

    fireEvent.click(screen.getByRole('button', { name: /Execute DDL/i }));

    await vi.waitFor(() => {
      expect(applyDdlMock).toHaveBeenCalledWith(
        TEST_DDL,
        TEST_CONFIG,
        true,
        '/api/apply-schema',
      );
    });
  });

  it('shows success message after successful execution', async () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(
      /I confirm I want to execute this DDL on the database/i,
    );
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Execute DDL/i }));

    await vi.waitFor(() => {
      expect(screen.getByText('Schema applied successfully')).toBeInTheDocument();
    });
  });

  it('shows error message when execution fails', async () => {
    applyDdlMock.mockResolvedValueOnce({
      success: false,
      message: 'DROP not allowed',
      ddlPreview: TEST_DDL,
    });

    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={vi.fn()}
      />,
    );
    const checkbox = screen.getByLabelText(
      /I confirm I want to execute this DDL on the database/i,
    );
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole('button', { name: /Execute DDL/i }));

    await vi.waitFor(() => {
      expect(screen.getByText('DROP not allowed')).toBeInTheDocument();
    });
  });

  it('calls onClose when Cancel is clicked', () => {
    const onClose = vi.fn();
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={TEST_CONFIG}
        isOpen
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not apply DDL when connection is null', async () => {
    render(
      <DdlPreview
        diagram={buildDiagram()}
        connection={null}
        isOpen
        onClose={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Execute DDL/i }));
    expect(applyDdlMock).not.toHaveBeenCalled();
  });
});
