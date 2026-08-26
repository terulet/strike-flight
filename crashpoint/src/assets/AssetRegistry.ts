import { ASSET_MANIFEST } from './AssetManifest';

/**
 * Central lookup for resolved asset images. Right now nothing is loaded (no final art yet),
 * so every id falls back to the procedural placeholder renderer. When the MEGA ZIP arrives,
 * call `registerImage(id, url)` for the ids it covers — everything else keeps its placeholder
 * automatically, so a partial asset drop never breaks rendering.
 */
export class AssetRegistry {
  private images = new Map<string, HTMLImageElement>();
  private loading = new Map<string, Promise<void>>();

  /** Registers a real image for an assetId. Unknown ids are logged, not thrown, to stay resilient. */
  registerImage(assetId: string, url: string): Promise<void> {
    if (!ASSET_MANIFEST.some((a) => a.id === assetId)) {
      console.warn(`[AssetRegistry] Unknown assetId "${assetId}" — not in AssetManifest.`);
    }
    const existing = this.loading.get(assetId);
    if (existing) return existing;

    const promise = new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(assetId, img);
        resolve();
      };
      img.onerror = () => {
        console.warn(`[AssetRegistry] Failed to load "${assetId}" from ${url}; keeping placeholder.`);
        resolve();
      };
      img.src = url;
    });
    this.loading.set(assetId, promise);
    return promise;
  }

  get(assetId: string): HTMLImageElement | undefined {
    return this.images.get(assetId);
  }

  has(assetId: string): boolean {
    return this.images.has(assetId);
  }
}

export const assetRegistry = new AssetRegistry();
