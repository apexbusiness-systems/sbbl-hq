import { useState, useEffect, useCallback } from 'react';
import { uploadCsv } from '@/lib/api/ops';
const getInitDB = async () => {
  const mod = await import('@/lib/rxdb');
  return mod.initDB();
};
import { parseCsv } from '@/lib/parseCsv';

export type QueueItem = {
  id: string;
  type: 'teams' | 'players' | 'schedules' | 'events' | 'scores';
  payload: {
    csvText?: string;
    rows?: Array<Record<string, string>>;
    format?: string;
  };
  status: 'pending' | 'failed' | 'completed';
  attempts: number;
  created_at: string;
  error_message?: string;
};

export function useOpsCsvUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<Error | null>(null);
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; field?: string; code: string; message: string }>>([]);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; failed: number } | null>(null);
  
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isDbReady, setIsDbReady] = useState(false);

  const refreshQueue = useCallback(async () => {
    try {
      const db = await getInitDB();
      const items = await db.ops_queue.find().exec();
      setQueue(items.map((i: { toJSON(): QueueItem }) => i.toJSON()));
      setIsDbReady(true);
    } catch (err) {
      console.error('[useOpsCsvUpload] Failed to load RxDB queue:', err);
    }
  }, []);

  useEffect(() => {
    refreshQueue();
  }, [refreshQueue]);

  const addToQueue = useCallback(async (
    type: 'teams' | 'players' | 'schedules' | 'events' | 'scores',
    payload: { csvText?: string; rows?: Array<Record<string, string>>; format?: string },
    status: 'pending' | 'failed' | 'completed' = 'pending',
    error_message?: string
  ) => {
    try {
      const db = await getInitDB();
      const id = `ops-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      await db.ops_queue.insert({
        id,
        type,
        payload,
        status,
        attempts: status === 'failed' ? 1 : 0,
        created_at: new Date().toISOString(),
        error_message: error_message || null,
      });
      await refreshQueue();
    } catch (err) {
      console.error('[useOpsCsvUpload] Failed to add item to RxDB queue:', err);
    }
  }, [refreshQueue]);

  const deleteQueueItem = useCallback(async (id: string) => {
    try {
      const db = await getInitDB();
      const doc = await db.ops_queue.findOne({ selector: { id } }).exec();
      if (doc) {
        await doc.remove();
        await refreshQueue();
      }
    } catch (err) {
      console.error('[useOpsCsvUpload] Failed to delete queue item:', err);
    }
  }, [refreshQueue]);

  const performUpload = useCallback(async (
    type: 'teams' | 'players' | 'schedules' | 'events' | 'scores',
    payload: { csvText?: string; rows?: Array<Record<string, string>>; format?: string }
  ) => {
    setIsUploading(true);
    setUploadError(null);
    setValidationErrors([]);
    setUploadResult(null);

    try {
      const response = await uploadCsv({
        kind: type,
        csvText: payload.csvText,
        rows: payload.rows,
        format: payload.format || 'v1',
      });

      if (response.ok) {
        setUploadResult({
          inserted: response.inserted,
          failed: response.failed,
        });
        return { ok: true, response };
      } else {
        if (response.errors) {
          setValidationErrors(response.errors);
        }
        throw new Error('Upload failed validation or ingestion');
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Upload failed');
      setUploadError(errorObj);
      await addToQueue(type, payload, 'failed', errorObj.message);
      return { ok: false, error: errorObj };
    } finally {
      setIsUploading(false);
    }
  }, [addToQueue]);

  const retryQueueItem = useCallback(async (id: string) => {
    const item = queue.find(i => i.id === id);
    if (!item) return;

    setIsUploading(true);
    setUploadError(null);
    setValidationErrors([]);

    try {
      const response = await uploadCsv({
        kind: item.type,
        csvText: item.payload.csvText,
        rows: item.payload.rows,
        format: item.payload.format || 'v1',
        idempotencyKey: item.id,
      });

      const db = await getInitDB();
      const doc = await db.ops_queue.findOne({ selector: { id } }).exec();

      if (response.ok) {
        if (doc) {
          await doc.remove();
        }
        await refreshQueue();
        setUploadResult({
          inserted: response.inserted,
          failed: response.failed,
        });
      } else {
        if (doc) {
          await doc.patch({
            attempts: (item.attempts || 1) + 1,
            error_message: 'Validation failed on retry',
          });
        }
        if (response.errors) {
          setValidationErrors(response.errors);
        }
        await refreshQueue();
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Retry failed');
      setUploadError(errorObj);
      const db = await getInitDB();
      const doc = await db.ops_queue.findOne({ selector: { id } }).exec();
      if (doc) {
        await doc.patch({
          attempts: (item.attempts || 1) + 1,
          error_message: errorObj.message,
        });
      }
      await refreshQueue();
    } finally {
      setIsUploading(false);
    }
  }, [queue, refreshQueue]);

  const flushQueue = useCallback(async () => {
    const failedItems = queue.filter(item => item.status === 'failed');
    if (failedItems.length === 0) return;

    for (const item of failedItems) {
      await retryQueueItem(item.id);
    }
  }, [queue, retryQueueItem]);

  return {
    isUploading,
    uploadError,
    validationErrors,
    uploadResult,
    queue,
    isDbReady,
    addToQueue,
    deleteQueueItem,
    performUpload,
    retryQueueItem,
    flushQueue,
    refreshQueue,
  };
}
