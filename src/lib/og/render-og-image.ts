import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { loadOgFonts } from "./fonts.js";
import { OG_SIZE, buildOgImage, type OgImageContent } from "./template.js";

export interface RenderOgImageOptions {
  content: OgImageContent;
  fontsDir: string;
}

/** Satori -> SVG -> PNG, entirely in-process; no headless browser on the host. */
export async function renderOgImage(options: RenderOgImageOptions): Promise<Buffer> {
  const fonts = await loadOgFonts(options.fontsDir);

  const svg = await satori(buildOgImage(options.content), {
    width: OG_SIZE.width,
    height: OG_SIZE.height,
    fonts,
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: OG_SIZE.width },
    background: "#0b0b0f",
  });

  return Buffer.from(resvg.render().asPng());
}