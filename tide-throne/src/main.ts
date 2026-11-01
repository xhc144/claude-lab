import Phaser from 'phaser'
import { audioFeedback } from './audio'
import {
  applyBattleResult,
  BattleRecord,
  BattleReport,
  buyShopOffer,
  cardForBattle,
  chestQueue,
  claimQuest,
  claimSeasonReward,
  claimTrophyReward,
  claimChest,
  donateFleetCard,
  FLEET_CATALOG,
  getShop,
  getLeaderboard,
  joinFleet,
  leaveFleet,
  loadProfile,
  MatchCategory,
  moveDeckCard,
  playerDeck,
  roadTier,
  sendFleetMessage,
  selectDeckPreset,
  questProgress,
  QUESTS,
  SEASON_REWARDS,
  TROPHY_MILESTONES,
  toggleDeckCard,
  upgradeCard,
  upgradeQuote,
  xpTarget,
} from './profile'
import { BattleScene } from './scene'
import { BattleMode, BattleSimulation, Card, CARDS, Lane, ReplayAction } from './simulation'
import './styles.css'

declare global {
  interface Window {
    __tidalTest: {
      sim: BattleSimulation
      game?: Phaser.Game
    }
  }
}

let profile = loadProfile()
const sim = new BattleSimulation(playerDeck(profile))
sim.setPaused(true)
if (import.meta.env.DEV) Object.defineProperty(window, '__tidalTest', { configurable: true, value: { sim } })
let selected: Card | null = null
let selectedDetailId = CARDS[0].id
let battleDeckIds = [...profile.deck]
let battleDeckPreset = profile.activeDeck
let collectionFilter: 'all' | 'units' | 'spells' | 'buildings' = 'all'
let handledResult = false
const heardEffectIds = new Set<number>()
const soundTowerState = new Map<string, { hp: number; active: boolean }>()
let overlayHeldPause = false
let chestMessage = ''
let deckMessage = ''
let deckMessageError = false
let roadMessage = ''
let shopMessage = ''
let questMessage = ''
let fleetMessage = ''
let seasonMessage = ''
let seasonTab: 'rewards' | 'leaderboard' = 'rewards'
let matchStarted = false
let selectedMode: BattleMode = 'ranked'
let selectedMatchCategory: MatchCategory = 'ranked'
let matchTimer: number | null = null
let matchOpponent = '雾港议会'
let lastReward: ReturnType<typeof applyBattleResult> | null = null
let announcedPhase: 'opening' | 'surge' | 'overtime' = 'opening'
let phaseBannerTimer: number | null = null
let practiceStep = 0
let displayedCrownScore: string | null = null
let replaySession: { record: BattleRecord; actions: ReplayAction[]; nextIndex: number } | null = null
let replayRate = 1
let suppressCardClick = false
let activeCardDrag: {
  card: Card
  pointerId: number
  startX: number
  startY: number
  moved: boolean
  button: HTMLButtonElement
  ghost: HTMLDivElement
} | null = null

const FRIENDS = [
  { id: 'mist', name: '雾港测绘师', trophies: 1288, fleet: '礁岸绘图局', online: true },
  { id: 'beacon', name: '白塔信使', trophies: 1675, fleet: '潮汐守望', online: true },
  { id: 'anchor', name: '沉锚观察员', trophies: 1094, fleet: '沉锚联盟', online: false },
  { id: 'wake', name: '尾流领航员', trophies: 1412, fleet: '风暴信标', online: true },
]

const CARD_ART: Partial<Record<Card['id'], string>> = {
  'iron-scout': '/assets/kenney-toon-characters-source/Male%20adventurer/PNG/Poses/character_maleAdventurer_idle.png',
  'signal-archer': '/assets/kenney-toon-characters-source/Female%20adventurer/PNG/Poses/character_femaleAdventurer_idle.png',
  'reef-bomber': '/assets/kenney-toon-characters-source/Female%20person/PNG/Poses/character_femalePerson_attack1.png',
  'ember-charger': '/assets/kenney-toon-characters-source/Zombie/PNG/Poses/character_zombie_run1.png',
  breakwater: '/assets/kenney-toon-characters-source/Robot/PNG/Poses/character_robot_idle.png',
  'reef-runners': '/assets/kenney-toon-characters-source/Zombie/PNG/Poses/character_zombie_idle.png',
  'lantern-school': '/assets/kenney-toon-characters-source/Male%20person/PNG/Poses/character_malePerson_run1.png',
  'cloud-sailor': '/assets/kenney-toon-characters-source/Female%20person/PNG/Poses/character_femalePerson_idle.png',
  'anchor-golem': '/assets/kenney-toon-characters-source/Robot/PNG/Poses/character_robot_attack1.png',
  'mist-pike': '/assets/kenney-toon-characters-source/Female%20adventurer/PNG/Poses/character_femaleAdventurer_attack1.png',
  'brine-guards': '/assets/kenney-toon-characters-source/Male%20adventurer/PNG/Poses/character_maleAdventurer_attack1.png',
  'tide-emplacement': '/assets/kenney-medieval-rts/harbor-outpost.png',
  'harbor-mortar': '/assets/kenney-medieval-rts/harbor-core.png',
}

const root = document.querySelector<HTMLDivElement>('#root')!
root.innerHTML = `
  <div class="shell">
    <header class="topbar">
      <div class="brand"><span class="mark" aria-hidden="true"></span><span>TIDAL THRONE</span></div>
      <div class="match-meta">
        <span id="crowns" class="crowns"><i class="score-sigil" aria-hidden="true"></i>0 : 0<i class="score-sigil enemy" aria-hidden="true"></i></span>
        <span id="phase">标准节奏</span>
        <div id="timer" class="timer">02:30</div>
      </div>
      <div class="top-actions">
        <button id="hub-button" class="pause-btn">大厅</button>
        <button id="loadout-button" class="pause-btn">战备</button>
        <button id="pause" class="pause-btn">暂停</button>
        <button id="reset" class="icon-btn" title="重新开始">↻</button>
      </div>
    </header>
    <main class="main">
      <aside class="hud battle-vitals">
        <span class="eyebrow">实时战况</span>
        <h1>守住潮汐。</h1>
        <div class="tower-columns">
          <div><div class="tower-caption enemy-caption">敌方塔群</div><div id="enemy-health" class="tower-health"></div></div>
          <div><div class="tower-caption">己方塔群</div><div id="health" class="tower-health"></div></div>
        </div>
        <div class="mana-block">
          <div class="mana-line"><span>能量潮汐 <small id="rate">+0.85/s</small></span><b id="mana" class="mana-value">5<span>/10</span></b></div>
          <div class="mana-meter"><i id="mana-bar" style="width:50%"></i></div>
        </div>
      </aside>
      <section class="arena-wrap">
        <div class="arena-label"><span id="enemy-name">敌方 · 雾港议会</span><span>己方 · 潮汐哨站</span></div>
        <div id="arena" class="arena"></div>
        <div class="hand-dock">
          <div class="hand-heading"><span>作战手牌 <small id="deck-count" class="deck-count">8 张牌组</small><small id="deck-average" class="deck-average">均费 3.5</small></span><small>选择后点击战场部署</small></div>
          <div id="cards" class="cards"></div>
          <div class="next-card"><span>下一张</span><div id="next-card-content"></div></div>
        </div>
        <p class="hint">点击战场任意横向位置部署，拖拽卡牌也可精确落点。单位会在短暂集结后进入战斗。</p>
      </section>
      <aside class="hud battle-feed">
        <span class="eyebrow">航线记录</span>
        <h2>战斗日志</h2>
        <div class="log">
          <div class="log-title">最新事件</div>
          <p id="log-text"></p>
          <div id="log-history" class="log-history"></div>
          <div class="emote-strip" id="emotes">
            <span>快速表情</span>
            <button data-emote="稳住">稳住</button><button data-emote="漂亮">漂亮</button>
            <button data-emote="加速">加速</button><button data-emote="小心">小心</button>
          </div>
        </div>
      </aside>
    </main>
  </div>

  <div id="result" class="result" hidden>
    <div class="result-panel">
      <span class="eyebrow">战斗结束</span>
      <div id="result-avatar" class="result-avatar" aria-hidden="true"></div>
      <h2 id="result-title"></h2>
      <p id="result-copy" class="result-copy"></p>
      <div id="result-score" class="result-score"></div>
      <div id="result-reward" class="result-reward"></div>
      <div id="result-stats" class="result-stats"></div>
      <div class="result-events-heading"><span>战报回放</span><small>本局关键事件</small></div>
      <div id="result-events" class="result-events"></div>
      <div class="result-actions"><button id="again">再来一局</button><button id="result-hub" class="secondary-action">返回大厅</button></div>
    </div>
  </div>

  <div id="loadout" class="result loadout" hidden>
    <div class="loadout-panel">
      <div class="loadout-head">
        <div><span class="eyebrow">战备甲板</span><h2>潮汐编队</h2><p>选择卡牌查看属性，升级将在下一场战斗生效。</p></div>
        <button id="close-loadout" class="icon-btn" title="关闭战备">×</button>
      </div>
      <div class="loadout-body"><div class="loadout-browser"><div id="deck-presets" class="deck-presets" role="tablist" aria-label="战备编队"></div><div class="deck-editor-heading"><span>当前牌组 <b id="deck-editor-count"></b></span><small id="deck-editor-warning"></small></div><div id="deck-slots" class="deck-slots"></div><div class="collection-heading"><span>卡牌收藏</span><small>点击卡牌查看详情，使用加入或移出管理牌组</small></div><div class="collection-filters" role="tablist" aria-label="卡牌分类"><button class="collection-filter" data-collection-filter="all" role="tab">全部</button><button class="collection-filter" data-collection-filter="units" role="tab">单位</button><button class="collection-filter" data-collection-filter="spells" role="tab">法术</button><button class="collection-filter" data-collection-filter="buildings" role="tab">建筑</button></div><div id="loadout-cards" class="loadout-cards"></div></div><aside id="card-detail" class="card-detail"></aside></div>
    </div>
  </div>

  <div id="hub" class="result hub" hidden>
    <div class="hub-panel">
      <div class="hub-head"><div><span class="eyebrow">潮汐航站</span><h2>准备下一场。</h2></div><button id="close-hub" class="icon-btn" title="关闭大厅">×</button></div>
      <div class="profile-strip"><span id="profile-mark" class="profile-mark"></span><div><strong>潮汐哨站</strong><small id="profile-summary"></small></div><b id="profile-trophies"></b></div>
      <div class="profile-economy"><span>潮贝 <b id="profile-coins"></b></span><span>胜场 <b id="profile-wins"></b></span><span>战绩 <b id="profile-record"></b></span></div>
      <div class="xp-track"><div><span>航海经验</span><b id="profile-xp"></b></div><i><em id="profile-xp-bar"></em></i></div>
      <div class="trophy-road-card"><div><span id="profile-arena">沉潮港主</span><b id="trophy-road-next"></b></div><p id="profile-arena-copy"></p><i><em id="trophy-road-bar"></em></i><button id="open-road" class="road-link">查看奖杯航线</button></div>
      <div class="chest-track">
        <div><span>潮汐补给箱</span><b id="chest-progress"></b></div>
        <i><em id="chest-bar"></em></i>
        <div class="chest-foot"><small id="chest-copy"></small><button id="claim-chest">尚未就绪</button></div>
        <p id="chest-message" class="chest-message"></p>
        <div id="chest-queue" class="chest-queue" aria-label="宝箱队列"></div>
      </div>
      <div class="quest-block"><div class="quest-heading"><span>航海任务</span><small>完成目标领取潮贝</small></div><div id="quests" class="quests"></div><p id="quest-message" class="quest-message"></p></div>
      <div class="history-block"><div class="history-title">最近战绩</div><div id="battle-history" class="battle-history"></div></div>
      <div class="hub-setting"><span><strong>程序音效</strong><small>部署、表情与战斗反馈</small></span><button id="sound-toggle" type="button"></button></div>
      <div class="hub-actions"><button id="hub-battle" class="hub-primary">进入战场</button></div>
      <div class="hub-utility-actions"><button id="hub-deck">查看战备</button><button id="hub-shop">潮汐商店</button><button id="hub-events">活动挑战</button><button id="hub-fleet">潮汐舰队</button><button id="hub-season">赛季联赛</button><button id="hub-friends">好友约战</button><button id="hub-practice">潮汐演练</button></div>
    </div>
  </div>

  <div id="shop" class="result shop" hidden>
    <div class="shop-panel">
      <div class="shop-head"><div><span class="eyebrow">每日补给 · 潮贝</span><h2>潮汐商店</h2><p>每日刷新三份原创卡牌补给，购买后本日不可重复购买。</p></div><button id="close-shop" class="icon-btn" title="关闭潮汐商店">×</button></div>
      <div class="shop-balance"><span>当前潮贝</span><strong id="shop-coins"></strong></div>
      <div id="shop-offers" class="shop-offers"></div>
      <p id="shop-message" class="shop-message"></p>
    </div>
  </div>

  <div id="events" class="result events" hidden>
    <div class="events-panel">
      <div class="events-head"><div><span class="eyebrow">限时航线 · 活动</span><h2>风暴冲刺</h2><p>更短的战局、更快的能量潮汐，适合练习桥头抢节奏。</p></div><button id="close-events" class="icon-btn" title="关闭活动挑战">×</button></div>
      <div class="event-banner"><div class="event-sigil">↯</div><div><strong>风暴冲刺 · 开放中</strong><small>90 秒战局 · 1.3 倍基础能量 · 20 秒突然死亡</small></div><b>活动</b></div>
      <div class="event-rules"><span><b>90</b>秒限时</span><span><b>2.2</b>/s 潮汐增幅</span><span><b>+90</b>航海经验</span></div>
      <button id="start-storm" class="event-primary">开始风暴冲刺</button>
      <p id="event-message" class="event-message">活动胜负仍会记录在最近战绩。</p>
    </div>
  </div>

  <div id="fleet" class="result fleet" hidden>
    <div class="fleet-panel">
      <div class="fleet-head"><div><span class="eyebrow">舰队通讯 · 社交</span><h2>潮汐舰队</h2><p>与本地舰队成员共享卡牌副本，积累贡献并领取协作奖励。</p></div><button id="close-fleet" class="icon-btn" title="关闭潮汐舰队">×</button></div>
      <div id="fleet-content"></div>
      <p id="fleet-message" class="fleet-message"></p>
    </div>
  </div>

  <div id="season" class="result season" hidden>
    <div class="season-panel">
      <div class="season-head"><div><span class="eyebrow">第 03 航季 · 联赛</span><h2>远洋赛季</h2><p>完成对战获得赛季点数，领取补给并提升本地联赛排名。</p></div><button id="close-season" class="icon-btn" title="关闭赛季联赛">×</button></div>
      <div class="season-summary"><div><span>当前点数</span><strong id="season-points"></strong></div><i><em id="season-progress"></em></i><small>胜利 +3 · 平局 +2 · 失败 +1</small></div>
      <div class="season-tabs"><button data-season-tab="rewards" class="active">赛季奖励</button><button data-season-tab="leaderboard">排行榜</button></div>
      <div id="season-content"></div>
      <p id="season-message" class="season-message"></p>
    </div>
  </div>

  <div id="friends" class="result friends" hidden>
    <div class="friends-panel">
      <div class="friends-head"><div><span class="eyebrow">好友列表 · 友谊战</span><h2>航线好友</h2><p>向在线好友发起本地模拟约战。友谊战不改变奖杯、赛季点数或宝箱进度。</p></div><button id="close-friends" class="icon-btn" title="关闭好友列表">×</button></div>
      <div id="friends-list" class="friends-list"></div>
      <p id="friends-message" class="friends-message">在线好友可立即接受挑战。</p>
    </div>
  </div>

  <div id="matching" class="result matching" hidden>
    <div class="matching-panel"><span class="eyebrow">潮汐匹配</span><h2 id="matching-title">寻找对手</h2><p id="matching-copy">正在扫描相近奖杯区间。</p><div class="matching-meter"><i id="matching-meter-bar"></i></div><div id="matching-opponent" class="matching-opponent" hidden><span>对手已确认</span><strong id="matching-opponent-name"></strong><small id="matching-opponent-trophies"></small></div><button id="cancel-match" class="secondary-action">取消匹配</button></div>
  </div>

  <div id="road" class="result road" hidden>
    <div class="road-panel"><div class="road-head"><div><span class="eyebrow">奖杯航线</span><h2>潮汐晋级路</h2></div><button id="close-road" class="icon-btn" title="关闭奖杯航线">×</button></div><p class="road-intro">赢下对战积累奖杯，解锁潮贝与卡牌补给。</p><div id="road-milestones" class="road-milestones"></div><p id="road-message" class="road-message"></p></div>
  </div>

  <div id="history-report" class="result history-report" hidden>
    <div class="history-report-panel">
      <div class="history-report-head"><div><span class="eyebrow">已保存战报</span><h2 id="history-report-title">战斗记录</h2><p id="history-report-copy"></p></div><button id="close-history-report" class="icon-btn" title="关闭战报">×</button></div>
      <div id="history-report-score" class="history-report-score"></div>
      <div id="history-report-stats" class="history-report-stats"></div>
      <div class="history-report-section"><span>当局牌组</span><div id="history-report-deck" class="history-report-deck"></div></div>
      <div class="history-report-section"><span>关键事件</span><div id="history-report-events" class="history-report-events"></div></div>
      <div class="history-replay-actions"><small id="history-replay-status"></small><button id="watch-replay" type="button">观看战斗回放</button></div>
    </div>
  </div>
`

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'arena',
  backgroundColor: '#0b2632',
  scene: [BattleScene],
  scale: { mode: Phaser.Scale.RESIZE, width: 720, height: 820 },
  render: { antialias: true },
}
const game = new Phaser.Game(config)
game.registry.set('simulation', sim)
game.registry.set('replayRate', replayRate)
if (import.meta.env.DEV) window.__tidalTest.game = game

const arena = document.querySelector<HTMLDivElement>('#arena')!
const countdownEl = document.createElement('div')
countdownEl.className = 'match-countdown'
countdownEl.setAttribute('aria-live', 'polite')
arena.appendChild(countdownEl)
const matchVersus = document.createElement('div')
matchVersus.className = 'match-versus'
matchVersus.innerHTML = '<div class="match-versus-side enemy"><span class="versus-avatar enemy" aria-hidden="true"></span><small>对手航线</small><strong id="versus-enemy"></strong></div><span id="versus-mode" class="versus-mode"></span><div class="match-versus-side player"><span class="versus-avatar player" aria-hidden="true"></span><small>己方航线</small><strong>潮汐哨站</strong></div>'
matchVersus.hidden = true
arena.appendChild(matchVersus)
const versusEnemy = matchVersus.querySelector('#versus-enemy')!
const versusMode = matchVersus.querySelector('#versus-mode')!
const pauseOverlay = document.createElement('div')
pauseOverlay.className = 'pause-overlay'
pauseOverlay.innerHTML = '<strong>战斗已暂停</strong><span>点击“继续”返回竞技场</span>'
pauseOverlay.hidden = true
arena.appendChild(pauseOverlay)
const phaseBanner = document.createElement('div')
phaseBanner.className = 'phase-banner'
phaseBanner.setAttribute('aria-live', 'assertive')
phaseBanner.innerHTML = '<span></span><strong></strong><small></small>'
phaseBanner.hidden = true
arena.appendChild(phaseBanner)
const practiceCoach = document.createElement('div')
practiceCoach.className = 'practice-coach'
practiceCoach.setAttribute('aria-live', 'polite')
practiceCoach.hidden = true
practiceCoach.innerHTML = '<span></span><strong></strong><small></small>'
arena.appendChild(practiceCoach)
const emoteBeacon = document.createElement('div')
emoteBeacon.className = 'emote-beacon'
emoteBeacon.setAttribute('aria-live', 'polite')
emoteBeacon.hidden = true
arena.appendChild(emoteBeacon)
const replayDock = document.createElement('section')
replayDock.className = 'replay-dock'
replayDock.setAttribute('aria-label', '战斗回放控制台')
replayDock.innerHTML = '<div><span>战斗回放</span><strong id="replay-time">00:00</strong><small id="replay-actions">0 / 0 动作</small></div><i><em id="replay-progress"></em></i><div class="replay-speeds"><button type="button" data-replay-speed="1">1x</button><button type="button" data-replay-speed="2">2x</button></div><button id="exit-replay" type="button" title="退出回放">退出</button>'
replayDock.hidden = true
arena.after(replayDock)
const replayTime = replayDock.querySelector('#replay-time')!
const replayActions = replayDock.querySelector('#replay-actions')!
const replayProgress = replayDock.querySelector<HTMLElement>('#replay-progress')!
const exitReplay = replayDock.querySelector<HTMLButtonElement>('#exit-replay')!
let emoteBeaconTimer: number | null = null

function showEmoteBeacon(message: string): void {
  emoteBeacon.textContent = message
  emoteBeacon.hidden = false
  emoteBeacon.classList.remove('show')
  void emoteBeacon.offsetWidth
  emoteBeacon.classList.add('show')
  if (emoteBeaconTimer !== null) window.clearTimeout(emoteBeaconTimer)
  emoteBeaconTimer = window.setTimeout(() => {
    emoteBeacon.hidden = true
    emoteBeacon.classList.remove('show')
  }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 1700 : 2200)
}

const cardsEl = document.querySelector<HTMLDivElement>('#cards')!
const nextCardContent = document.querySelector<HTMLDivElement>('#next-card-content')!
const deckAverage = document.querySelector('#deck-average')!
const timer = document.querySelector('#timer')!
const phaseEl = document.querySelector('#phase')!
const crownsEl = document.querySelector<HTMLElement>('#crowns')!
const rateEl = document.querySelector('#rate')!
const mana = document.querySelector('#mana')!
const manaBar = document.querySelector<HTMLElement>('#mana-bar')!
const health = document.querySelector('#health')!
const enemyHealth = document.querySelector('#enemy-health')!
const logText = document.querySelector('#log-text')!
const logHistory = document.querySelector('#log-history')!
const result = document.querySelector<HTMLDivElement>('#result')!
const resultTitle = document.querySelector('#result-title')!
const resultAvatar = document.querySelector<HTMLElement>('#result-avatar')!
const resultCopy = document.querySelector('#result-copy')!
const resultScore = document.querySelector('#result-score')!
const resultReward = document.querySelector('#result-reward')!
const resultStats = document.querySelector('#result-stats')!
const resultEvents = document.querySelector('#result-events')!
const pause = document.querySelector<HTMLButtonElement>('#pause')!
const loadout = document.querySelector<HTMLDivElement>('#loadout')!
const loadoutCards = document.querySelector<HTMLDivElement>('#loadout-cards')!
const deckSlots = document.querySelector<HTMLDivElement>('#deck-slots')!
const deckPresetControls = document.querySelector<HTMLDivElement>('#deck-presets')!
const cardDetail = document.querySelector<HTMLElement>('#card-detail')!
const hub = document.querySelector<HTMLDivElement>('#hub')!
const shop = document.querySelector<HTMLDivElement>('#shop')!
const shopOffers = document.querySelector<HTMLDivElement>('#shop-offers')!
const shopCoins = document.querySelector('#shop-coins')!
const shopMessageEl = document.querySelector('#shop-message')!
const events = document.querySelector<HTMLDivElement>('#events')!
const eventMessage = document.querySelector('#event-message')!
const fleet = document.querySelector<HTMLDivElement>('#fleet')!
const fleetContent = document.querySelector<HTMLDivElement>('#fleet-content')!
const fleetMessageEl = document.querySelector('#fleet-message')!
const season = document.querySelector<HTMLDivElement>('#season')!
const seasonContent = document.querySelector<HTMLDivElement>('#season-content')!
const seasonPointsEl = document.querySelector('#season-points')!
const seasonProgressEl = document.querySelector<HTMLElement>('#season-progress')!
const seasonMessageEl = document.querySelector('#season-message')!
const friends = document.querySelector<HTMLDivElement>('#friends')!
const friendsList = document.querySelector<HTMLDivElement>('#friends-list')!
const friendsMessage = document.querySelector('#friends-message')!
const quests = document.querySelector<HTMLDivElement>('#quests')!
const questMessageEl = document.querySelector('#quest-message')!
const chestQueueEl = document.querySelector<HTMLDivElement>('#chest-queue')!
const emotes = document.querySelector<HTMLDivElement>('#emotes')!
const soundToggle = document.querySelector<HTMLButtonElement>('#sound-toggle')!
const matching = document.querySelector<HTMLDivElement>('#matching')!
const matchingTitle = document.querySelector('#matching-title')!
const matchingCopy = document.querySelector('#matching-copy')!
const matchingMeterBar = document.querySelector<HTMLElement>('#matching-meter-bar')!
const matchingOpponent = document.querySelector<HTMLElement>('#matching-opponent')!
const matchingOpponentName = document.querySelector('#matching-opponent-name')!
const matchingOpponentTrophies = document.querySelector('#matching-opponent-trophies')!
const road = document.querySelector<HTMLDivElement>('#road')!
const roadMilestones = document.querySelector<HTMLDivElement>('#road-milestones')!
const roadMessageEl = document.querySelector('#road-message')!
const battleHistory = document.querySelector<HTMLDivElement>('#battle-history')!
const historyReport = document.querySelector<HTMLDivElement>('#history-report')!
const historyReportTitle = document.querySelector('#history-report-title')!
const historyReportCopy = document.querySelector('#history-report-copy')!
const historyReportScore = document.querySelector('#history-report-score')!
const historyReportStats = document.querySelector('#history-report-stats')!
const historyReportDeck = document.querySelector('#history-report-deck')!
const historyReportEvents = document.querySelector('#history-report-events')!
const historyReplayStatus = document.querySelector('#history-replay-status')!
const watchReplay = document.querySelector<HTMLButtonElement>('#watch-replay')!

function formatTime(time: number): string {
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(Math.ceil(time % 60)).padStart(2, '0')}`
}

function kindLabel(card: Card): string {
  return { melee: '近战单位', ranged: '远程单位', tank: '重装单位', spell: '范围法术', building: '防御建筑' }[card.kind]
}

function rarityLabel(card: Card): string {
  if (card.id === 'cloud-sailor' || card.id === 'anchor-golem') return '传说'
  if (card.kind === 'spell' && card.cost >= 5 || card.kind === 'tank' && card.cost >= 6) return '史诗'
  if (card.kind === 'building' || card.cost >= 4) return '稀有'
  return '基础'
}

function rarityClass(card: Card): string {
  return `rarity-${rarityLabel(card)}`
}

function targetLabel(card: Card): string {
  if (card.kind === 'spell') return '地面与空中'
  if (card.targetMode === 'buildings') return '仅建筑'
  if (card.airborne) return '空中单位'
  return card.canTargetAir ? '地面与空中' : '地面单位'
}

function targetShortLabel(card: Card): string {
  if (card.airborne) return '空中'
  if (card.targetMode === 'buildings') return '建筑'
  return card.canTargetAir || card.kind === 'spell' ? '全域' : '地面'
}

function cardIconMarkup(card: Card, className = 'card-icon'): string {
  const art = CARD_ART[card.id]
  if (art) return `<span class="${className} card-art" style="--card-art:url('${art}');--card-color:${card.color}" aria-hidden="true"></span>`
  return `<span class="${className} card-symbol card-symbol-${card.kind}" style="--card-color:${card.color}" aria-hidden="true"></span>`
}

function speedLabel(speed: number): string {
  if (speed === 0) return '固定'
  if (speed >= 55) return '迅捷'
  if (speed >= 28) return '中等'
  return '缓慢'
}

function weightLabel(weight: Card['weight']): string {
  return { light: '轻型', medium: '中型', heavy: '重型', structure: '固定建筑' }[weight ?? 'medium']
}

function targetPriorityLabel(priority: Card['targetPriority']): string {
  return { nearest: '最近目标', weakest: '受损目标', cluster: '密集目标' }[priority ?? 'nearest']
}

function healthMarkup(side: 'player' | 'enemy', towers: ReturnType<BattleSimulation['snapshot']>['towers']): string {
  return towers.filter(tower => tower.side === side).map(tower => {
    const label = tower.lane === 'core' ? '主塔' : tower.lane === 0 ? '左塔' : '右塔'
    const stateClass = tower.hp <= 0 ? ' down' : tower.lane === 'core' && tower.active ? ' active' : ''
    return `<div class="health-row${stateClass}"><span><b>${label}</b><b>${Math.ceil(tower.hp)}</b></span><div class="bar"><i style="width:${Math.max(0, tower.hp / tower.maxHp * 100)}%"></i></div></div>`
  }).join('')
}

function renderCards(hand: Card[], manaValue: number, locked = false): void {
  cardsEl.innerHTML = ''
  hand.forEach(card => {
    const button = document.createElement('button')
    button.className = `card${selected?.id === card.id ? ' selected' : ''}${card.airborne ? ' airborne' : ''}`
    button.dataset.card = card.id
    button.disabled = locked || manaValue < card.cost
    button.draggable = false
    button.title = `${card.name}：${card.description}`
    const targetShort = card.targetMode === 'buildings' ? '建筑' : card.airborne ? '空中' : card.canTargetAir || card.kind === 'spell' ? '全域' : '地面'
    button.innerHTML = `<span class="card-level">等级 ${card.level ?? 5}</span><span class="card-target">${targetShort}</span>${cardIconMarkup(card)}<span class="card-copy"><strong class="card-name">${card.name}</strong><small>${card.description}</small></span><b class="card-cost">${card.cost}</b>`
    button.addEventListener('click', () => {
      if (suppressCardClick) {
        suppressCardClick = false
        return
      }
      selected = card
      arena.classList.add('preview-active')
      arena.classList.toggle('spell-preview', card.kind === 'spell')
      renderCards(hand, manaValue)
    })
    button.addEventListener('pointerdown', event => startCardDrag(card, button, event))
    cardsEl.appendChild(button)
  })
}

function renderQuests(): void {
  quests.innerHTML = QUESTS.map(quest => {
    const progress = Math.min(quest.target, questProgress(profile, quest.id))
    const claimed = profile.claimedQuests.includes(quest.id)
    const complete = progress >= quest.target
    const buttonLabel = claimed ? '已领取' : complete ? '领取' : `${progress}/${quest.target}`
    return `<div class="quest-row${complete ? ' complete' : ''}${claimed ? ' claimed' : ''}"><div><strong>${quest.label}</strong><small>${quest.description}</small><i><em style="width:${progress / quest.target * 100}%"></em></i></div><button data-claim-quest="${quest.id}" ${!complete || claimed ? 'disabled' : ''}>${buttonLabel}</button><b>+${quest.reward}</b></div>`
  }).join('')
  questMessageEl.textContent = questMessage
  quests.querySelectorAll<HTMLButtonElement>('[data-claim-quest]').forEach(button => button.addEventListener('click', () => {
    const quest = claimQuest(profile, button.dataset.claimQuest ?? '')
    if (!quest) {
      audioFeedback.error()
      return
    }
    questMessage = `已领取 ${quest.label}：+${quest.reward} 潮贝。`
    audioFeedback.upgrade()
    renderProfile()
  }))
}

function chestCountdown(unlockAt: number): string {
  const remaining = Math.max(0, unlockAt - Date.now())
  if (remaining <= 0) return '已解锁'
  const seconds = Math.ceil(remaining / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}

function renderChestQueue(): void {
  const queue = chestQueue(profile)
  chestQueueEl.innerHTML = Array.from({ length: 4 }, (_, index) => {
    const chest = queue[index]
    if (!chest) return `<div class="chest-slot empty"><span>${index + 1}</span><b>空位</b><small>胜利后获得宝箱</small></div>`
    const card = CARDS.find(item => item.id === chest.cardId)!
    const active = index === 0
    const ready = active && chest.unlockAt <= Date.now()
    return `<div class="chest-slot ${active ? 'active' : 'queued'}${ready ? ' ready' : ''}"><span>${index + 1}</span><i class="chest-glyph ${chest.kind}">▣</i><div><strong>${chest.label}</strong><small>${active ? ready ? '可以开启' : `解锁中 · ${chestCountdown(chest.unlockAt)}` : '排队中'}</small></div><b>+${chest.coins}</b><em>${card.name} ×${chest.copies}</em></div>`
  }).join('')
}

function renderProfile(): void {
  const target = xpTarget(profile.level)
  document.querySelector('#profile-mark')!.textContent = `T${profile.level}`
  document.querySelector('#profile-summary')!.textContent = `航海等级 ${String(profile.level).padStart(2, '0')} · 连胜 ${profile.streak}`
  document.querySelector('#profile-trophies')!.textContent = `${profile.trophies} 杯`
  document.querySelector('#profile-coins')!.textContent = String(profile.coins)
  document.querySelector('#profile-wins')!.textContent = String(profile.wins)
  document.querySelector('#profile-record')!.textContent = `${profile.wins}胜 ${profile.losses}负`
  document.querySelector('#profile-xp')!.textContent = `${profile.xp} / ${target}`
  document.querySelector<HTMLElement>('#profile-xp-bar')!.style.width = `${Math.min(100, profile.xp / target * 100)}%`
  const tier = roadTier(profile.trophies)
  document.querySelector('#profile-arena')!.textContent = tier.name
  document.querySelector('#profile-arena-copy')!.textContent = tier.next ? `${profile.trophies} 杯 · 距离下一段位还差 ${tier.next - profile.trophies} 杯` : `${profile.trophies} 杯 · 已抵达最高航线`
  const roadRange = tier.next ? tier.next - tier.min : 1
  const roadProgress = tier.next ? (profile.trophies - tier.min) / roadRange : 1
  document.querySelector<HTMLElement>('#trophy-road-bar')!.style.width = `${Math.max(0, Math.min(100, roadProgress * 100))}%`
  document.querySelector('#trophy-road-next')!.textContent = tier.next ? `${tier.next} 杯` : '最高段位'
  document.querySelector('#chest-progress')!.textContent = `${profile.chestWins} / 3 胜`
  document.querySelector<HTMLElement>('#chest-bar')!.style.width = `${profile.chestWins / 3 * 100}%`
  const queue = chestQueue(profile)
  const queueReady = Boolean(queue[0] && queue[0].unlockAt <= Date.now())
  document.querySelector('#chest-copy')!.textContent = queueReady ? '宝箱已解锁，可立即开启' : queue.length ? `队列 ${queue.length} / 4 · 首箱正在解锁` : profile.chestWins >= 3 ? '补给已就绪，可立即开启' : `再胜 ${3 - profile.chestWins} 场即可开启`
  document.querySelector('#chest-message')!.textContent = chestMessage
  const claimButton = document.querySelector<HTMLButtonElement>('#claim-chest')!
  claimButton.disabled = !queueReady && profile.chestWins < 3
  claimButton.textContent = queueReady ? '开启宝箱' : profile.chestWins >= 3 ? '领取补给' : '尚未就绪'
  renderChestQueue()
  const shownDeckIndex = matchStarted ? battleDeckPreset : profile.activeDeck
  const shownDeckSize = matchStarted ? battleDeckIds.length : profile.deck.length
  document.querySelector('#deck-count')!.textContent = `编队 ${shownDeckIndex + 1} / ${shownDeckSize} 张牌组`
  const battleButton = document.querySelector<HTMLButtonElement>('#hub-battle')!
  battleButton.disabled = profile.deck.length !== 8
  battleButton.textContent = profile.deck.length !== 8 ? `牌组 ${profile.deck.length} / 8` : matchStarted && !sim.result ? '返回战场' : '开始匹配'
  battleHistory.innerHTML = profile.history.length ? profile.history.map(record => {
    const resultLabel = record.result === 'win' ? '胜利' : record.result === 'lose' ? '失败' : '平局'
    const modeLabel = record.mode === 'friendly' ? '友谊' : record.mode === 'event' ? '活动' : record.mode === 'practice' ? '训练' : '排位'
    const date = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(record.playedAt)
    const delta = record.trophyDelta > 0 ? `+${record.trophyDelta}` : String(record.trophyDelta)
    return `<button type="button" class="history-row ${record.result}" data-history-id="${record.id}" aria-label="查看${date}的${resultLabel}战报"><b>${resultLabel}</b><span>♛ ${record.crownsFor} : ${record.crownsAgainst}</span><small>${modeLabel} · ${date}</small><strong>${delta}</strong><i>查看</i></button>`
  }).join('') : '<div class="history-empty">完成一场战斗后，战绩会记录在这里。</div>'
  renderQuests()
}

function openHistoryReport(record: BattleRecord): void {
  const report = record.report
  const resultLabel = record.result === 'win' ? '胜利' : record.result === 'lose' ? '失败' : '平局'
  const modeLabel = record.mode === 'friendly' ? '友谊战' : record.mode === 'event' ? '风暴冲刺' : record.mode === 'practice' ? '潮汐演练' : '奖杯对战'
  const date = new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(record.playedAt)
  historyReportTitle.textContent = `${resultLabel}战报`
  historyReportCopy.textContent = `${modeLabel} · ${report?.opponent ? `对阵 ${report.opponent} · ` : ''}${date}`
  historyReportScore.innerHTML = `<span>己方王冠</span><b>${record.crownsFor} : ${record.crownsAgainst}</b><span>敌方王冠</span>`
  historyReportStats.innerHTML = report
    ? `<span>己方部署 <b>${report.playerDeployments}</b></span><span>敌方部署 <b>${report.enemyDeployments}</b></span><span>己方法术 <b>${report.playerSpellcasts}</b></span><span>敌方法术 <b>${report.enemySpellcasts}</b></span>`
    : '<p>这是一条旧战绩，只保存了王冠与奖杯变化。</p>'
  const deck = report?.deck ?? []
  historyReportDeck.innerHTML = deck.length
    ? deck.map(cardId => {
      const card = CARDS.find(item => item.id === cardId)
      return card ? `<div class="history-deck-card" title="${card.name}">${cardIconMarkup(card, 'history-deck-icon')}<small>${card.cost}</small></div>` : ''
    }).join('')
    : '<p class="history-report-empty">未保存当局牌组。</p>'
  historyReportEvents.innerHTML = report?.events.length
    ? report.events.map((event, index) => `<div class="history-report-event${event.includes('摧毁') ? ' tower-event' : ''}"><span>${String(report.events.length - index).padStart(2, '0')}</span><p>${event}</p></div>`).join('')
    : '<p class="history-report-empty">未保存关键事件。</p>'
  const replayAvailable = Boolean(report?.actions.length && report.deck.length)
  historyReplayStatus.textContent = replayAvailable ? `已保存 ${report!.actions.length} 个部署动作` : '旧战绩仅保留文字摘要，无法播放。'
  watchReplay.disabled = !replayAvailable
  watchReplay.textContent = replayAvailable ? '观看战斗回放' : '无可用回放'
  watchReplay.onclick = () => { if (replayAvailable) startReplay(record) }
  historyReport.hidden = false
}

function closeHistoryReport(): void {
  historyReport.hidden = true
}

function renderShop(): void {
  const offers = getShop(profile)
  shopCoins.textContent = String(profile.coins)
  shopOffers.innerHTML = offers.map(offer => {
    const card = CARDS.find(item => item.id === offer.cardId)!
    const progress = profile.cards[card.id]
    const affordable = profile.coins >= offer.price
    const buttonLabel = offer.purchased ? '已购买' : affordable ? '购买补给' : '潮贝不足'
    return `<article class="shop-offer${offer.purchased ? ' purchased' : ''}"><div class="shop-offer-top">${cardIconMarkup(card, 'shop-icon')}<div><small>${kindLabel(card)} · 等级 ${progress.level}</small><strong>${card.name}</strong><p>${card.description}</p></div><b class="shop-price">${offer.price}<small>潮贝</small></b></div><div class="shop-offer-foot"><span>获得卡牌 <b>+${offer.copies}</b></span><button data-shop-buy="${offer.id}" ${offer.purchased || !affordable ? 'disabled' : ''}>${buttonLabel}</button></div></article>`
  }).join('')
  shopMessageEl.textContent = shopMessage
  shopOffers.querySelectorAll<HTMLButtonElement>('[data-shop-buy]').forEach(button => button.addEventListener('click', () => {
    const offer = buyShopOffer(profile, button.dataset.shopBuy ?? '')
    if (!offer) {
      const selectedOffer = offers.find(item => item.id === button.dataset.shopBuy)
      shopMessage = selectedOffer && profile.coins < selectedOffer.price ? '潮贝不足，完成对战或开启补给箱获得更多潮贝。' : '这份补给已经购买。'
      audioFeedback.error()
      renderShop()
      return
    }
    const card = CARDS.find(item => item.id === offer.cardId)!
    shopMessage = `已购买 ${card.name} ×${offer.copies}，今日补给已锁定。`
    audioFeedback.upgrade()
    renderProfile()
    renderLoadout()
    renderShop()
  }))
}

function renderFleet(): void {
  fleetMessageEl.textContent = fleetMessage
  if (!profile.fleet) {
    fleetContent.innerHTML = `<div class="fleet-catalog">${FLEET_CATALOG.map(item => `<article><span>${item.tag}</span><div><strong>${item.name}</strong><small>${item.motto}</small></div><button data-join-fleet="${item.id}">加入</button></article>`).join('')}</div>`
    fleetContent.querySelectorAll<HTMLButtonElement>('[data-join-fleet]').forEach(button => button.addEventListener('click', () => {
      if (!joinFleet(profile, button.dataset.joinFleet ?? '')) {
        audioFeedback.error()
        return
      }
      fleetMessage = `已加入 ${profile.fleet?.name ?? '舰队'}。`
      audioFeedback.upgrade()
      renderFleet()
    }))
    return
  }

  const currentFleet = profile.fleet
  const definition = FLEET_CATALOG.find(item => item.id === currentFleet.id)
  const requestCard = CARDS.find(card => card.id === currentFleet.requestCardId)!
  const cardProgress = profile.cards[requestCard.id]
  const requestComplete = currentFleet.donatedCopies >= 6
  fleetContent.innerHTML = `
    <div class="fleet-identity"><span>${currentFleet.tag}</span><div><strong>${currentFleet.name}</strong><small>${definition?.motto ?? '共同守住潮汐航线。'}</small></div><b>${currentFleet.role}</b></div>
    <div class="fleet-request"><div class="fleet-request-head">${cardIconMarkup(requestCard)}<div><small>成员卡牌请求</small><strong>${requestCard.name}</strong><p>${currentFleet.donatedCopies} / 6 · 你持有 ${cardProgress.copies} 张</p></div></div><i><em style="width:${Math.min(100, currentFleet.donatedCopies / 6 * 100)}%"></em></i><div class="fleet-request-foot"><span>捐赠奖励：8 潮贝 · 5 经验</span><button id="donate-fleet" ${requestComplete || cardProgress.copies < 1 ? 'disabled' : ''}>${requestComplete ? '请求完成' : cardProgress.copies < 1 ? '副本不足' : '捐赠 1 张'}</button></div></div>
    <div class="fleet-members"><div class="fleet-members-title"><span>舰队成员</span><small>${currentFleet.members.length + 1} / 30</small></div>${currentFleet.members.map(member => `<div class="fleet-member"><span>T${member.level}</span><div><strong>${member.name}</strong><small>${member.role}</small></div><b>${member.donations} 贡献</b></div>`).join('')}<div class="fleet-member player"><span>T${profile.level}</span><div><strong>潮汐哨站</strong><small>你 · ${currentFleet.role}</small></div><b>${currentFleet.donatedCopies} 贡献</b></div></div>
    <section class="fleet-chat" aria-label="舰队通讯"><div class="fleet-chat-head"><span>舰队通讯</span><small>最近 ${currentFleet.messages.length} 条</small></div><div id="fleet-chat-log" class="fleet-chat-log"></div><form id="fleet-chat-form" class="fleet-chat-form"><input id="fleet-chat-input" maxlength="60" autocomplete="off" placeholder="发送航线消息" aria-label="发送舰队消息"><button type="submit">发送</button></form></section>
    <button id="leave-fleet" class="fleet-leave">离开舰队</button>
  `
  const fleetChatLog = fleetContent.querySelector<HTMLDivElement>('#fleet-chat-log')!
  const formatMessageTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  }
  currentFleet.messages.forEach(message => {
    const row = document.createElement('div')
    row.className = `fleet-chat-message${message.player ? ' player' : ''}`
    const meta = document.createElement('div')
    meta.className = 'fleet-chat-meta'
    const author = document.createElement('strong')
    author.textContent = message.author
    const time = document.createElement('time')
    time.textContent = formatMessageTime(message.sentAt)
    meta.append(author, time)
    const text = document.createElement('p')
    text.textContent = message.text
    row.append(meta, text)
    fleetChatLog.append(row)
  })
  const fleetChatForm = fleetContent.querySelector<HTMLFormElement>('#fleet-chat-form')!
  const fleetChatInput = fleetContent.querySelector<HTMLInputElement>('#fleet-chat-input')!
  fleetChatForm.addEventListener('submit', event => {
    event.preventDefault()
    if (!sendFleetMessage(profile, fleetChatInput.value)) {
      fleetMessage = '消息不能为空。'
      audioFeedback.error()
      renderFleet()
      return
    }
    fleetMessage = '消息已发送。'
    audioFeedback.emote()
    renderFleet()
  })
  fleetContent.querySelector<HTMLButtonElement>('#donate-fleet')?.addEventListener('click', () => {
    if (!donateFleetCard(profile)) {
      fleetMessage = '当前无法捐赠：卡牌副本不足或请求已经完成。'
      audioFeedback.error()
      renderFleet()
      return
    }
    fleetMessage = `已捐赠 ${requestCard.name} ×1，获得 8 潮贝与 5 经验。`
    audioFeedback.upgrade()
    renderProfile()
    renderLoadout()
    renderFleet()
  })
  fleetContent.querySelector<HTMLButtonElement>('#leave-fleet')?.addEventListener('click', () => {
    if (!leaveFleet(profile)) return
    fleetMessage = '已离开舰队，可从舰队列表重新加入。'
    audioFeedback.reset()
    renderFleet()
  })
}

function renderSeason(): void {
  const target = SEASON_REWARDS[SEASON_REWARDS.length - 1].points
  seasonPointsEl.textContent = `${profile.seasonPoints} / ${target}`
  seasonProgressEl.style.width = `${Math.min(100, profile.seasonPoints / target * 100)}%`
  seasonMessageEl.textContent = seasonMessage
  season.querySelectorAll<HTMLButtonElement>('[data-season-tab]').forEach(button => {
    button.classList.toggle('active', button.dataset.seasonTab === seasonTab)
  })

  if (seasonTab === 'leaderboard') {
    const entries = getLeaderboard(profile)
    seasonContent.innerHTML = `<div class="leaderboard-head"><span>本地联赛排名</span><small>${entries.length} 名参赛者</small></div><div class="leaderboard-list">${entries.map((entry, index) => `<div class="leaderboard-row${entry.player ? ' player' : ''}"><span>${String(index + 1).padStart(2, '0')}</span><div><strong>${entry.name}</strong><small>${entry.fleet}</small></div><b>${entry.trophies} 杯</b></div>`).join('')}</div>`
    return
  }

  seasonContent.innerHTML = `<div class="season-rewards">${SEASON_REWARDS.map(reward => {
    const reached = profile.seasonPoints >= reward.points
    const claimed = profile.claimedSeasonRewards.includes(reward.points)
    const card = reward.cardId ? CARDS.find(item => item.id === reward.cardId) : null
    const rewardCopy = `${reward.coins} 潮贝${card && reward.copies ? ` · ${card.name} ×${reward.copies}` : ''}`
    return `<article class="season-reward${reached ? ' reached' : ''}${claimed ? ' claimed' : ''}"><span>${reward.points}</span><div><strong>${reward.label}</strong><small>${rewardCopy}</small></div><button data-claim-season="${reward.points}" ${!reached || claimed ? 'disabled' : ''}>${claimed ? '已领取' : reached ? '领取' : '未解锁'}</button></article>`
  }).join('')}</div>`
  seasonContent.querySelectorAll<HTMLButtonElement>('[data-claim-season]').forEach(button => button.addEventListener('click', () => {
    const reward = claimSeasonReward(profile, Number(button.dataset.claimSeason))
    if (!reward) {
      audioFeedback.error()
      return
    }
    const card = reward.cardId ? CARDS.find(item => item.id === reward.cardId) : null
    seasonMessage = `已领取 ${reward.label}：${reward.coins} 潮贝${card && reward.copies ? ` 与 ${card.name} ×${reward.copies}` : ''}。`
    audioFeedback.upgrade()
    renderProfile()
    renderLoadout()
    renderSeason()
  }))
}

function renderFriends(): void {
  friendsList.innerHTML = FRIENDS.map(friend => `<div class="friend-row${friend.online ? ' online' : ' offline'}"><span>${friend.online ? '在线' : '离线'}</span><div><strong>${friend.name}</strong><small>${friend.fleet} · ${friend.trophies} 杯</small></div><button data-challenge-friend="${friend.id}" ${friend.online ? '' : 'disabled'}>${friend.online ? '发起约战' : '暂不可用'}</button></div>`).join('')
  friendsList.querySelectorAll<HTMLButtonElement>('[data-challenge-friend]').forEach(button => button.addEventListener('click', () => {
    const friend = FRIENDS.find(item => item.id === button.dataset.challengeFriend)
    if (!friend || !friend.online) {
      audioFeedback.error()
      return
    }
    friendsMessage.textContent = `${friend.name} 已接受挑战，正在进入友谊战。`
    audioFeedback.emote()
    window.setTimeout(() => {
      friends.hidden = true
      startMatchmaking('friendly', 'friendly', friend.name)
    }, 260)
  }))
}

function renderRoad(): void {
  const tier = roadTier(profile.trophies)
  roadMilestones.innerHTML = TROPHY_MILESTONES.map(milestone => {
    const reached = profile.trophies >= milestone.trophies
    const claimed = profile.claimedTrophyRewards.includes(milestone.trophies)
    const current = milestone.trophies === tier.next
    const rewardText = milestone.cardId && milestone.copies ? `${milestone.coins} 潮贝 + ${CARDS.find(card => card.id === milestone.cardId)?.name ?? '卡牌'} ×${milestone.copies}` : `${milestone.coins} 潮贝`
    const buttonText = claimed ? '已领取' : reached ? '领取' : '未解锁'
    return `<div class="road-milestone${reached ? ' reached' : ''}${current ? ' current' : ''}"><div class="road-node"><b>${milestone.trophies}</b><i></i></div><div class="road-reward"><strong>${milestone.label}</strong><small>${rewardText}</small></div><button data-claim-road="${milestone.trophies}" ${!reached || claimed ? 'disabled' : ''}>${buttonText}</button></div>`
  }).join('')
  roadMessageEl.textContent = roadMessage
  roadMilestones.querySelectorAll<HTMLButtonElement>('[data-claim-road]').forEach(button => button.addEventListener('click', () => {
    const trophyValue = Number(button.dataset.claimRoad)
    const reward = claimTrophyReward(profile, trophyValue)
    if (!reward) {
      audioFeedback.error()
      return
    }
    const card = reward.cardId ? CARDS.find(item => item.id === reward.cardId) : null
    roadMessage = `已领取 ${reward.label}：${reward.coins} 潮贝${card && reward.copies ? ` 与 ${card.name} ×${reward.copies}` : ''}`
    audioFeedback.upgrade()
    renderProfile()
    renderRoad()
  }))
}

function renderLoadout(): void {
  const deckReady = profile.deck.length === 8
  const presetLabels = ['均衡推进', '快速突袭', '重装控场']
  deckPresetControls.innerHTML = profile.decks.map((deck, index) => `
    <button type="button" role="tab" data-deck-preset="${index}" aria-selected="${index === profile.activeDeck}" aria-controls="deck-slots" tabindex="${index === profile.activeDeck ? '0' : '-1'}" class="deck-preset${index === profile.activeDeck ? ' active' : ''}">
      <span>编队 ${index + 1}</span><small>${presetLabels[index] ?? '自定义'} / ${deck.length} 张</small>
    </button>
  `).join('')
  document.querySelector('#deck-editor-count')!.textContent = `${profile.deck.length} / 8`
  const deckWarning = document.querySelector<HTMLElement>('#deck-editor-warning')!
  deckWarning.textContent = deckMessage || (deckReady ? '下一场将使用此牌组' : `还需加入 ${8 - profile.deck.length} 张卡牌`)
  deckWarning.classList.toggle('ready', deckReady && !deckMessageError)
  deckWarning.classList.toggle('error', deckMessageError)
  deckSlots.innerHTML = profile.deck.map((cardId, index) => {
    const card = CARDS.find(item => item.id === cardId)!
    return `<div class="deck-slot" draggable="true" data-deck-index="${index}"><button class="deck-slot-card${selectedDetailId === card.id ? ' selected' : ''}" data-detail-card="${card.id}" title="查看 ${card.name}"><span>${index + 1}</span>${cardIconMarkup(card)}<b>${card.name}</b><strong>${card.cost}</strong></button><div class="deck-slot-actions"><button class="deck-slot-move" data-deck-move="-1" data-deck-index="${index}" title="卡牌前移">←</button><button class="deck-slot-remove" data-deck-action="${card.id}" title="移出 ${card.name}">×</button><button class="deck-slot-move" data-deck-move="1" data-deck-index="${index}" title="卡牌后移">→</button></div></div>`
  }).join('')
  const filteredCards = CARDS.filter(card => collectionFilter === 'all' || collectionFilter === 'units' && card.kind !== 'spell' && card.kind !== 'building' || collectionFilter === 'spells' && card.kind === 'spell' || collectionFilter === 'buildings' && card.kind === 'building')
  loadoutCards.innerHTML = filteredCards.map(card => {
    const progress = profile.cards[card.id]
    const quote = upgradeQuote(profile, card.id)
    const copyPercent = quote.maxed ? 100 : Math.min(100, progress.copies / quote.copiesNeeded * 100)
    const inDeck = profile.deck.includes(card.id)
    return `<div class="collection-card${inDeck ? ' in-deck' : ''}"><button class="loadout-card${selectedDetailId === card.id ? ' selected' : ''}" data-detail-card="${card.id}">${cardIconMarkup(card)}<div><strong>${card.name}</strong><small>等级 ${progress.level} · <em class="rarity-badge ${rarityClass(card)}">${rarityLabel(card)}</em> · ${kindLabel(card)} · ${targetShortLabel(card)}</small><i><em style="width:${copyPercent}%"></em></i></div><b>${card.cost}</b></button><button class="collection-deck-action" data-deck-action="${card.id}">${inDeck ? '移出' : '加入'}</button></div>`
  }).join('')
  loadout.querySelectorAll<HTMLButtonElement>('[data-collection-filter]').forEach(button => {
    const filter = button.dataset.collectionFilter as typeof collectionFilter
    button.classList.toggle('active', filter === collectionFilter)
    button.setAttribute('aria-selected', String(filter === collectionFilter))
    button.onclick = () => {
      collectionFilter = filter
      renderLoadout()
    }
  })
  deckPresetControls.querySelectorAll<HTMLButtonElement>('[data-deck-preset]').forEach(button => {
    button.addEventListener('click', () => changeDeckPreset(Number(button.dataset.deckPreset)))
    button.addEventListener('keydown', event => {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      const nextIndex = (profile.activeDeck + direction + profile.decks.length) % profile.decks.length
      changeDeckPreset(nextIndex)
      deckPresetControls.querySelector<HTMLButtonElement>(`[data-deck-preset="${nextIndex}"]`)?.focus()
    })
  })
  loadout.querySelectorAll<HTMLButtonElement>('[data-detail-card]').forEach(button => {
    button.addEventListener('click', () => {
      selectedDetailId = button.dataset.detailCard ?? CARDS[0].id
      renderLoadout()
      if (window.matchMedia('(max-width: 520px)').matches) {
        cardDetail.closest<HTMLElement>('.loadout-panel')?.scrollTo({ top: 0, behavior: 'auto' })
      }
    })
  })
  loadout.querySelectorAll<HTMLButtonElement>('[data-deck-action]').forEach(button => {
    button.addEventListener('click', () => changeDeck(button.dataset.deckAction ?? ''))
  })
  deckSlots.querySelectorAll<HTMLButtonElement>('[data-deck-move]').forEach(button => button.addEventListener('click', () => {
    reorderDeckTo(Number(button.dataset.deckIndex), Number(button.dataset.deckIndex) + Number(button.dataset.deckMove))
  }))
  deckSlots.querySelectorAll<HTMLElement>('.deck-slot').forEach(slot => {
    slot.addEventListener('dragstart', event => {
      event.dataTransfer?.setData('deck-index', slot.dataset.deckIndex ?? '')
      slot.classList.add('dragging')
    })
    slot.addEventListener('dragend', () => slot.classList.remove('dragging'))
    slot.addEventListener('dragover', event => { event.preventDefault(); slot.classList.add('drop-target') })
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'))
    slot.addEventListener('drop', event => {
      event.preventDefault()
      slot.classList.remove('drop-target')
      const from = Number(event.dataTransfer?.getData('deck-index'))
      reorderDeckTo(from, Number(slot.dataset.deckIndex))
    })
  })

  const baseCard = CARDS.find(card => card.id === selectedDetailId) ?? CARDS[0]
  const battleCard = cardForBattle(baseCard, profile)
  const progress = profile.cards[baseCard.id]
  const quote = upgradeQuote(profile, baseCard.id)
  const inDeck = profile.deck.includes(baseCard.id)
  const attackStats = baseCard.kind !== 'spell' && baseCard.hitSpeed
    ? `<span>攻速 <b>${baseCard.hitSpeed.toFixed(2).replace(/0$/, '')} 秒</b></span><span>攻击起手 <b>${(baseCard.attackWindup ?? 0).toFixed(2).replace(/0$/, '')} 秒</b></span><span>首击准备 <b>${(baseCard.firstAttackDelay ?? 0).toFixed(2).replace(/0$/, '')} 秒</b></span><span>转火 <b>${(baseCard.retargetDelay ?? 0).toFixed(2).replace(/0$/, '')} 秒</b></span><span>秒伤 <b>${Math.round(battleCard.damage / baseCard.hitSpeed)}</b></span>`
    : ''
  const projectileStats = baseCard.projectileSpeed
    ? `<span>弹速 <b>${baseCard.projectileSpeed} 格/秒</b></span>`
    : ''
  const weightStats = baseCard.kind !== 'spell' && baseCard.weight
    ? `<span>重量 <b>${weightLabel(baseCard.weight)}</b></span><span>抗击退 <b>${Math.round((baseCard.knockbackResistance ?? 0) * 100)}%</b></span>`
    : ''
  const targetingStats = baseCard.kind !== 'spell'
    ? `<span>索敌 <b>${targetPriorityLabel(baseCard.targetPriority)}</b></span>`
    : ''
  const effectStats = [
    baseCard.id === 'undertow' ? '<span>状态 <b>减速 2.4 秒</b></span>' : '',
    baseCard.id === 'static-field' ? '<span>状态 <b>眩晕 0.85 秒</b></span>' : '',
    baseCard.id === 'mending-current' ? '<span>治疗 <b>部队 48 · 塔 32</b></span>' : '',
    baseCard.id === 'gale-pulse' ? '<span>状态 <b>最多击退 5 格</b></span>' : '',
    baseCard.deathDamage && baseCard.deathRadius ? `<span>阵亡 <b>爆裂 ${baseCard.deathRadius} 格</b></span>` : '',
    baseCard.splashRadius ? `<span>范围 <b>溅射 ${baseCard.splashRadius} 格</b></span>` : '',
    baseCard.spellRadius ? `<span>作用 <b>${baseCard.spellRadius} 格</b></span>` : '',
    baseCard.chargeDistance && baseCard.chargeMultiplier ? `<span>冲锋 <b>${baseCard.chargeDistance} 格 · ${baseCard.chargeMultiplier} 倍</b></span>` : '',
    baseCard.shield ? `<span>护盾 <b>${baseCard.shield}</b></span>` : '',
    baseCard.spawnCount && baseCard.spawnCount > 1 ? `<span>编队 <b>${baseCard.spawnCount} 个单位</b></span>` : '',
  ].join('')
  const requirement = quote.maxed ? '已达到最高等级' : `${progress.copies} / ${quote.copiesNeeded} 卡牌 · ${quote.coinCost} 潮贝`
  const buttonLabel = quote.maxed ? '已满级' : quote.canUpgrade ? `升级到 ${progress.level + 1} 级` : '资源不足'
  cardDetail.innerHTML = `
    <div class="detail-hero">${cardIconMarkup(baseCard, 'detail-icon')}<div><small><em class="rarity-badge ${rarityClass(baseCard)}">${rarityLabel(baseCard)}</em> · ${kindLabel(baseCard)}</small><h3>${baseCard.name}</h3><p>${baseCard.description}</p></div><b>${baseCard.cost}</b></div>
    <div class="detail-level"><span>卡牌等级</span><strong>${progress.level}</strong></div>
    <div class="detail-stats"><span>生命值 <b>${battleCard.hp || '不适用'}</b></span><span>伤害 <b>${battleCard.damage}</b></span>${attackStats}${projectileStats}<span>射程 <b>${baseCard.range}</b></span><span>速度 <b>${speedLabel(baseCard.speed)}</b></span>${weightStats}${targetingStats}<span>目标 <b>${targetLabel(baseCard)}</b></span>${baseCard.kind === 'building' ? '<span>持续时间 <b>30 秒</b></span>' : ''}${effectStats}</div>
    <div class="upgrade-copy"><span>${requirement}</span><small>每级提升战斗数值 7%</small></div>
    <button id="upgrade-card" class="upgrade-button" ${quote.canUpgrade ? '' : 'disabled'}>${buttonLabel}</button>
    <button id="detail-deck-action" class="detail-deck-action" ${!inDeck && deckReady ? 'disabled' : ''}>${inDeck ? '移出当前牌组' : deckReady ? '牌组已满' : '加入当前牌组'}</button>
  `
  cardDetail.querySelector<HTMLButtonElement>('#upgrade-card')!.addEventListener('click', () => {
    if (!upgradeCard(profile, baseCard.id)) {
      audioFeedback.error()
      return
    }
    audioFeedback.upgrade()
    profile = loadProfile()
    renderProfile()
    renderLoadout()
  })
  cardDetail.querySelector<HTMLButtonElement>('#detail-deck-action')!.addEventListener('click', () => changeDeck(baseCard.id))
}

function changeDeckPreset(index: number): void {
  if (!selectDeckPreset(profile, index)) return
  selectedDetailId = profile.deck[0] ?? CARDS[0].id
  deckMessage = `已切换到编队 ${index + 1}，下一场战斗生效。`
  deckMessageError = false
  audioFeedback.upgrade()
  renderProfile()
  renderLoadout()
}

function changeDeck(cardId: string): void {
  const result = toggleDeckCard(profile, cardId)
  if (result === 'full') {
    deckMessage = '牌组已满，请先移出一张卡牌。'
    deckMessageError = true
    audioFeedback.error()
  } else if (result === 'missing') {
    deckMessage = '未找到这张卡牌。'
    deckMessageError = true
    audioFeedback.error()
  } else {
    const card = CARDS.find(item => item.id === cardId)!
    deckMessage = result === 'added' ? `${card.name} 已加入下一场牌组。` : `${card.name} 已移出，补足 8 张后才能关闭。`
    deckMessageError = false
    audioFeedback.upgrade()
  }
  renderProfile()
  renderLoadout()
}

function reorderDeckTo(fromIndex: number, toIndex: number): void {
  if (!moveDeckCard(profile, fromIndex, toIndex)) {
    audioFeedback.error()
    return
  }
  deckMessage = '牌组顺序已保存，下一场会按新顺序循环。'
  deckMessageError = false
  audioFeedback.upgrade()
  renderProfile()
  renderLoadout()
}

function renderSoundState(): void {
  const muted = audioFeedback.isMuted()
  soundToggle.textContent = muted ? '关闭' : '开启'
  soundToggle.classList.toggle('off', muted)
  soundToggle.setAttribute('aria-pressed', String(!muted))
}

function renderResult(resultValue: 'win' | 'lose' | 'draw', snapshot: ReturnType<BattleSimulation['snapshot']>): void {
  const replaying = replaySession !== null
  resultAvatar.className = `result-avatar ${resultValue}`
  resultTitle.textContent = replaying ? '战斗回放结束' : resultValue === 'win' ? '潮汐王冠归你' : resultValue === 'lose' ? '防线已沉没' : '潮汐暂时平衡'
  resultCopy.textContent = replaying ? '已按保存的部署时间线重演本局。回放不会影响奖杯、奖励或战绩。' : snapshot.mode === 'practice' ? '潮汐演练完成：奖杯、资源、任务、宝箱与战绩均保持不变。' : resultValue === 'draw' ? '双方塔群损失相同，本局以平局结束。' : snapshot.mode === 'friendly' ? '友谊战完成：奖杯、赛季点数与宝箱进度保持不变。' : snapshot.mode === 'storm' ? '风暴冲刺完成，战绩与活动奖励已保存。' : '战绩与奖励已保存到潮汐航站。'
  resultScore.innerHTML = `<span>己方</span><b>${snapshot.stats.enemyTowersDown} : ${snapshot.stats.playerTowersDown}</b><span>敌方</span>`
  resultReward.classList.remove('with-chest')
  if (replaying) {
    resultReward.innerHTML = '<span>历史回放 <b>档案不变</b></span>'
  } else if (snapshot.mode === 'practice') {
    resultReward.innerHTML = '<span>训练模式 <b>档案不变</b></span>'
  } else if (lastReward) {
    const trophyText = lastReward.trophies > 0 ? `+${lastReward.trophies}` : String(lastReward.trophies)
    const chestMarkup = snapshot.mode === 'ranked' ? `<span>补给箱 <b>${lastReward.chestQueued ? '已入队' : `${lastReward.chestWins ?? 0}/3`}</b></span>` : ''
    resultReward.classList.toggle('with-chest', snapshot.mode === 'ranked')
    resultReward.innerHTML = `<span>奖杯 <b>${trophyText}</b></span><span>潮贝 <b>+${lastReward.coins}</b></span><span>经验 <b>+${lastReward.xp}</b></span>${chestMarkup}`
  }
  resultStats.innerHTML = `<span>己方部署 <b>${snapshot.stats.playerDeployments}</b></span><span>敌方部署 <b>${snapshot.stats.enemyDeployments}</b></span><span>敌塔摧毁 <b>${snapshot.stats.enemyTowersDown}</b></span><span>己塔损失 <b>${snapshot.stats.playerTowersDown}</b></span>`
  resultEvents.innerHTML = snapshot.logs.slice(0, 8).map((entry, index) => `<div class="result-event${entry.includes('摧毁') ? ' tower-event' : ''}"><span>${String(snapshot.logs.length - index).padStart(2, '0')}</span><p>${entry}</p></div>`).join('') || '<p class="result-events-empty">本局没有可回放事件。</p>'
  document.querySelector('#again')!.textContent = replaying ? '重新观看' : '再来一局'
}

function resetBattleSoundTracking(): void {
  heardEffectIds.clear()
  soundTowerState.clear()
  displayedCrownScore = null
  crownsEl?.classList.remove('score-pop', 'player-score', 'enemy-score')
}

function playBattleSounds(snapshot: ReturnType<BattleSimulation['snapshot']>): void {
  snapshot.effects.forEach(effect => {
    if (heardEffectIds.has(effect.id)) return
    heardEffectIds.add(effect.id)
    if (effect.kind === 'impact') audioFeedback.hit()
    if (effect.kind === 'death') audioFeedback.death()
  })
  snapshot.towers.forEach(tower => {
    const previous = soundTowerState.get(tower.id)
    if (previous && !previous.active && tower.active && tower.hp > 0) audioFeedback.towerActive()
    if (previous && previous.hp > 0 && tower.hp <= 0) audioFeedback.towerDown()
    soundTowerState.set(tower.id, { hp: tower.hp, active: tower.active })
  })
}

function showPhaseBanner(phase: 'surge' | 'overtime'): void {
  if (phaseBannerTimer !== null) window.clearTimeout(phaseBannerTimer)
  phaseBanner.className = `phase-banner ${phase}`
  phaseBanner.querySelector('span')!.textContent = phase === 'overtime' ? '决胜' : '增幅'
  phaseBanner.querySelector('strong')!.textContent = phase === 'overtime' ? '突然死亡' : '双倍能量'
  phaseBanner.querySelector('small')!.textContent = phase === 'overtime' ? '下一座塔决定胜负' : '潮汐能量恢复加快'
  phaseBanner.hidden = false
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 900 : 1500
  phaseBannerTimer = window.setTimeout(() => {
    phaseBanner.hidden = true
    phaseBannerTimer = null
  }, duration)
}

function resetPhaseBanner(): void {
  if (phaseBannerTimer !== null) window.clearTimeout(phaseBannerTimer)
  phaseBannerTimer = null
  announcedPhase = 'opening'
  phaseBanner.hidden = true
  phaseBanner.className = 'phase-banner'
}

function resetPracticeCoach(): void {
  practiceStep = 0
  practiceCoach.hidden = true
}

function renderPracticeCoach(snapshot: ReturnType<BattleSimulation['snapshot']>): void {
  if (!matchStarted || snapshot.mode !== 'practice' || snapshot.result || snapshot.countdown > 0) {
    practiceCoach.hidden = true
    return
  }
  if (practiceStep === 0 && snapshot.stats.playerDeployments > 0) practiceStep = 1
  if (practiceStep === 1 && snapshot.units.some(unit => unit.side === 'player' && unit.x < 49)) practiceStep = 2
  if (practiceStep === 2 && snapshot.stats.playerSpellcasts > 0) practiceStep = 3
  const steps = [
    ['1 / 4', '部署一张单位牌', '选择底部手牌，点击己方半场任意横向位置。'],
    ['2 / 4', '让部队穿过河道', '观察部队如何从落点寻找目标并推进。'],
    ['3 / 4', '用一张法术牌', '法术可以压低一群敌军，或把桥头重新拉回你的节奏。'],
    ['4 / 4', '守住两座外塔', '留一点能量应对反击，再寻找主塔突破口。'],
  ] as const
  const [index, title, copy] = steps[practiceStep]
  practiceCoach.querySelector('span')!.textContent = `潮汐演练 · ${index}`
  practiceCoach.querySelector('strong')!.textContent = title
  practiceCoach.querySelector('small')!.textContent = copy
  practiceCoach.hidden = false
}

function advanceReplayTimeline(): void {
  if (!replaySession || sim.snapshot().paused) return
  const elapsed = sim.duration - sim.time
  while (replaySession.nextIndex < replaySession.actions.length && replaySession.actions[replaySession.nextIndex].at <= elapsed + 0.05) {
    sim.replayAction(replaySession.actions[replaySession.nextIndex])
    replaySession.nextIndex += 1
  }
}

function renderReplayDock(): void {
  if (!replaySession) {
    replayDock.hidden = true
    return
  }
  const elapsed = Math.max(0, sim.duration - sim.time)
  const finalActionAt = replaySession.actions[replaySession.actions.length - 1]?.at ?? 0
  replayDock.hidden = false
  replayTime.textContent = `${formatTime(elapsed)} / ${formatTime(sim.duration)}`
  replayActions.textContent = replaySession.nextIndex >= replaySession.actions.length ? '动作已重演，等待战斗结算' : `${replaySession.nextIndex} / ${replaySession.actions.length} 动作`
  replayProgress.style.width = `${Math.min(100, elapsed / Math.max(1, finalActionAt) * 100)}%`
  replayDock.querySelectorAll<HTMLButtonElement>('[data-replay-speed]').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.replaySpeed) === replayRate)
    button.setAttribute('aria-pressed', String(Number(button.dataset.replaySpeed) === replayRate))
  })
}

function renderHud(): void {
  advanceReplayTimeline()
  const snapshot = sim.snapshot()
  renderReplayDock()
  playBattleSounds(snapshot)
  timer.textContent = formatTime(snapshot.time)
  phaseEl.textContent = snapshot.mode === 'storm' ? snapshot.phase === 'overtime' ? '风暴加时 · 能量狂潮' : '风暴冲刺 · 快速能量' : snapshot.mode === 'friendly' ? snapshot.phase === 'overtime' ? '友谊加时 · 能量狂潮' : '友谊战 · 标准节奏' : snapshot.mode === 'practice' ? snapshot.phase === 'overtime' ? '演练加时 · 能量狂潮' : '潮汐演练 · 较慢对手' : snapshot.phase === 'overtime' ? '加时赛 · 能量狂潮' : snapshot.phase === 'surge' ? '潮汐增幅 · 双倍能量' : '标准节奏'
  phaseEl.className = snapshot.phase === 'overtime' ? 'overtime' : snapshot.phase === 'surge' ? 'surge' : ''
  if (matchStarted && snapshot.countdown <= 0 && snapshot.phase !== announcedPhase) {
    announcedPhase = snapshot.phase
    if (snapshot.phase !== 'opening') showPhaseBanner(snapshot.phase)
  }
  const crownScore = `${snapshot.stats.enemyTowersDown}:${snapshot.stats.playerTowersDown}`
  crownsEl.innerHTML = `<i class="score-sigil" aria-hidden="true"></i>${snapshot.stats.enemyTowersDown} : ${snapshot.stats.playerTowersDown}<i class="score-sigil enemy" aria-hidden="true"></i>`
  if (displayedCrownScore !== null && displayedCrownScore !== crownScore && matchStarted) {
    const [previousPlayer, previousEnemy] = displayedCrownScore.split(':').map(Number)
    const playerScored = snapshot.stats.enemyTowersDown > previousPlayer
    const enemyScored = snapshot.stats.playerTowersDown > previousEnemy
    crownsEl.classList.remove('score-pop', 'player-score', 'enemy-score')
    void crownsEl.offsetWidth
    crownsEl.classList.add('score-pop', playerScored ? 'player-score' : enemyScored ? 'enemy-score' : '')
  }
  displayedCrownScore = crownScore
  rateEl.textContent = `+${snapshot.manaRate.toFixed(2)}/s`
  mana.innerHTML = `${Math.floor(snapshot.mana)}<span>/10</span>`
  manaBar.style.width = `${snapshot.mana * 10}%`
  health.innerHTML = healthMarkup('player', snapshot.towers)
  enemyHealth.innerHTML = healthMarkup('enemy', snapshot.towers)
  logText.textContent = snapshot.logs[0] || ''
  logHistory.innerHTML = snapshot.logs.slice(0, 5).map((entry, index) => `<div class="log-event${index === 0 ? ' current' : ''}"><span>${String(snapshot.logs.length - index).padStart(2, '0')}</span><p>${entry}</p></div>`).join('')
  pause.textContent = snapshot.paused ? '继续' : '暂停'
  pauseOverlay.hidden = !snapshot.paused || !loadout.hidden || !hub.hidden
  countdownEl.hidden = snapshot.countdown <= 0 || snapshot.paused
  countdownEl.textContent = String(Math.max(1, Math.ceil(snapshot.countdown)))
  const showVersus = matchStarted && snapshot.countdown > 0 && !snapshot.paused
  matchVersus.hidden = !showVersus
  if (showVersus) {
    versusEnemy.textContent = matchOpponent
    versusMode.textContent = snapshot.mode === 'storm' ? '风暴冲刺' : snapshot.mode === 'friendly' ? '友谊约战' : snapshot.mode === 'practice' ? '潮汐演练' : '奖杯对战'
  }
  renderPracticeCoach(snapshot)
  renderCards(snapshot.hand, snapshot.mana, snapshot.countdown > 0 || snapshot.paused || replaySession !== null)
  const displayedDeckIds = matchStarted ? battleDeckIds : profile.deck
  const averageCost = displayedDeckIds.reduce((total, cardId) => total + (CARDS.find(card => card.id === cardId)?.cost ?? 0), 0) / Math.max(1, displayedDeckIds.length)
  deckAverage.textContent = `均费 ${averageCost.toFixed(1)}`
  nextCardContent.innerHTML = `${cardIconMarkup(snapshot.nextCard, 'next-icon')}<span>${snapshot.nextCard.name}</span><b>${snapshot.nextCard.cost}</b>`
  if (snapshot.result) {
    if (!handledResult) {
      if (!replaySession) {
        const report: BattleReport = {
          opponent: matchOpponent,
          deck: [...battleDeckIds],
          playerDeployments: snapshot.stats.playerDeployments,
          enemyDeployments: snapshot.stats.enemyDeployments,
          playerSpellcasts: snapshot.stats.playerSpellcasts,
          enemySpellcasts: snapshot.stats.enemySpellcasts,
          events: snapshot.logs,
          actions: sim.replayActions(),
        }
        lastReward = applyBattleResult(profile, snapshot.result, snapshot.stats.enemyTowersDown, snapshot.stats.playerTowersDown, selectedMatchCategory, report)
        renderProfile()
        renderLoadout()
      }
      audioFeedback.result(snapshot.result)
      handledResult = true
    }
    renderResult(snapshot.result, snapshot)
    result.hidden = false
  } else {
    result.hidden = true
  }
}

function clearDeploymentPreview(): void {
  game.registry.set('deploymentPreview', null)
  arena.classList.remove('preview-active', 'preview-left', 'preview-right', 'spell-preview')
  arena.style.removeProperty('--deploy-y')
  arena.style.removeProperty('--deploy-x')
  arena.style.removeProperty('--deploy-min')
  arena.style.removeProperty('--spell-radius')
  delete arena.dataset.deployZone
  delete arena.dataset.deployTerrain
  delete arena.dataset.frontline
}

function startCardDrag(card: Card, button: HTMLButtonElement, event: PointerEvent): void {
  if (replaySession || button.disabled || activeCardDrag || event.pointerType === 'mouse' && event.button !== 0) return
  event.preventDefault()
  selected = card
  const ghost = document.createElement('div')
  ghost.className = 'card-drag-ghost'
  ghost.innerHTML = `${cardIconMarkup(card, 'card-drag-icon')}<span>${card.name}</span><b>${card.cost}</b>`
  document.body.appendChild(ghost)
  activeCardDrag = { card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, moved: false, button, ghost }
  button.classList.add('dragging-card')
  button.setPointerCapture(event.pointerId)
  updateCardDrag(event)
}

function updateCardDrag(event: PointerEvent): void {
  const drag = activeCardDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY)
  if (distance > 8) drag.moved = true
  drag.ghost.style.transform = `translate3d(${event.clientX + 14}px, ${event.clientY - 54}px, 0)`
  const bounds = arena.getBoundingClientRect()
  const insideArena = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  if (insideArena) updatePreview(event.clientX, event.clientY)
  else clearDeploymentPreview()
  if (event.pointerType === 'touch') event.preventDefault()
}

function finishCardDrag(event: PointerEvent, cancelled = false): void {
  const drag = activeCardDrag
  if (!drag || drag.pointerId !== event.pointerId) return
  activeCardDrag = null
  if (drag.button.hasPointerCapture(event.pointerId)) drag.button.releasePointerCapture(event.pointerId)
  drag.button.classList.remove('dragging-card')
  drag.ghost.remove()
  suppressCardClick = true
  window.setTimeout(() => { suppressCardClick = false }, 0)
  if (cancelled) {
    selected = null
    clearDeploymentPreview()
    renderHud()
    return
  }
  if (!drag.moved) {
    selected = drag.card
    arena.classList.add('preview-active')
    arena.classList.toggle('spell-preview', drag.card.kind === 'spell')
    renderHud()
    return
  }
  const bounds = arena.getBoundingClientRect()
  const insideArena = event.clientX >= bounds.left && event.clientX <= bounds.right && event.clientY >= bounds.top && event.clientY <= bounds.bottom
  if (insideArena) {
    deployAt(event.clientX, event.clientY)
    return
  }
  selected = null
  clearDeploymentPreview()
  renderHud()
}

function deployAt(clientX: number, clientY?: number): void {
  if (replaySession) return
  if (!selected) return
  const bounds = arena.getBoundingClientRect()
  const fieldPosition = Math.max(.04, Math.min(.96, (clientX - bounds.left) / bounds.width))
  const lane = (fieldPosition < .5 ? 0 : 1) as Lane
  const position = clientY === undefined ? 0.75 : (clientY - bounds.top) / bounds.height
  if (sim.deploy(selected, lane, position, fieldPosition)) {
    audioFeedback.deploy()
    selected = null
    clearDeploymentPreview()
  } else audioFeedback.error()
  renderHud()
}

function updatePreview(clientX: number, clientY: number): void {
  if (!selected) return
  arena.classList.add('preview-active')
  arena.classList.toggle('spell-preview', selected.kind === 'spell')
  const bounds = arena.getBoundingClientRect()
  const fieldPosition = Math.max(.04, Math.min(.96, (clientX - bounds.left) / bounds.width))
  const lane = (fieldPosition < .5 ? 0 : 1) as Lane
  const deploymentMinimum = selected.kind === 'spell' ? 0 : sim.deploymentMinimum(lane)
  const pointerPosition = (clientY - bounds.top) / bounds.height
  arena.classList.toggle('preview-left', lane === 0)
  arena.classList.toggle('preview-right', lane === 1)
  arena.style.setProperty('--deploy-y', `${Math.max(0, Math.min(100, (clientY - bounds.top) / bounds.height * 100))}%`)
  arena.style.setProperty('--deploy-x', `${fieldPosition * 100}%`)
  arena.style.setProperty('--deploy-min', `${deploymentMinimum * 100}%`)
  arena.dataset.frontline = selected.kind === 'spell' ? 'spell' : deploymentMinimum < 0.52 ? 'advanced' : 'home'
  if (selected.kind === 'spell') arena.style.setProperty('--spell-radius', `${Math.min(bounds.width, bounds.height) * (selected.spellRadius ?? 20) / 100}px`)
  const overRiver = selected.kind !== 'spell'
    && !selected.airborne
    && pointerPosition > 0.475
    && pointerPosition < 0.525
    && ![0.275, 0.725].some(bridge => Math.abs(fieldPosition - bridge) <= 0.075)
  const valid = sim.canDeployAt(selected, lane, pointerPosition, fieldPosition)
  arena.dataset.deployTerrain = overRiver ? 'river' : 'open'
  arena.dataset.deployZone = valid ? 'ready' : 'blocked'
  game.registry.set('deploymentPreview', {
    cardId: selected.id,
    kind: selected.kind,
    lane,
    fieldX: fieldPosition,
    position: Math.max(.04, Math.min(.96, pointerPosition)),
    valid,
    radius: selected.spellRadius,
  })
}

function holdPause(): void {
  overlayHeldPause = !sim.paused && !sim.result
  if (overlayHeldPause) sim.setPaused(true)
}

function releasePause(): void {
  if (overlayHeldPause) sim.setPaused(false)
  overlayHeldPause = false
}

function openHub(keepPause = false): void {
  if (!keepPause) holdPause()
  renderProfile()
  hub.hidden = false
}

function closeHub(): void {
  hub.hidden = true
  releasePause()
}

function openLoadout(keepPause = false): void {
  if (!keepPause) holdPause()
  renderLoadout()
  loadout.hidden = false
}

function closeLoadout(): void {
  if (profile.deck.length !== 8) {
    deckMessage = `牌组需要 8 张卡牌，当前为 ${profile.deck.length} 张。`
    deckMessageError = true
    audioFeedback.error()
    renderLoadout()
    return
  }
  loadout.hidden = true
  if (!matchStarted) {
    openHub(true)
    return
  }
  releasePause()
}

function beginMatch(): void {
  matching.hidden = true
  replaySession = null
  document.querySelector('#hub-button')!.textContent = '大厅'
  matchStarted = true
  handledResult = false
  lastReward = null
  selected = null
  resetPhaseBanner()
  resetPracticeCoach()
  result.hidden = true
  document.querySelector('#enemy-name')!.textContent = `敌方 · ${matchOpponent}`
  sim.setMode(selectedMode)
  loadActiveDeckIntoBattle()
  resetBattleSoundTracking()
  renderHud()
}

function startReplay(record: BattleRecord): void {
  const report = record.report
  if (!report?.actions.length || !report.deck.length) return
  const replayMode: BattleMode = record.mode === 'event' ? 'storm' : record.mode === 'friendly' ? 'friendly' : record.mode === 'practice' ? 'practice' : 'ranked'
  const replayDeck = report.deck.map(id => CARDS.find(card => card.id === id)).filter((card): card is Card => Boolean(card)).map(card => cardForBattle(card, profile))
  if (!replayDeck.length) return
  replaySession = { record, actions: report.actions.map(action => ({ ...action })), nextIndex: 0 }
  replayRate = 1
  game.registry.set('replayRate', replayRate)
  selectedMode = replayMode
  selectedMatchCategory = record.mode
  matchOpponent = report.opponent
  battleDeckIds = [...report.deck]
  sim.setMode(replayMode)
  sim.setPlayerDeck(replayDeck)
  sim.beginReplay()
  matchStarted = true
  handledResult = false
  lastReward = null
  selected = null
  overlayHeldPause = false
  resetPhaseBanner()
  resetPracticeCoach()
  resetBattleSoundTracking()
  result.hidden = true
  historyReport.hidden = true
  hub.hidden = true
  document.querySelector('#hub-button')!.textContent = '退出回放'
  document.querySelector('#enemy-name')!.textContent = `回放对手 · ${matchOpponent}`
  renderHud()
}

function loadActiveDeckIntoBattle(): void {
  battleDeckIds = [...profile.deck]
  battleDeckPreset = profile.activeDeck
  sim.setPlayerDeck(playerDeck(profile))
}

function cancelMatch(): void {
  if (matchTimer !== null) window.clearTimeout(matchTimer)
  matchTimer = null
  matching.hidden = true
  openHub(true)
}

function startMatchmaking(mode: BattleMode = 'ranked', category: MatchCategory = 'ranked', fixedOpponent?: string): void {
  selectedMode = mode
  selectedMatchCategory = category
  if (profile.deck.length !== 8) {
    openLoadout()
    return
  }
  if (matchStarted && !sim.result) {
    closeHub()
    return
  }
  if (matchTimer !== null) window.clearTimeout(matchTimer)
  matching.hidden = false
  hub.hidden = true
  sim.setPaused(true)
  matchingTitle.textContent = '寻找对手'
  matchingCopy.textContent = mode === 'friendly' ? '正在建立好友约战房间。' : mode === 'storm' ? '正在寻找风暴冲刺对手。' : mode === 'practice' ? '正在装载训练领航员与标准塔群。' : '正在扫描相近奖杯区间。'
  matchingMeterBar.style.width = '18%'
  matchingOpponent.hidden = true
  const tier = roadTier(profile.trophies)
  const names = tier.next && profile.trophies < tier.next - 160 ? ['雾港议会', '白礁守望团'] : ['沉锚联盟', '风暴领航会']
  matchOpponent = fixedOpponent ?? names[Math.floor(Math.random() * names.length)]
  matchTimer = window.setTimeout(() => {
    matchingTitle.textContent = '对手已找到'
    matchingCopy.textContent = mode === 'friendly' ? '好友已进入房间，正在同步战场。' : mode === 'storm' ? '正在校准风暴航线与能量倍率。' : mode === 'practice' ? '训练领航员已就位，正在校准较慢部署节奏。' : '正在校准竞技场与奖杯差值。'
    matchingMeterBar.style.width = '74%'
    matchingOpponent.hidden = false
    matchingOpponentName.textContent = matchOpponent
    matchingOpponentTrophies.textContent = mode === 'friendly' ? '友谊战 · 不影响奖杯' : mode === 'storm' ? '风暴冲刺 · 90 秒活动战局' : mode === 'practice' ? '训练 AI · 较慢部署 · 档案不变' : `${Math.max(0, profile.trophies + Math.floor(Math.random() * 81) - 40)} 杯 · ${tier.name}`
    matchTimer = window.setTimeout(beginMatch, 720)
  }, 680)
}

function openRoad(): void {
  hub.hidden = true
  renderRoad()
  road.hidden = false
}

function closeRoad(): void {
  road.hidden = true
  hub.hidden = false
}

function openShop(): void {
  hub.hidden = true
  shopMessage = ''
  renderShop()
  shop.hidden = false
}

function closeShop(): void {
  shop.hidden = true
  hub.hidden = false
  renderProfile()
}

function openEvents(): void {
  hub.hidden = true
  eventMessage.textContent = '活动胜负仍会记录在最近战绩。'
  events.hidden = false
}

function closeEvents(): void {
  events.hidden = true
  hub.hidden = false
}

function startStorm(): void {
  events.hidden = true
  startMatchmaking('storm', 'event')
}

function openFleet(): void {
  hub.hidden = true
  fleetMessage = ''
  renderFleet()
  fleet.hidden = false
}

function closeFleet(): void {
  fleet.hidden = true
  hub.hidden = false
  renderProfile()
}

function openSeason(): void {
  hub.hidden = true
  seasonMessage = ''
  seasonTab = 'rewards'
  renderSeason()
  season.hidden = false
}

function closeSeason(): void {
  season.hidden = true
  hub.hidden = false
  renderProfile()
}

function openFriends(): void {
  hub.hidden = true
  friendsMessage.textContent = '在线好友可立即接受挑战。'
  renderFriends()
  friends.hidden = false
}

function closeFriends(): void {
  friends.hidden = true
  hub.hidden = false
}

function returnToLobby(): void {
  if (matchTimer !== null) window.clearTimeout(matchTimer)
  matchTimer = null
  selectedMode = 'ranked'
  selectedMatchCategory = 'ranked'
  replaySession = null
  replayRate = 1
  game.registry.set('replayRate', replayRate)
  document.querySelector('#hub-button')!.textContent = '大厅'
  loadActiveDeckIntoBattle()
  sim.setPaused(true)
  resetBattleSoundTracking()
  matchStarted = false
  handledResult = false
  lastReward = null
  selected = null
  resetPhaseBanner()
  resetPracticeCoach()
  result.hidden = true
  loadout.hidden = true
  road.hidden = true
  shop.hidden = true
  events.hidden = true
  fleet.hidden = true
  season.hidden = true
  friends.hidden = true
  matching.hidden = true
  historyReport.hidden = true
  openHub(true)
}

function resetGame(): void {
  if (replaySession) {
    startReplay(replaySession.record)
    return
  }
  audioFeedback.reset()
  loadActiveDeckIntoBattle()
  sim.setPaused(false)
  resetBattleSoundTracking()
  matchStarted = true
  selected = null
  resetPhaseBanner()
  resetPracticeCoach()
  arena.classList.remove('preview-active', 'preview-left', 'preview-right', 'spell-preview')
  arena.style.removeProperty('--deploy-y')
  arena.style.removeProperty('--deploy-x')
  arena.style.removeProperty('--deploy-min')
  arena.style.removeProperty('--spell-radius')
  delete arena.dataset.deployZone
  delete arena.dataset.deployTerrain
  delete arena.dataset.frontline
  handledResult = false
  lastReward = null
  overlayHeldPause = false
  result.hidden = true
  hub.hidden = true
  loadout.hidden = true
  road.hidden = true
  shop.hidden = true
  events.hidden = true
  fleet.hidden = true
  season.hidden = true
  friends.hidden = true
  matching.hidden = true
  historyReport.hidden = true
  renderHud()
}

arena.addEventListener('pointermove', event => updatePreview(event.clientX, event.clientY))
arena.addEventListener('pointerleave', () => {
  if (!activeCardDrag) clearDeploymentPreview()
})
arena.addEventListener('click', event => deployAt((event as MouseEvent).clientX, (event as MouseEvent).clientY))
arena.addEventListener('dragover', event => {
  event.preventDefault()
  updatePreview((event as DragEvent).clientX, (event as DragEvent).clientY)
})
arena.addEventListener('drop', event => {
  event.preventDefault()
  const id = (event as DragEvent).dataTransfer?.getData('card')
  const found = sim.snapshot().hand.find(card => card.id === id)
  if (found) selected = found
  deployAt((event as DragEvent).clientX, (event as DragEvent).clientY)
})
document.addEventListener('pointermove', updateCardDrag, { passive: false })
document.addEventListener('pointerup', event => finishCardDrag(event))
document.addEventListener('pointercancel', event => finishCardDrag(event, true))

soundToggle.addEventListener('click', () => {
  audioFeedback.toggleMuted()
  renderSoundState()
})
document.querySelector('#loadout-button')!.addEventListener('click', () => openLoadout())
document.querySelector('#close-loadout')!.addEventListener('click', closeLoadout)
loadout.addEventListener('click', event => { if (event.target === loadout) closeLoadout() })
document.querySelector('#hub-button')!.addEventListener('click', () => { if (replaySession) returnToLobby(); else openHub() })
replayDock.querySelectorAll<HTMLButtonElement>('[data-replay-speed]').forEach(button => button.addEventListener('click', () => {
  if (!replaySession) return
  replayRate = button.dataset.replaySpeed === '2' ? 2 : 1
  game.registry.set('replayRate', replayRate)
  renderReplayDock()
}))
exitReplay.addEventListener('click', returnToLobby)
document.querySelector('#close-hub')!.addEventListener('click', closeHub)
hub.addEventListener('click', event => { if (event.target === hub) closeHub() })
document.querySelector('#hub-battle')!.addEventListener('click', () => startMatchmaking('ranked'))
document.querySelector('#hub-practice')!.addEventListener('click', () => startMatchmaking('practice', 'practice', '训练领航员'))
document.querySelector('#hub-shop')!.addEventListener('click', openShop)
document.querySelector('#close-shop')!.addEventListener('click', closeShop)
shop.addEventListener('click', event => { if (event.target === shop) closeShop() })
document.querySelector('#hub-events')!.addEventListener('click', openEvents)
document.querySelector('#close-events')!.addEventListener('click', closeEvents)
document.querySelector('#start-storm')!.addEventListener('click', startStorm)
events.addEventListener('click', event => { if (event.target === events) closeEvents() })
document.querySelector('#hub-fleet')!.addEventListener('click', openFleet)
document.querySelector('#close-fleet')!.addEventListener('click', closeFleet)
fleet.addEventListener('click', event => { if (event.target === fleet) closeFleet() })
document.querySelector('#hub-season')!.addEventListener('click', openSeason)
document.querySelector('#close-season')!.addEventListener('click', closeSeason)
season.addEventListener('click', event => { if (event.target === season) closeSeason() })
season.querySelectorAll<HTMLButtonElement>('[data-season-tab]').forEach(button => button.addEventListener('click', () => {
  seasonTab = button.dataset.seasonTab === 'leaderboard' ? 'leaderboard' : 'rewards'
  renderSeason()
}))
document.querySelector('#hub-friends')!.addEventListener('click', openFriends)
document.querySelector('#close-friends')!.addEventListener('click', closeFriends)
friends.addEventListener('click', event => { if (event.target === friends) closeFriends() })
document.querySelector('#hub-deck')!.addEventListener('click', () => {
  hub.hidden = true
  openLoadout(true)
})
document.querySelector('#open-road')!.addEventListener('click', openRoad)
document.querySelector('#close-road')!.addEventListener('click', closeRoad)
road.addEventListener('click', event => { if (event.target === road) closeRoad() })
battleHistory.addEventListener('click', event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-history-id]')
  const recordId = Number(button?.dataset.historyId)
  const record = profile.history.find(item => item.id === recordId)
  if (record) openHistoryReport(record)
})
document.querySelector('#close-history-report')!.addEventListener('click', closeHistoryReport)
historyReport.addEventListener('click', event => { if (event.target === historyReport) closeHistoryReport() })
document.querySelector('#cancel-match')!.addEventListener('click', cancelMatch)
document.querySelector('#claim-chest')!.addEventListener('click', () => {
  const reward = claimChest(profile)
  if (!reward) {
    audioFeedback.error()
    return
  }
  const card = CARDS.find(item => item.id === reward.cardId)!
  chestMessage = `获得 ${reward.coins} 潮贝与 ${card.name} ×${reward.copies}`
  audioFeedback.upgrade()
  renderProfile()
  renderLoadout()
})
emotes.querySelectorAll<HTMLButtonElement>('button').forEach(button => button.addEventListener('click', () => {
  audioFeedback.emote()
  const message = button.dataset.emote || ''
  sim.sendEmote(message)
  showEmoteBeacon(message)
  renderHud()
  button.classList.add('sent')
  window.setTimeout(() => button.classList.remove('sent'), 220)
}))
pause.addEventListener('click', () => { sim.togglePause(); renderHud() })
document.querySelector('#reset')!.addEventListener('click', resetGame)
document.querySelector('#again')!.addEventListener('click', resetGame)
document.querySelector('#result-hub')!.addEventListener('click', returnToLobby)

renderSoundState()
renderProfile()
renderLoadout()
openHub(true)
window.setInterval(renderHud, 160)
window.setInterval(renderChestQueue, 1000)
renderHud()
