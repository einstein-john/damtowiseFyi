import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH, cloudinaryImageUrl } from "../../contracts/index.js";

export const OG_FOLDER = "og/fyi";

export function ogPublicId(slug: string): string {
  return `${OG_FOLDER}/${slug}`;
}

/**
 * Versioned so the stored URL changes whenever the asset is regenerated; the
 * upload also invalidates the CDN copy.
 */
export function ogImageUrl(asset: {
  cloudName: string;
  cloudinaryPublicId: string;
  version: number;
  format: string;
}): string {
  return cloudinaryImageUrl({
    ...asset,
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    crop: "fill",
  });
}