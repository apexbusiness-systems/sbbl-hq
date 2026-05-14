import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MediaCard, type MediaCardProps } from './MediaCard';

export type MediaDragCardProps = MediaCardProps & {
  id: string;
};

export function MediaDragCard({ id, ...cardProps }: MediaDragCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="touch-none">
      <MediaCard
        {...cardProps}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
