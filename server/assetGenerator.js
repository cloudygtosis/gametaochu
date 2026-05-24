export const TRANSPARENT_PROMPT_SUFFIX =
  "transparent background, PNG with alpha channel, no background, isolated subject, clean edges, no watermark, no text overlay";

export const PIXEL_PROMPT_SUFFIX =
  "16-bit pixel art style, retro JRPG aesthetic, clean pixel edges, no anti-aliasing, sharp pixels, top-down perspective";

export const PORTRAIT_PROMPT_SUFFIX =
  "photorealistic CG portrait, cinematic lighting, detailed skin texture, half-body composition from chest up, vertical composition, sharp focus";

export const characterConsistency = {
  xiaoyue: {
    age: "22",
    body: "slim, about 162cm",
    face:
      "strictly based on the user-provided reference photo: soft oval face, fair translucent skin, large clear dark eyes, delicate straight nose, gentle natural lips",
    modern:
      "single high ponytail with dark brown-black hair and airy bangs, white or light cream knit sweater, light blue denim shorts, white sneakers, small canvas crossbody bag",
    guifei:
      "ancient hair bun, cinnabar phoenix hairpin, delicate earrings, crimson red consort robe with gold phoenix embroidery",
    temperament: "clean, pure, gentle college student aesthetic"
  },
  linya: {
    age: "22",
    hair: "shoulder-length inward-curled bob haircut, chestnut brown dyed hair",
    skin: "natural wheat-toned skin",
    outfit: "beige hoodie, black skinny jeans, canvas shoes, small metal earrings",
    temperament: "lively, bright, fashionable"
  },
  laobanniang: {
    age: "ambiguous between 30 and 50",
    hair: "perfectly neat traditional hair bun, one silver hairpin",
    makeup: "thick white powder face, blood-red lips",
    outfit: "dark red late-Qing-style qipao with frog buttons",
    temperament: "surface kindness with strange, still eyes"
  }
};

export function buildPrompt(assetKey, description, options = {}) {
  const transparency =
    options.opaque === true
      ? "Scene background is fully opaque. No watermark, no text overlay."
      : `${TRANSPARENT_PROMPT_SUFFIX}. Create the source on a flat #00ff00 chroma-key background for local alpha extraction.`;

  return [
    `Asset key: ${assetKey}`,
    `Primary request: ${description}`,
    options.style ?? "",
    options.consistency ?? "",
    transparency
  ]
    .filter(Boolean)
    .join("\n");
}

export function describeGenerationMode() {
  return {
    mode: "codex-imagegen-skill",
    modelPolicy: "All shipped raster assets are generated through the Codex image generation skill using gpt-image-2 prompts.",
    transparencyPolicy:
      "Portraits, objects, sprites, and UI elements require transparent PNG output. The current skill path generates flat chroma-key sources and removes the key locally to create PNG alpha."
  };
}
