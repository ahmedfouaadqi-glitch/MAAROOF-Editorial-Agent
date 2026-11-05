const MIN_EDITORIAL_IMAGE_EDGE = 1200;

function pngDimensions(bytes) {
  if (bytes.length < 24 || bytes.toString("ascii", 12, 16) !== "IHDR") return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++];
    if (marker === 0xd9 || marker === 0xda) break;
    if ([0xd8, 0x01, 0xd0, 0xd1, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7].includes(marker)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (segmentLength < 7) return null;
      return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return null;
}

function webpDimensions(bytes) {
  if (bytes.length < 30 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = bytes.toString("ascii", 12, 16);
  if (chunk === "VP8X") return {
    width: 1 + bytes.readUIntLE(24, 3),
    height: 1 + bytes.readUIntLE(27, 3)
  };
  if (chunk === "VP8 ") {
    for (let i = 20; i + 10 < bytes.length; i += 1) {
      if (bytes[i] === 0x9d && bytes[i + 1] === 0x01 && bytes[i + 2] === 0x2a) {
        return { width: bytes.readUInt16LE(i + 3) & 0x3fff, height: bytes.readUInt16LE(i + 5) & 0x3fff };
      }
    }
  }
  if (chunk === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) {
    const b1=bytes[21],b2=bytes[22],b3=bytes[23],b4=bytes[24];
    return { width: 1 + (((b2 & 0x3f) << 8) | b1), height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)) };
  }
  return null;
}

function imageDimensions(bytes, mimeType) {
  if (mimeType === "image/png") return pngDimensions(bytes);
  if (mimeType === "image/jpeg") return jpegDimensions(bytes);
  if (mimeType === "image/webp") return webpDimensions(bytes);
  return null;
}

export function analyzeMediaAsset({ bytes, mimeType, kind, description = "" }) {
  const warnings = [];
  const recommendations = [];
  if (kind === "video") {
    warnings.push("Video stream metadata (duration, frame size, codec, and audio) has not been inspected.");
    if (!description.trim()) warnings.push("A human-authored video caption/context is required.");
    return {
      analysisVersion: 1,
      analysisMode: "metadata-only",
      kind,
      dimensions: null,
      aspectRatio: null,
      orientation: "unknown",
      recommendedUses: [],
      warnings,
      altTextStatus: "not-applicable-video"
    };
  }

  const dimensions = imageDimensions(bytes, mimeType);
  if (!dimensions || !dimensions.width || !dimensions.height) {
    warnings.push("Image dimensions could not be read from the supported header; inspect the file manually.");
  } else {
    const { width, height } = dimensions;
    const ratio = Number((width / height).toFixed(4));
    const orientation = ratio > 1.1 ? "landscape" : ratio < 0.9 ? "portrait" : "square";
    if (Math.min(width, height) < MIN_EDITORIAL_IMAGE_EDGE) {
      warnings.push("The shortest image edge is below 1200 px; suitability for large hero placements is not established.");
    }
    if (orientation === "landscape") recommendations.push("article-hero", "website-feature");
    else if (orientation === "portrait") recommendations.push("social-portrait", "story-cover");
    else recommendations.push("square-social", "thumbnail");
    return {
      analysisVersion: 1,
      analysisMode: "metadata-only",
      kind,
      dimensions,
      aspectRatio: ratio,
      orientation,
      recommendedUses: recommendations,
      warnings,
      altTextStatus: description.trim().length >= 20 ? "human-description-present" : "human-description-needs-review"
    };
  }
  return {
    analysisVersion: 1,
    analysisMode: "metadata-only",
    kind,
    dimensions: null,
    aspectRatio: null,
    orientation: "unknown",
    recommendedUses: [],
    warnings,
    altTextStatus: description.trim().length >= 20 ? "human-description-present" : "human-description-needs-review"
  };
}
