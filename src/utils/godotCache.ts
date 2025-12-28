/**
 * IndexedDB caching utility for Godot .pck files
 * Provides caching with versioning to avoid re-downloading large files
 */

const DB_NAME = 'tesla-wrap-godot-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pck-files';

interface CachedPack {
  url: string;
  version: string;
  data: Blob;
  cachedAt: number;
  size: number;
}

/**
 * Open the IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'url' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
        store.createIndex('version', 'version', { unique: false });
      }
    };
  });
}

/**
 * Get cached pack file from IndexedDB
 */
export async function getCachedPack(url: string, version: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(url);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const cached: CachedPack | undefined = request.result;
        if (cached && cached.version === version) {
          console.log(`[GodotCache] Cache hit for ${url} (version ${version})`);
          resolve(cached.data);
        } else {
          if (cached && cached.version !== version) {
            console.log(`[GodotCache] Cache miss - version mismatch (cached: ${cached.version}, required: ${version})`);
          } else {
            console.log(`[GodotCache] Cache miss for ${url}`);
          }
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[GodotCache] Failed to read from cache:', error);
    return null;
  }
}

/**
 * Cache a pack file in IndexedDB
 */
export async function cachePack(url: string, version: string, data: Blob): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const cached: CachedPack = {
      url,
      version,
      data,
      cachedAt: Date.now(),
      size: data.size,
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(cached);
      request.onsuccess = () => {
        console.log(`[GodotCache] Cached ${url} (version ${version}, ${(data.size / 1024 / 1024).toFixed(2)}MB)`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[GodotCache] Failed to cache pack:', error);
    // Don't throw - caching is optional
  }
}

/**
 * Download a pack file, using cache if available
 */
export async function downloadPack(url: string, version: string): Promise<Blob> {
  // Try cache first
  const cached = await getCachedPack(url, version);
  if (cached) {
    return cached;
  }

  // Download if not cached
  console.log(`[GodotCache] Downloading ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download pack: ${response.statusText}`);
  }

  const blob = await response.blob();
  
  // Cache for future use (don't await - cache in background)
  cachePack(url, version, blob).catch(err => {
    console.warn('[GodotCache] Background caching failed:', err);
  });

  return blob;
}
