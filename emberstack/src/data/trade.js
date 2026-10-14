// What markets sell and what passing caravans offer. Every trade takes real cards from the board.

/** fixed offers of a 集市 (market); `tech` gates later wares */
export const MARKET_OFFERS = [
  { id: 'm_supply', give: [['coin', 3]], get: [['supply_basic', 1]] },
  { id: 'm_seed', give: [['coin', 3]], get: [['seed_pouch', 1]] },
  { id: 'm_food', give: [['coin', 6]], get: [['food_crate', 1]] },
  { id: 'm_crafter', give: [['coin', 7]], get: [['crafter_bundle', 1]] },
  { id: 'm_explorer', give: [['coin', 6]], get: [['explorer_bundle', 1]] },
  { id: 'm_military', give: [['coin', 10]], get: [['military_crate', 1]] },
  { id: 'm_recruit', give: [['coin', 12]], get: [['survivor', 1]] },
  { id: 'm_scroll', give: [['coin', 5]], get: [['scroll', 1]] },
  { id: 'm_coal', give: [['coin', 4]], get: [['coal', 2]], tech: 'smelting' },
  { id: 'm_iron', give: [['coin', 8]], get: [['iron', 1]], tech: 'iron' },
  { id: 'm_oil', give: [['coin', 4]], get: [['oil', 2]], tech: 'lamplight' },
  { id: 'm_glass', give: [['coin', 7]], get: [['glass', 1]], tech: 'glassmaking' },
];

/** caravan offer pools; `bio` limits an offer to some biomes (empty = everywhere) */
export const CARAVAN_POOL = [
  { give: [['coin', 4]], get: [['food_crate', 1]], w: 3 },
  { give: [['coin', 2]], get: [['supply_basic', 1]], w: 3 },
  { give: [['coin', 8]], get: [['survivor', 1]], w: 2 },
  { give: [['coin', 5]], get: [['scroll', 2]], w: 1.5 },
  { give: [['coin', 6]], get: [['tome', 1]], w: 1 },
  { give: [['coin', 5]], get: [['explorer_bundle', 1]], w: 1.5 },
  { give: [['coin', 9]], get: [['military_crate', 1]], w: 1.2 },
  { give: [['coin', 6]], get: [['crafter_bundle', 1]], w: 1.5 },
  { give: [['coin', 3]], get: [['potion', 1]], w: 1.2 },
  { give: [['coin', 10]], get: [['treasure_chest', 1]], w: 0.5 },
  { give: [['coin', 4]], get: [['copper', 2]], w: 1, bio: ['mountain', 'marsh', 'isles'] },
  { give: [['coin', 6]], get: [['iron', 1]], w: 1, bio: ['mountain', 'tundra', 'isles', 'ash'] },
  { give: [['coin', 4]], get: [['oil', 2]], w: 1, bio: ['isles', 'tundra', 'ash'] },
  { give: [['coin', 3]], get: [['salt', 2]], w: 1, bio: ['valley', 'forest', 'mountain', 'tundra'] },
  { give: [['coin', 6]], get: [['ember_shard', 1]], w: 0.5, bio: ['ash', 'isles'] },
  { give: [['coin', 8]], get: [['glass', 2]], w: 0.6, bio: ['isles', 'ash'] },
  { give: [['coin', 5]], get: [['saddle_horse', 1]], w: 0.5, bio: ['mountain', 'valley'] },
  // the caravan buys, too
  { give: [['hide', 2]], get: [['coin', 4]], w: 1.5 },
  { give: [['relic', 1]], get: [['coin', 8]], w: 1.2 },
  { give: [['salt', 2]], get: [['coin', 5]], w: 1.2 },
  { give: [['cloth', 2]], get: [['coin', 7]], w: 1 },
  { give: [['brick', 3]], get: [['coin', 6]], w: 0.8 },
  { give: [['pearl', 1]], get: [['coin', 11]], w: 0.8 },
  { give: [['jerky', 3]], get: [['coin', 5]], w: 1 },
  { give: [['honey', 2]], get: [['coin', 6]], w: 0.8 },
  { give: [['fur', 2]], get: [['coin', 7]], w: 0.8 },
  { give: [['bronze', 2]], get: [['coin', 10]], w: 0.6 },
  { give: [['wood', 5]], get: [['coin', 3]], w: 1.2 },
  { give: [['stone', 5]], get: [['coin', 3]], w: 1 },
];
