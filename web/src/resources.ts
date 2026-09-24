// De fyra rummen får varsin Catan-resursidentitet (färg + namn).
// Namnen är de officiella engelska resurskorten i reglerna.
export const RESOURCES = [
  { name: 'Lumber', cls: 'res-forest' },
  { name: 'Brick', cls: 'res-brick' },
  { name: 'Wool', cls: 'res-sheep' },
  { name: 'Ore', cls: 'res-ore' },
] as const;

export function resourceFor(index: number): (typeof RESOURCES)[number] {
  return RESOURCES[((index % RESOURCES.length) + RESOURCES.length) % RESOURCES.length];
}
