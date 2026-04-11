import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';

type Props = {
  id: string;
  title: string;
  thumbnail: string;
  order: number;
};

export function MediaLayoutTile({ id, title, thumbnail, order }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`panel overflow-hidden border border-border/50 ${isDragging ? 'opacity-70' : ''}`}
    >
      <div className="relative" style={{ aspectRatio: '3/4' }}>
        <img src={thumbnail} alt={title} className="absolute inset-0 h-full w-full object-cover object-top" />
        <span className="absolute left-2 top-2 rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-[#F5F5F0]">{order + 1}</span>
        <button
          type="button"
          aria-label={`Drag ${title}`}
          className="absolute right-2 top-2 rounded-sm bg-black/70 p-2 text-[#F5F5F0] touch-manipulation"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
