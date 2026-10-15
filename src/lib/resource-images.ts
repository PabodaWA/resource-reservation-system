export const MAX_RESOURCE_IMAGES = 4;
const MAX_IMAGE_LENGTH = 700_000;
const IMAGE_DATA_URL =
  /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

export function parseResourceImages(
  value: unknown
): { ok: true; images: string[] } | { ok: false; message: string } {
  if (!Array.isArray(value)) {
    return { ok: false, message: "Photos must be a list of images." };
  }

  if (value.length > MAX_RESOURCE_IMAGES) {
    return {
      ok: false,
      message: `Add up to ${MAX_RESOURCE_IMAGES} photos.`,
    };
  }

  const images: string[] = [];

  for (const item of value) {
    if (
      typeof item !== "string" ||
      item.length > MAX_IMAGE_LENGTH ||
      !IMAGE_DATA_URL.test(item)
    ) {
      return {
        ok: false,
        message: "Each photo must be a JPEG, PNG, or WebP image.",
      };
    }

    images.push(item);
  }

  return { ok: true, images };
}
