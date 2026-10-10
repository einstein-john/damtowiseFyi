import { describe, expect, it } from "vitest";
import { cloudinaryImagePreviewUrl, cloudinaryImageSrcset, cloudinaryImageUrl } from "./media-url.js";

const cloudName = "demo";
const version = 1712345678;
const asset = { cloudinaryPublicId: "fyi/cover", version, format: "jpg" };

describe("cloudinaryImageUrl", () => {
  it("places transformations before the version segment", () => {
    const url = cloudinaryImageUrl({ cloudName, ...asset, width: 800 });

    expect(url).toBe(
      `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800,dpr_auto/v${version}/fyi/cover.jpg`,
    );
  });

  it("adds height and crop only when requested", () => {
    const url = cloudinaryImageUrl({ cloudName, ...asset, width: 1200, height: 630, crop: "fill" });

    expect(url).toContain("w_1200");
    expect(url).toContain("h_630");
    expect(url).toContain("c_fill");
  });

  it("always negotiates format and quality automatically", () => {
    expect(cloudinaryImageUrl({ cloudName, ...asset })).toContain("f_auto,q_auto");
  });
});

describe("cloudinaryImageSrcset", () => {
  it("emits one candidate per configured width", () => {
    const srcset = cloudinaryImageSrcset(cloudName, asset);

    expect(srcset.split(", ")).toHaveLength(3);
    expect(srcset.split(", ").at(-1)).toBe(
      `https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_1200,dpr_auto/v${version}/fyi/cover.jpg 1200w`,
    );
  });

  it("honours a custom width list", () => {
    expect(cloudinaryImageSrcset(cloudName, asset, [480])).not.toContain("1200w");
  });
});

describe("cloudinaryImagePreviewUrl", () => {
  it("caps at the natural width so a small upload is never upscaled", () => {
    const url = cloudinaryImagePreviewUrl(cloudName, {
      ...asset,
      id: "m1",
      alt: null,
      decorative: false,
      caption: null,
      width: 2400,
      height: 1600,
    });

    expect(url).toContain("w_2400");
    expect(url).toContain("c_limit");
  });
});