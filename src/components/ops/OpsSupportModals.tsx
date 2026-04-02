import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { patchOpsEntity, deleteOpsEntity } from '@/lib/api/ops';

interface EditModalProps {
  entity: 'teams' | 'players' | 'products' | 'events' | 'schedules';
  id: string;
  initialData: Record<string, unknown>;
  onClose: () => void;
}

export function OpsEditModal({ entity, id, initialData, onClose }: EditModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(initialData);

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: Record<string, unknown>) => patchOpsEntity(entity, id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`ops-${entity}-list`] });
      onClose();
    },
    onError: (err) => {
      console.error('Failed to update:', err);
      alert('Failed to update. Must be Super Admin.');
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 p-6 rounded-lg w-full max-w-md border border-slate-700">
        <h3 className="text-xl font-bold mb-4">Edit {entity}</h3>
        <div className="space-y-4">
          {Object.entries(initialData).filter(([k]) => k !== 'id' && k !== 'created_at').map(([key, val]) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 capitalize">{key.replace('_', ' ')}</label>
              <input
                name={key}
                value={formData[key] || ''}
                onChange={handleChange}
                className="w-full bg-slate-800 border-slate-700 rounded px-3 py-2"
              />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 hover:bg-slate-800 rounded">Cancel</button>
          <button onClick={() => mutate(formData)} disabled={isPending} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white">
            {isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ArchiveModalProps {
  entity: 'teams' | 'players' | 'products' | 'events';
  id: string;
  name?: string;
  onClose: () => void;
}

export function OpsArchiveModal({ entity, id, name, onClose }: ArchiveModalProps) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation({
    mutationFn: () => deleteOpsEntity(entity, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`ops-${entity}-list`] });
      onClose();
    },
    onError: (err) => {
      console.error('Failed to archive:', err);
      alert('Failed to archive. Must be Super Admin.');
    }
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-slate-900 p-6 rounded-lg w-full max-w-sm border border-slate-700">
        <h3 className="text-xl font-bold mb-4">Confirm Archive</h3>
        <p className="mb-6">Are you sure you want to archive {name ? `"${name}"` : 'this item'}?</p>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} disabled={isPending} className="px-4 py-2 hover:bg-slate-800 rounded">Cancel</button>
          <button onClick={() => mutate()} disabled={isPending} className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white">
            {isPending ? 'Archiving...' : 'Archive'}
          </button>
        </div>
      </div>
    </div>
  );
}
