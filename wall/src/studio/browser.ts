/* Entry for the bundled browser build used by the room prototypes (design/shared/studio.js). */
import { studioSchema, toFolioContent, fromFolioContent, toIndexContent, fromIndexContent, toSalonContent, fromSalonContent, toReelContent, fromReelContent, toAtelierContent, fromAtelierContent, ratioNumber, migrateFromV13 } from "./document";
import { createStudioStore, StaleRevisionError, isStoredAsset } from "./store";

(window as unknown as { LatentStudio: unknown }).LatentStudio = {
  studioSchema, toFolioContent, fromFolioContent, toIndexContent, fromIndexContent, toSalonContent, fromSalonContent, toReelContent, fromReelContent, toAtelierContent, fromAtelierContent, ratioNumber, migrateFromV13,
  store: createStudioStore(), StaleRevisionError, isStoredAsset,
};
