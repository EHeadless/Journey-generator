/**
 * Storage entrypoint. The rest of the app should `import { storage }
 * from '@/lib/storage'` and nothing else. When we swap IndexedDB for
 * Supabase later, only this file and the new adapter change.
 */

import indexedDbAdapter from './indexedDb';
import type { StorageAdapter } from './adapter';

export const storage: StorageAdapter = indexedDbAdapter;
export type { StorageAdapter, ExportBundle } from './adapter';
