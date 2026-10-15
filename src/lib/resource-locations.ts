export const RESOURCE_LOCATIONS = [
  "Garage A",
  "Garage B",
  "1st Floor",
  "2nd Floor",
  "3rd Floor",
  "4th Floor",
] as const;

export type ResourceLocation = (typeof RESOURCE_LOCATIONS)[number];

export function isResourceLocation(value: string): value is ResourceLocation {
  return (RESOURCE_LOCATIONS as readonly string[]).includes(value);
}
