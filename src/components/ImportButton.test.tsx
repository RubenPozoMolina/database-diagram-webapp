import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportButton } from './ImportButton';
import { createEmptyDiagram } from '../types/diagram';
import {
  DIAGRAM_JSON_VERSION,
  serializeDiagram,
} from '../serialization/diagramSerializer';

describe('ImportButton', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders an Import from JSON button', () => {
    render(<ImportButton onImport={vi.fn()} onError={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /import from json/i }),
    ).toBeInTheDocument();
  });

  it('is keyboard-focusable and announces itself to assistive technology', () => {
    render(<ImportButton onImport={vi.fn()} onError={vi.fn()} />);
    const button = screen.getByRole('button', { name: /import from json/i });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', 'Import diagram from JSON');
  });

  it('triggers a hidden file input when clicked', () => {
    const clickSpy = vi.fn();
    const { container } = render(<ImportButton onImport={vi.fn()} onError={vi.fn()} />);
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).not.toBeNull();
    vi.spyOn(fileInput!, 'click').mockImplementation(clickSpy);

    fireEvent.click(screen.getByRole('button', { name: /import from json/i }));
    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('calls onError when a non-JSON file is selected', () => {
    const onError = vi.fn();
    const onImport = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const input = document.querySelector('input[type="file"]')!;
    const file = new File(['not json'], 'diagram.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(/please select a json file/i);
  });

  it('imports a valid diagram and calls onImport', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const diagram = createEmptyDiagram('Imported Diagram');
    diagram.tables.push({
      id: 'table-1',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        {
          id: 'col-1',
          name: 'id',
          dataType: 'serial',
          nullable: false,
          primaryKey: true,
        },
      ],
    });
    const exportPayload = serializeDiagram(diagram);
    const jsonString = JSON.stringify(exportPayload);
    const file = new File([jsonString], 'diagram.json', {
      type: 'application/json',
    });

    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const imported = onImport.mock.calls[0][0];
    expect(imported.name).toBe('Imported Diagram');
    expect(imported.tables).toHaveLength(1);
    expect(imported.tables[0].name).toBe('users');
    expect(imported.tables[0].columns).toHaveLength(1);
    expect(imported.relationships).toEqual([]);
  });

  it('calls onError for invalid JSON', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const file = new File(['not valid json{{{'], 'bad.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(/invalid json/i);
  });

  it('calls onError for unsupported schema version', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const payload = {
      version: '9.9.9',
      diagram: {
        id: 'some-id',
        name: 'Bad Version',
        tables: [],
        relationships: [],
        uniqueConstraints: [],
        indexes: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };
    const file = new File([JSON.stringify(payload)], 'bad-version.json', {
      type: 'application/json',
    });
    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining(/unsupported diagram file version/i),
    );
  });

  it('calls onError for missing diagram root', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const file = new File(
      JSON.stringify({ version: DIAGRAM_JSON_VERSION }),
      'no-diagram.json',
      { type: 'application/json' },
    );
    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining(/missing version or diagram root/i),
    );
  });

  it('round-trips through export then import', () => {
    const onImport = vi.fn();
    const onError = vi.fn();
    render(<ImportButton onImport={onImport} onError={onError} />);

    const original = createEmptyDiagram('Round Trip');
    original.tables.push({
      id: 'table-1',
      name: 'products',
      x: 200,
      y: 150,
      width: 240,
      height: 200,
      columns: [
        {
          id: 'col-1',
          name: 'id',
          dataType: 'serial',
          nullable: false,
          primaryKey: true,
        },
        {
          id: 'col-2',
          name: 'name',
          dataType: 'varchar',
          nullable: false,
          primaryKey: false,
        },
      ],
    });
    original.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-1',
      targetTableId: 'table-1',
    });

    const exportPayload = serializeDiagram(original);
    const jsonString = JSON.stringify(exportPayload);
    const file = new File([jsonString], 'roundtrip.json', {
      type: 'application/json',
    });

    const input = document.querySelector('input[type="file"]')!;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    const imported = onImport.mock.calls[0][0];
    expect(imported.name).toBe('Round Trip');
    expect(imported.tables).toHaveLength(1);
    expect(imported.tables[0].name).toBe('products');
    expect(imported.tables[0].columns).toHaveLength(2);
    expect(imported.tables[0].columns[0].dataType).toBe('serial');
    expect(imported.tables[0].columns[0].primaryKey).toBe(true);
    expect(imported.tables[0].columns[1].dataType).toBe('varchar');
    expect(imported.relationships).toHaveLength(1);
  });
});
