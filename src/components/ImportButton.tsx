import { useCallback, useRef } from 'react';
import type { Diagram } from '../types/diagram';
import { deserializeJson, DiagramImportError } from '../serialization/diagramDeserializer';

interface ImportButtonProps {
  onImport: (diagram: Diagram) => void;
  onError: (message: string) => void;
}

export function ImportButton({ onImport, onError }: ImportButtonProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith('.json')) {
        onError('Please select a JSON file.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result as string;
          const parsed = JSON.parse(text);
          const diagram = deserializeJson(parsed);
          onImport(diagram);
        } catch (err) {
          if (err instanceof SyntaxError) {
            onError('Invalid JSON file: could not parse the file contents.');
          } else if (err instanceof DiagramImportError) {
            onError(err.message);
          } else {
            onError(
              'An unexpected error occurred while importing the diagram.',
            );
          }
        }
      };
      reader.onerror = () => {
        onError('Failed to read the selected file.');
      };
      reader.readAsText(file);

      // Reset the input so the same file can be selected again.
      event.target.value = '';
    },
    [onImport, onError],
  );

  const triggerFileInput = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
      <button
        type="button"
        className="import-button"
        onClick={triggerFileInput}
        aria-label="Import diagram from JSON"
      >
        Import from JSON
      </button>
    </>
  );
}
