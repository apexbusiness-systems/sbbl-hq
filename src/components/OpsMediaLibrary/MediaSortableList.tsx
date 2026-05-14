import { ReactNode } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

export type MediaSortableListProps = {
  itemIds: string[];
  onDragEnd: (event: DragEndEvent) => void;
  sensors?: ReturnType<typeof useSensors>;
  children: ReactNode;
};

export function MediaSortableList({ itemIds, onDragEnd, sensors: externalSensors, children }: MediaSortableListProps) {
  const internalSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const sensors = externalSensors ?? internalSensors;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}
