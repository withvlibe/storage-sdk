/**
 * useStorage - React hook for file operations
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { VlibeStorage } from '../VlibeStorage';
import type { StorageFile, UploadOptions, UploadResult, ListOptions } from '../types';

export interface UseStorageOptions {
  /** Initial folder to list files from */
  folder?: string;
  /** Auto-fetch files on mount */
  autoFetch?: boolean;
  /** Pagination limit */
  limit?: number;
}

export interface UseStorageReturn {
  /** List of files */
  files: StorageFile[];
  /** Total file count */
  total: number;
  /** Loading state */
  loading: boolean;
  /** Error message if any */
  error: string | null;
  /** Upload a file */
  upload: (file: File, options?: UploadOptions) => Promise<UploadResult>;
  /** Upload with progress tracking */
  uploadWithProgress: (
    file: File,
    options?: UploadOptions
  ) => Promise<UploadResult>;
  /** Current upload progress (0-100) */
  uploadProgress: number;
  /** Uploading state */
  uploading: boolean;
  /** Delete a file */
  remove: (fileId: string) => Promise<boolean>;
  /** Refresh the file list */
  refresh: () => Promise<void>;
  /** Load more files (pagination) */
  loadMore: () => Promise<void>;
  /** Whether there are more files to load */
  hasMore: boolean;
}

export function useStorage(
  client: VlibeStorage,
  options: UseStorageOptions = {}
): UseStorageReturn {
  const { folder, autoFetch = true, limit = 50 } = options;

  const [files, setFiles] = useState<StorageFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);

  const fetchFiles = useCallback(
    async (append = false) => {
      setLoading(true);
      setError(null);

      try {
        const listOptions: ListOptions = {
          folder,
          limit,
          offset: append ? offsetRef.current : 0,
        };

        const result = await client.list(listOptions);

        if (append) {
          setFiles((prev) => [...prev, ...result.files]);
        } else {
          setFiles(result.files);
          offsetRef.current = 0;
        }

        setTotal(result.total);
        setHasMore(result.hasMore);
        offsetRef.current = (append ? offsetRef.current : 0) + result.files.length;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch files');
      } finally {
        setLoading(false);
      }
    },
    [client, folder, limit]
  );

  useEffect(() => {
    if (autoFetch) {
      fetchFiles();
    }
  }, [autoFetch, fetchFiles]);

  const upload = useCallback(
    async (file: File, uploadOptions: UploadOptions = {}): Promise<UploadResult> => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const result = await client.upload(file, {
          ...uploadOptions,
          folder: uploadOptions.folder ?? folder,
        });

        // Refresh file list
        await fetchFiles();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        throw err;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [client, folder, fetchFiles]
  );

  const uploadWithProgress = useCallback(
    async (file: File, uploadOptions: UploadOptions = {}): Promise<UploadResult> => {
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        const result = await client.uploadWithProgress(file, {
          ...uploadOptions,
          folder: uploadOptions.folder ?? folder,
          onProgress: (progress) => {
            setUploadProgress(progress);
            uploadOptions.onProgress?.(progress);
          },
        });

        // Refresh file list
        await fetchFiles();

        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Upload failed';
        setError(message);
        throw err;
      } finally {
        setUploading(false);
        setUploadProgress(0);
      }
    },
    [client, folder, fetchFiles]
  );

  const remove = useCallback(
    async (fileId: string): Promise<boolean> => {
      setError(null);

      try {
        const deleted = await client.delete(fileId);

        if (deleted) {
          // Remove from local state
          setFiles((prev) => prev.filter((f) => f.id !== fileId));
          setTotal((prev) => prev - 1);
        }

        return deleted;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Delete failed';
        setError(message);
        throw err;
      }
    },
    [client]
  );

  const refresh = useCallback(async () => {
    await fetchFiles(false);
  }, [fetchFiles]);

  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchFiles(true);
    }
  }, [hasMore, loading, fetchFiles]);

  return {
    files,
    total,
    loading,
    error,
    upload,
    uploadWithProgress,
    uploadProgress,
    uploading,
    remove,
    refresh,
    loadMore,
    hasMore,
  };
}
