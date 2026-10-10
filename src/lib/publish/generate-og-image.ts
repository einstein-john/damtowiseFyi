import type { Env } from "../../config/env.js";
import type { TagRow } from "../../db/schema.js";
import { uploadGeneratedImage, type CloudinaryClientConfig } from "../media/cloudinary.js";
import { ogImageUrl, ogPublicId } from "../og/asset.js";
import { renderOgImage } from "../og/render-og-image.js";

export interface OgImageSource {
  slug: string;
  title: string;
  excerpt: string | null;
  tags: TagRow[];
}

export interface GeneratedOgImage {
  publicId: string;
  url: string;
}

export interface GenerateOgImageParams {
  env: Env;
  cloudinary: CloudinaryClientConfig;
  source: OgImageSource;
  siteName: string;
}

/**
 * Renders and uploads the social card at a stable public id, so regenerating it
 * overwrites in place instead of accumulating orphaned assets.
 */
export async function generateOgImage(params: GenerateOgImageParams): Promise<GeneratedOgImage> {
  const png = await renderOgImage({
    fontsDir: params.env.OG_FONTS_DIR,
    content: {
      title: params.source.title,
      description: params.source.excerpt,
      tags: params.source.tags.map((tag) => tag.slug),
      siteName: params.siteName,
    },
  });

  const publicId = ogPublicId(params.source.slug);
  const uploaded = await uploadGeneratedImage(params.cloudinary, png, {
    publicId,
    format: "png",
  });

  return {
    publicId,
    url: ogImageUrl({
      cloudName: params.env.CLOUDINARY_CLOUD_NAME,
      cloudinaryPublicId: uploaded.publicId,
      version: uploaded.version,
      format: uploaded.format,
    }),
  };
}