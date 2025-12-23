/**
 * Vlibe Storage SDK Types
 */

export interface VlibeStorageConfig {
  /** Your Vlibe App ID */
  appId: string;
  /** Your Vlibe App Secret */
  appSecret: string;
  /** Base URL for the Vlibe API (defaults to production) */
  baseUrl?: string;
}

export interface StorageFile {
  id: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  isPublic: boolean;
  folder: string | null;
  url?: string;
  createdAt: string;
}

export interface UploadOptions {
  /** Folder/category for the file */
  folder?: string;
  /** Custom filename (auto-generated if not provided) */
  filename?: string;
  /** Make file publicly accessible */
  isPublic?: boolean;
  /** Progress callback (0-100) */
  onProgress?: (progress: number) => void;
}

export interface UploadResult {
  id: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  isPublic: boolean;
}

export interface ListOptions {
  /** Filter by folder */
  folder?: string;
  /** Maximum files to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface ListResult {
  files: StorageFile[];
  total: number;
  hasMore: boolean;
}

export interface StorageStats {
  bytesUsed: number;
  bytesUsedFormatted: string;
  fileCount: number;
  storageLimit: number;
  storageLimitFormatted: string;
  usagePercent: number;
  month: string;
  monthlyStats: {
    bytesUploaded: number;
    bytesUploadedFormatted: string;
    bytesDeleted: number;
    bytesDeletedFormatted: string;
  };
  ownerType: 'platform_user' | 'creator';
}

export interface CanUploadResult {
  allowed: boolean;
  reason?: string;
}

export interface PresignedUpload {
  uploadUrl: string;
  key: string;
  expiresIn: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
