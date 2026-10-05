import { openDB, type DBSchema } from "idb";
import { activeWorkspaceId, databaseName } from "./workspace";
export interface StoredDocument {
  value: unknown;
  revision: number;
}
export interface StudioDB extends DBSchema {
  documents: { key: string; value: StoredDocument };
  assets: { key: string; value: Blob };
}
export const database = () =>
  openDB<StudioDB>(databaseName(activeWorkspaceId), 1, {
    upgrade(db) {
      db.createObjectStore("documents");
      db.createObjectStore("assets");
    },
  });
