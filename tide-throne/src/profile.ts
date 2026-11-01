import { Card, CARDS, ReplayAction } from './simulation'

const STORAGE_KEY = 'tidal-throne-profile-v1'
const BASE_CARD_LEVEL = 5
const MAX_CARD_LEVEL = 10

export interface CardProgress {
  level: number
  copies: number
}

export interface BattleRecord {
  id: number
  mode: MatchCategory
  result: 'win' | 'lose' | 'draw'
  crownsFor: number
  crownsAgainst: number
  trophyDelta: number
  playedAt: number
  report?: BattleReport
}

export interface BattleReport {
  opponent: string
  deck: string[]
  playerDeployments: number
  enemyDeployments: number
  playerSpellcasts: number
  enemySpellcasts: number
  events: string[]
  actions: ReplayAction[]
}

export type MatchCategory = 'ranked' | 'event' | 'friendly' | 'practice'

export interface PlayerProfile {
  version: 1
  level: number
  xp: number
  trophies: number
  coins: number
  wins: number
  losses: number
  streak: number
  chestWins: number
  chestQueue: ChestSlot[]
  activeDeck: number
  decks: string[][]
  deck: string[]
  claimedTrophyRewards: number[]
  cards: Record<string, CardProgress>
  history: BattleRecord[]
  shopDate: string
  shopOffers: ShopOffer[]
  claimedQuests: string[]
  fleet: FleetState | null
  seasonPoints: number
  claimedSeasonRewards: number[]
}

const DEFAULT_DECK_SIZE = 8
const DEFAULT_DECK_IDS = ['iron-scout', 'signal-archer', 'breakwater', 'flare-burst', 'reef-runners', 'tide-emplacement', 'cloud-sailor', 'static-field']
const DEFAULT_DECK_PRESETS = [
  DEFAULT_DECK_IDS,
  ['reef-runners', 'ember-charger', 'lantern-school', 'mist-pike', 'signal-archer', 'undertow', 'gale-pulse', 'mending-current'],
  ['brine-guards', 'breakwater', 'anchor-golem', 'tide-emplacement', 'harbor-mortar', 'reef-bomber', 'static-field', 'mending-current'],
]

export interface TrophyMilestone {
  trophies: number
  label: string
  coins: number
  cardId?: string
  copies?: number
}

export const TROPHY_MILESTONES: TrophyMilestone[] = [
  { trophies: 300, label: '潮线新兵', coins: 100 },
  { trophies: 600, label: '礁岸守望', coins: 140 },
  { trophies: 900, label: '风暴领航', coins: 180, cardId: 'mist-pike', copies: 8 },
  { trophies: 1200, label: '沉潮港主', coins: 220 },
  { trophies: 1500, label: '星图先锋', coins: 260, cardId: 'harbor-mortar', copies: 10 },
  { trophies: 1800, label: '远洋王座', coins: 320, cardId: 'brine-guards', copies: 12 },
]

export interface BattleReward {
  trophies: number
  coins: number
  xp: number
  chestQueued?: boolean
  chestWins?: number
}

export interface UpgradeQuote {
  maxed: boolean
  copiesNeeded: number
  coinCost: number
  canUpgrade: boolean
}

export interface ChestReward {
  cardId: string
  copies: number
  coins: number
}

export type ChestKind = 'tide' | 'reef' | 'storm'

export interface ChestSlot {
  id: number
  kind: ChestKind
  label: string
  cardId: string
  copies: number
  coins: number
  unlockAt: number
}

export interface ShopOffer {
  id: string
  cardId: string
  copies: number
  price: number
  purchased: boolean
}

export interface QuestDefinition {
  id: string
  label: string
  description: string
  target: number
  reward: number
}

export interface FleetMember {
  id: string
  name: string
  level: number
  role: '舰长' | '成员'
  donations: number
}

export interface FleetMessage {
  id: string
  author: string
  text: string
  sentAt: number
  player: boolean
}

export interface FleetState {
  id: string
  name: string
  tag: string
  role: '舰长' | '成员'
  requestCardId: string
  donatedCopies: number
  members: FleetMember[]
  messages: FleetMessage[]
}

export interface FleetDefinition {
  id: string
  name: string
  tag: string
  motto: string
}

export interface SeasonReward {
  points: number
  label: string
  coins: number
  cardId?: string
  copies?: number
}

export interface LeaderboardEntry {
  id: string
  name: string
  trophies: number
  fleet: string
  player: boolean
}

export const FLEET_CATALOG: FleetDefinition[] = [
  { id: 'tidal-watch', name: '潮汐守望', tag: 'TIDE', motto: '先守桥，再夺冠。' },
  { id: 'reef-cartographers', name: '礁岸绘图局', tag: 'REEF', motto: '每一次推进都留下航线。' },
  { id: 'storm-signal', name: '风暴信标', tag: 'STMR', motto: '快速集结，精准反击。' },
]

export const SEASON_REWARDS: SeasonReward[] = [
  { points: 3, label: '启航补给', coins: 90 },
  { points: 6, label: '桥头军备', coins: 120, cardId: 'signal-archer', copies: 6 },
  { points: 10, label: '风暴储备', coins: 180, cardId: 'breakwater', copies: 8 },
  { points: 15, label: '远洋王冠', coins: 260, cardId: 'static-field', copies: 10 },
]

export const QUESTS: QuestDefinition[] = [
  { id: 'first-voyage', label: '首航记录', description: '完成 3 场对战', target: 3, reward: 80 },
  { id: 'crown-hunter', label: '王冠猎手', description: '在对战中夺取 5 顶王冠', target: 5, reward: 110 },
  { id: 'storm-streak', label: '风暴连胜', description: '达成 5 场连胜', target: 5, reward: 140 },
]

function shopDate(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function shopSeed(date: string): number {
  return [...date].reduce((total, character) => total * 31 + character.charCodeAt(0), 7)
}

function createShopOffers(date: string): ShopOffer[] {
  const seed = Math.abs(shopSeed(date))
  return [0, 1, 2].map(index => {
    const card = CARDS[(seed + index * 5) % CARDS.length]
    const copies = 5 + index * 3
    const price = Math.round((card.cost * 16 + 32 + index * 12) / 5) * 5
    return {
      id: `${date}-${index}-${card.id}`,
      cardId: card.id,
      copies,
      price,
      purchased: false,
    }
  })
}

function validShopOffers(date: string, offers: unknown): offers is ShopOffer[] {
  return Array.isArray(offers)
    && offers.length === 3
    && offers.every((offer): offer is ShopOffer => {
      if (!offer || typeof offer !== 'object') return false
      const item = offer as Partial<ShopOffer>
      return typeof item.id === 'string'
        && item.id.startsWith(`${date}-`)
        && typeof item.cardId === 'string'
        && CARDS.some(card => card.id === item.cardId)
        && typeof item.copies === 'number'
        && typeof item.price === 'number'
        && typeof item.purchased === 'boolean'
    })
}

const CHEST_LIMIT = 4
const CHEST_UNLOCK_MS = 45_000

function createChest(id: number, unlockAt: number, index = 0): ChestSlot {
  const kinds: ChestKind[] = ['tide', 'reef', 'storm']
  const kind = kinds[index % kinds.length]
  const labels = { tide: '潮汐箱', reef: '礁岸箱', storm: '风暴箱' }
  const card = CARDS[(id + index * 3) % CARDS.length]
  return {
    id,
    kind,
    label: labels[kind],
    cardId: card.id,
    copies: kind === 'storm' ? 10 : kind === 'reef' ? 8 : 6,
    coins: kind === 'storm' ? 260 : kind === 'reef' ? 220 : 180,
    unlockAt,
  }
}

function defaultChestQueue(): ChestSlot[] {
  return [createChest(Date.now(), Date.now() - 1)]
}

function validChestQueue(value: unknown): value is ChestSlot[] {
  return Array.isArray(value)
    && value.length <= CHEST_LIMIT
    && value.every(entry => {
      if (!entry || typeof entry !== 'object') return false
      const chest = entry as Partial<ChestSlot>
      return typeof chest.id === 'number'
        && typeof chest.kind === 'string'
        && ['tide', 'reef', 'storm'].includes(chest.kind)
        && typeof chest.label === 'string'
        && typeof chest.cardId === 'string'
        && CARDS.some(card => card.id === chest.cardId)
        && typeof chest.copies === 'number'
        && typeof chest.coins === 'number'
        && typeof chest.unlockAt === 'number'
    })
}

function defaultCards(): Record<string, CardProgress> {
  return Object.fromEntries(
    CARDS.map((card, index) => [
      card.id,
      { level: BASE_CARD_LEVEL, copies: 18 + (index % 4) * 3 },
    ]),
  )
}

function createFleet(definition: FleetDefinition): FleetState {
  const now = Date.now()
  return {
    id: definition.id,
    name: definition.name,
    tag: definition.tag,
    role: '成员',
    requestCardId: 'signal-archer',
    donatedCopies: 1,
    members: [
      { id: 'captain', name: '潮汐领航员', level: 11, role: '舰长', donations: 48 },
      { id: 'member-1', name: '白礁拾荒者', level: 9, role: '成员', donations: 32 },
      { id: 'member-2', name: '雾港测绘师', level: 8, role: '成员', donations: 21 },
      { id: 'member-3', name: '沉锚观察员', level: 7, role: '成员', donations: 16 },
    ],
    messages: [
      { id: 'fleet-briefing', author: '潮汐领航员', text: '右桥防线稳定后再投入巨像，先留能量应对空中单位。', sentAt: now - 12 * 60_000, player: false },
      { id: 'fleet-scout', author: '雾港测绘师', text: '本轮建议把信标射手放在盾卫之后，桥头更容易守住。', sentAt: now - 4 * 60_000, player: false },
    ],
  }
}

function defaultFleet(): FleetState {
  return createFleet(FLEET_CATALOG[0])
}

function validFleet(value: unknown): value is FleetState {
  if (!value || typeof value !== 'object') return false
  const fleet = value as Partial<FleetState>
  return typeof fleet.id === 'string'
    && FLEET_CATALOG.some(item => item.id === fleet.id)
    && typeof fleet.name === 'string'
    && typeof fleet.tag === 'string'
    && (fleet.role === '舰长' || fleet.role === '成员')
    && typeof fleet.requestCardId === 'string'
    && CARDS.some(card => card.id === fleet.requestCardId)
    && typeof fleet.donatedCopies === 'number'
    && Array.isArray(fleet.members)
}

function normalizeFleetMessages(value: unknown): FleetMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is FleetMessage => {
      if (!entry || typeof entry !== 'object') return false
      const message = entry as Partial<FleetMessage>
      return typeof message.id === 'string'
        && typeof message.author === 'string'
        && typeof message.text === 'string'
        && typeof message.sentAt === 'number'
        && typeof message.player === 'boolean'
    })
    .map(message => ({
      id: message.id.slice(0, 80),
      author: message.author.slice(0, 24),
      text: message.text.replace(/\s+/g, ' ').trim().slice(0, 60),
      sentAt: Math.max(0, Math.floor(message.sentAt)),
      player: message.player,
    }))
    .filter(message => message.text.length > 0)
    .slice(-20)
}

function normalizeReplayActions(value: unknown): ReplayAction[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((action): action is Partial<ReplayAction> => Boolean(action) && typeof action === 'object')
    .filter(action => typeof action.at === 'number' && Number.isFinite(action.at) && (action.side === 'player' || action.side === 'enemy') && (action.lane === 0 || action.lane === 1) && typeof action.position === 'number' && Number.isFinite(action.position) && typeof action.cardId === 'string' && CARDS.some(card => card.id === action.cardId))
    .map(action => ({ at: Math.max(0, Math.min(240, Math.round(action.at! * 10) / 10)), side: action.side!, cardId: action.cardId!, lane: action.lane!, position: Math.max(.04, Math.min(.96, Math.round(action.position! * 1000) / 1000)), fieldX: typeof action.fieldX === 'number' && Number.isFinite(action.fieldX) ? Math.max(.04, Math.min(.96, Math.round(action.fieldX * 1000) / 1000)) : undefined }))
    .sort((a, b) => a.at - b.at)
    .slice(0, 80)
}

function normalizeBattleReport(value: unknown): BattleReport | undefined {
  if (!value || typeof value !== 'object') return undefined
  const report = value as Partial<BattleReport>
  if (typeof report.opponent !== 'string' || !Array.isArray(report.deck) || !Array.isArray(report.events)) return undefined
  return {
    opponent: report.opponent.slice(0, 40),
    deck: report.deck.filter((cardId): cardId is string => typeof cardId === 'string' && CARDS.some(card => card.id === cardId)).slice(0, 8),
    playerDeployments: Math.max(0, Math.floor(report.playerDeployments ?? 0)),
    enemyDeployments: Math.max(0, Math.floor(report.enemyDeployments ?? 0)),
    playerSpellcasts: Math.max(0, Math.floor(report.playerSpellcasts ?? 0)),
    enemySpellcasts: Math.max(0, Math.floor(report.enemySpellcasts ?? 0)),
    events: report.events.filter((event): event is string => typeof event === 'string').map(event => event.replace(/\s+/g, ' ').trim().slice(0, 100)).filter(Boolean).slice(0, 12),
    actions: normalizeReplayActions(report.actions),
  }
}

function createDefaultProfile(): PlayerProfile {
  const today = shopDate()
  const decks = DEFAULT_DECK_PRESETS.map(deck => deck.filter(cardId => CARDS.some(card => card.id === cardId)))
  return {
    version: 1,
    level: 8,
    xp: 520,
    trophies: 1240,
    coins: 680,
    wins: 12,
    losses: 7,
    streak: 3,
    chestWins: 2,
    chestQueue: defaultChestQueue(),
    activeDeck: 0,
    decks,
    deck: [...decks[0]],
    claimedTrophyRewards: [],
    cards: defaultCards(),
    history: [],
    shopDate: today,
    shopOffers: createShopOffers(today),
    claimedQuests: [],
    fleet: defaultFleet(),
    seasonPoints: 4,
    claimedSeasonRewards: [],
  }
}

function normalizeDeck(value: unknown, fallback: string[], validIds: Set<string>): string[] {
  const stored = Array.isArray(value)
    ? value.filter((id): id is string => typeof id === 'string' && validIds.has(id))
    : []
  const deck = [...new Set(stored)]
  for (const cardId of fallback) {
    if (deck.length >= DEFAULT_DECK_SIZE) break
    if (!deck.includes(cardId) && validIds.has(cardId)) deck.push(cardId)
  }
  for (const cardId of DEFAULT_DECK_IDS) {
    if (deck.length >= DEFAULT_DECK_SIZE) break
    if (!deck.includes(cardId) && validIds.has(cardId)) deck.push(cardId)
  }
  for (const card of CARDS) {
    if (deck.length >= DEFAULT_DECK_SIZE) break
    if (!deck.includes(card.id)) deck.push(card.id)
  }
  return deck.slice(0, DEFAULT_DECK_SIZE)
}

function normalizeProfile(value: Partial<PlayerProfile>): PlayerProfile {
  const fallback = createDefaultProfile()
  const today = shopDate()
  const cards = defaultCards()
  const validIds = new Set(CARDS.map(card => card.id))
  const storedDecks = Array.isArray(value.decks) ? value.decks : []
  const requestedDeck = typeof value.activeDeck === 'number' && Number.isFinite(value.activeDeck) ? Math.floor(value.activeDeck) : 0
  const activeDeck = Math.max(0, Math.min(DEFAULT_DECK_PRESETS.length - 1, requestedDeck))
  const decks = DEFAULT_DECK_PRESETS.map((preset, index) => normalizeDeck(
    storedDecks[index] ?? (index === 0 ? value.deck : undefined),
    preset,
    validIds,
  ))
  const deck = [...decks[activeDeck]]
  for (const card of CARDS) {
    const saved = value.cards?.[card.id]
    if (!saved) continue
    cards[card.id] = {
      level: Math.max(BASE_CARD_LEVEL, Math.min(MAX_CARD_LEVEL, Math.floor(saved.level))),
      copies: Math.max(0, Math.floor(saved.copies)),
    }
  }
  const storedShopOffers = value.shopDate === today && validShopOffers(today, value.shopOffers)
    ? value.shopOffers.map(offer => ({ ...offer }))
    : createShopOffers(today)
  const storedChestQueue = validChestQueue(value.chestQueue)
    ? value.chestQueue.map(chest => ({ ...chest }))
    : value.chestQueue === undefined ? fallback.chestQueue.map(chest => ({ ...chest })) : []
  const storedFleet = value.fleet === null ? null : validFleet(value.fleet)
    ? { ...value.fleet, members: value.fleet.members.map(member => ({ ...member })), messages: normalizeFleetMessages(value.fleet.messages) }
    : fallback.fleet
  return {
    ...fallback,
    ...value,
    version: 1,
    level: Math.max(1, Math.floor(value.level ?? fallback.level)),
    xp: Math.max(0, Math.floor(value.xp ?? fallback.xp)),
    trophies: Math.max(0, Math.floor(value.trophies ?? fallback.trophies)),
    coins: Math.max(0, Math.floor(value.coins ?? fallback.coins)),
    wins: Math.max(0, Math.floor(value.wins ?? fallback.wins)),
    losses: Math.max(0, Math.floor(value.losses ?? fallback.losses)),
    streak: Math.max(0, Math.floor(value.streak ?? fallback.streak)),
    chestWins: Math.max(0, Math.min(3, Math.floor(value.chestWins ?? fallback.chestWins))),
    chestQueue: storedChestQueue,
    activeDeck,
    decks,
    deck,
    claimedTrophyRewards: Array.isArray(value.claimedTrophyRewards)
      ? [...new Set(value.claimedTrophyRewards.filter(value => TROPHY_MILESTONES.some(milestone => milestone.trophies === value)))]
      : [],
    cards,
    history: Array.isArray(value.history) ? value.history.slice(0, 5).map(record => ({ ...record, mode: record.mode ?? 'ranked', report: normalizeBattleReport(record.report) })) : [],
    shopDate: today,
    shopOffers: storedShopOffers,
    claimedQuests: Array.isArray(value.claimedQuests)
      ? [...new Set(value.claimedQuests.filter(id => QUESTS.some(quest => quest.id === id)))]
      : [],
    fleet: storedFleet,
    seasonPoints: Math.max(0, Math.floor(value.seasonPoints ?? fallback.seasonPoints)),
    claimedSeasonRewards: Array.isArray(value.claimedSeasonRewards)
      ? [...new Set(value.claimedSeasonRewards.filter(points => SEASON_REWARDS.some(reward => reward.points === points)))]
      : [],
  }
}

function syncActiveDeck(profile: PlayerProfile): void {
  profile.decks[profile.activeDeck] = [...profile.deck]
}

export function selectDeckPreset(profile: PlayerProfile, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= profile.decks.length || index === profile.activeDeck) return false
  syncActiveDeck(profile)
  profile.activeDeck = index
  profile.deck = [...profile.decks[index]]
  saveProfile(profile)
  return true
}

export function toggleDeckCard(profile: PlayerProfile, cardId: string): 'added' | 'removed' | 'full' | 'missing' {
  if (!CARDS.some(card => card.id === cardId)) return 'missing'
  const index = profile.deck.indexOf(cardId)
  if (index >= 0) {
    profile.deck.splice(index, 1)
    syncActiveDeck(profile)
    saveProfile(profile)
    return 'removed'
  }
  if (profile.deck.length >= DEFAULT_DECK_SIZE) return 'full'
  profile.deck.push(cardId)
  syncActiveDeck(profile)
  saveProfile(profile)
  return 'added'
}

export function moveDeckCard(profile: PlayerProfile, fromIndex: number, toIndex: number): boolean {
  if (fromIndex < 0 || fromIndex >= profile.deck.length || toIndex < 0 || toIndex >= profile.deck.length || fromIndex === toIndex) return false
  const [cardId] = profile.deck.splice(fromIndex, 1)
  profile.deck.splice(toIndex, 0, cardId)
  syncActiveDeck(profile)
  saveProfile(profile)
  return true
}

export function roadTier(trophies: number): { name: string; min: number; next: number | null } {
  const milestones = TROPHY_MILESTONES
  let current = milestones[0]
  for (const milestone of milestones) {
    if (trophies >= milestone.trophies) current = milestone
  }
  const next = milestones.find(milestone => milestone.trophies > trophies)?.trophies ?? null
  return { name: current.label, min: current.trophies, next }
}

export function claimTrophyReward(profile: PlayerProfile, trophies: number): TrophyMilestone | null {
  const milestone = TROPHY_MILESTONES.find(item => item.trophies === trophies)
  if (!milestone || profile.trophies < milestone.trophies || profile.claimedTrophyRewards.includes(trophies)) return null
  profile.claimedTrophyRewards.push(trophies)
  profile.coins += milestone.coins
  if (milestone.cardId && milestone.copies) profile.cards[milestone.cardId].copies += milestone.copies
  saveProfile(profile)
  return milestone
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) return normalizeProfile(JSON.parse(raw) as Partial<PlayerProfile>)
  } catch {
    // Storage is optional in privacy-restricted browser contexts.
  }
  return createDefaultProfile()
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch {
    // The current session remains playable even when persistence is unavailable.
  }
}

export function getShop(profile: PlayerProfile): ShopOffer[] {
  const today = shopDate()
  if (profile.shopDate !== today || !validShopOffers(today, profile.shopOffers)) {
    profile.shopDate = today
    profile.shopOffers = createShopOffers(today)
    saveProfile(profile)
  }
  return profile.shopOffers.map(offer => ({ ...offer }))
}

export function buyShopOffer(profile: PlayerProfile, offerId: string): ShopOffer | null {
  const offers = getShop(profile)
  const offer = offers.find(item => item.id === offerId)
  if (!offer || offer.purchased || profile.coins < offer.price) return null
  const card = profile.cards[offer.cardId]
  if (!card) return null
  profile.coins -= offer.price
  card.copies += offer.copies
  const storedOffer = profile.shopOffers.find(item => item.id === offer.id)
  if (!storedOffer) return null
  storedOffer.purchased = true
  saveProfile(profile)
  return { ...storedOffer }
}

export function questProgress(profile: PlayerProfile, questId: string): number {
  if (questId === 'first-voyage') return profile.history.length
  if (questId === 'crown-hunter') return profile.history.reduce((total, record) => total + record.crownsFor, 0)
  if (questId === 'storm-streak') return profile.streak
  return 0
}

export function claimQuest(profile: PlayerProfile, questId: string): QuestDefinition | null {
  const quest = QUESTS.find(item => item.id === questId)
  if (!quest || profile.claimedQuests.includes(quest.id) || questProgress(profile, quest.id) < quest.target) return null
  profile.claimedQuests.push(quest.id)
  profile.coins += quest.reward
  saveProfile(profile)
  return quest
}

export function claimSeasonReward(profile: PlayerProfile, points: number): SeasonReward | null {
  const reward = SEASON_REWARDS.find(item => item.points === points)
  if (!reward || profile.seasonPoints < reward.points || profile.claimedSeasonRewards.includes(points)) return null
  profile.claimedSeasonRewards.push(points)
  profile.coins += reward.coins
  if (reward.cardId && reward.copies) profile.cards[reward.cardId].copies += reward.copies
  saveProfile(profile)
  return reward
}

export function getLeaderboard(profile: PlayerProfile): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [
    { id: 'northstar', name: '北辰领航员', trophies: 1840, fleet: '风暴信标', player: false },
    { id: 'beacon', name: '白塔信使', trophies: 1675, fleet: '潮汐守望', player: false },
    { id: 'chart', name: '深海绘图师', trophies: 1510, fleet: '礁岸绘图局', player: false },
    { id: 'anchor', name: '沉锚执政官', trophies: 1365, fleet: '沉锚联盟', player: false },
    { id: 'wake', name: '尾流观察者', trophies: 1180, fleet: '潮汐守望', player: false },
    { id: 'copper', name: '铜帆修理师', trophies: 1035, fleet: '礁岸绘图局', player: false },
    { id: 'player', name: '潮汐哨站', trophies: profile.trophies, fleet: profile.fleet?.name ?? '无舰队', player: true },
  ]
  return entries.sort((a, b) => b.trophies - a.trophies)
}

export function joinFleet(profile: PlayerProfile, fleetId: string): boolean {
  const definition = FLEET_CATALOG.find(item => item.id === fleetId)
  if (!definition) return false
  profile.fleet = createFleet(definition)
  saveProfile(profile)
  return true
}

export function leaveFleet(profile: PlayerProfile): boolean {
  if (!profile.fleet) return false
  profile.fleet = null
  saveProfile(profile)
  return true
}

export function sendFleetMessage(profile: PlayerProfile, text: string): FleetMessage | null {
  const fleet = profile.fleet
  const normalizedText = text.replace(/\s+/g, ' ').trim().slice(0, 60)
  if (!fleet || !normalizedText) return null
  const message: FleetMessage = {
    id: `player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author: '潮汐哨站',
    text: normalizedText,
    sentAt: Date.now(),
    player: true,
  }
  fleet.messages = [...normalizeFleetMessages(fleet.messages), message].slice(-20)
  saveProfile(profile)
  return { ...message }
}

export function donateFleetCard(profile: PlayerProfile): boolean {
  const fleet = profile.fleet
  if (!fleet || fleet.donatedCopies >= 6) return false
  const progress = profile.cards[fleet.requestCardId]
  if (!progress || progress.copies < 1) return false
  progress.copies -= 1
  fleet.donatedCopies += 1
  profile.coins += 8
  profile.xp += 5
  applyLevelUps(profile)
  saveProfile(profile)
  return true
}

export function chestQueue(profile: PlayerProfile): ChestSlot[] {
  return profile.chestQueue.map(chest => ({ ...chest }))
}

function enqueueChest(profile: PlayerProfile): boolean {
  if (profile.chestQueue.length >= CHEST_LIMIT) return false
  const now = Date.now()
  const last = profile.chestQueue[profile.chestQueue.length - 1]
  const unlockAt = last ? Math.max(now + CHEST_UNLOCK_MS, last.unlockAt + CHEST_UNLOCK_MS) : now + CHEST_UNLOCK_MS
  profile.chestQueue.push(createChest(now, unlockAt, profile.chestQueue.length))
  return true
}

export function xpTarget(level: number): number {
  return 300 + level * 100
}

export function upgradeQuote(profile: PlayerProfile, cardId: string): UpgradeQuote {
  const progress = profile.cards[cardId]
  const maxed = progress.level >= MAX_CARD_LEVEL
  const copiesNeeded = 10 + progress.level * 2
  const coinCost = 130 + progress.level * 45
  return {
    maxed,
    copiesNeeded,
    coinCost,
    canUpgrade: !maxed && progress.copies >= copiesNeeded && profile.coins >= coinCost,
  }
}

export function upgradeCard(profile: PlayerProfile, cardId: string): boolean {
  const progress = profile.cards[cardId]
  const quote = upgradeQuote(profile, cardId)
  if (!quote.canUpgrade) return false
  progress.level += 1
  progress.copies -= quote.copiesNeeded
  profile.coins -= quote.coinCost
  profile.xp += 35
  applyLevelUps(profile)
  saveProfile(profile)
  return true
}

export function claimChest(profile: PlayerProfile): ChestReward | null {
  const queued = profile.chestQueue[0]
  if (queued && queued.unlockAt <= Date.now()) {
    profile.chestQueue.shift()
    const reward = { cardId: queued.cardId, copies: queued.copies, coins: queued.coins }
    profile.coins += reward.coins
    profile.cards[reward.cardId].copies += reward.copies
    saveProfile(profile)
    return reward
  }
  if (profile.chestWins < 3) return null
  const card = CARDS[Math.floor(Math.random() * CARDS.length)]
  const reward = { cardId: card.id, copies: 6, coins: 180 }
  profile.chestWins = 0
  profile.coins += reward.coins
  profile.cards[card.id].copies += reward.copies
  saveProfile(profile)
  return reward
}

export function cardForBattle(card: Card, profile: PlayerProfile): Card {
  const progress = profile.cards[card.id]
  const multiplier = 1 + Math.max(0, progress.level - BASE_CARD_LEVEL) * 0.07
  return {
    ...card,
    level: progress.level,
    hp: Math.round(card.hp * multiplier),
    damage: Math.round(card.damage * multiplier),
    shield: card.shield === undefined ? undefined : Math.round(card.shield * multiplier),
    deathDamage: card.deathDamage === undefined ? undefined : Math.round(card.deathDamage * multiplier),
  }
}

export function playerDeck(profile: PlayerProfile): Card[] {
  const selected = profile.deck.map(id => CARDS.find(card => card.id === id)).filter((card): card is Card => Boolean(card))
  return selected.map(card => cardForBattle(card, profile))
}

export function applyBattleResult(
  profile: PlayerProfile,
  result: 'win' | 'lose' | 'draw',
  crownsFor: number,
  crownsAgainst: number,
  mode: MatchCategory = 'ranked',
  report?: BattleReport,
): BattleReward {
  if (mode === 'practice') return { trophies: 0, coins: 0, xp: 0 }
  const chestQueueBefore = profile.chestQueue.length
  const reward: BattleReward = mode === 'friendly'
    ? { trophies: 0, coins: 10, xp: 15 }
    : mode === 'event'
      ? result === 'win' ? { trophies: 0, coins: 70, xp: 90 } : result === 'lose' ? { trophies: 0, coins: 25, xp: 40 } : { trophies: 0, coins: 35, xp: 55 }
      : result === 'win' ? { trophies: 28, coins: 55, xp: 90 } : result === 'lose' ? { trophies: -18, coins: 18, xp: 35 } : { trophies: 0, coins: 28, xp: 50 }

  if (mode === 'ranked') profile.trophies = Math.max(0, profile.trophies + reward.trophies)
  profile.coins += reward.coins
  profile.xp += reward.xp
  if (mode === 'ranked' && result === 'win') {
    profile.wins += 1
    profile.streak += 1
    profile.chestWins = Math.min(3, profile.chestWins + 1)
    if (profile.chestWins >= 3 && enqueueChest(profile)) profile.chestWins = 0
  } else if (mode === 'ranked' && result === 'lose') {
    profile.losses += 1
    profile.streak = 0
  }
  if (mode !== 'friendly') profile.seasonPoints += result === 'win' ? 3 : result === 'draw' ? 2 : 1
  profile.history.unshift({
    id: Date.now(),
    mode,
    result,
    crownsFor,
    crownsAgainst,
    trophyDelta: reward.trophies,
    playedAt: Date.now(),
    report: report ? {
      opponent: report.opponent.slice(0, 40),
      deck: report.deck.filter(cardId => CARDS.some(card => card.id === cardId)).slice(0, 8),
      playerDeployments: Math.max(0, Math.floor(report.playerDeployments)),
      enemyDeployments: Math.max(0, Math.floor(report.enemyDeployments)),
      playerSpellcasts: Math.max(0, Math.floor(report.playerSpellcasts)),
      enemySpellcasts: Math.max(0, Math.floor(report.enemySpellcasts)),
      events: report.events.map(event => event.replace(/\s+/g, ' ').trim().slice(0, 100)).filter(Boolean).slice(0, 12),
      actions: normalizeReplayActions(report.actions),
    } : undefined,
  })
  profile.history = profile.history.slice(0, 5)
  applyLevelUps(profile)
  saveProfile(profile)
  return {
    ...reward,
    chestQueued: profile.chestQueue.length > chestQueueBefore,
    chestWins: mode === 'ranked' ? profile.chestWins : undefined,
  }
}

function applyLevelUps(profile: PlayerProfile): void {
  let target = xpTarget(profile.level)
  while (profile.xp >= target) {
    profile.xp -= target
    profile.level += 1
    profile.coins += 120
    target = xpTarget(profile.level)
  }
}
