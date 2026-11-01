import assert from 'node:assert/strict'
import { chromium } from 'playwright'

const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173/'
const browser = await chromium.launch({ headless: true })

try {
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await desktop.goto(baseUrl)
  await desktop.waitForLoadState('domcontentloaded')
  assert.equal(await desktop.title(), '潮汐王座 | 实时卡牌塔防')
  assert.equal(await desktop.locator('#hub').isHidden(), false, 'hub should be the first actionable screen')
  const soundBefore = await desktop.locator('#sound-toggle').getAttribute('aria-pressed')
  await desktop.locator('#sound-toggle').click()
  assert.notEqual(await desktop.locator('#sound-toggle').getAttribute('aria-pressed'), soundBefore, 'sound control should expose its changed state')
  await desktop.locator('#sound-toggle').click()
  for (const [open, panel, close] of [
    ['hub-deck', '#loadout', 'close-loadout'],
    ['hub-shop', '#shop', 'close-shop'],
    ['hub-events', '#events', 'close-events'],
    ['hub-fleet', '#fleet', 'close-fleet'],
    ['hub-season', '#season', 'close-season'],
    ['hub-friends', '#friends', 'close-friends'],
  ]) {
    await desktop.locator(`#${open}`).click()
    assert.equal(await desktop.locator(panel).isHidden(), false, `${panel} should open from hub`)
    await desktop.locator(`#${close}`).click()
    assert.equal(await desktop.locator('#hub').isHidden(), false, 'closing a hub panel should return to hub')
  }
  await desktop.locator('#hub-fleet').click()
  const fleetMessage = `桥头战术 ${Date.now()}`
  await desktop.locator('#fleet-chat-input').fill(fleetMessage)
  await desktop.locator('#fleet-chat-form').press('Enter')
  assert.ok((await desktop.locator('#fleet-chat-log').textContent())?.includes(fleetMessage), 'fleet chat should render a sent message')
  const persistedFleetMessage = await desktop.evaluate(message => {
    const raw = window.localStorage.getItem('tidal-throne-profile-v1')
    const profile = raw ? JSON.parse(raw) : null
    return profile?.fleet?.messages?.some((entry) => entry.text === message) ?? false
  }, fleetMessage)
  assert.equal(persistedFleetMessage, true, 'fleet chat should persist messages locally')
  await desktop.locator('#close-fleet').click()
  await desktop.locator('#hub-deck').click()
  const presetModel = await desktop.evaluate(async () => {
    const key = 'tidal-throne-profile-v1'
    const original = window.localStorage.getItem(key)
    window.localStorage.setItem(key, JSON.stringify({
      version: 1,
      deck: ['signal-archer', 'iron-scout', 'missing-card', 'signal-archer'],
    }))
    const { loadProfile, moveDeckCard, selectDeckPreset } = await import('/src/profile.ts')
    const migrated = loadProfile()
    const legacyDeckMigrated = migrated.activeDeck === 0
      && migrated.decks.length === 3
      && migrated.deck.length === 8
      && migrated.deck[0] === 'signal-archer'
      && migrated.deck[1] === 'iron-scout'
      && migrated.decks[0].join(',') === migrated.deck.join(',')
    const switched = selectDeckPreset(migrated, 1)
    const switchedDeck = migrated.activeDeck === 1
      && migrated.deck.length === 8
      && migrated.deck.join(',') === migrated.decks[1].join(',')
    const moved = moveDeckCard(migrated, 0, 1)
    const editSynced = migrated.deck.join(',') === migrated.decks[1].join(',')
    if (original === null) window.localStorage.removeItem(key)
    else window.localStorage.setItem(key, original)
    return { legacyDeckMigrated, switched, switchedDeck, moved, editSynced }
  })
  assert.deepEqual(presetModel, {
    legacyDeckMigrated: true,
    switched: true,
    switchedDeck: true,
    moved: true,
    editSynced: true,
  }, 'legacy profiles should migrate into three presets and active edits should stay synchronized')
  assert.equal(await desktop.locator('[data-deck-preset]').count(), 3, 'loadout should expose three saved deck presets')
  const handBeforePresetSwitch = await desktop.evaluate(() => window.__tidalTest.sim.hand.map(card => card.id).join(','))
  const firstPresetCards = await desktop.locator('#deck-slots [data-detail-card]').evaluateAll(cards => cards.map(card => card.dataset.detailCard))
  await desktop.locator('[data-deck-preset="1"]').click()
  assert.equal(await desktop.locator('[data-deck-preset="1"]').getAttribute('aria-selected'), 'true', 'selected preset should expose its active state')
  assert.equal(await desktop.locator('#deck-slots .deck-slot').count(), 8, 'every preset should render eight deck slots')
  assert.match(await desktop.locator('#deck-editor-warning').textContent(), /编队 2/)
  const secondPresetCards = await desktop.locator('#deck-slots [data-detail-card]').evaluateAll(cards => cards.map(card => card.dataset.detailCard))
  assert.notDeepEqual(secondPresetCards, firstPresetCards, 'presets should provide meaningfully different card lineups')
  assert.equal(await desktop.evaluate(() => window.__tidalTest.sim.hand.map(card => card.id).join(',')), handBeforePresetSwitch, 'switching presets should not rewrite the current battle hand')
  await desktop.screenshot({ path: 'playtest-deck-presets.png' })
  await desktop.locator('[data-deck-preset="0"]').click()
  assert.equal(await desktop.locator('[data-deck-preset="0"]').getAttribute('aria-selected'), 'true')
  await desktop.locator('[data-collection-filter="spells"]').click()
  assert.ok(await desktop.locator('#loadout-cards .collection-card').count() >= 4, 'spell filter should show spell cards')
  assert.ok(await desktop.locator('#loadout-cards').textContent().then(text => !text.includes('铁潮卫士')), 'spell filter should hide unit cards')
  await desktop.locator('[data-collection-filter="buildings"]').click()
  assert.ok(await desktop.locator('#loadout-cards').textContent().then(text => text.includes('潮汐炮台')), 'building filter should show building cards')
  await desktop.locator('[data-collection-filter="all"]').click()
  await desktop.locator('#close-loadout').click()
  await desktop.locator('#open-road').click()
  assert.equal(await desktop.locator('#road').isHidden(), false, 'trophy road should open from hub')
  await desktop.locator('#close-road').click()
  await desktop.locator('#hub-battle').click()
  await desktop.waitForTimeout(1_700)
  assert.equal(await desktop.locator('.match-versus').isHidden(), false, 'versus intro should bridge matchmaking and battle')
  assert.match(await desktop.locator('#versus-mode').textContent(), /奖杯对战/)
  assert.ok((await desktop.locator('#versus-enemy').textContent())?.trim(), 'versus intro should name the opponent')
  await desktop.screenshot({ path: 'playtest-versus-intro.png' })
  await desktop.waitForTimeout(3_600)

  assert.equal(await desktop.locator('#arena canvas').count(), 1, 'Phaser canvas should be present')
  assert.equal(await desktop.locator('#matching').getAttribute('hidden'), '', 'matchmaking should close')
  assert.equal(await desktop.locator('.match-versus').isHidden(), true, 'versus intro should clear after countdown')
  assert.match(await desktop.locator('#timer').textContent(), /^02:/, 'match timer should be active')
  await desktop.locator('[data-emote="漂亮"]').click()
  assert.equal(await desktop.locator('#arena .emote-beacon').isHidden(), false, 'battle emotes should appear in the arena')
  assert.equal((await desktop.locator('#arena .emote-beacon').textContent())?.trim(), '漂亮')
  await desktop.locator('#arena').screenshot({ path: 'playtest-emote-beacon.png' })

  const manaBefore = await desktop.locator('#mana').textContent()
  const card = desktop.locator('#cards .card').first()
  assert.equal(await card.isDisabled(), false, 'first card should be playable at opening energy')
  const arenaBounds = await desktop.locator('#arena').boundingBox()
  assert.ok(arenaBounds)
  await card.click()
  await desktop.locator('#arena').hover({ position: { x: arenaBounds.width * 0.5, y: arenaBounds.height * 0.4 } })
  assert.equal(await desktop.locator('#arena').getAttribute('data-deploy-zone'), 'blocked', 'unit preview should reject enemy territory before a lane tower falls')
  assert.equal(await desktop.locator('#arena').evaluate(element => element.style.getPropertyValue('--deploy-min')), '52%', 'home deployment boundary should match simulation rules')
  await desktop.locator('#arena').hover({ position: { x: arenaBounds.width * 0.5, y: arenaBounds.height * 0.5 } })
  assert.equal(await desktop.locator('#arena').getAttribute('data-deploy-terrain'), 'river', 'ground deployment preview should identify water outside the bridges')
  await desktop.locator('#arena').screenshot({ path: 'playtest-river-deployment-blocked.png' })
  await desktop.locator('#arena').hover({ position: { x: arenaBounds.width * 0.5, y: arenaBounds.height * 0.78 } })
  assert.equal(await desktop.locator('#arena').getAttribute('data-deploy-zone'), 'ready', 'unit preview should accept the player deployment zone')
  assert.deepEqual(await desktop.evaluate(() => {
    const preview = window.__tidalTest.game.registry.get('deploymentPreview')
    return preview ? { kind: preview.kind, fieldX: Math.round(preview.fieldX * 100) / 100, valid: preview.valid } : null
  }), { kind: 'melee', fieldX: 0.5, valid: true }, 'Phaser should receive an exact center-field unit preview')
  await desktop.locator('#arena').screenshot({ path: 'playtest-canvas-deployment-preview.png' })
  await desktop.locator('#arena').click({ position: { x: arenaBounds.width * 0.5, y: arenaBounds.height * 0.78 } })
  await desktop.waitForTimeout(120)
  assert.notEqual(await desktop.locator('#mana').textContent(), manaBefore, 'deploying a card should spend energy')
  assert.ok(await desktop.evaluate(() => window.__tidalTest.sim.units.some(unit => unit.side === 'player' && Math.abs((unit.fieldX ?? 0) - 50) < 1.5)), 'center-field placement should persist its horizontal coordinate before pathfinding begins')
  assert.equal(await desktop.evaluate(() => window.__tidalTest.sim.snapshot().logs.some(log => log.includes('驶入'))), true, 'battle log history should record deployment')
  assert.equal(await desktop.locator('[data-card="breakwater"] .card-target').textContent(), '建筑', 'tank card should expose building-only target rule')
  assert.match(await desktop.locator('#deck-average').textContent(), /^均费 \d\.\d$/, 'deck should expose average energy cost')
  await desktop.screenshot({ path: 'playtest-playwright-deploy.png' })

  await desktop.locator('#pause').click()
  assert.equal(await desktop.locator('#pause').textContent(), '继续')
  assert.equal(await desktop.locator('.pause-overlay').isHidden(), false)
  const pausedTimer = await desktop.locator('#timer').textContent()
  await desktop.waitForTimeout(450)
  assert.equal(await desktop.locator('#timer').textContent(), pausedTimer, 'paused match timer should not advance')
  await desktop.locator('#pause').click()
  assert.equal(await desktop.locator('#pause').textContent(), '暂停')
  await desktop.waitForTimeout(3_200)
  await desktop.screenshot({ path: 'playtest-combat-feedback.png' })

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.time = 74
    sim.overtime = false
    sim.setPaused(false)
  })
  await desktop.waitForTimeout(220)
  assert.equal(await desktop.locator('.phase-banner').isHidden(), false, 'double-energy phase should announce inside the arena')
  assert.match(await desktop.locator('.phase-banner').textContent(), /双倍能量/)
  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.overtime = true
    sim.time = 30
  })
  await desktop.waitForTimeout(220)
  assert.equal(await desktop.locator('.phase-banner').isHidden(), false, 'overtime should announce inside the arena')
  assert.match(await desktop.locator('.phase-banner').textContent(), /突然死亡/)
  await desktop.screenshot({ path: 'playtest-phase-overtime.png' })
  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.overtime = false
    sim.time = 140
  })

  await desktop.locator('#loadout-button').click()
  await desktop.locator('[data-detail-card="mending-current"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /修复潮涌/)
  assert.match(await desktop.locator('#card-detail').textContent(), /部队 48/)
  await desktop.locator('[data-detail-card="flare-burst"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /作用 22 格/)
  await desktop.locator('[data-detail-card="gale-pulse"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /逆风冲波/)
  assert.match(await desktop.locator('#card-detail').textContent(), /最多击退 5 格/)
  await desktop.locator('[data-detail-card="cloud-sailor"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /云帆侦察艇/)
  assert.match(await desktop.locator('#card-detail').textContent(), /空中单位/)
  assert.match(await desktop.locator('#card-detail').textContent(), /弹速 48 格\/秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /重量 轻型/)
  assert.match(await desktop.locator('#card-detail').textContent(), /抗击退 12%/)
  await desktop.locator('[data-detail-card="reef-bomber"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /礁火投弹手/)
  assert.match(await desktop.locator('#card-detail').textContent(), /溅射 8 格/)
  assert.match(await desktop.locator('#card-detail').textContent(), /弹速 20 格\/秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /攻击起手 0.32 秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /首击准备 0.38 秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /转火 0.28 秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /索敌 密集目标/)
  assert.match(await desktop.locator('#card-detail').textContent(), /稀有/)
  await desktop.screenshot({ path: 'playtest-ballistics-card-detail.png' })
  await desktop.locator('[data-detail-card="ember-charger"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /余烬冲锋者/)
  assert.match(await desktop.locator('#card-detail').textContent(), /攻速 0.9 秒/)
  assert.match(await desktop.locator('#card-detail').textContent(), /秒伤 18/)
  assert.match(await desktop.locator('#card-detail').textContent(), /索敌 受损目标/)
  assert.match(await desktop.locator('#card-detail').textContent(), /爆裂 8 格/)
  assert.match(await desktop.locator('#card-detail').textContent(), /冲锋 10 格 · 2 倍/)
  await desktop.locator('[data-detail-card="lantern-school"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /灯潮游群/)
  assert.match(await desktop.locator('#card-detail').textContent(), /4 个单位/)
  await desktop.locator('[data-detail-card="brine-guards"]').last().click()
  assert.match(await desktop.locator('#card-detail').textContent(), /盐沫盾卫/)
  assert.match(await desktop.locator('#card-detail').textContent(), /护盾 36/)
  assert.match(await desktop.locator('#card-detail').textContent(), /2 个单位/)
  await desktop.screenshot({ path: 'playtest-splash-card-detail.png' })
  await desktop.locator('#close-loadout').click()

  await desktop.waitForTimeout(2_600)
  const spell = desktop.locator('[data-card="flare-burst"]')
  assert.equal(await spell.isDisabled(), false, 'area spell should become playable after energy regenerates')
  await spell.click()
  await desktop.locator('#arena').hover({ position: { x: 110, y: 130 } })
  assert.equal(await desktop.locator('#arena').evaluate(element => element.classList.contains('spell-preview')), true)
  assert.notEqual(await desktop.locator('#arena').evaluate(element => element.style.getPropertyValue('--spell-radius')), '')
  assert.deepEqual(await desktop.evaluate(() => {
    const preview = window.__tidalTest.game.registry.get('deploymentPreview')
    return preview ? { kind: preview.kind, valid: preview.valid, radius: preview.radius } : null
  }), { kind: 'spell', valid: true, radius: 22 }, 'Phaser should receive the spell targeting radius')
  await desktop.locator('#arena').screenshot({ path: 'playtest-canvas-spell-preview.png' })
  await desktop.locator('#arena').click({ position: { x: 110, y: 130 } })
  assert.equal(await desktop.evaluate(() => window.__tidalTest.sim.snapshot().logs.some(log => log.includes('范围'))), true, 'spell log history should describe area impact')

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.towers.find(tower => tower.id === 'enemy-left').hp = 0
    sim.mana = 10
    sim.countdown = 0
    sim.result = null
    sim.setPaused(false)
    const button = document.querySelector('[data-card="signal-archer"]')
    button.disabled = false
    button.click()
  })
  await desktop.waitForTimeout(120)
  await desktop.locator('#arena').hover({ position: { x: arenaBounds.width * 0.25, y: arenaBounds.height * 0.4 } })
  assert.equal(await desktop.locator('#arena').getAttribute('data-deploy-zone'), 'ready', 'destroying a lane tower should unlock advanced deployment in that lane')
  assert.equal(await desktop.locator('#arena').getAttribute('data-frontline'), 'advanced', 'advanced territory should have a visible preview state')
  assert.equal(await desktop.locator('#arena').evaluate(element => element.style.getPropertyValue('--deploy-min')), '34%', 'advanced preview boundary should match simulation rules')
  await desktop.screenshot({ path: 'playtest-advanced-deployment.png' })

  await desktop.locator('#reset').click()
  await desktop.waitForTimeout(120)
  assert.equal(await desktop.locator('#timer').textContent(), '02:30', 'reset should restore match duration')
  assert.equal(await desktop.locator('#result').isHidden(), true)
  assert.equal(await desktop.locator('#arena').evaluate(element => element.classList.contains('preview-active')), false, 'reset should clear deployment preview state')
  assert.equal(await desktop.locator('.phase-banner').isHidden(), true, 'reset should clear phase announcements')

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.logs = ['胜利：敌方主塔失守。', '敌方左塔被摧毁。', '你施放 炽光脉冲，左路范围伤害。']
    sim.result = 'win'
    sim.setPaused(true)
  })
  await desktop.waitForTimeout(240)
  assert.equal(await desktop.locator('#result').isHidden(), false, 'battle result should open after the simulation reports a winner')
  assert.match(await desktop.locator('#result-reward').textContent(), /补给箱/)
  assert.match(await desktop.locator('#result-reward').textContent(), /(已入队|\d\/3)/)
  assert.match(await desktop.locator('#result-events').textContent(), /敌方左塔被摧毁/)
  assert.match(await desktop.locator('#result-events .tower-event').textContent(), /敌方左塔被摧毁/)
  await desktop.screenshot({ path: 'playtest-result-report.png' })
  await desktop.locator('#again').click()
  await desktop.waitForTimeout(120)
  assert.equal(await desktop.locator('#result').isHidden(), true, 'rematch should close the battle report')

  const combatRules = await desktop.evaluate(async () => {
    const { BattleSimulation, CARDS } = await import('/src/simulation.ts')
    const { loadProfile, applyBattleResult, cardForBattle } = await import('/src/profile.ts')
    const sim = new BattleSimulation()
    sim.countdown = 0
    sim.aiTimer = 999
    sim.towers.forEach(tower => { tower.active = false })
    sim.units = [
      { id: 101, side: 'player', lane: 0, x: 60, hp: 100, maxHp: 100, damage: 14, range: 150, speed: 30, attackCd: 0, hitSpeed: 1.2, attackWindup: 0.1, projectileSpeed: 40, kind: 'ranged', color: '#74d6c4', icon: '⌁', canTargetAir: true, targetId: undefined, deployDelay: 0 },
      { id: 102, side: 'enemy', lane: 0, x: 54, hp: 100, maxHp: 100, damage: 12, range: 34, speed: 42, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    sim.update(0.01)
    const attackStarted = sim.snapshot().projectiles.length === 0
      && sim.units.find(unit => unit.id === 102)?.hp === 100
      && sim.units.find(unit => unit.id === 101)?.windupRemaining > 0
      && sim.snapshot().effects.some(effect => effect.kind === 'attack')
    sim.update(0.1)
    const inFlight = sim.snapshot().projectiles.length === 1 && sim.units.find(unit => unit.id === 102)?.hp === 100
    sim.update(0.1)
    const impact = sim.units.find(unit => unit.id === 102)?.hp === 86 && sim.snapshot().effects.some(effect => effect.kind === 'impact')
    sim.update(0.5)
    const cadenceHeld = sim.units.find(unit => unit.id === 102)?.hp === 86 && sim.units.find(unit => unit.id === 101)?.attackCd > 0
    sim.units.find(unit => unit.id === 102).hp = 10
    sim.units.find(unit => unit.id === 101).attackCd = 0
    sim.update(0.01)
    sim.update(0.1)
    sim.update(0.1)
    const death = sim.snapshot().effects.some(effect => effect.kind === 'death') && sim.snapshot().logs.some(log => log.includes('单位被击沉'))
    const timedCards = CARDS.filter(card => card.kind !== 'spell')
    const attackTimingData = timedCards.every(card => card.hitSpeed > 0 && card.attackWindup > 0 && card.attackWindup < card.hitSpeed)
      && new Set(timedCards.map(card => card.hitSpeed)).size >= 8
    const rangedCards = timedCards.filter(card => card.kind === 'ranged' || card.kind === 'building')
    const projectileSpeedData = rangedCards.every(card => card.projectileSpeed > 0)
      && new Set(rangedCards.map(card => card.projectileSpeed)).size >= 5
    const weightData = timedCards.every(card => card.weight && card.knockbackResistance >= 0 && card.knockbackResistance <= 1)
      && new Set(timedCards.map(card => card.weight)).size === 4
    const targetingData = timedCards.every(card => card.firstAttackDelay > 0 && card.retargetDelay > 0 && card.targetPriority)
      && new Set(timedCards.map(card => card.targetPriority)).size === 3

    const firstHit = new BattleSimulation()
    firstHit.countdown = 0
    firstHit.aiTimer = 999
    firstHit.towers.forEach(tower => { tower.active = false })
    firstHit.units = [
      { id: 181, side: 'player', lane: 0, x: 60, hp: 105, maxHp: 105, damage: 18, range: 40, speed: 0, attackCd: 0, hitSpeed: 1.05, attackWindup: 0.05, firstAttackDelay: 0.25, firstAttackRemaining: 0.25, retargetDelay: 0.16, retargetRemaining: 0, targetPriority: 'nearest', kind: 'melee', color: '#efb35e', icon: '✦', deployDelay: 0 },
      { id: 182, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    firstHit.update(0.2)
    const firstHitWaits = firstHit.units.find(unit => unit.id === 181)?.targetId === 182
      && firstHit.units.find(unit => unit.id === 181)?.windupRemaining === undefined
      && firstHit.units.find(unit => unit.id === 182)?.hp === 100
    firstHit.update(0.06)
    const firstHitStarts = firstHit.units.find(unit => unit.id === 181)?.windupRemaining > 0
      && firstHit.units.find(unit => unit.id === 182)?.hp === 100
    firstHit.update(0.05)
    const firstHitLands = firstHit.units.find(unit => unit.id === 182)?.hp === 82

    const retarget = new BattleSimulation()
    retarget.countdown = 0
    retarget.aiTimer = 999
    retarget.towers.forEach(tower => { tower.active = false })
    retarget.units = [
      { id: 191, side: 'player', lane: 0, x: 60, hp: 105, maxHp: 105, damage: 18, range: 150, speed: 0, attackCd: 1, firstAttackRemaining: 0, retargetDelay: 0.2, retargetRemaining: 0, targetPriority: 'nearest', targetId: 192, kind: 'ranged', color: '#74d6c4', icon: '⌁', deployDelay: 0 },
      { id: 192, side: 'enemy', lane: 0, x: 58, hp: 0, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 193, side: 'enemy', lane: 0, x: 54, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    retarget.update(0.01)
    const retargetStarts = retarget.units.find(unit => unit.id === 191)?.targetId === undefined
      && retarget.units.find(unit => unit.id === 191)?.retargetRemaining === 0.2
    retarget.update(0.1)
    const retargetWaits = retarget.units.find(unit => unit.id === 191)?.targetId === undefined
      && retarget.units.find(unit => unit.id === 191)?.retargetRemaining > 0
    retarget.update(0.11)
    const retargetCompletes = retarget.units.find(unit => unit.id === 191)?.targetId === 193

    const priority = new BattleSimulation()
    priority.countdown = 0
    priority.aiTimer = 999
    priority.towers.forEach(tower => { tower.active = false })
    priority.units = [
      { id: 211, side: 'player', lane: 0, x: 60, hp: 86, maxHp: 86, damage: 20, range: 200, speed: 0, attackCd: 999, firstAttackRemaining: 0, retargetRemaining: 0, targetPriority: 'cluster', splashRadius: 8, kind: 'ranged', color: '#e9ad6a', icon: '◉', deployDelay: 0 },
      { id: 212, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 213, side: 'enemy', lane: 0, x: 47, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 214, side: 'enemy', lane: 0, x: 45, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 215, side: 'enemy', lane: 0, x: 43, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    priority.update(0.01)
    const clusterPriority = priority.units.find(unit => unit.id === 211)?.targetId === 213

    const weakest = new BattleSimulation()
    weakest.countdown = 0
    weakest.aiTimer = 999
    weakest.towers.forEach(tower => { tower.active = false })
    weakest.units = [
      { id: 221, side: 'player', lane: 0, x: 60, hp: 72, maxHp: 72, damage: 11, range: 200, speed: 0, attackCd: 999, firstAttackRemaining: 0, retargetRemaining: 0, targetPriority: 'weakest', kind: 'ranged', color: '#8cc6bb', icon: '╱', deployDelay: 0 },
      { id: 222, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 223, side: 'enemy', lane: 0, x: 52, hp: 10, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    weakest.update(0.01)
    const weakestPriority = weakest.units.find(unit => unit.id === 221)?.targetId === 223

    const towerTiming = new BattleSimulation()
    towerTiming.countdown = 0
    towerTiming.aiTimer = 999
    towerTiming.towers.forEach(tower => { tower.active = false })
    const timedTower = towerTiming.towers.find(tower => tower.id === 'player-left')
    timedTower.active = true
    towerTiming.units = [
      { id: 231, side: 'enemy', lane: 0, x: 68, hp: 100, maxHp: 100, damage: 10, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    towerTiming.update(0.01)
    const towerWindupStarts = timedTower.targetId === 231
      && timedTower.pendingTargetId === 231
      && timedTower.windupRemaining > 0
      && towerTiming.projectiles.length === 0
    const pausedTowerWindup = timedTower.windupRemaining
    towerTiming.setPaused(true)
    towerTiming.update(0.5)
    const towerPauseFreezes = timedTower.windupRemaining === pausedTowerWindup
      && towerTiming.projectiles.length === 0
    towerTiming.setPaused(false)
    towerTiming.update(0.1)
    const towerWindupWaits = towerTiming.projectiles.length === 0
      && timedTower.windupRemaining > 0
    towerTiming.update(0.09)
    const towerWindupFires = towerTiming.projectiles.length === 1
      && timedTower.windupRemaining === 0

    const towerMiss = new BattleSimulation()
    towerMiss.countdown = 0
    towerMiss.aiTimer = 999
    towerMiss.towers.forEach(tower => { tower.active = false })
    const missTower = towerMiss.towers.find(tower => tower.id === 'player-left')
    missTower.active = true
    towerMiss.units = [
      { id: 241, side: 'enemy', lane: 0, x: 68, hp: 100, maxHp: 100, damage: 10, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    towerMiss.update(0.01)
    towerMiss.units.find(unit => unit.id === 241).x = 40
    towerMiss.update(0.19)
    const towerWindupMisses = towerMiss.projectiles.length === 0
      && missTower.targetId === undefined
      && missTower.retargetRemaining > 0

    const towerRetarget = new BattleSimulation()
    towerRetarget.countdown = 0
    towerRetarget.aiTimer = 999
    towerRetarget.towers.forEach(tower => { tower.active = false })
    const retargetTower = towerRetarget.towers.find(tower => tower.id === 'player-left')
    retargetTower.active = true
    retargetTower.attackCd = 999
    towerRetarget.units = [
      { id: 251, side: 'enemy', lane: 0, x: 75, hp: 100, maxHp: 100, damage: 10, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 252, side: 'enemy', lane: 0, x: 69, hp: 100, maxHp: 100, damage: 10, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    towerRetarget.update(0.01)
    towerRetarget.units.find(unit => unit.id === 251).hp = 0
    towerRetarget.update(0.01)
    const towerRetargetStarts = retargetTower.targetId === undefined
      && retargetTower.retargetRemaining === retargetTower.retargetDelay
    towerRetarget.update(0.1)
    const towerRetargetWaits = retargetTower.targetId === undefined
      && retargetTower.retargetRemaining > 0
    towerRetarget.update(0.13)
    const towerRetargetCompletes = retargetTower.targetId === 252
    const towerTimingData = towerTiming.towers.every(tower => tower.hitSpeed > 0 && tower.attackWindup > 0 && tower.projectileSpeed > 0 && tower.retargetDelay > 0)
      && towerTiming.towers.find(tower => tower.lane === 'core').hitSpeed !== towerTiming.towers.find(tower => tower.lane !== 'core').hitSpeed

    const createBallisticsSim = projectileSpeed => {
      const ballistics = new BattleSimulation()
      ballistics.countdown = 0
      ballistics.aiTimer = 999
      ballistics.towers.forEach(tower => { tower.active = false })
      ballistics.units = [
        { id: 151, side: 'player', lane: 0, x: 60, hp: 62, maxHp: 62, damage: 14, range: 180, speed: 0, attackCd: 0, hitSpeed: 1.2, attackWindup: 0.05, projectileSpeed, kind: 'ranged', color: '#74d6c4', icon: '⌁', canTargetAir: true, deployDelay: 0 },
        { id: 152, side: 'enemy', lane: 0, x: 52, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      ]
      ballistics.update(0.01)
      ballistics.update(0.05)
      ballistics.update(0.1)
      return ballistics
    }
    const fastProjectile = createBallisticsSim(CARDS.find(card => card.id === 'signal-archer').projectileSpeed)
    const slowProjectile = createBallisticsSim(CARDS.find(card => card.id === 'harbor-mortar').projectileSpeed)
    const projectileSpeedDifference = fastProjectile.units.find(unit => unit.id === 152)?.hp === 86
      && slowProjectile.units.find(unit => unit.id === 152)?.hp === 100
      && slowProjectile.snapshot().projectiles[0]?.speed === 18
      && slowProjectile.snapshot().projectiles[0]?.originX === 60

    const knockback = new BattleSimulation()
    knockback.countdown = 0
    knockback.aiTimer = 999
    knockback.mana = 10
    const galePulse = CARDS.find(card => card.id === 'gale-pulse')
    knockback.hand = [galePulse]
    knockback.units = [
      { id: 171, side: 'enemy', lane: 0, x: 24, hp: 100, maxHp: 100, damage: 9, range: 28, speed: 0, attackCd: 0.8, hitSpeed: 0.8, attackWindup: 0.2, windupRemaining: 0.2, windupDuration: 0.2, pendingTargetId: 174, pendingTargetX: 30, kind: 'melee', color: '#d75f61', icon: '≋', weight: 'light', knockbackResistance: 0.1, deployDelay: 0 },
      { id: 172, side: 'enemy', lane: 0, x: 26, hp: 260, maxHp: 260, damage: 28, range: 38, speed: 0, attackCd: 1, kind: 'tank', color: '#d75f61', icon: '◆', weight: 'heavy', knockbackResistance: 0.7, deployDelay: 0 },
      { id: 173, side: 'enemy', lane: 0, x: 28, hp: 180, maxHp: 180, damage: 16, range: 170, speed: 0, attackCd: 1, kind: 'building', color: '#d75f61', icon: '◈', weight: 'structure', knockbackResistance: 1, deployDelay: 0 },
    ]
    knockback.deploy(galePulse, 0, 0.24)
    const lightUnit = knockback.units.find(unit => unit.id === 171)
    const heavyUnit = knockback.units.find(unit => unit.id === 172)
    const structureUnit = knockback.units.find(unit => unit.id === 173)
    const weightAffectsKnockback = lightUnit?.x === 19.5
      && heavyUnit?.x === 24.5
      && structureUnit?.x === 28
      && lightUnit.windupRemaining === 0
      && knockback.snapshot().effects.filter(effect => effect.kind === 'knockback').map(effect => effect.value).join(',') === '4.5,1.5,0'

    const tank = new BattleSimulation()
    tank.countdown = 0
    tank.aiTimer = 999
    tank.towers.forEach(tower => { tower.active = false })
    tank.units = [
      { id: 201, side: 'player', lane: 1, x: 70, hp: 260, maxHp: 260, damage: 28, range: 38, speed: 19, attackCd: 1, kind: 'tank', color: '#da7663', icon: '◆', targetMode: 'buildings', deployDelay: 0 },
      { id: 202, side: 'enemy', lane: 1, x: 66, hp: 100, maxHp: 100, damage: 14, range: 34, speed: 42, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 203, side: 'enemy', lane: 1, x: 50, hp: 100, maxHp: 100, damage: 16, range: 170, speed: 0, attackCd: 1, kind: 'building', color: '#b9a4e8', icon: '◈', targetMode: 'any', deployDelay: 0 },
    ]
    tank.update(0.01)
    const tankTarget = tank.units.find(unit => unit.id === 201)?.targetId === 203

    const lock = new BattleSimulation()
    lock.countdown = 0
    lock.aiTimer = 999
    lock.towers.forEach(tower => { tower.active = false })
    lock.units = [
      { id: 301, side: 'player', lane: 0, x: 60, hp: 100, maxHp: 100, damage: 14, range: 150, speed: 30, attackCd: 1, kind: 'ranged', color: '#74d6c4', icon: '⌁', canTargetAir: true, deployDelay: 0 },
      { id: 302, side: 'enemy', lane: 0, x: 54, hp: 100, maxHp: 100, damage: 12, range: 34, speed: 42, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    lock.update(0.01)
    lock.units.push({ id: 303, side: 'enemy', lane: 0, x: 59, hp: 100, maxHp: 100, damage: 12, range: 34, speed: 42, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 })
    lock.update(0.01)
    const stableLock = lock.units.find(unit => unit.id === 301)?.targetId === 302

    const ai = new BattleSimulation()
    ai.countdown = 0
    ai.aiTimer = 0
    ai.enemyMana = 10
    ai.towers.forEach(tower => { tower.active = false })
    const handBefore = ai.enemyHand.map(card => card.id)
    ai.update(0.01)
    const handAfter = ai.enemyHand.map(card => card.id)
    const aiCycle = handAfter.length === 4 && ai.enemyDeckIndex === 5 && handBefore.join(',') !== handAfter.join(',') && ai.stats.enemyDeployments === 1

    const spell = new BattleSimulation()
    spell.countdown = 0
    spell.mana = 10
    const flare = CARDS.find(card => card.id === 'flare-burst')
    spell.hand = [flare]
    spell.deploy(flare, 0, 0.24)
    const spellTowers = spell.snapshot().towers
    const spellLocality = spellTowers.find(tower => tower.id === 'enemy-left')?.hp === 149 && spellTowers.find(tower => tower.id === 'enemy-right')?.hp === 180 && spellTowers.find(tower => tower.id === 'enemy-core')?.hp === 300

    const staticField = new BattleSimulation()
    staticField.countdown = 0
    staticField.mana = 10
    const staticCard = CARDS.find(card => card.id === 'static-field')
    staticField.hand = [staticCard]
    staticField.units = [
      { id: 351, side: 'enemy', lane: 0, x: 24, hp: 100, maxHp: 100, damage: 14, range: 150, speed: 0, attackCd: 1.2, hitSpeed: 1.2, attackWindup: 0.3, windupRemaining: 0.3, windupDuration: 0.3, pendingTargetId: 352, pendingTargetX: 30, kind: 'ranged', color: '#d75f61', icon: '⌁', deployDelay: 0 },
    ]
    staticField.deploy(staticCard, 0, 0.24)
    const stunnedUnit = staticField.units[0]
    const stunCancelsAttack = stunnedUnit.stunRemaining === 0.85
      && stunnedUnit.windupRemaining === 0
      && stunnedUnit.pendingTargetId === undefined
    const spellRadiusData = spell.snapshot().effects.some(effect => effect.kind === 'burst' && effect.radius === 22)
      && staticField.snapshot().effects.some(effect => effect.kind === 'burst' && effect.radius === 24)

    const globalSpell = new BattleSimulation()
    globalSpell.countdown = 0
    globalSpell.mana = 10
    globalSpell.hand = [staticCard]
    globalSpell.units = [
      { id: 361, side: 'enemy', lane: 1, x: 50, fieldX: 50, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 362, side: 'enemy', lane: 0, x: 50, fieldX: 12, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    globalSpell.deploy(staticCard, 1, 0.5, 0.5)
    const freeAreaSpell = globalSpell.units[0].hp === 28 && globalSpell.units[0].stunRemaining === 0.85 && globalSpell.units[1].hp === 100

    const splash = new BattleSimulation()
    splash.countdown = 0
    splash.aiTimer = 999
    splash.towers.forEach(tower => { tower.active = false })
    splash.units = [
      { id: 401, side: 'player', lane: 0, x: 60, hp: 86, maxHp: 86, damage: 20, range: 145, speed: 25, attackCd: 0, hitSpeed: 1.5, attackWindup: 0.32, kind: 'ranged', color: '#e9ad6a', icon: '◉', splashRadius: 8, deployDelay: 0 },
      { id: 402, side: 'enemy', lane: 0, x: 54, hp: 100, maxHp: 100, damage: 10, range: 34, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
      { id: 403, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 34, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    splash.update(0.01)
    splash.update(0.31)
    splash.update(0.02)
    splash.update(0.05)
    const splashHit = splash.units.filter(unit => unit.side === 'enemy').every(unit => unit.hp === 80) && splash.snapshot().effects.some(effect => effect.kind === 'impact' && effect.radius === 8)

    const deathBurst = new BattleSimulation()
    deathBurst.countdown = 0
    deathBurst.aiTimer = 999
    deathBurst.towers.forEach(tower => { tower.active = false })
    deathBurst.units = [
      { id: 501, side: 'player', lane: 0, x: 60, hp: 0, maxHp: 76, damage: 16, range: 30, speed: 52, attackCd: 1, kind: 'melee', color: '#ef8079', icon: '✹', deathDamage: 30, deathRadius: 8, name: '余烬冲锋者', deployDelay: 0 },
      { id: 502, side: 'enemy', lane: 0, x: 54, hp: 100, maxHp: 100, damage: 10, range: 34, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 },
    ]
    deathBurst.update(0.01)
    const deathBurstHit = deathBurst.units.find(unit => unit.id === 502)?.hp === 70 && deathBurst.snapshot().effects.some(effect => effect.kind === 'burst' && effect.radius === 8) && deathBurst.snapshot().logs.some(log => log.includes('爆裂'))

    const charge = new BattleSimulation()
    charge.countdown = 0
    charge.aiTimer = 999
    charge.towers.forEach(tower => { tower.active = false })
    charge.units = [
      { id: 551, side: 'player', lane: 0, x: 70, hp: 76, maxHp: 76, damage: 16, range: 30, speed: 52, attackCd: 0, hitSpeed: 0.9, attackWindup: 0.12, kind: 'melee', color: '#ef8079', icon: '✹', cardId: 'ember-charger', name: '余烬冲锋者', chargeDistance: 10, chargeMultiplier: 2, chargeTravel: 0, chargeReady: false, deployDelay: 0 },
    ]
    charge.update(2)
    const chargeReady = charge.units[0]?.chargeReady === true && charge.units[0]?.chargeTravel >= 10
    charge.units.push({ id: 552, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', deployDelay: 0 })
    charge.update(0.01)
    charge.update(0.12)
    const chargeHit = charge.units.find(unit => unit.id === 552)?.hp === 68
      && charge.units.find(unit => unit.id === 551)?.chargeReady === false
      && charge.units.find(unit => unit.id === 551)?.chargeTravel === 0
      && charge.snapshot().effects.some(effect => effect.kind === 'charge' && effect.value === 32)
      && charge.snapshot().logs.some(log => log.includes('冲锋命中'))

    const formation = new BattleSimulation()
    formation.countdown = 0
    formation.aiTimer = 999
    formation.mana = 10
    const lanternSchool = CARDS.find(card => card.id === 'lantern-school')
    formation.hand = [lanternSchool]
    formation.deploy(lanternSchool, 1, 0.7)
    const formationUnits = formation.units.filter(unit => unit.cardId === 'lantern-school')
    const groupDeploy = formationUnits.length === 4
      && formationUnits.every(unit => unit.side === 'player' && unit.lane === 1)
      && formation.mana === 7
      && formation.stats.playerDeployments === 1

    const shield = new BattleSimulation()
    shield.countdown = 0
    shield.aiTimer = 999
    shield.towers.forEach(tower => { tower.active = false })
    shield.units = [
      { id: 601, side: 'player', lane: 0, x: 60, hp: 100, maxHp: 100, damage: 22, range: 34, speed: 0, attackCd: 0, hitSpeed: 0.5, attackWindup: 0.05, kind: 'melee', color: '#efb35e', icon: '✦', deployDelay: 0 },
      { id: 602, side: 'enemy', lane: 0, x: 59, hp: 150, maxHp: 150, damage: 22, range: 32, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '⬢', shield: 36, maxShield: 36, deployDelay: 0 },
    ]
    shield.update(0.01)
    shield.update(0.05)
    const firstShieldHit = shield.units.find(unit => unit.id === 602)
    const shieldAbsorbs = firstShieldHit?.hp === 150
      && firstShieldHit.shield === 14
      && shield.snapshot().effects.some(effect => effect.kind === 'shield' && effect.value === 22)
    shield.units.find(unit => unit.id === 601).attackCd = 0
    shield.update(0.01)
    shield.update(0.05)
    const secondShieldHit = shield.units.find(unit => unit.id === 602)
    const shieldBreaks = secondShieldHit?.shield === 0 && secondShieldHit.hp === 142

    const territory = new BattleSimulation()
    territory.countdown = 0
    territory.aiTimer = 999
    territory.mana = 10
    const scout = CARDS.find(card => card.id === 'iron-scout')
    territory.hand = [scout]
    const homeBoundary = territory.deploymentMinimum(0) === 0.52
    const blockedAdvance = territory.deploy(scout, 0, 0.4) === false && territory.units.length === 0 && territory.mana === 10
    territory.towers.find(tower => tower.id === 'enemy-left').hp = 0
    const advancedBoundary = territory.deploymentMinimum(0) === 0.34
    const allowedAdvance = territory.deploy(scout, 0, 0.4) === true
      && territory.units.some(unit => unit.cardId === 'iron-scout' && unit.lane === 0 && unit.x === 40)
      && territory.snapshot().logs.some(log => log.includes('推进前线'))

    const riverRules = new BattleSimulation()
    riverRules.countdown = 0
    riverRules.mana = 10
    riverRules.towers.find(tower => tower.id === 'enemy-left').hp = 0
    const cloudSailor = CARDS.find(card => card.id === 'cloud-sailor')
    const staticFieldCard = CARDS.find(card => card.id === 'static-field')
    const riverDeploymentRules = riverRules.canDeployAt(scout, 0, 0.5, 0.5) === false
      && riverRules.canDeployAt(scout, 0, 0.5, 0.275) === true
      && riverRules.canDeployAt(cloudSailor, 0, 0.5, 0.5) === true
      && riverRules.canDeployAt(staticFieldCard, 0, 0.5, 0.5) === true

    const groundPath = new BattleSimulation()
    groundPath.countdown = 0
    groundPath.aiTimer = 999
    groundPath.towers.forEach(tower => { tower.active = false })
    groundPath.units = [{ id: 701, side: 'player', lane: 0, x: 70, fieldX: 50, hp: 105, maxHp: 105, damage: 18, range: 34, speed: 100, attackCd: 999, kind: 'melee', color: '#efb35e', icon: '✦', deployDelay: 0 }]
    const groundRiverSamples = []
    for (let index = 0; index < 180; index += 1) {
      groundPath.update(0.05)
      const unit = groundPath.units[0]
      if (unit && unit.x > 47.5 && unit.x < 52.5) groundRiverSamples.push(unit.fieldX ?? 50)
    }
    const groundUsesBridge = groundRiverSamples.length > 0
      && groundRiverSamples.every(fieldX => Math.abs(fieldX - 27.5) <= 7.5 || Math.abs(fieldX - 72.5) <= 7.5)
      && (groundPath.units[0]?.x ?? 100) < 47.5

    const airPath = new BattleSimulation()
    airPath.countdown = 0
    airPath.aiTimer = 999
    airPath.towers.forEach(tower => { tower.active = false })
    airPath.units = [{ id: 702, side: 'player', lane: 0, x: 70, fieldX: 50, hp: 66, maxHp: 66, damage: 15, range: 165, speed: 100, attackCd: 999, kind: 'ranged', color: '#8ed8d0', icon: '◇', airborne: true, canTargetAir: true, deployDelay: 0 }]
    const airRiverSamples = []
    for (let index = 0; index < 180; index += 1) {
      airPath.update(0.05)
      const unit = airPath.units[0]
      if (unit && unit.x > 47.5 && unit.x < 52.5) airRiverSamples.push(unit.fieldX ?? 50)
    }
    const airBypassesRiver = airRiverSamples.some(fieldX => Math.abs(fieldX - 27.5) > 7.5 && Math.abs(fieldX - 72.5) > 7.5)

    const aiTerritory = new BattleSimulation()
    aiTerritory.countdown = 0
    aiTerritory.aiTimer = 0
    aiTerritory.enemyMana = 10
    aiTerritory.enemyHand = [scout]
    aiTerritory.towers.find(tower => tower.id === 'player-left').hp = 0
    const originalRandom = Math.random
    Math.random = () => 0.9
    aiTerritory.update(0.01)
    Math.random = originalRandom
    const aiAdvances = aiTerritory.units.some(unit => unit.side === 'enemy' && unit.lane === 0 && unit.x === 62)
      && aiTerritory.snapshot().logs.some(log => log.includes('前线压进'))

    const aiShield = new BattleSimulation()
    aiShield.countdown = 0
    aiShield.aiTimer = 0
    aiShield.enemyMana = 10
    aiShield.enemyHand = [CARDS.find(card => card.id === 'brine-guards')]
    aiShield.towers.forEach(tower => { tower.active = false })
    aiShield.update(0.01)
    const aiShieldDeploy = aiShield.units.filter(unit => unit.side === 'enemy' && unit.cardId === 'brine-guards').length === 2
      && aiShield.units.filter(unit => unit.cardId === 'brine-guards').every(unit => unit.shield === 36)
      && aiShield.snapshot().logs.some(log => log.includes('盐沫盾卫'))

    const upgradeProfile = loadProfile()
    upgradeProfile.cards['brine-guards'].level = 7
    upgradeProfile.cards['ember-charger'].level = 7
    const upgradedShieldCard = cardForBattle(CARDS.find(card => card.id === 'brine-guards'), upgradeProfile)
    const upgradedDeathCard = cardForBattle(CARDS.find(card => card.id === 'ember-charger'), upgradeProfile)
    const progressionStats = upgradedShieldCard.shield === 41
      && upgradedShieldCard.hp === 171
      && upgradedDeathCard.deathDamage === 34

    const practice = new BattleSimulation()
    practice.setMode('practice')
    const practiceProfile = loadProfile()
    const profileBefore = JSON.stringify(practiceProfile)
    const practiceReward = applyBattleResult(practiceProfile, 'win', 3, 0, 'practice')
    const practiceMode = practice.aiTimer === 5.5 && practice.snapshot().logs.some(log => log.includes('不记录奖励与战绩')) && JSON.stringify(practiceProfile) === profileBefore && practiceReward.trophies === 0 && practiceReward.coins === 0 && practiceReward.xp === 0

    const chestProfile = loadProfile()
    chestProfile.chestQueue = []
    chestProfile.chestWins = 2
    const chestRewardResult = applyBattleResult(chestProfile, 'win', 1, 0, 'ranked')
    const chestReward = chestRewardResult.chestQueued === true
      && chestRewardResult.chestWins === 0
      && chestProfile.chestQueue.length === 1
      && chestProfile.chestWins === 0
    const spellVisualStyles = Object.entries({ 'flare-burst': 'flare', 'static-field': 'static', undertow: 'undertow', 'gale-pulse': 'gale' }).every(([cardId, style]) => {
      const visualSpell = new BattleSimulation()
      visualSpell.countdown = 0
      visualSpell.aiTimer = 999
      visualSpell.mana = 10
      const card = CARDS.find(item => item.id === cardId)
      visualSpell.hand = [card]
      return visualSpell.deploy(card, 0, 0.5) && visualSpell.snapshot().effects.some(effect => effect.kind === 'burst' && effect.style === style)
    })
    return { attackStarted, inFlight, impact, cadenceHeld, attackTimingData, projectileSpeedData, projectileSpeedDifference, weightData, targetingData, firstHitWaits, firstHitStarts, firstHitLands, retargetStarts, retargetWaits, retargetCompletes, clusterPriority, weakestPriority, towerTimingData, towerWindupStarts, towerPauseFreezes, towerWindupWaits, towerWindupFires, towerWindupMisses, towerRetargetStarts, towerRetargetWaits, towerRetargetCompletes, weightAffectsKnockback, stunCancelsAttack, death, tankTarget, stableLock, aiCycle, spellLocality, spellRadiusData, freeAreaSpell, splashHit, deathBurstHit, chargeReady, chargeHit, groupDeploy, shieldAbsorbs, shieldBreaks, homeBoundary, blockedAdvance, advancedBoundary, allowedAdvance, riverDeploymentRules, groundUsesBridge, airBypassesRiver, aiAdvances, aiShieldDeploy, progressionStats, practiceMode, chestReward, spellVisualStyles }
  })
  assert.deepEqual(combatRules, { attackStarted: true, inFlight: true, impact: true, cadenceHeld: true, attackTimingData: true, projectileSpeedData: true, projectileSpeedDifference: true, weightData: true, targetingData: true, firstHitWaits: true, firstHitStarts: true, firstHitLands: true, retargetStarts: true, retargetWaits: true, retargetCompletes: true, clusterPriority: true, weakestPriority: true, towerTimingData: true, towerWindupStarts: true, towerPauseFreezes: true, towerWindupWaits: true, towerWindupFires: true, towerWindupMisses: true, towerRetargetStarts: true, towerRetargetWaits: true, towerRetargetCompletes: true, weightAffectsKnockback: true, stunCancelsAttack: true, death: true, tankTarget: true, stableLock: true, aiCycle: true, spellLocality: true, spellRadiusData: true, freeAreaSpell: true, splashHit: true, deathBurstHit: true, chargeReady: true, chargeHit: true, groupDeploy: true, shieldAbsorbs: true, shieldBreaks: true, homeBoundary: true, blockedAdvance: true, advancedBoundary: true, allowedAdvance: true, riverDeploymentRules: true, groundUsesBridge: true, airBypassesRiver: true, aiAdvances: true, aiShieldDeploy: true, progressionStats: true, practiceMode: true, chestReward: true, spellVisualStyles: true }, 'combat rules should preserve free placement, free-area spells, bridge-only ground crossings, aerial river bypass, unit and tower windups, pause-safe targeting, first-hit preparation, retarget delays, target priorities, card-specific cadence, projectile speed differences, weight-based knockback, stun interruption, death feedback, building aggro, target lock, AI deck cycling, splash damage, death burst, charge attacks, group deployment, shield absorption, territory advancement, progression scaling, practice isolation, chest rewards, and spell visual identities')

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.result = null
    sim.aiTimer = 999
    sim.setPaused(false)
    sim.towers.forEach(tower => { tower.active = false })
    sim.projectiles = []
    sim.effects = [{ id: 9899, kind: 'attack', side: 'player', x1: 60, x2: 58, lane: 0, ttl: 0.3 }]
    sim.units = [
      { id: 9897, side: 'player', lane: 0, x: 60, hp: 105, maxHp: 105, damage: 18, range: 34, speed: 0, attackCd: 1.05, hitSpeed: 1.05, attackWindup: 0.3, windupRemaining: 0.3, windupDuration: 0.3, pendingTargetId: 9898, pendingTargetX: 58, kind: 'melee', color: '#efb35e', icon: '✦', name: '铁潮卫士', deployDelay: 0 },
      { id: 9898, side: 'enemy', lane: 0, x: 58, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', name: '训练靶舰', deployDelay: 0 },
    ]
  })
  await desktop.waitForTimeout(70)
  await desktop.locator('#arena').screenshot({ path: 'playtest-attack-windup.png' })

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.effects = [
      { id: 9910, kind: 'knockback', side: 'player', x1: 54, x2: 49.5, lane: 0, ttl: 0.42, value: 4.5 },
      { id: 9911, kind: 'knockback', side: 'player', x1: 54, x2: 52.5, lane: 1, ttl: 0.42, value: 1.5 },
    ]
    sim.projectiles = [
      { id: 9912, side: 'player', lane: 0, x: 66, targetX: 18, damage: 23, speed: 18, color: '#d5a268' },
      { id: 9913, side: 'player', lane: 1, x: 66, targetX: 18, damage: 11, speed: 64, color: '#8cc6bb' },
    ]
    sim.units = [
      { id: 9914, side: 'enemy', lane: 0, x: 49.5, hp: 74, maxHp: 100, damage: 9, range: 28, speed: 0, attackCd: 1, kind: 'melee', color: '#d75f61', icon: '≋', name: '轻型靶舰', weight: 'light', knockbackResistance: 0.1, deployDelay: 0 },
      { id: 9915, side: 'enemy', lane: 1, x: 52.5, hp: 234, maxHp: 260, damage: 28, range: 38, speed: 0, attackCd: 1, kind: 'tank', color: '#d75f61', icon: '◆', name: '重型靶舰', weight: 'heavy', knockbackResistance: 0.7, deployDelay: 0 },
    ]
  })
  await desktop.waitForTimeout(70)
  await desktop.locator('#arena').screenshot({ path: 'playtest-projectile-weight-feedback.png' })

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.effects = []
    sim.projectiles = []
    sim.units = [
      { id: 9920, side: 'player', lane: 0, x: 58, hp: 86, maxHp: 86, damage: 20, range: 145, speed: 0, attackCd: 1, firstAttackDelay: 0.5, firstAttackRemaining: 0.38, retargetDelay: 0.28, retargetRemaining: 0, targetPriority: 'cluster', targetId: 9922, kind: 'ranged', color: '#e9ad6a', icon: '◉', name: '礁火投弹手', deployDelay: 0 },
      { id: 9921, side: 'player', lane: 1, x: 58, hp: 72, maxHp: 72, damage: 11, range: 175, speed: 0, attackCd: 1, firstAttackRemaining: 0, retargetDelay: 0.3, retargetRemaining: 0.24, targetPriority: 'weakest', kind: 'ranged', color: '#8cc6bb', icon: '╱', name: '雾矛游骑', deployDelay: 0 },
      { id: 9922, side: 'enemy', lane: 0, x: 48, hp: 100, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', name: '密集靶舰', deployDelay: 0 },
      { id: 9923, side: 'enemy', lane: 1, x: 48, hp: 20, maxHp: 100, damage: 10, range: 30, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', name: '受损靶舰', deployDelay: 0 },
    ]
  })
  await desktop.waitForTimeout(70)
  await desktop.locator('#arena').screenshot({ path: 'playtest-targeting-timers.png' })

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.result = null
    sim.aiTimer = 999
    sim.setPaused(false)
    sim.towers.forEach(tower => {
      tower.active = false
      tower.targetId = undefined
      tower.pendingTargetId = undefined
      tower.windupRemaining = 0
      tower.windupDuration = 0
      tower.retargetRemaining = 0
    })
    const aimingTower = sim.towers.find(tower => tower.id === 'player-left')
    const searchingTower = sim.towers.find(tower => tower.id === 'player-right')
    aimingTower.active = true
    aimingTower.attackCd = 1
    aimingTower.targetId = 9931
    aimingTower.pendingTargetId = 9931
    aimingTower.windupDuration = 0.8
    aimingTower.windupRemaining = 0.6
    searchingTower.active = true
    searchingTower.attackCd = 1
    searchingTower.retargetRemaining = 0.6
    sim.effects = [{ id: 9930, kind: 'attack', side: 'player', x1: 76, x2: 68, lane: 0, ttl: 0.6 }]
    sim.projectiles = []
    sim.units = [
      { id: 9931, side: 'enemy', lane: 0, x: 68, hp: 100, maxHp: 100, damage: 10, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#d75f61', icon: '✦', name: '瞄准靶舰', deployDelay: 0 },
    ]
  })
  await desktop.waitForTimeout(70)
  await desktop.locator('#arena').screenshot({ path: 'playtest-tower-windup.png' })

  await desktop.waitForTimeout(430)
  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.result = null
    sim.aiTimer = 999
    sim.setPaused(false)
    sim.towers.forEach(tower => { tower.active = false })
    sim.projectiles = []
    sim.effects = [
      { id: 9940, kind: 'deploy', side: 'player', x1: 70, x2: 70, lane: 0, ttl: 0.7 },
      { id: 9941, kind: 'deploy', side: 'enemy', x1: 30, x2: 30, lane: 1, ttl: 0.7 },
    ]
    sim.units = [
      { id: 9942, side: 'player', lane: 0, x: 70, hp: 105, maxHp: 105, damage: 18, range: 0, speed: 0, attackCd: 999, kind: 'melee', color: '#efb35e', icon: '✦', name: '铁潮卫士', deployDelay: 0.7 },
      { id: 9943, side: 'enemy', lane: 1, x: 30, hp: 260, maxHp: 260, damage: 28, range: 0, speed: 0, attackCd: 999, kind: 'tank', color: '#d75f61', icon: '◆', name: '堤岸巨像', deployDelay: 0.7 },
      { id: 9944, side: 'player', lane: 1, x: 64, hp: 66, maxHp: 66, damage: 15, range: 0, speed: 0, attackCd: 999, kind: 'ranged', color: '#8ed8d0', icon: '◇', name: '云帆侦察艇', airborne: true, deployDelay: 0.7 },
    ]
  })
  await desktop.waitForTimeout(105)
  await desktop.locator('#arena').screenshot({ path: 'playtest-sprite-deploy.png' })

  await desktop.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.result = null
    sim.aiTimer = 999
    sim.setPaused(false)
    sim.towers.forEach(tower => { tower.active = false })
    sim.units = [
      { id: 9901, side: 'player', lane: 0, x: 58, hp: 76, maxHp: 76, damage: 16, range: 30, speed: 0, attackCd: 1, kind: 'melee', color: '#ef8079', icon: '✹', cardId: 'ember-charger', name: '余烬冲锋者', chargeDistance: 10, chargeMultiplier: 2, chargeTravel: 10, chargeReady: true, deployDelay: 0 },
    ]
  })
  await desktop.waitForTimeout(180)
  await desktop.screenshot({ path: 'playtest-charge-ready.png' })
  await desktop.close()

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await mobile.goto(baseUrl)
  await mobile.locator('#hub-battle').click()
  await mobile.waitForTimeout(1_700)
  const viewport = await mobile.locator('body').evaluate(element => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  assert.equal(viewport.width, viewport.scrollWidth, 'mobile layout must not overflow horizontally')
  assert.ok(await mobile.locator('#arena').boundingBox(), 'mobile arena should be visible')
  assert.ok(await mobile.locator('#cards').boundingBox(), 'mobile hand should be visible')
  assert.equal(await mobile.locator('.match-versus').isHidden(), false, 'mobile versus intro should be visible during countdown')
  await mobile.screenshot({ path: 'playtest-versus-mobile.png' })
  await mobile.locator('#loadout-button').click()
  assert.equal(await mobile.locator('[data-deck-preset]').count(), 3, 'mobile loadout should keep all three deck presets available')
  const mobileLoadoutViewport = await mobile.locator('.loadout-panel').evaluate(element => ({
    width: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }))
  assert.equal(mobileLoadoutViewport.width, mobileLoadoutViewport.scrollWidth, 'mobile deck presets must not overflow the loadout panel')
  await mobile.locator('[data-detail-card="cloud-sailor"]').last().click()
  assert.equal(await mobile.locator('.loadout-panel').evaluate(element => element.scrollTop), 0, 'mobile card detail should return to the top')
  assert.match(await mobile.locator('#card-detail').textContent(), /空中单位/)
  await mobile.screenshot({ path: 'playtest-playwright-mobile.png' })
  await mobile.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.logs = ['胜利：敌方主塔失守。', '敌方左塔被摧毁。']
    sim.result = 'win'
    sim.setPaused(true)
  })
  await mobile.waitForTimeout(220)
  const mobileResultBounds = await mobile.locator('.result-panel').boundingBox()
  assert.equal(await mobile.locator('#result').isHidden(), false, 'mobile result report should be visible')
  assert.ok(mobileResultBounds && mobileResultBounds.height <= 844, 'mobile result report should fit the viewport height')
  await mobile.screenshot({ path: 'playtest-result-mobile.png' })
  await mobile.locator('#again').click()
  await mobile.close()

  const practice = await browser.newPage({ viewport: { width: 1040, height: 820 } })
  await practice.goto(baseUrl)
  await practice.locator('#hub-practice').click()
  await practice.waitForTimeout(1_700)
  assert.equal(await practice.locator('.match-versus').isHidden(), false, 'practice mode should reach the versus intro')
  assert.match(await practice.locator('#versus-mode').textContent(), /潮汐演练/)
  assert.match(await practice.locator('#phase').textContent(), /潮汐演练/)
  await practice.evaluate(() => { window.__tidalTest.sim.countdown = 0 })
  await practice.waitForTimeout(220)
  assert.equal(await practice.locator('.practice-coach').isHidden(), false, 'practice mode should expose a live coach after countdown')
  assert.match(await practice.locator('.practice-coach strong').textContent(), /部署一张单位牌/)
  await practice.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.stats.playerDeployments = 1
    sim.units = [{ id: 701, side: 'player', lane: 0, x: 60, hp: 50, maxHp: 50, damage: 10, range: 30, speed: 0, attackCd: 1, kind: 'melee', color: '#efb35e', icon: '✦', deployDelay: 0 }]
  })
  await practice.waitForTimeout(220)
  assert.match(await practice.locator('.practice-coach strong').textContent(), /穿过河道/)
  await practice.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.units[0].x = 46
    sim.stats.playerSpellcasts = 1
  })
  await practice.waitForTimeout(220)
  assert.match(await practice.locator('.practice-coach strong').textContent(), /守住两座外塔/)
  await practice.screenshot({ path: 'playtest-practice-mode.png' })
  await practice.close()

  const historyReport = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await historyReport.goto(baseUrl)
  await historyReport.locator('#hub-battle').click()
  await historyReport.waitForTimeout(1_700)
  await historyReport.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.stats.playerDeployments = 4
    sim.stats.enemyDeployments = 3
    sim.stats.playerSpellcasts = 1
    sim.stats.enemySpellcasts = 2
    sim.logs = ['敌方右塔被摧毁。', '你施放 潮汐裂隙，右路命中。', '铁潮卫士 驶入左路。']
    sim.result = 'win'
  })
  await historyReport.waitForTimeout(240)
  await historyReport.locator('#result-hub').click()
  const historyRow = historyReport.locator('#battle-history [data-history-id]').first()
  assert.equal(await historyRow.isVisible(), true, 'mobile recent history should remain actionable')
  await historyRow.scrollIntoViewIfNeeded()
  await historyRow.click()
  assert.equal(await historyReport.locator('#history-report').isHidden(), false, 'a saved match should open a battle report')
  assert.match(await historyReport.locator('#history-report-stats').textContent(), /己方部署\s*4/, 'battle report should preserve deployment stats')
  assert.equal(await historyReport.locator('#history-report-deck .history-deck-card').count(), 8, 'battle report should preserve the eight-card deck')
  const historyReportBounds = await historyReport.locator('.history-report-panel').evaluate(element => ({ width: element.clientWidth, scrollWidth: element.scrollWidth, height: element.getBoundingClientRect().height }))
  assert.equal(historyReportBounds.width, historyReportBounds.scrollWidth, 'mobile battle report should not overflow horizontally')
  assert.ok(historyReportBounds.height <= 816, 'mobile battle report should fit within the visible viewport')
  await historyReport.screenshot({ path: 'playtest-history-report-mobile.png' })
  await historyReport.evaluate(async () => {
    const [{ loadProfile, applyBattleResult }, { BattleSimulation }] = await Promise.all([
      import('/src/profile.ts'),
      import('/src/simulation.ts'),
    ])
    const replaySimulation = new BattleSimulation()
    replaySimulation.countdown = 0
    replaySimulation.mana = 10
    const card = replaySimulation.snapshot().hand[0]
    replaySimulation.deploy(card, 0, 0.74)
    const profile = loadProfile()
    applyBattleResult(profile, 'win', 1, 0, 'ranked', {
      opponent: '回放训练舰队',
      deck: profile.deck,
      playerDeployments: 1,
      enemyDeployments: 0,
      playerSpellcasts: 0,
      enemySpellcasts: 0,
      events: ['铁潮卫士驶入左路。'],
      actions: replaySimulation.replayActions(),
    })
  })
  await historyReport.reload()
  await historyReport.locator('#battle-history [data-history-id]').first().click()
  assert.equal(await historyReport.locator('#watch-replay').isDisabled(), false, 'new reports with deployment actions should expose a playable replay')
  await historyReport.locator('#watch-replay').click()
  assert.equal(await historyReport.locator('.replay-dock').isHidden(), false, 'replay should expose an in-arena control dock')
  assert.equal(await historyReport.locator('[data-replay-speed="1"]').getAttribute('aria-pressed'), 'true', 'replay should begin at normal speed')
  await historyReport.locator('[data-replay-speed="2"]').click()
  assert.equal(await historyReport.locator('[data-replay-speed="2"]').getAttribute('aria-pressed'), 'true', 'replay speed control should switch to 2x')
  await historyReport.waitForTimeout(300)
  await historyReport.screenshot({ path: 'playtest-replay-controls-mobile.png' })
  assert.match(await historyReport.locator('#enemy-name').textContent(), /回放对手/)
  assert.ok(await historyReport.evaluate(() => window.__tidalTest.sim.units.some(unit => unit.side === 'player')), 'replay should dispatch saved player deployment actions into the simulation')
  assert.equal(await historyReport.locator('#cards .card').first().isDisabled(), true, 'replay should lock live card deployment')
  await historyReport.locator('#hub-button').click()
  assert.equal(await historyReport.locator('#hub').isHidden(), false, 'the replay exit control should return to the hub')
  await historyReport.close()

  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const touch = await touchContext.newPage()
  await touch.goto(baseUrl)
  await touch.locator('#hub-battle').click()
  await touch.waitForTimeout(1_700)
  await touch.locator('#cards .card').first().waitFor({ state: 'visible', timeout: 4_000 })
  await touch.evaluate(() => {
    const { sim } = window.__tidalTest
    sim.countdown = 0
    sim.mana = 10
    sim.aiTimer = 999
  })
  await touch.waitForTimeout(220)
  const touchCard = await touch.locator('#cards .card').first().boundingBox()
  const touchArena = await touch.locator('#arena').boundingBox()
  assert.ok(touchCard && touchArena, 'touch deployment requires a hand and arena')
  const touchStartX = touchCard.x + touchCard.width / 2
  const touchStartY = touchCard.y + touchCard.height / 2
  const touchEndX = touchArena.x + touchArena.width * 0.73
  const touchEndY = touchArena.y + touchArena.height * 0.79
  const touchManaBefore = await touch.locator('#mana').textContent()
  const touchSession = await touchContext.newCDPSession(touch)
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchStartX, y: touchStartY, id: 1, radiusX: 1, radiusY: 1, force: 1 }] })
  await touch.waitForTimeout(25)
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchEndX, y: touchEndY, id: 1, radiusX: 1, radiusY: 1, force: 1 }] })
  await touch.waitForTimeout(90)
  assert.equal(await touch.locator('.card-drag-ghost').count(), 1, 'touch drag should show a floating card')
  assert.equal(await touch.locator('#arena').getAttribute('data-deploy-zone'), 'ready', 'touch drag should expose a valid deployment zone')
  await touch.screenshot({ path: 'playtest-touch-drag-preview.png' })
  await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await touch.waitForTimeout(180)
  assert.equal(await touch.locator('.card-drag-ghost').count(), 0, 'touch drag ghost should clear after release')
  assert.notEqual(await touch.locator('#mana').textContent(), touchManaBefore, 'touch release should spend energy')
  assert.ok(await touch.evaluate(() => window.__tidalTest.sim.units.some(unit => unit.side === 'player')), 'touch release should deploy a player unit')
  await touchContext.close()

  console.log('Playwright smoke test passed: load, matchmaking, deploy, pointer drag, combat rules, pause/resume, loadout detail, reset, battle history, replay, mobile overflow.')
} finally {
  await browser.close()
}
