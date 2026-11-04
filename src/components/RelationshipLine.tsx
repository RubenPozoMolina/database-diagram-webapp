import type { Relationship } from '../types/diagram';

interface RelationshipLineProps {
  relationship: Relationship;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  onDelete?: (relationshipId: string) => void;
}

export function RelationshipLine({
  relationship,
  sourceX,
  sourceY,
  targetX,
  targetY,
  onDelete,
}: RelationshipLineProps) {
  // Draw a slightly curved line from source to target.
  const cp1x = (sourceX + targetX) / 2;
  const cp1y = sourceY;
  const cp2x = (sourceX + targetX) / 2;
  const cp2y = targetY;
  const d = `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${targetX} ${targetY}`;

  const handleClick = () => {
    if (onDelete) onDelete(relationship.id);
  };

  return (
    <path
      key={relationship.id}
      d={d}
      fill="none"
      stroke="#4f46e5"
      strokeWidth="2"
      className="relationship-line"
      style={{
        cursor: 'pointer',
        pointerEvents: 'all',
      }}
      onClick={handleClick}
    />
  );
}
