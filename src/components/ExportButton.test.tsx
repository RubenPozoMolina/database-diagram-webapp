import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExportButton } from './ExportButton';
import { createEmptyDiagram } from '../types/diagram';

type UrlWithMocks = URL & {
  createObjectURL?: ReturnType<typeof vi.fn>;
  revokeObjectURL?: ReturnType<typeof vi.fn>;
};

describe('ExportButton', () => {
  let createObjectURLMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.spyOn>;
  let capturedAnchor: HTMLAnchorElement | null = null;
  let originalBlob: typeof Blob | undefined;

  beforeEach(() => {
    capturedAnchor = null;
    originalBlob = globalThis.Blob;
    // jsdom does not implement URL.createObjectURL/revokeObjectURL; define
    // test doubles so the export download path can be exercised here.
    createObjectURLMock = vi.fn(() => 'blob:mock-export-url');
    revokeObjectURLMock = vi.fn();
    (URL as unknown as UrlWithMocks).createObjectURL = createObjectURLMock;
    (URL as unknown as UrlWithMocks).revokeObjectURL = revokeObjectURLMock;
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      // jsdom anchor click attempts navigation ("Not implemented"); stub it so
      // the test only observes that click was invoked.
      .mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === 'a') {
        capturedAnchor = el as HTMLAnchorElement;
      }
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    globalThis.Blob = originalBlob!;
  });

  it('renders an Export to JSON button', () => {
    render(<ExportButton diagram={createEmptyDiagram()} />);
    expect(
      screen.getByRole('button', { name: /export diagram to json/i }),
    ).toBeInTheDocument();
  });

  it('is keyboard-focusable and announces itself to assistive technology', () => {
    render(<ExportButton diagram={createEmptyDiagram()} />);
    const button = screen.getByRole('button', { name: /export diagram to json/i });
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toHaveAttribute('aria-label', 'Export diagram to JSON');
  });

  it('triggers a file download with a .json filename', () => {
    const diagram = createEmptyDiagram('My Diagram');
    render(<ExportButton diagram={diagram} />);
    fireEvent.click(screen.getByRole('button', { name: /export diagram to json/i }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.download).toMatch(/my_diagram\.json$/);
    expect(capturedAnchor!.href).toBe('blob:mock-export-url');
  });

  it('downloads JSON containing the complete diagram model and no credentials', async () => {
    // Capture the parts passed to the Blob constructor so we can inspect the
    // downloaded payload (jsdom's Blob does not implement .text()).
    const blobParts: unknown[] = [];
    const blobConstructorMock = vi.fn((parts: unknown[]) => {
      blobParts.push(...parts);
      return Object.create(Blob.prototype);
    });
    globalThis.Blob = blobConstructorMock as unknown as typeof Blob;

    const diagram = createEmptyDiagram('E-commerce Schema');
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
      indexes: [],
    });
    diagram.relationships.push({
      id: 'rel-1',
      sourceTableId: 'table-users',
      targetTableId: 'table-users',
    });

    render(<ExportButton diagram={diagram} />);
    fireEvent.click(screen.getByRole('button', { name: /export diagram to json/i }));

    expect(createObjectURLMock).toHaveBeenCalledTimes(1);

    const jsonString = blobParts.find((part) => typeof part === 'string');
    expect(jsonString).toBeDefined();
    const json = JSON.parse(jsonString as string);

    expect(json.version).toBe('1.0.0');
    expect(json.diagram.name).toBe('E-commerce Schema');
    expect(json.diagram.tables).toHaveLength(1);
    expect(json.diagram.tables[0].columns).toHaveLength(2);
    expect(json.diagram.tables[0].columns[0].type).toBe('serial');
    expect(json.diagram.tables[0].columns[0].primaryKey).toBe(true);
    expect(json.diagram.relationships).toHaveLength(1);
    expect(json.diagram.uniqueConstraints).toEqual([]);
    expect(json.diagram.indexes).toEqual([]);

    const serialized = JSON.stringify(json).toLowerCase();
    for (const credential of [
      'host',
      'port',
      'database',
      '"user"',
      'password',
    ]) {
      expect(serialized).not.toContain(credential);
    }

    // The blob URL should be revoked after the download is triggered.
    await vi.waitFor(() => {
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-export-url');
    });
  });

  it('uses a default filename when the diagram name is empty', () => {
    const diagram = createEmptyDiagram('');
    render(<ExportButton diagram={diagram} />);
    fireEvent.click(screen.getByRole('button', { name: /export diagram to json/i }));

    expect(capturedAnchor!.download).toMatch(/diagram\.json$/);
  });
});
