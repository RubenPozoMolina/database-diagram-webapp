import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../App';
import { createEmptyDiagram } from '../types/diagram';
import {
  DIAGRAM_JSON_VERSION,
  serializeDiagram,
} from '../serialization/diagramSerializer';

/**
 * Build a File-like object for jsdom.
 *
 * jsdom's File constructor rejects array bits in this environment
 * ("parameter 1 is not an iterable object"), so build the file from a
 * Blob instead and give it a name. The ImportButton component under test
 * only reads `name`/`type` and passes the file to FileReader, so a Blob
 * with a name behaves identically to a real File.
 */
function createFile(content: string, name: string): File {
  const blob = new Blob([content], { type: 'application/json' });
  Object.defineProperty(blob, 'name', { value: name, configurable: true });
  // Stash the text content so the FileReader mock can read it synchronously.
  Object.defineProperty(blob, '_content', { value: content, configurable: true });
  return blob as unknown as File;
}

/**
 * Mock FileReader for jsdom: readAsText() synchronously triggers onload
 * with the file's text content as reader.result. This lets the ImportButton's
 * handleFileSelect → FileReader → onload → JSON.parse → onImport/onError
 * chain execute synchronously inside fireEvent.change.
 */
vi.stubGlobal(
  'FileReader',
  class FileReaderMock {
    result: string | null = null;
    onload: ((this: any, ev: any) => void) | null = null;
    onerror: ((this: any, ev: any) => void) | null = null;

    readAsText(file: File | Blob) {
      const content = (file as { _content?: string })._content ?? '';
      this.result = content;
      if (this.onload) {
        this.onload.call(this, null);
      }
    }

    abort() {}
  } as any,
);

function ensureRandomUUID(): void {
  const globalCrypto = globalThis as {
    crypto?: { randomUUID?: () => string };
  };
  if (!globalCrypto.crypto?.randomUUID) {
    globalCrypto.crypto = { randomUUID: () => 'test-diagram-uuid' };
  }
}

function selectFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file] });
}

describe('App - JSON import', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ensureRandomUUID();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('imports a valid JSON diagram and loads its tables onto the canvas', () => {
    const diagram = createEmptyDiagram('Imported Diagram');
    diagram.tables.push({
      id: 'table-users',
      name: 'users',
      x: 100,
      y: 100,
      width: 240,
      height: 200,
      columns: [
        { id: 'col-1', name: 'id', dataType: 'serial', nullable: false, primaryKey: true },
        { id: 'col-2', name: 'email', dataType: 'varchar', nullable: false, primaryKey: false },
      ],
      indexes: [],
    });

    const exportPayload = serializeDiagram(diagram);
    const jsonString = JSON.stringify(exportPayload);

    render(<App />);

    // The canvas starts empty.
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = createFile(jsonString, 'diagram.json');
    selectFile(input, file);
    fireEvent.change(input);

    // The imported diagram replaced the empty canvas: table nodes are rendered.
    expect(screen.queryByText(/Empty diagram canvas/i)).not.toBeInTheDocument();
    expect(screen.getByText('users')).toBeInTheDocument();
    expect(screen.getByText(/id: serial/)).toBeInTheDocument();
    expect(screen.getByText(/email: varchar/)).toBeInTheDocument();
  });

  it('leaves the canvas empty and shows an error for invalid JSON', () => {
    render(<App />);

    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = createFile('not valid json{{{', 'bad.json');
    selectFile(input, file);
    fireEvent.change(input);

    // Nothing was imported: the canvas stays empty and the error alert shows.
    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/invalid json/i)).toBeInTheDocument();
  });

  it('leaves the canvas empty and shows an error for an unsupported schema version', () => {
    render(<App />);

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
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = createFile(JSON.stringify(payload), 'bad-version.json');
    selectFile(input, file);
    fireEvent.change(input);

    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/unsupported diagram file version/i)).toBeInTheDocument();
  });

  it('leaves the canvas empty and shows an error for a payload missing the diagram root', () => {
    render(<App />);

    const payload = { version: DIAGRAM_JSON_VERSION };
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    const file = createFile(JSON.stringify(payload), 'no-diagram.json');
    selectFile(input, file);
    fireEvent.change(input);

    expect(screen.getByText(/Empty diagram canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/missing version or diagram root/i)).toBeInTheDocument();
  });
});
