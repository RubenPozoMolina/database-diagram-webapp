/**
 * Application entry point.
 *
 * Initialises the diagram canvas component and renders an empty workspace.
 * Table nodes and relationship lines can be added programmatically here
 * or by user interaction handlers wired up in later tickets.
 *
 * Also mounts the PostgreSQL connection form so users can enter connection
 * details and submit them to the backend (TASK-036).
 */

import { DiagramCanvas } from './canvas/DiagramCanvas';
import { ConnectionForm } from './connection/ConnectionForm';

function main(): void {
  const canvasElement = document.getElementById(
    'diagram-canvas',
  ) as HTMLCanvasElement | null;

  if (!canvasElement) {
    console.error('Diagram canvas element #diagram-canvas not found');
    return;
  }

  const canvas = new DiagramCanvas(canvasElement);

  // Render the empty workspace on load (acceptance criterion 1).
  canvas.render();

  // Mount the connection form (TASK-036).
  const connectionFormContainer = document.getElementById(
    'connection-form',
  ) as HTMLElement | null;
  if (connectionFormContainer) {
    new ConnectionForm({ container: connectionFormContainer });
  }

  // Expose for debugging / later integration.
  (window as unknown as { __diagramCanvas?: DiagramCanvas }).__diagramCanvas =
    canvas;
}

document.addEventListener('DOMContentLoaded', main);
