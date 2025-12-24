/**
 * VlibeStorage - Main SDK class
 */
import type {
  VlibeStorageConfig,
  StorageFile,
  UploadOptions,
  UploadResult,
  ListOptions,
  ListResult,
  StorageStats,
  CanUploadResult,
  PresignedUpload,
  ApiResponse,
  Folder,
  CreateFolderOptions,
  ListFoldersOptions,
  FileReference,
  FileCopyResult,
  StorageConfig,
} from './types';

const DEFAULT_BASE_URL = 'https://vlibe.app';

export class VlibeStorage {
  private appId: string;
  private appSecret: string;
  private baseUrl: string;
  private authToken: string | null = null;
  private storageConfig: StorageConfig | null = null;

  constructor(config: VlibeStorageConfig) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.baseUrl = config.baseUrl?.replace(/\/$/, '') || DEFAULT_BASE_URL;
  }

  /**
   * Set the user's auth token (required for authenticated requests)
   */
  setAuthToken(token: string): void {
    this.authToken = token;
  }

  /**
   * Clear the auth token
   */
  clearAuthToken(): void {
    this.authToken = null;
  }

  /**
   * Get storage configuration from the server
   * This fetches the current storage provider and public URL base
   */
  async getStorageConfig(): Promise<StorageConfig> {
    // Return cached config if available
    if (this.storageConfig) {
      return this.storageConfig;
    }

    try {
      const response = await this.request<StorageConfig>('/storage/config');
      if (response.success && response.data) {
        this.storageConfig = response.data;
        return response.data;
      }
    } catch {
      // Fall through to default
    }

    // Fallback to legacy Wasabi configuration
    return {
      provider: 'wasabi',
      publicUrlBase: 'https://s3.eu-central-2.wasabisys.com/vlibe.com',
    };
  }

  /**
   * Clear cached storage config (call if config might have changed)
   */
  clearStorageConfigCache(): void {
    this.storageConfig = null;
  }

  /**
   * Make an authenticated API request
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}/api${path}`;

    const headers: Record<string, string> = {
      'X-App-Id': this.appId,
      'X-App-Secret': this.appSecret,
      ...((options.headers as Record<string, string>) || {}),
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok && !data.error) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    return data;
  }

  // ============================================
  // UPLOAD METHODS
  // ============================================

  /**
   * Upload a file directly
   */
  async upload(
    file: File | Blob,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    const formData = new FormData();
    formData.append('file', file);

    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.isPublic) {
      formData.append('isPublic', 'true');
    }

    const response = await this.request<UploadResult>('/storage', {
      method: 'POST',
      body: formData,
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Upload failed');
    }

    return response.data;
  }

  /**
   * Get a presigned URL for direct upload to storage
   * Useful for large files or when you want upload progress
   */
  async getUploadUrl(
    filename: string,
    mimeType: string,
    size: number,
    options: Omit<UploadOptions, 'onProgress'> = {}
  ): Promise<PresignedUpload> {
    const response = await this.request<PresignedUpload>('/storage/upload-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filename,
        mimeType,
        size,
        folder: options.folder,
        isPublic: options.isPublic,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get upload URL');
    }

    return response.data;
  }

  /**
   * Upload a file using presigned URL (for progress tracking)
   */
  async uploadWithProgress(
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    // Get presigned URL
    const { uploadUrl, key, expiresIn } = await this.getUploadUrl(
      file.name,
      file.type,
      file.size,
      options
    );

    // Upload directly to S3 with progress
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      if (options.onProgress) {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 100);
            options.onProgress!(percent);
          }
        });
      }

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.open('PUT', uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });

    // Confirm upload
    const response = await this.request<UploadResult>('/storage/upload-url', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        folder: options.folder,
        isPublic: options.isPublic,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to confirm upload');
    }

    return response.data;
  }

  // ============================================
  // DOWNLOAD METHODS
  // ============================================

  /**
   * Get a signed download URL for a file
   */
  async getDownloadUrl(fileId: string, expiresIn?: number): Promise<string> {
    const params = new URLSearchParams({ download: 'true' });
    if (expiresIn) {
      params.set('expiresIn', expiresIn.toString());
    }

    const response = await this.request<{ url: string; expiresIn: number }>(
      `/storage/${fileId}?${params}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get download URL');
    }

    return response.data.url;
  }

  /**
   * Get a public URL for a file (only works for public files in the public path)
   * Returns the direct URL based on the configured storage provider
   *
   * Note: This is a sync method that uses cached config. Call getStorageConfig()
   * first to ensure the config is loaded, or use getPublicUrlAsync() for a
   * guaranteed fresh URL.
   */
  getPublicUrl(key: string): string {
    // Use cached config if available
    if (this.storageConfig) {
      const base = this.storageConfig.publicUrlBase.replace(/\/$/, '');
      return `${base}/${key}`;
    }

    // Fallback to legacy Wasabi URL
    const region = 'eu-central-2';
    const bucket = 'vlibe.com';
    return `https://s3.${region}.wasabisys.com/${bucket}/${key}`;
  }

  /**
   * Get a public URL for a file (async version that ensures fresh config)
   * Returns the direct URL based on the configured storage provider
   */
  async getPublicUrlAsync(key: string): Promise<string> {
    const config = await this.getStorageConfig();
    const base = config.publicUrlBase.replace(/\/$/, '');
    return `${base}/${key}`;
  }

  /**
   * Check if a storage key is in the public path
   */
  isPublicKey(key: string): boolean {
    return key.startsWith('vlibe-storage/public/');
  }

  // ============================================
  // FILE MANAGEMENT
  // ============================================

  /**
   * List files
   */
  async list(options: ListOptions = {}): Promise<ListResult> {
    const params = new URLSearchParams();
    if (options.folder !== undefined) {
      params.set('folder', options.folder);
    }
    if (options.limit) {
      params.set('limit', options.limit.toString());
    }
    if (options.offset) {
      params.set('offset', options.offset.toString());
    }

    const response = await this.request<ListResult>(
      `/storage?${params}`
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list files');
    }

    return response.data;
  }

  /**
   * Get a single file's metadata
   */
  async get(fileId: string): Promise<StorageFile | null> {
    const response = await this.request<StorageFile>(`/storage/${fileId}`);

    if (!response.success) {
      if (response.error?.includes('not found')) {
        return null;
      }
      throw new Error(response.error || 'Failed to get file');
    }

    return response.data || null;
  }

  /**
   * Delete a file
   */
  async delete(fileId: string): Promise<boolean> {
    const response = await this.request<void>(`/storage/${fileId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      if (response.error?.includes('not found')) {
        return false;
      }
      throw new Error(response.error || 'Failed to delete file');
    }

    return true;
  }

  /**
   * Delete multiple files
   */
  async deleteMany(fileIds: string[]): Promise<{ deleted: string[]; failed: string[] }> {
    const deleted: string[] = [];
    const failed: string[] = [];

    // Delete in parallel batches
    const batchSize = 10;
    for (let i = 0; i < fileIds.length; i += batchSize) {
      const batch = fileIds.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((id) => this.delete(id))
      );

      results.forEach((result, index) => {
        const id = batch[index];
        if (result.status === 'fulfilled' && result.value) {
          deleted.push(id);
        } else {
          failed.push(id);
        }
      });
    }

    return { deleted, failed };
  }

  // ============================================
  // USAGE & LIMITS
  // ============================================

  /**
   * Get storage usage statistics
   */
  async getUsage(): Promise<StorageStats> {
    const response = await this.request<StorageStats>('/storage/usage');

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get usage');
    }

    return response.data;
  }

  /**
   * Check if a file of given size can be uploaded
   */
  async canUpload(size: number): Promise<CanUploadResult> {
    const response = await this.request<CanUploadResult>('/storage/usage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ size }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to check upload');
    }

    return response.data;
  }

  // ============================================
  // FOLDER MANAGEMENT
  // ============================================

  /**
   * List folders
   */
  async listFolders(options: ListFoldersOptions = {}): Promise<Folder[]> {
    const params = new URLSearchParams();
    if (options.parentId !== undefined) {
      params.set('parentId', options.parentId === null ? 'null' : options.parentId);
    }
    if (options.projectId) {
      params.set('projectId', options.projectId);
    }

    const response = await this.request<Folder[]>(`/storage/folders?${params}`);

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to list folders');
    }

    return response.data;
  }

  /**
   * Create a folder
   */
  async createFolder(name: string, options: CreateFolderOptions = {}): Promise<Folder> {
    const response = await this.request<Folder>('/storage/folders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        parentId: options.parentId,
        projectId: options.projectId,
        isProjectRoot: options.isProjectRoot,
      }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create folder');
    }

    return response.data;
  }

  /**
   * Rename a folder
   */
  async renameFolder(folderId: string, name: string): Promise<Folder> {
    const response = await this.request<Folder>(`/storage/folders/${folderId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to rename folder');
    }

    return response.data;
  }

  /**
   * Delete a folder (must be empty)
   */
  async deleteFolder(folderId: string): Promise<boolean> {
    const response = await this.request<void>(`/storage/folders/${folderId}`, {
      method: 'DELETE',
    });

    if (!response.success) {
      if (response.error?.includes('not found')) {
        return false;
      }
      throw new Error(response.error || 'Failed to delete folder');
    }

    return true;
  }

  // ============================================
  // FILE COPY & REFERENCE
  // ============================================

  /**
   * Copy a file to another project
   * Creates a new database record pointing to the same S3 object
   */
  async copyFileToProject(fileId: string, targetProjectId: string): Promise<FileCopyResult> {
    const response = await this.request<FileCopyResult>('/storage/files/copy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, targetProjectId }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to copy file');
    }

    return response.data;
  }

  /**
   * Create a file reference (link file to another project without copying)
   * Does not count against storage quota
   */
  async createFileReference(fileId: string, targetProjectId: string): Promise<FileReference> {
    const response = await this.request<FileReference>('/storage/files/reference', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ fileId, targetProjectId }),
    });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create file reference');
    }

    return response.data;
  }
}
