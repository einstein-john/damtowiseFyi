import { SRCSET_WIDTHS, type MediaRef, type SrcsetWidth } from "./domain.js";

const DELIVERY_ORIGIN = "https://res.cloudinary.com";

/** The subset of a media record needed to build a delivery URL. */
export type CloudinaryAsset = Pick<MediaRef, "cloudinaryPublicId" | "version" | "format">;

export interface CloudinaryImageParams extends CloudinaryAsset {
  cloudName: string;
  width?: number;
  height?: number;
  crop?: "fill" | "limit";
}

export function cloudinaryDeliveryOrigin(cloudName: string): string {
  return `${DELIVERY_ORIGIN}/${cloudName}`;
}

/**
 * Builds a delivery URL. Transformation components must precede the `/v<version>/`
 * segment; anything after it is treated as part of the public id.
 */
export function cloudinaryImageUrl(params: CloudinaryImageParams): string {
  const transformations = ["f_auto", "q_auto"];
  if (params.width !== undefined) transformations.push(`w_${params.width}`);
  if (params.height !== undefined) transformations.push(`h_${params.height}`);
  if (params.crop !== undefined) transformations.push(`c_${params.crop}`);
  transformations.push("dpr_auto");

  return [
    cloudinaryDeliveryOrigin(params.cloudName),
    "image/upload",
    transformations.join(","),
    `v${params.version}`,
    `${params.cloudinaryPublicId}.${params.format}`,
  ].join("/");
}

export function cloudinaryImageSrcset(
  cloudName: string,
  asset: CloudinaryAsset,
  widths: readonly SrcsetWidth[] = SRCSET_WIDTHS,
): string {
  return widths
    .map((width) => `${cloudinaryImageUrl({ cloudName, ...asset, width })} ${width}w`)
    .join(", ");
}

/** Same asset, capped at its natural width so a small upload is never upscaled. */
export function cloudinaryImagePreviewUrl(cloudName: string, media: MediaRef): string {
  return cloudinaryImageUrl({
    cloudName,
    cloudinaryPublicId: media.cloudinaryPublicId,
    version: media.version,
    format: media.format,
    width: media.width,
    crop: "limit",
  });
}