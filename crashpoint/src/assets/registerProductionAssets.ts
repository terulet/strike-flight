import { ASSET_MANIFEST } from './AssetManifest';
import { assetRegistry } from './AssetRegistry';

/**
 * Loads every 'production' asset (MEGA_ASSET_PACK_v1) into AssetRegistry. Called once at startup
 * before the game boots so the first frame already shows real art instead of a placeholder flash.
 * Missing/failed files fall back to the placeholder automatically (see AssetRegistry.registerImage).
 */
export function registerProductionAssets(): Promise<void[]> {
  const jobs = ASSET_MANIFEST.filter((a) => a.status === 'production' && a.productionFile).map((a) =>
    assetRegistry.registerImage(a.id, a.productionFile!)
  );
  return Promise.all(jobs);
}
