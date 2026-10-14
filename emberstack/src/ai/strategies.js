// Strategy profiles: the same planner with different temperaments.

export const STRATEGIES = {
  balanced: {
    id: 'balanced', name: '均衡', desc: '因势而变：先保生存，再推进目标，有余力就探索和研究。',
    objective: 1.0, foodDays: 1.6, fuelDays: 2, army: 1.2, explore: 0.5, curiosity: 0.25, growth: 1.0, research: 1.0,
    economy: 0.6, caution: 0.6, popTarget: 7, stock: 1.0, adaptive: true,
  },
  rush: {
    id: 'rush', name: '速通', desc: '直奔目标，只保留最低限度的储备，能省则省。',
    objective: 1.7, foodDays: 1.0, fuelDays: 1.4, army: 1.0, explore: 0.2, curiosity: 0.05, growth: 0.7, research: 0.8,
    economy: 0.4, caution: 0.35, popTarget: 5, stock: 0.6,
  },
  steady: {
    id: 'steady', name: '稳健', desc: '粮草充足、火光不灭、兵强马壮之后才推进目标。',
    objective: 0.85, foodDays: 2.6, fuelDays: 3, army: 1.6, explore: 0.35, curiosity: 0.1, growth: 1.3, research: 1.1,
    economy: 0.6, caution: 0.9, popTarget: 9, stock: 1.4,
  },
  explorer: {
    id: 'explorer', name: '探索', desc: '好奇心驱动：优先探索未知之地、尝试新的组合、发掘隐藏配方。',
    objective: 0.9, foodDays: 1.6, fuelDays: 2, army: 1.1, explore: 1.6, curiosity: 1.2, growth: 0.9, research: 1.3,
    economy: 0.5, caution: 0.6, popTarget: 7, stock: 1.0,
  },
  warlord: {
    id: 'warlord', name: '征伐', desc: '以战养战：组建强军、主动猎杀巢穴与首领。',
    objective: 1.1, foodDays: 1.5, fuelDays: 2, army: 2.2, explore: 0.5, curiosity: 0.05, growth: 1.1, research: 0.9,
    economy: 0.5, caution: 0.45, popTarget: 8, stock: 1.0, aggressive: true,
  },
};

export const STRATEGY_IDS = Object.keys(STRATEGIES);
