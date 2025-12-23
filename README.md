# @withvlibe/storage-sdk

Official Vlibe Storage SDK for file uploads in Vlibe apps.

## Installation

```bash
npm install @withvlibe/storage-sdk
# or
yarn add @withvlibe/storage-sdk
# or
pnpm add @withvlibe/storage-sdk
```

## Quick Start

```typescript
import { VlibeStorage } from '@withvlibe/storage-sdk';

// Initialize the client
const storage = new VlibeStorage({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
});

// Set user auth token (from Vlibe Auth)
storage.setAuthToken(userToken);

// Upload a file
const result = await storage.upload(file, {
  folder: 'images',
  isPublic: true,
});

console.log(result.url); // File URL
```

## React Hooks

```typescript
import { VlibeStorage, useStorage, useStorageUsage } from '@withvlibe/storage-sdk/react';

// Create client instance
const storage = new VlibeStorage({
  appId: 'your-app-id',
  appSecret: 'your-app-secret',
});

function FileUploader() {
  const {
    files,
    loading,
    upload,
    uploadWithProgress,
    uploadProgress,
    uploading,
    remove,
    refresh,
  } = useStorage(storage, { folder: 'documents' });

  const {
    usage,
    usagePercent,
    usageFormatted,
    isNearLimit,
    canUpload,
  } = useStorageUsage(storage);

  const handleUpload = async (file: File) => {
    if (!canUpload(file.size)) {
      alert('Storage limit would be exceeded');
      return;
    }

    const result = await uploadWithProgress(file, {
      onProgress: (progress) => console.log(`${progress}%`),
    });

    console.log('Uploaded:', result.url);
  };

  return (
    <div>
      <p>Storage: {usageFormatted} ({usagePercent}%)</p>
      {isNearLimit && <p>Warning: Running low on storage!</p>}

      <input type="file" onChange={(e) => handleUpload(e.target.files[0])} />
      {uploading && <p>Uploading: {uploadProgress}%</p>}

      <h3>Files ({files.length})</h3>
      {files.map((file) => (
        <div key={file.id}>
          {file.filename} ({file.size} bytes)
          <button onClick={() => remove(file.id)}>Delete</button>
        </div>
      ))}
    </div>
  );
}
```

## API Reference

### VlibeStorage

#### Constructor

```typescript
new VlibeStorage({
  appId: string;      // Your Vlibe App ID
  appSecret: string;  // Your Vlibe App Secret
  baseUrl?: string;   // API base URL (optional)
})
```

#### Methods

##### `setAuthToken(token: string)`
Set the user's authentication token.

##### `upload(file: File | Blob, options?: UploadOptions): Promise<UploadResult>`
Upload a file directly.

```typescript
const result = await storage.upload(file, {
  folder: 'images',
  isPublic: true,
});
```

##### `uploadWithProgress(file: File, options?: UploadOptions): Promise<UploadResult>`
Upload a file with progress tracking.

```typescript
const result = await storage.uploadWithProgress(file, {
  onProgress: (percent) => console.log(`${percent}%`),
});
```

##### `getDownloadUrl(fileId: string, expiresIn?: number): Promise<string>`
Get a signed download URL for a file.

##### `list(options?: ListOptions): Promise<ListResult>`
List files.

```typescript
const { files, total, hasMore } = await storage.list({
  folder: 'images',
  limit: 50,
  offset: 0,
});
```

##### `get(fileId: string): Promise<StorageFile | null>`
Get file metadata.

##### `delete(fileId: string): Promise<boolean>`
Delete a file.

##### `deleteMany(fileIds: string[]): Promise<{ deleted: string[]; failed: string[] }>`
Delete multiple files.

##### `getUsage(): Promise<StorageStats>`
Get storage usage statistics.

##### `canUpload(size: number): Promise<CanUploadResult>`
Check if a file of given size can be uploaded.

### React Hooks

#### `useStorage(client, options?)`

```typescript
const {
  files,           // StorageFile[]
  total,           // number
  loading,         // boolean
  error,           // string | null
  upload,          // (file: File, options?) => Promise<UploadResult>
  uploadWithProgress, // (file: File, options?) => Promise<UploadResult>
  uploadProgress,  // number (0-100)
  uploading,       // boolean
  remove,          // (fileId: string) => Promise<boolean>
  refresh,         // () => Promise<void>
  loadMore,        // () => Promise<void>
  hasMore,         // boolean
} = useStorage(client, {
  folder: 'images',  // optional
  autoFetch: true,   // optional, default true
  limit: 50,         // optional
});
```

#### `useStorageUsage(client, options?)`

```typescript
const {
  usage,           // StorageStats | null
  loading,         // boolean
  error,           // string | null
  canUpload,       // (size: number) => boolean
  refresh,         // () => Promise<void>
  usagePercent,    // number
  usageFormatted,  // string (e.g., "1.5 GB of 5 GB")
  isLimitReached,  // boolean
  isNearLimit,     // boolean (> 80%)
} = useStorageUsage(client, {
  autoFetch: true,     // optional
  refreshInterval: 0,  // optional, ms
});
```

## Types

```typescript
interface UploadOptions {
  folder?: string;
  filename?: string;
  isPublic?: boolean;
  onProgress?: (progress: number) => void;
}

interface UploadResult {
  id: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  isPublic: boolean;
}

interface StorageFile {
  id: string;
  key: string;
  filename: string;
  size: number;
  mimeType: string;
  isPublic: boolean;
  folder: string | null;
  createdAt: string;
}

interface StorageStats {
  bytesUsed: number;
  bytesUsedFormatted: string;
  fileCount: number;
  storageLimit: number;
  storageLimitFormatted: string;
  usagePercent: number;
}
```

## License

MIT
