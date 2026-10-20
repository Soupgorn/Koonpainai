/** Fictional fixture presentation only. Imported records always retain their source labels. */
export function fixtureLabel(value: string) {
  return value.replace(/\bLaboratory\b/gi, "Practical").replace(/\bLab\b/gi, "Room");
}
