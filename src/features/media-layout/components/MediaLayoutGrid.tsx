import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { MediaLayoutTile } from './MediaLayoutTile';

type Item = { id: string; title: string; thumbnail: string };

type Props = {
  items: Item[];
  onChange: (nextIds: string[]) => void;
};

export function MediaLayoutGrid({ items, onChange }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex).map((item) => item.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((item) => item.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.map((item, index) => (
            <MediaLayoutTile key={item.id} id={item.id} title={item.title} thumbnail={item.thumbnail} order={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
