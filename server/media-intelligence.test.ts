import { describe, expect, it } from "vitest";
import { analyzeMediaAsset } from "./media-intelligence.mjs";

function png(width, height) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).copy(bytes,0);
  bytes.write("IHDR",12,"ascii");
  bytes.writeUInt32BE(width,16);
  bytes.writeUInt32BE(height,20);
  return bytes;
}

describe("media intelligence", () => {
  it("extracts image dimensions and proposes placements from aspect ratio", () => {
    const result = analyzeMediaAsset({ bytes: png(2400, 1200), mimeType: "image/png", kind: "image", description: "A city skyline at sunrise" });
    expect(result).toMatchObject({
      analysisMode: "metadata-only",
      dimensions: { width: 2400, height: 1200 },
      aspectRatio: 2,
      orientation: "landscape",
      recommendedUses: ["article-hero", "website-feature"],
      altTextStatus: "human-description-present"
    });
  });

  it("flags low-resolution images without claiming they are unusable", () => {
    const result = analyzeMediaAsset({ bytes: png(800, 600), mimeType: "image/png", kind: "image", description: "A building" });
    expect(result.warnings[0]).toContain("below 1200 px");
    expect(result.altTextStatus).toBe("human-description-needs-review");
  });

  it("does not pretend video metadata or semantic content was inspected", () => {
    const result = analyzeMediaAsset({ bytes: Buffer.from("video"), mimeType: "video/mp4", kind: "video", description: "A product demonstration" });
    expect(result).toMatchObject({
      analysisMode: "metadata-only",
      dimensions: null,
      orientation: "unknown",
      altTextStatus: "not-applicable-video"
    });
    expect(result.warnings.join(" ")).toContain("Video stream metadata");
  });

  it("returns a manual-review warning for unrecognized image headers", () => {
    const result = analyzeMediaAsset({ bytes: Buffer.from("not-an-image"), mimeType: "image/png", kind: "image", description: "An image description" });
    expect(result.dimensions).toBeNull();
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
