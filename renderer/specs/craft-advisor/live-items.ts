// Фикстуры предметов для live-харнесса (текст из игры, Ctrl+C).
// Добавляй сюда любой предмет — харнесс прогонит по нему весь конвейер.

export const LIVE_ITEMS: Record<string, string> = {
  prismaticRing: `Item Class: Rings
Rarity: Rare
Dire Twirl
Prismatic Ring
--------
Requires: Level 54
--------
Item Level: 80
--------
{ Implicit Modifier — Elemental, Fire, Cold, Lightning, Resistance }
+8(7-10)% to all Elemental Resistances
--------
{ Prefix Modifier "Hailing" (Tier: 2) — Damage, Elemental, Cold }
26(23-26)% increased Cold Damage
{ Suffix Modifier "of Exile" (Tier: 2) — Chaos, Resistance }
+23(20-23)% to Chaos Resistance
{ Suffix Modifier "of Consumption" (Tier: 2) — Mana }
Gain 15(15-20) Mana per enemy killed
{ Suffix Modifier "of Archaeology" (Tier: 1) }
15(15-18)% increased Rarity of Items found
`,
};
