import type { Diagram } from '../types/diagram';
import { serializeDiagram } from '../serialization/diagramSerializer';

interface ExportButtonProps {
  diagram: Diagram;
}

export function ExportButton({ diagram }: ExportButtonProps) {
  const handleExport = () => {
    const exportPayload = serializeDiagram(diagram);
    const blob = new Blob(
      [JSON.stringify(exportPayload, null, 2)],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);

    const fileName = `${diagram.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '') || 'diagram'}.json`;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    // Release the blob URL once the download has been triggered.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <button
      type="button"
      className="export-button"
      onClick={handleExport}
      aria-label="Export diagram to JSON"
    >
      Export to JSON
    </button>
  );
}
