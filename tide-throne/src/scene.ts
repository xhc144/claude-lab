import Phaser from 'phaser'
import { BattleSimulation, CardKind, Snapshot, Tower, Unit } from './simulation'

const KENNEY_ASSETS = {
  scout: '/assets/kenney/player-scout.png',
  archer: '/assets/kenney/player-archer.png',
  tank: '/assets/kenney/player-tank.png',
  slimeA: '/assets/kenney/enemy-slime-a.png',
  slimeB: '/assets/kenney/enemy-slime-b.png',
  snailA: '/assets/kenney/enemy-snail-a.png',
  snailB: '/assets/kenney/enemy-snail-b.png',
  fishA: '/assets/kenney/enemy-fish-a.png',
  fishB: '/assets/kenney/enemy-fish-b.png',
  flyA: '/assets/kenney/enemy-fly-a.png',
  flyB: '/assets/kenney/enemy-fly-b.png',
  bridge: '/assets/kenney/bridge.png',
  water: '/assets/kenney/water.png',
  castle: '/assets/kenney/castle.png',
  castleSide: '/assets/kenney/castle-side.png',
  torchA: '/assets/kenney/torch-a.png',
  torchB: '/assets/kenney/torch-b.png',
  harborOutpost: '/assets/kenney-medieval-rts/harbor-outpost.png',
  harborCore: '/assets/kenney-medieval-rts/harbor-core.png',
  harborWing: '/assets/kenney-medieval-rts/harbor-wing.png',
  reefTree: '/assets/kenney-medieval-rts/reef-tree.png',
  reefLog: '/assets/kenney-medieval-rts/reef-log.png',
  reefRock: '/assets/kenney-medieval-rts/reef-rock.png',
  reefShrub: '/assets/kenney-medieval-rts/reef-shrub.png',
} as const

const TINY_DUNGEON_CHARACTERS = {
  playerScout: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0087.png',
  playerArcher: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0084.png',
  playerTank: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0086.png',
  playerAir: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0085.png',
  enemyScout: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0110.png',
  enemyArcher: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0108.png',
  enemyTank: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0111.png',
  enemyAir: '/assets/kenney-tiny-dungeon-source/Tiles/tile_0109.png',
} as const

// Kenney Toon Characters is CC0. We deliberately load its pose sequence rather
// than treating a single portrait as an "animation".
const TOON_CHARACTERS = {
  playerScout: { folder: 'Male adventurer', file: 'character_maleAdventurer' },
  playerArcher: { folder: 'Female adventurer', file: 'character_femaleAdventurer' },
  playerTank: { folder: 'Robot', file: 'character_robot' },
  playerAir: { folder: 'Female person', file: 'character_femalePerson' },
  enemyScout: { folder: 'Zombie', file: 'character_zombie' },
  enemyArcher: { folder: 'Male person', file: 'character_malePerson' },
  enemyTank: { folder: 'Robot', file: 'character_robot' },
  enemyAir: { folder: 'Male person', file: 'character_malePerson' },
} as const

type ToonCharacterKey = keyof typeof TOON_CHARACTERS

const UNIT_CHARACTER_BY_CARD: Partial<Record<string, { player: ToonCharacterKey; enemy: ToonCharacterKey }>> = {
  'iron-scout': { player: 'playerScout', enemy: 'enemyScout' },
  'signal-archer': { player: 'playerArcher', enemy: 'enemyArcher' },
  'reef-bomber': { player: 'playerAir', enemy: 'enemyArcher' },
  'ember-charger': { player: 'enemyScout', enemy: 'enemyScout' },
  breakwater: { player: 'playerTank', enemy: 'enemyTank' },
  'reef-runners': { player: 'playerScout', enemy: 'enemyArcher' },
  'lantern-school': { player: 'playerArcher', enemy: 'enemyScout' },
  'cloud-sailor': { player: 'playerAir', enemy: 'enemyAir' },
  'anchor-golem': { player: 'playerTank', enemy: 'enemyTank' },
  'mist-pike': { player: 'playerArcher', enemy: 'enemyAir' },
  'brine-guards': { player: 'playerScout', enemy: 'enemyTank' },
} as const

interface TowerViewState {
  hp: number
  active: boolean
}

interface DeploymentPreview {
  cardId: string
  kind: CardKind
  lane: 0 | 1
  fieldX?: number
  position: number
  valid: boolean
  radius?: number
}

export class BattleScene extends Phaser.Scene {
  private sim!: BattleSimulation
  private nodes = new Map<number, Phaser.GameObjects.Container>()
  private towers = new Map<string, Phaser.GameObjects.Container>()
  private projectileNodes = new Map<number, Phaser.GameObjects.Container>()
  private towerState = new Map<string, TowerViewState>()
  private fxNodes: Phaser.GameObjects.GameObject[] = []
  private terrain: Phaser.GameObjects.GameObject[] = []
  private waterLayers: Phaser.GameObjects.TileSprite[] = []
  private torchNodes: Phaser.GameObjects.Image[] = []
  private bankNodes: Array<{ node: Phaser.GameObjects.Image; baseY: number; phase: number }> = []
  private deploymentPreview: Phaser.GameObjects.Container | null = null
  private field!: Phaser.GameObjects.Graphics
  private reducedMotion = false

  constructor() {
    super('battle')
  }

  preload(): void {
    Object.entries(KENNEY_ASSETS).forEach(([key, path]) => this.load.image(`kenney-${key}`, path))
    Object.entries(TINY_DUNGEON_CHARACTERS).forEach(([key, path]) => this.load.image(`tiny-${key}`, path))
    Object.entries(TOON_CHARACTERS).forEach(([key, character]) => {
      const root = `/assets/kenney-toon-characters-source/${encodeURIComponent(character.folder)}/PNG/Poses/${character.file}`
      ;(['idle', 'jump', 'hurt', 'fallDown'] as const).forEach(pose => this.load.image(`toon-${key}-${pose}`, `${root}_${pose}.png`))
      for (let frame = 0; frame < 8; frame += 1) this.load.image(`toon-${key}-walk${frame}`, `${root}_walk${frame}.png`)
      for (let frame = 0; frame < 3; frame += 1) this.load.image(`toon-${key}-attack${frame}`, `${root}_attack${frame}.png`)
    })
  }

  create(): void {
    this.sim = this.registry.get('simulation') as BattleSimulation
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this.field = this.add.graphics().setDepth(-5)
    this.draw()
    this.scale.on('resize', () => this.draw())
  }

  update(time: number, delta: number): void {
    const replayRate = this.registry.get('replayRate') as number | undefined
    this.sim.update(delta / 1000 * (replayRate && replayRate > 0 ? replayRate : 1))
    this.animateTerrain(time, delta)
    this.render(this.sim.snapshot())
  }

  private draw(): void {
    const width = this.scale.width
    const height = this.scale.height
    this.terrain.forEach(node => node.destroy())
    this.terrain = []
    this.waterLayers = []
    this.torchNodes = []
    this.bankNodes = []
    this.field.clear()
    this.field.fillStyle(0x0b2632, 1).fillRect(0, 0, width, height)

    for (let y = 0; y < height; y += 34) {
      this.field.lineStyle(1, 0x123c47, 0.5).lineBetween(0, y, width, y)
    }
    this.field.fillStyle(0x0f303b, 0.72)
      .fillRect(width * 0.19, 0, width * 0.17, height)
      .fillRect(width * 0.64, 0, width * 0.17, height)
    this.field.lineStyle(1, 0x2d6570, 0.5)
      .lineBetween(width * 0.275, 0, width * 0.275, height)
      .lineBetween(width * 0.725, 0, width * 0.725, height)

    this.field.fillStyle(0x173c44, 0.34)
      .fillRect(0, 0, width, height * 0.47)
      .fillStyle(0x17434a, 0.26)
      .fillRect(0, height * 0.53, width, height * 0.47)

    this.field.fillStyle(0x1e7180, 1).fillRect(0, height * 0.475, width, height * 0.05)
    for (let x = -24; x < width; x += 38) {
      this.field.lineStyle(2, 0x55a8ae, 0.32).lineBetween(x, height * 0.49, x + 22, height * 0.49)
    }
    this.drawBridge(width * 0.275, height * 0.5, width * 0.17, height * 0.11)
    this.drawBridge(width * 0.725, height * 0.5, width * 0.17, height * 0.11)
    this.field.lineStyle(2, 0x65bec1, 0.38).lineBetween(width * 0.5, 0, width * 0.5, height)

    const water = this.add.tileSprite(width / 2, height * 0.5, width, height * 0.062, 'kenney-water')
      .setAlpha(0.86)
      .setDepth(-4)
    water.tileScaleX = Math.max(0.45, width / 1400)
    water.tileScaleY = Math.max(0.35, height / 1450)
    this.waterLayers.push(water)
    this.terrain.push(water)
    ;[0.275, 0.725].forEach((lane, index) => {
      const bridge = this.add.image(width * lane, height * 0.5, 'kenney-bridge')
        .setDisplaySize(width * 0.17, height * 0.095)
        .setDepth(-3)
      const torchLeft = this.add.image(width * lane - width * 0.105, height * 0.5 - height * 0.06, `kenney-${index === 0 ? 'torchA' : 'torchB'}`)
        .setDisplaySize(18, 26)
        .setAlpha(0.88)
        .setDepth(-3)
      const torchRight = this.add.image(width * lane + width * 0.105, height * 0.5 + height * 0.06, `kenney-${index === 0 ? 'torchB' : 'torchA'}`)
        .setDisplaySize(18, 26)
        .setAlpha(0.88)
        .setDepth(-3)
      this.terrain.push(bridge, torchLeft, torchRight)
      this.torchNodes.push(torchLeft, torchRight)
    })
    this.drawBankDecorations(width, height)
  }

  private animateTerrain(time: number, delta: number): void {
    if (this.reducedMotion) return
    this.waterLayers.forEach(water => { water.tilePositionX += delta * 0.018 })
    this.torchNodes.forEach((torch, index) => {
      const pulse = Math.sin(time / 132 + index * 1.7)
      torch.setAlpha(0.76 + (pulse + 1) * 0.08)
      const scale = 0.92 + (pulse + 1) * 0.045
      torch.setDisplaySize(18 * scale, 26 * scale)
    })
    this.bankNodes.forEach(({ node, baseY, phase }, index) => {
      const sway = Math.sin(time / 960 + phase) * (index % 2 ? 0.8 : 0.45)
      node.setY(baseY + sway).setAlpha(0.7 + Math.sin(time / 1200 + phase) * 0.06)
    })
  }

  private drawBankDecorations(width: number, height: number): void {
    const placements: Array<{ key: keyof typeof KENNEY_ASSETS; x: number; y: number; size: number; flip?: boolean }> = [
      { key: 'reefTree', x: 0.075, y: 0.11, size: 98 }, { key: 'reefShrub', x: 0.135, y: 0.31, size: 82 },
      { key: 'reefRock', x: 0.065, y: 0.65, size: 92 }, { key: 'reefLog', x: 0.13, y: 0.88, size: 104 },
      { key: 'reefShrub', x: 0.925, y: 0.13, size: 90, flip: true }, { key: 'reefRock', x: 0.865, y: 0.34, size: 90, flip: true },
      { key: 'reefLog', x: 0.93, y: 0.66, size: 104, flip: true }, { key: 'reefTree', x: 0.87, y: 0.88, size: 100, flip: true },
    ]
    placements.forEach((placement, index) => {
      const node = this.add.image(width * placement.x, height * placement.y, `kenney-${placement.key}`)
        .setDisplaySize(placement.size, placement.size).setFlipX(Boolean(placement.flip)).setAlpha(0.75).setDepth(-2)
      this.terrain.push(node)
      this.bankNodes.push({ node, baseY: node.y, phase: index * 0.83 })
    })
  }

  private drawBridge(x: number, y: number, width: number, height: number): void {
    this.field.fillStyle(0x936d3e, 1).fillRect(x - width / 2, y - height / 2, width, height)
    this.field.lineStyle(2, 0xc89a58, 0.75).strokeRect(x - width / 2, y - height / 2, width, height)
    for (let offset = -width / 2 + 12; offset < width / 2; offset += 18) {
      this.field.lineStyle(1, 0x5c4933, 0.75).lineBetween(x + offset, y - height / 2, x + offset, y + height / 2)
    }
  }

  private render(snapshot: Snapshot): void {
    const width = this.scale.width
    const height = this.scale.height
    this.renderDeploymentPreview(width, height)
    this.renderEffects(snapshot, width, height)
    snapshot.towers.forEach(tower => this.renderTower(tower, width, height))
    this.renderUnits(snapshot, width, height)
    this.renderProjectiles(snapshot, width, height)
  }

  private renderDeploymentPreview(width: number, height: number): void {
    const preview = this.registry.get('deploymentPreview') as DeploymentPreview | null | undefined
    if (!preview) {
      this.deploymentPreview?.setVisible(false)
      return
    }
    const x = (preview.fieldX ?? (preview.lane === 0 ? 0.275 : 0.725)) * width
    const y = Phaser.Math.Clamp(preview.position, 0.04, 0.96) * height
    const color = preview.valid ? 0x8fe8d0 : 0xff928a
    if (!this.deploymentPreview) {
      const node = this.add.container(x, y).setDepth(11)
      const ring = this.add.graphics()
      const sprite = this.add.image(0, -10, 'toon-playerScout-idle').setOrigin(0.5, 0.68)
      const marker = this.add.graphics()
      node.setData('ring', ring)
      node.setData('sprite', sprite)
      node.setData('marker', marker)
      node.add([ring, sprite, marker])
      this.deploymentPreview = node
    }
    const node = this.deploymentPreview
    const ring = node.getData('ring') as Phaser.GameObjects.Graphics
    const sprite = node.getData('sprite') as Phaser.GameObjects.Image
    const marker = node.getData('marker') as Phaser.GameObjects.Graphics
    node.setVisible(true).setPosition(x, y)
    ring.clear()
    marker.clear()
    if (preview.kind === 'spell') {
      const radius = Math.max(24, (preview.radius ?? 20) / 100 * height * 0.55)
      sprite.setVisible(false)
      ring.fillStyle(color, preview.valid ? 0.11 : 0.08).fillCircle(0, 0, radius * 0.72)
        .lineStyle(3, color, preview.valid ? 0.86 : 0.74).strokeCircle(0, 0, radius)
        .lineStyle(1.5, 0xffe7a9, 0.72).strokeCircle(0, 0, radius * 0.6)
      for (let index = 0; index < 6; index += 1) {
        const angle = index / 6 * Math.PI * 2 + (this.reducedMotion ? 0 : this.time.now / 520)
        ring.lineStyle(2, index % 2 ? 0xffe7a9 : color, 0.72)
          .lineBetween(Math.cos(angle) * radius * 0.22, Math.sin(angle) * radius * 0.22, Math.cos(angle) * radius * 0.8, Math.sin(angle) * radius * 0.8)
      }
      return
    }
    const character = UNIT_CHARACTER_BY_CARD[preview.cardId]?.player ?? 'playerScout'
    const size = this.previewDisplaySize(preview.kind)
    sprite.setVisible(true).setTexture(preview.kind === 'building' ? 'kenney-castleSide' : `toon-${character}-idle`)
      .setDisplaySize(size.width, size.height).setTint(preview.valid ? 0xc4fff1 : 0xffb5af).setAlpha(preview.valid ? 0.62 : 0.4)
    ring.fillStyle(color, preview.valid ? 0.16 : 0.1).fillEllipse(0, 9, size.width * 0.78, 10)
      .lineStyle(2, color, preview.valid ? 0.9 : 0.72).strokeEllipse(0, 9, size.width * 0.78, 10)
    marker.lineStyle(1.4, 0xffe7a9, preview.valid ? 0.9 : 0.58)
      .lineBetween(-size.width * 0.32, 10, size.width * 0.32, 10)
      .lineBetween(0, 3, 0, 17)
  }

  private previewDisplaySize(kind: CardKind): { width: number; height: number } {
    if (kind === 'building') return { width: 52, height: 52 }
    if (kind === 'tank') return { width: 38, height: 51 }
    if (kind === 'ranged') return { width: 28, height: 38 }
    return { width: 28, height: 38 }
  }

  private renderEffects(snapshot: Snapshot, width: number, height: number): void {
    this.fxNodes.forEach(node => node.destroy())
    this.fxNodes = []
    snapshot.effects.forEach(effect => {
      const effectX1 = (effect.fieldX1 ?? (effect.lane === 0 ? 27.5 : 72.5)) / 100 * width
      const effectX2 = (effect.fieldX2 ?? effect.fieldX1 ?? (effect.lane === 0 ? 27.5 : 72.5)) / 100 * width
      const laneX = effectX2
      const y1 = effect.x1 / 100 * height
      const y2 = effect.x2 / 100 * height
      const color = effect.side === 'player' ? 0x74d6c4 : 0xef6c69
      if (effect.kind === 'deploy') {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.7
        const impactRadius = 18 + progress * 36
        const alpha = Math.max(0.08, 0.96 - progress * 0.78)
        graphics.fillStyle(color, Math.max(0.06, 0.3 - progress * 0.22)).fillCircle(laneX, y2, impactRadius * 0.76)
        graphics.lineStyle(3.5, color, alpha).strokeEllipse(laneX, y2 + 9, impactRadius * 1.9, impactRadius * 0.64)
        graphics.lineStyle(1.5, 0xffe7a9, Math.max(0.14, alpha * 0.82)).strokeEllipse(laneX, y2 + 9, impactRadius * 1.28, impactRadius * 0.4)
        if (!this.reducedMotion) {
          const beamHeight = 118 * (1 - progress) + 18
          graphics.fillStyle(color, Math.max(0.035, 0.16 - progress * 0.1)).fillTriangle(laneX - 13, y2 - beamHeight, laneX + 13, y2 - beamHeight, laneX, y2 + 7)
          graphics.lineStyle(2.2, 0xfff2c7, Math.max(0.08, alpha * 0.82)).lineBetween(laneX, y2 - beamHeight, laneX, y2 - 5)
          for (let index = 0; index < 8; index += 1) {
            const angle = (Math.PI * 2 * index) / 8 + progress * 0.45
            const inner = impactRadius * 0.34
            const outer = impactRadius * (0.72 + progress * 0.34)
            graphics.lineStyle(2, index % 2 ? 0xffe7a9 : color, Math.max(0.08, alpha * 0.72)).lineBetween(laneX + Math.cos(angle) * inner, y2 + 9 + Math.sin(angle) * inner * 0.34, laneX + Math.cos(angle) * outer, y2 + 9 + Math.sin(angle) * outer * 0.34)
          }
        }
        graphics.setAlpha(this.reducedMotion ? 0.75 : Math.min(1, effect.ttl / 0.12))
        this.fxNodes.push(graphics)
        return
      }
      if (effect.kind === 'heal') {
        const graphics = this.add.graphics()
        const radius = effect.radius ? Math.max(22, effect.radius / 100 * height * 0.55) : 22
        graphics.lineStyle(4, 0x65c89f, 0.7).strokeCircle(laneX, y2, radius)
        graphics.fillStyle(0x65c89f, 0.24).fillCircle(laneX, y2, radius * 0.68)
        const text = this.add.text(laneX - 12, y2 - 35, `+${effect.value ?? 0}`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: '#9ff0c8',
          stroke: '#0b2029',
          strokeThickness: 3,
        })
        graphics.setAlpha(Math.min(1, effect.ttl / 0.25))
        text.setAlpha(Math.min(1, effect.ttl / 0.25))
        this.fxNodes.push(graphics, text)
        return
      }
      if (effect.kind === 'shield') {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.4
        graphics.lineStyle(3, 0xf0c46e, Math.max(0.12, 0.9 - progress * 0.75)).strokeCircle(laneX, y2, 22 + progress * 9)
        graphics.lineStyle(1, 0xffefd0, Math.max(0.1, 0.65 - progress * 0.55)).strokeCircle(laneX, y2, 17 + progress * 6)
        const text = this.add.text(laneX - 10, y2 - 34, `-${effect.value ?? 0}`, {
          fontSize: '13px',
          fontStyle: 'bold',
          color: '#f7d98b',
          stroke: '#0b2029',
          strokeThickness: 3,
        })
        graphics.setAlpha(this.reducedMotion ? 0.8 : 1)
        text.setAlpha(Math.min(1, effect.ttl / 0.18))
        this.fxNodes.push(graphics, text)
        return
      }
      if (effect.kind === 'knockback') {
        const graphics = this.add.graphics()
        const moved = effect.value ?? 0
        const direction = Math.sign(y2 - y1) || (effect.side === 'player' ? -1 : 1)
        const alpha = this.reducedMotion ? 0.78 : Math.min(0.92, 0.35 + effect.ttl * 1.35)
        if (moved > 0.1) {
          graphics.lineStyle(4, 0x85bddd, alpha).lineBetween(effectX1, y1, effectX2, y2)
          graphics.lineStyle(2, 0xd9f1ff, alpha)
            .lineBetween(laneX - 7, y2 - direction * 9, laneX, y2)
            .lineBetween(laneX + 7, y2 - direction * 9, laneX, y2)
        } else {
          graphics.lineStyle(3, 0xf0c46e, alpha).strokeCircle(laneX, y2, 17)
          graphics.lineStyle(1, 0xffefd0, alpha).strokeCircle(laneX, y2, 11)
        }
        const label = moved > 0.1 ? `推 ${moved.toFixed(1)}` : '稳固'
        const text = this.add.text(laneX - 16, Math.min(y1, y2) - 28, label, {
          fontSize: '11px',
          fontStyle: 'bold',
          color: moved > 0.1 ? '#bfe8ff' : '#f7d98b',
          stroke: '#0b2029',
          strokeThickness: 3,
        })
        text.setAlpha(alpha)
        this.fxNodes.push(graphics, text)
        return
      }
      if (effect.kind === 'charge') {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.42
        const alpha = this.reducedMotion ? 0.82 : Math.max(0.08, 0.95 - progress * 0.84)
        graphics.lineStyle(5, 0xf0c46e, alpha).lineBetween(effectX1, y1, effectX2, y2)
        graphics.lineStyle(2, 0xffefd0, alpha).strokeCircle(laneX, y2, 12 + progress * 16)
        graphics.fillStyle(0xef8079, alpha * 0.72).fillCircle(laneX, y2, 6)
        const text = this.add.text(laneX - 17, y2 - 38, '冲锋', {
          fontSize: '12px',
          fontStyle: 'bold',
          color: '#f7d98b',
          stroke: '#0b2029',
          strokeThickness: 3,
        })
        text.setAlpha(alpha)
        this.fxNodes.push(graphics, text)
        return
      }
      if (effect.kind === 'attack') {
        const graphics = this.add.graphics()
        const direction = Math.sign(y2 - y1) || (effect.side === 'player' ? -1 : 1)
        const alpha = this.reducedMotion ? 0.78 : Math.min(0.9, 0.28 + effect.ttl * 2.4)
        graphics.lineStyle(3, color, alpha)
          .lineBetween(effectX1 - 9, y1 + direction * 3, effectX1, y1 + direction * 12)
          .lineBetween(effectX1 + 9, y1 + direction * 3, effectX1, y1 + direction * 12)
          .lineStyle(1, 0xf0bf69, alpha * 0.72)
          .strokeCircle(effectX1, y1, 9)
        this.fxNodes.push(graphics)
        return
      }
      if (effect.kind === 'damage') {
        const text = this.add.text(laneX - 10, y2 - 18, `-${effect.value ?? 0}`, {
          fontSize: '14px',
          fontStyle: 'bold',
          color: effect.side === 'player' ? '#8fe8d0' : '#ff9a92',
          stroke: '#0b2029',
          strokeThickness: 3,
        })
        text.setAlpha(Math.min(1, effect.ttl / 0.25))
        this.fxNodes.push(text)
        return
      }
      if (effect.kind === 'death') {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.52
        const radius = 10 + progress * 22
        graphics.lineStyle(3, effect.side === 'player' ? 0x74d6c4 : 0xef6c69, Math.max(0.1, 0.85 - progress * 0.8)).strokeCircle(laneX, y2, radius)
        graphics.lineStyle(2, 0xf0bf69, Math.max(0.1, 0.7 - progress * 0.6))
        ;[-1, -0.33, 0.33, 1].forEach(offset => graphics.lineBetween(laneX + offset * radius, y2 - radius * 0.4, laneX + offset * radius * 1.35, y2 - radius * 0.95))
        this.fxNodes.push(graphics)
        return
      }
      if (effect.kind === 'impact') {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.3
        const splashRadius = effect.radius ? effect.radius / 100 * height * 0.55 : 0
        const radius = Math.max(5 + progress * 10, splashRadius * (0.72 + progress * 0.28))
        graphics.lineStyle(2, color, Math.max(0.1, 0.9 - progress * 0.75)).strokeCircle(laneX, y2, radius)
        graphics.fillStyle(color, Math.max(0.1, 0.8 - progress * 0.7)).fillCircle(laneX, y2, 3)
        this.fxNodes.push(graphics)
        return
      }
      if (effect.kind === 'burst' && effect.style) {
        const graphics = this.add.graphics()
        const progress = 1 - Math.max(0, effect.ttl) / 0.45
        const radius = effect.radius ? Math.max(24, effect.radius / 100 * height * 0.5) : 26
        const alpha = this.reducedMotion ? 0.78 : Math.max(0.08, 0.9 - progress * 0.8)
        if (effect.style === 'flare') {
          graphics.fillStyle(0xef6c69, alpha * 0.42).fillCircle(laneX, y2, radius * (0.35 + progress * 0.48))
          graphics.lineStyle(4, 0xffb05e, alpha).strokeCircle(laneX, y2, radius * (0.42 + progress * 0.55))
          graphics.lineStyle(2, 0xffedb0, alpha * 0.92).strokeCircle(laneX, y2, radius * (0.18 + progress * 0.4))
          for (let index = 0; index < 7; index += 1) {
            const angle = index / 7 * Math.PI * 2 + progress * 0.38
            const start = radius * 0.22
            const end = radius * (0.56 + progress * 0.34)
            graphics.lineStyle(2, index % 2 ? 0xffd17d : 0xef6c69, alpha)
              .lineBetween(laneX + Math.cos(angle) * start, y2 + Math.sin(angle) * start, laneX + Math.cos(angle) * end, y2 + Math.sin(angle) * end)
          }
        } else if (effect.style === 'static') {
          graphics.fillStyle(0xe8c26d, alpha * 0.14).fillCircle(laneX, y2, radius * 0.76)
          graphics.lineStyle(3, 0xffe99a, alpha).strokeCircle(laneX, y2, radius * (0.44 + progress * 0.38))
          for (let index = 0; index < 6; index += 1) {
            const angle = index / 6 * Math.PI * 2 + progress * 0.6
            const inner = radius * 0.2
            const middle = radius * 0.52
            const outer = radius * 0.76
            const x1 = laneX + Math.cos(angle) * inner
            const y1 = y2 + Math.sin(angle) * inner
            const x2 = laneX + Math.cos(angle + 0.18) * middle
            const y3 = y2 + Math.sin(angle + 0.18) * middle
            const x3 = laneX + Math.cos(angle - 0.06) * outer
            const y4 = y2 + Math.sin(angle - 0.06) * outer
            graphics.lineStyle(2, 0xfff2b7, alpha).lineBetween(x1, y1, x2, y3).lineBetween(x2, y3, x3, y4)
          }
        } else if (effect.style === 'undertow') {
          graphics.fillStyle(0x6ca8d9, alpha * 0.22).fillCircle(laneX, y2, radius * 0.74)
          for (let index = 0; index < 3; index += 1) {
            const ring = radius * (0.28 + index * 0.2 + progress * 0.16)
            graphics.lineStyle(2.5, index === 1 ? 0xbfe8ff : 0x6ca8d9, alpha * (1 - index * 0.17))
              .beginPath().arc(laneX, y2, ring, progress * Math.PI * 2 + index, progress * Math.PI * 2 + index + Math.PI * 1.45).strokePath()
          }
          graphics.lineStyle(2, 0xd9f1ff, alpha).lineBetween(laneX - radius * 0.46, y2 + 4, laneX + radius * 0.46, y2 - 4)
        } else {
          const direction = effect.side === 'player' ? -1 : 1
          graphics.fillStyle(0x85bddd, alpha * 0.18).fillCircle(laneX, y2, radius * 0.72)
          for (let index = -1; index <= 1; index += 1) {
            const offset = index * radius * 0.34
            graphics.lineStyle(3, 0xd9f1ff, alpha).lineBetween(laneX + offset, y2 + direction * radius * 0.48, laneX + offset, y2 - direction * radius * 0.44)
            graphics.lineStyle(2, 0x85bddd, alpha).lineBetween(laneX + offset - 5, y2 - direction * radius * 0.25, laneX + offset, y2 - direction * radius * 0.44).lineBetween(laneX + offset + 5, y2 - direction * radius * 0.25, laneX + offset, y2 - direction * radius * 0.44)
          }
        }
        this.fxNodes.push(graphics)
        return
      }
      const graphics = this.add.graphics()
      if (effect.kind === 'shot') {
        graphics.lineStyle(3, color, 0.9).lineBetween(effectX1, y1, effectX2, y2)
        graphics.fillStyle(color, 1).fillCircle(laneX, y2, 4)
      } else {
        const radius = effect.radius ? Math.max(22, effect.radius / 100 * height * 0.55) : 18
        graphics.lineStyle(5, color, 0.35).strokeCircle(laneX, y2, radius)
        graphics.fillStyle(color, 0.42).fillCircle(laneX, y2, Math.max(8, radius * 0.38))
      }
      this.fxNodes.push(graphics)
    })
  }

  private renderTower(tower: Tower, width: number, height: number): void {
    const { x, y } = this.towerPosition(tower, width, height)
    const size = tower.lane === 'core' ? 38 : 30
    let node = this.towers.get(tower.id)
    if (!node) {
      node = this.add.container(x, y)
      const body = this.add.graphics()
      const status = this.add.graphics()
      const art = this.add.image(0, 2, tower.lane === 'core' ? 'kenney-harborCore' : 'kenney-harborOutpost')
      const crown = this.add.text(-9, -11, '♛', {
        fontSize: tower.lane === 'core' ? '24px' : '20px',
        color: '#f4f0dc',
      })
      const health = this.add.graphics()
      const hp = this.add.text(0, size + 10, '', { fontSize: '10px', color: '#dcecf0' }).setOrigin(0.5, 0)
      node.setData('body', body)
      node.setData('status', status)
      node.setData('art', art)
      node.setData('crown', crown)
      node.setData('health', health)
      node.setData('hp', hp)
      node.add([status, body, art, crown, health, hp])
      this.towers.set(tower.id, node)
    }

    node.setPosition(x, y)
    const body = node.getData('body') as Phaser.GameObjects.Graphics
    const status = node.getData('status') as Phaser.GameObjects.Graphics
    const art = node.getData('art') as Phaser.GameObjects.Image
    const crown = node.getData('crown') as Phaser.GameObjects.Text
    const health = node.getData('health') as Phaser.GameObjects.Graphics
    const hp = node.getData('hp') as Phaser.GameObjects.Text
      body.clear()
      status.clear()
      health.clear()

    if (tower.hp > 0) {
      const teamColor = tower.side === 'player' ? 0x357ea5 : 0xb54f4f
      const stone = tower.side === 'player' ? 0x416f7d : 0x875457
      const roof = tower.side === 'player' ? 0x2e718d : 0xa4484c
      body.fillStyle(0x071920, 0.58).fillEllipse(0, size * 0.8, size * 2.25, size * 0.52)
        .fillStyle(teamColor, 0.72)
        .fillTriangle(-size * 0.93, -size * 0.7, -size * 0.93, -size * 0.06, -size * 0.56, -size * 0.26)
        .fillTriangle(size * 0.93, -size * 0.7, size * 0.93, -size * 0.06, size * 0.56, -size * 0.26)
        .fillStyle(0x112b35, 1).fillRect(-size * 0.73, -size * 0.1, size * 1.46, size * 0.98)
        .fillStyle(stone, 1).fillRect(-size * 0.59, -size * 0.16, size * 1.18, size * 0.91)
        .fillStyle(0x193944, 0.8).fillRect(-size * 0.43, size * 0.15, size * 0.86, size * 0.45)
        .fillStyle(roof, 1).fillTriangle(-size * 0.82, -size * 0.12, size * 0.82, -size * 0.12, 0, -size * 0.9)
        .lineStyle(2, tower.active ? 0xf0bf69 : 0xdcecf0, 0.9)
        .strokeTriangle(-size * 0.82, -size * 0.12, size * 0.82, -size * 0.12, 0, -size * 0.9)
        .lineBetween(-size * 0.59, -size * 0.16, -size * 0.59, size * 0.75)
        .lineBetween(size * 0.59, -size * 0.16, size * 0.59, size * 0.75)
      for (let brickY = 0; brickY < 3; brickY += 1) {
        body.lineStyle(1, 0x102830, 0.54).lineBetween(-size * 0.56, -size * 0.02 + brickY * size * 0.23, size * 0.56, -size * 0.02 + brickY * size * 0.23)
      }
      body.fillStyle(0xf0c46e, tower.active ? 0.96 : 0.58).fillRect(-size * 0.12, size * 0.03, size * 0.24, size * 0.2)
        .fillStyle(teamColor, 0.98).fillTriangle(0, -size * 0.93, size * 0.56, -size * 0.65, 0, -size * 0.43)
      const towerArtKey = tower.lane === 'core' ? 'kenney-harborCore' : 'kenney-harborOutpost'
      const artSize = tower.lane === 'core' ? size * 2.1 : size * 1.8
      const windupDuration = Math.max(0.01, tower.windupDuration || tower.attackWindup || 0.2)
      const windupProgress = tower.windupRemaining > 0
        ? Math.max(0, Math.min(1, 1 - tower.windupRemaining / windupDuration))
        : 0
      const recoil = !this.reducedMotion && tower.windupRemaining > 0 ? Math.sin(windupProgress * Math.PI) * 7 : 0
      art.setTexture(towerArtKey)
        .setDisplaySize(artSize, artSize)
        .setPosition(0, -size * 0.1 + recoil)
        .setOrigin(0.5, 0.7)
        .setAlpha(tower.windupRemaining > 0 ? 1 : 0.94)
        .setTint(tower.side === 'player' ? 0xb7f2e7 : 0xffaaa0)
        .setVisible(true)
      health.fillStyle(0x102730, 0.95).fillRect(-size, size + 3, size * 2, 4)
        .fillStyle(tower.side === 'player' ? 0x61d3a8 : 0xe98079, 1)
        .fillRect(-size, size + 3, size * 2 * Math.max(0, tower.hp / tower.maxHp), 4)
      if (tower.lane === 'core' && tower.active) {
        status.lineStyle(3, 0xf0bf69, 0.75).strokeCircle(0, 0, size + 7)
      }
      if (tower.windupRemaining > 0) {
        const direction = tower.side === 'player' ? -1 : 1
        status.lineStyle(3, 0xf0bf69, 0.95)
          .beginPath()
          .arc(0, 0, size + 10, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * windupProgress)
          .strokePath()
        status.fillStyle(0xffe0a1, 0.14 + windupProgress * 0.14).fillCircle(0, -size * 0.28, size * 0.68)
        status.lineStyle(2, 0xffe0a1, 0.9).lineBetween(0, direction * (size - 2), 0, direction * (size + 13))
        status.fillStyle(0xffe0a1, 0.95).fillTriangle(-4, direction * (size + 8), 4, direction * (size + 8), 0, direction * (size + 15))
      } else if (tower.retargetRemaining > 0) {
        status.lineStyle(2, 0x85bddd, 0.85)
          .beginPath().arc(0, 0, size + 8, -Math.PI * 0.85, -Math.PI * 0.15).strokePath()
          .beginPath().arc(0, 0, size + 8, Math.PI * 0.15, Math.PI * 0.85).strokePath()
        status.lineStyle(2, 0xd9f1ff, 0.78)
          .lineBetween(-5, -5, 5, 5)
          .lineBetween(5, -5, -5, 5)
      }
      crown.setVisible(true).setY(-size * 0.98)
      hp.setText(String(Math.ceil(tower.hp))).setColor('#dcecf0')
    } else {
      body.fillStyle(0x32434a, 1)
        .fillRect(-size, 4, size * 0.8, size * 0.45)
        .fillRect(2, -2, size * 0.85, size * 0.55)
        .lineStyle(1, 0x74878b, 0.65)
        .strokeRect(-size, 4, size * 0.8, size * 0.45)
      crown.setVisible(false)
      art.setVisible(false)
      health.setVisible(false)
      hp.setText('已摧毁').setColor('#91a4a7')
    }
    if (tower.hp > 0) health.setVisible(true)

    const previous = this.towerState.get(tower.id)
    if (previous && !previous.active && tower.active && tower.hp > 0) this.playTowerActivation(x, y, tower.side)
    if (previous && previous.hp > 0 && tower.hp <= 0) this.playTowerDestruction(x, y, tower.side)
    this.towerState.set(tower.id, { hp: tower.hp, active: tower.active })
  }

  private towerPosition(tower: Tower, width: number, height: number): { x: number; y: number } {
    const x = tower.lane === 'core' ? width * 0.5 : this.laneX(tower.lane, width) + width * (tower.lane === 0 ? -0.055 : 0.055)
    const y = tower.lane === 'core'
      ? tower.side === 'player' ? height * 0.86 : height * 0.14
      : tower.side === 'player' ? height * 0.76 : height * 0.24
    return { x, y }
  }

  private playTowerActivation(x: number, y: number, side: Tower['side']): void {
    const ring = this.add.graphics()
    ring.lineStyle(4, side === 'player' ? 0x74d6c4 : 0xef8079, 0.95).strokeCircle(x, y, 34)
    if (this.reducedMotion) {
      ring.destroy()
      return
    }
    this.tweens.add({
      targets: ring,
      scale: 1.7,
      alpha: 0,
      duration: 420,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
    this.cameras.main.shake(100, 0.003)
  }

  private playTowerDestruction(x: number, y: number, side: Tower['side']): void {
    const burst = this.add.container(x, y)
    const color = side === 'player' ? 0x74d6c4 : 0xef8079
    const offsets = [[0, 0], [-20, -8], [18, -14], [-14, 17], [22, 12]]
    offsets.forEach(([offsetX, offsetY], index) => {
      const shard = this.add.rectangle(offsetX, offsetY, 10 + index * 2, 7, color, 0.9)
      shard.setRotation(index * 0.7)
      burst.add(shard)
    })
    if (this.reducedMotion) {
      this.time.delayedCall(120, () => burst.destroy())
      return
    }
    this.tweens.add({
      targets: burst,
      scale: 1.65,
      alpha: 0,
      angle: 16,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => burst.destroy(),
    })
    this.playCrownClaim(x, y, side)
    this.cameras.main.shake(180, 0.007)
  }

  private playCrownClaim(x: number, y: number, destroyedSide: Tower['side']): void {
    const playerScored = destroyedSide === 'enemy'
    const color = playerScored ? 0x8fe8d0 : 0xff9b91
    const claim = this.add.container(x, y - 18).setDepth(24)
    const halo = this.add.graphics()
    const crest = this.add.text(0, 0, '♛', {
      fontFamily: 'Arial',
      fontSize: '34px',
      color: playerScored ? '#c9fff2' : '#ffe0d6',
      stroke: '#102630',
      strokeThickness: 4,
    }).setOrigin(0.5)
    halo.lineStyle(3, color, 0.9).strokeCircle(0, 0, 17)
    halo.lineStyle(1.5, 0xf9d68a, 0.86).strokeCircle(0, 0, 11)
    claim.add([halo, crest])
    if (this.reducedMotion) {
      this.time.delayedCall(220, () => claim.destroy())
      return
    }
    const destinationY = playerScored ? this.scale.height * 0.92 : this.scale.height * 0.08
    this.tweens.add({
      targets: claim,
      y: destinationY,
      scale: 0.58,
      alpha: 0,
      duration: 720,
      ease: 'Cubic.easeIn',
      onComplete: () => claim.destroy(),
    })
  }

  private renderUnits(snapshot: Snapshot, width: number, height: number): void {
    const active = new Set<number>()
    snapshot.units.forEach(unit => {
      active.add(unit.id)
      const x = (unit.fieldX ?? (unit.lane === 0 ? 27.5 : 72.5)) / 100 * width
      const y = unit.x / 100 * height
      let node = this.nodes.get(unit.id)
      if (!node) {
        node = this.add.container(x, y)
        const shadow = this.add.ellipse(0, unit.airborne ? 9 : 7, unit.kind === 'tank' ? 21 : 16, unit.airborne ? 5 : 6, 0x06161c, unit.airborne ? 0.32 : 0.58)
        const body = this.add.graphics()
        const status = this.add.graphics()
        const teamColor = unit.side === 'player' ? 0x61d3a8 : 0xe98079
        if (unit.kind === 'building') {
          const accent = Phaser.Display.Color.HexStringToColor(unit.color).color
          body.fillStyle(0x06161c, 0.62).fillEllipse(0, 18, 50, 15)
            .fillStyle(0x163846, 1).fillRect(-20, -4, 40, 24)
            .fillStyle(0x345965, 1).fillRect(-17, -8, 34, 23)
            .fillStyle(accent, 0.94).fillTriangle(-22, -8, 22, -8, 0, -26)
            .lineStyle(2, teamColor, 0.82).strokeRect(-17, -8, 34, 23)
            .lineStyle(2, 0xf0bf69, 0.82).lineBetween(-25, -23, 25, -23)
            .fillStyle(0x0b2029, 1).fillRect(-7, 2, 14, 13)
            .fillStyle(0xdcecf0, 0.9).fillCircle(0, -14, 4)
        } else {
          body.fillStyle(0x06161c, unit.airborne ? 0.28 : 0.44)
            .fillEllipse(0, unit.airborne ? 7 : 6, unit.kind === 'tank' ? 20 : 15, unit.airborne ? 4 : 5)
          body.lineStyle(1, teamColor, 0.34)
            .strokeEllipse(0, unit.airborne ? 7 : 6, unit.kind === 'tank' ? 18 : 14, unit.airborne ? 4 : 5)
        }
        const sprite = this.add.image(0, unit.airborne ? -7 : -4, this.unitTexture(unit, 'idle', this.time.now))
          .setOrigin(0.5, 0.68)
          .setVisible(unit.kind !== 'building')
        const badge = this.add.circle(0, 10, 3, Phaser.Display.Color.HexStringToColor(unit.color).color, 0.95).setStrokeStyle(1, teamColor, 0.9)
        const roleMark = this.add.text(0, 10, unit.icon, { fontSize: '6px', color: '#f7f3df' }).setOrigin(0.5).setAlpha(0.92)
        const hp = this.add.graphics()
        node.setData('status', status)
        node.setData('shadow', shadow)
        node.setData('sprite', sprite)
        node.setData('badge', badge)
        node.setData('roleMark', roleMark)
        node.setData('spawnedAt', this.time.now)
        node.setData('lastHp', unit.hp)
        node.setData('lastY', y)
        node.setData('hitUntil', 0)
        node.setData('textureKey', this.unitTexture(unit, 'idle', this.time.now))
        node.setData('lastMotion', 'idle')
        node.setData('landingTriggered', false)
        node.setData('isBuilding', unit.kind === 'building')
        node.setData('hp', hp)
        node.add([shadow, body, status, sprite, badge, roleMark, hp])
        this.nodes.set(unit.id, node)
      }
      const now = this.time.now
      const windupDuration = Math.max(0.01, unit.windupDuration ?? unit.attackWindup ?? 0.2)
      const windupProgress = unit.windupRemaining && unit.windupRemaining > 0
        ? Math.max(0, Math.min(1, 1 - unit.windupRemaining / windupDuration))
        : 0
      const attackDirection = Math.sign((unit.pendingTargetX ?? unit.x) - unit.x)
      const attackOffset = !this.reducedMotion && unit.windupRemaining && unit.windupRemaining > 0
        ? Math.sin(windupProgress * Math.PI) * 5 * attackDirection
        : 0
      const spawnedAt = node.getData('spawnedAt') as number
      const spawnProgress = this.reducedMotion ? 1 : Math.min(1, Math.max(0, (now - spawnedAt) / 610))
      const landingOffset = this.reducedMotion ? 0 : -84 * (1 - spawnProgress) ** 2 + Math.sin(spawnProgress * Math.PI) * 3
      const previousY = node.getData('lastY') as number
      const moving = Math.abs(previousY - y) > 0.05 && !(unit.deployDelay && unit.deployDelay > 0)
      const stride = !this.reducedMotion && moving ? Math.sin((now + unit.id * 53) / 78) * (unit.airborne ? 1.2 : 1.6) : 0
      node.setData('lastY', y)
      node.setPosition(x, y - (unit.airborne ? 5 : 0) + attackOffset + landingOffset + stride)
      node.setAlpha(0.35 + spawnProgress * 0.65)
      const deployScale = unit.deployDelay && unit.deployDelay > 0 && !this.reducedMotion ? 0.7 + (0.7 - unit.deployDelay) * 0.42 : 1
      const attackScale = !this.reducedMotion && unit.windupRemaining && unit.windupRemaining > 0 ? 1 + Math.sin(windupProgress * Math.PI) * 0.1 : 1
      const idleScale = !this.reducedMotion && !moving && spawnProgress >= 1 ? 1 + Math.sin((now + unit.id * 31) / 420) * 0.018 : 1
      node.setScale((0.66 + spawnProgress * 0.34) * deployScale * attackScale * idleScale)
      const sprite = node.getData('sprite') as Phaser.GameObjects.Image
      const motion = unit.deployDelay && unit.deployDelay > 0 ? 'deploy' : unit.windupRemaining && unit.windupRemaining > 0 ? 'attack' : moving ? 'walk' : 'idle'
      const textureKey = this.unitTexture(unit, motion, now)
      const display = this.unitDisplaySize(unit)
      if (unit.kind !== 'building') {
        sprite.setTexture(textureKey).setDisplaySize(display.width, display.height)
        sprite.setTint(unit.side === 'enemy' ? 0xffdfd8 : 0xe9fffb)
        sprite.setFlipX(unit.side === 'enemy')
      }
      const lastHp = node.getData('lastHp') as number
      if (unit.hp < lastHp) node.setData('hitUntil', now + 120)
      node.setData('lastHp', unit.hp)
      const hitUntil = node.getData('hitUntil') as number
      if (unit.kind !== 'building' && now < hitUntil) {
        sprite.setTexture(`toon-${this.unitCharacter(unit)}-hurt`).setDisplaySize(display.width, display.height).setTint(0xffffff).setTintMode(Phaser.TintModes.FILL)
        node.setData('textureKey', `toon-${this.unitCharacter(unit)}-hurt`)
      } else if (unit.kind !== 'building') {
        sprite.setTint(unit.side === 'enemy' ? 0xffdfd8 : 0xe9fffb)
        node.setData('textureKey', textureKey)
      }
      node.setData('lastMotion', motion)
      const status = node.getData('status') as Phaser.GameObjects.Graphics
      status.clear()
      const shadow = node.getData('shadow') as Phaser.GameObjects.Ellipse
      shadow.setScale(this.reducedMotion ? 1 : 0.52 + spawnProgress * 0.48)
      if (spawnProgress >= 1 && !node.getData('landingTriggered')) {
        node.setData('landingTriggered', true)
        this.playLandingBurst(x, y - (unit.airborne ? 5 : 0), unit.side, unit.kind === 'tank')
      }
      if (spawnProgress < 1 && !this.reducedMotion) {
        const beamAlpha = (1 - spawnProgress) * 0.74
        status.lineStyle(3, unit.side === 'player' ? 0x8fe8d0 : 0xffa39a, beamAlpha)
          .lineBetween(0, -46 * (1 - spawnProgress), 0, -7)
        status.lineStyle(1.4, 0xffefd0, beamAlpha)
          .lineBetween(-4, -40 * (1 - spawnProgress), 0, -7)
          .lineBetween(4, -40 * (1 - spawnProgress), 0, -7)
        status.fillStyle(0xf0bf69, beamAlpha).fillCircle(0, -46 * (1 - spawnProgress), 3)
      }
      if (unit.shield && unit.shield > 0) {
        const shieldRatio = unit.shield / Math.max(1, unit.maxShield ?? unit.shield)
        status.lineStyle(2, 0xf0c46e, 0.82).strokeCircle(0, 0, 14)
        status.lineStyle(1, 0xffefd0, 0.4 + shieldRatio * 0.35).strokeCircle(0, 0, 12)
      }
      if (unit.chargeReady) {
        status.lineStyle(2, 0xf0c46e, 0.92).strokeCircle(0, 0, 16)
        status.lineStyle(1, 0xef8079, 0.82).strokeCircle(0, 0, 14)
      }
      if (unit.firstAttackRemaining && unit.firstAttackRemaining > 0 && !(unit.deployDelay && unit.deployDelay > 0) && unit.targetId !== undefined) {
        const total = Math.max(0.01, unit.firstAttackDelay ?? unit.firstAttackRemaining)
        const progress = Math.max(0, Math.min(1, 1 - unit.firstAttackRemaining / total))
        status.lineStyle(2.5, 0xf0bf69, 0.9)
          .beginPath()
          .arc(0, 0, 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
          .strokePath()
        status.fillStyle(0xf0bf69, 0.95).fillCircle(0, -16, 2)
      }
      if (unit.retargetRemaining && unit.retargetRemaining > 0) {
        status.lineStyle(2, 0x85bddd, 0.82).strokeCircle(0, 0, 16)
        status.lineStyle(2, 0xd9f1ff, 0.8)
          .lineBetween(-4, -4, 4, 4)
          .lineBetween(4, -4, -4, 4)
      }
      if (unit.airborne) {
        status.lineStyle(1, unit.side === 'player' ? 0x74d6c4 : 0xef8079, 0.62).strokeEllipse(0, 0, 26, 16)
      } else if (unit.stunRemaining && unit.stunRemaining > 0) {
        status.lineStyle(2, 0xf0bf69, 0.9).strokeCircle(0, 0, 14)
        status.fillStyle(0xf0bf69, 0.22).fillCircle(0, 0, 12)
      } else if (unit.slowRemaining && unit.slowRemaining > 0) {
        status.lineStyle(2, 0x6ca8d9, 0.9).strokeCircle(0, 0, 14)
        status.fillStyle(0x6ca8d9, 0.18).fillCircle(0, 0, 12)
      }
      const hp = node.getData('hp') as Phaser.GameObjects.Graphics
      hp.clear()
        .fillStyle(0x18313a, 0.9).fillRect(-11, 15, 22, 2)
        .fillStyle(unit.side === 'player' ? 0x61d3a8 : 0xe98079, 1)
        .fillRect(-11, 15, 22 * Math.max(0, unit.hp / unit.maxHp), 2)
    })
    this.nodes.forEach((node, id) => {
      if (!active.has(id)) {
        this.playUnitDestruction(node)
        node.destroy()
        this.nodes.delete(id)
      }
    })
  }

  private unitTexture(unit: Unit, motion: 'idle' | 'walk' | 'attack' | 'deploy' = 'idle', time = 0): string {
    if (unit.kind === 'building') return 'kenney-castleSide'
    const character = this.unitCharacter(unit)
    if (motion === 'deploy') return `toon-${character}-jump`
    if (motion === 'walk') {
      const frame = this.reducedMotion ? 0 : Math.floor(time / 68 + unit.id * 1.7) % 8
      return `toon-${character}-walk${frame}`
    }
    if (motion === 'attack') {
      const frame = this.reducedMotion ? 1 : Math.floor(time / 72 + unit.id) % 3
      return `toon-${character}-attack${frame}`
    }
    return `toon-${character}-idle`
  }

  private unitCharacter(unit: Unit): ToonCharacterKey {
    const cardCharacter = unit.cardId ? UNIT_CHARACTER_BY_CARD[unit.cardId] : undefined
    if (cardCharacter) return cardCharacter[unit.side]
    if (unit.side === 'enemy') {
      if (unit.airborne) return 'enemyAir'
      if (unit.kind === 'tank') return 'enemyTank'
      if (unit.kind === 'ranged') return 'enemyArcher'
      return 'enemyScout'
    }
    if (unit.airborne) return 'playerAir'
    if (unit.kind === 'tank') return 'playerTank'
    if (unit.kind === 'ranged') return 'playerArcher'
    return 'playerScout'
  }

  private unitDisplaySize(unit: Unit): { width: number; height: number } {
    if (unit.kind === 'building') return { width: 46, height: 46 }
    if (unit.airborne) return { width: 26, height: 35 }
    if (unit.kind === 'tank') return { width: 34, height: 45 }
    if (unit.kind === 'ranged') return { width: 24, height: 32 }
    return { width: 24, height: 32 }
  }

  private playUnitDestruction(node: Phaser.GameObjects.Container): void {
    if (node.getData('isBuilding')) {
      const rubble = this.add.graphics().setDepth(7)
      rubble.fillStyle(0x58727a, 0.9).fillRect(node.x - 18, node.y + 5, 18, 8).fillRect(node.x + 3, node.y + 10, 16, 7)
      if (this.reducedMotion) {
        this.time.delayedCall(120, () => rubble.destroy())
      } else {
        this.tweens.add({ targets: rubble, alpha: 0, y: node.y + 22, duration: 420, ease: 'Cubic.easeOut', onComplete: () => rubble.destroy() })
      }
      return
    }
    const sprite = node.getData('sprite') as Phaser.GameObjects.Image | undefined
    const textureKey = node.getData('textureKey') as string | undefined
    if (!sprite || !textureKey) return
    const remnant = this.add.image(node.x, node.y, textureKey)
      .setDisplaySize(sprite.displayWidth * node.scaleX, sprite.displayHeight * node.scaleY)
      .setDepth(7)
    if (this.reducedMotion) {
      remnant.setAlpha(0.38)
      this.time.delayedCall(110, () => remnant.destroy())
      return
    }
    this.tweens.add({
      targets: remnant,
      y: node.y + 9,
      angle: node.x % 2 ? 24 : -24,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => remnant.destroy(),
    })
  }

  private playLandingBurst(x: number, y: number, side: Unit['side'], heavy: boolean): void {
    const color = side === 'player' ? 0x8fe8d0 : 0xffa39a
    const ring = this.add.graphics().setDepth(6)
    ring.lineStyle(heavy ? 3 : 2, color, 0.92).strokeEllipse(x, y + 8, heavy ? 32 : 24, heavy ? 12 : 9)
    ring.lineStyle(1, 0xffefd0, 0.72).strokeEllipse(x, y + 8, heavy ? 22 : 16, heavy ? 8 : 6)
    if (this.reducedMotion) {
      this.time.delayedCall(110, () => ring.destroy())
      return
    }
    this.tweens.add({
      targets: ring,
      scaleX: heavy ? 1.72 : 1.45,
      scaleY: heavy ? 1.42 : 1.25,
      alpha: 0,
      duration: heavy ? 420 : 300,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy(),
    })
    if (heavy) this.cameras.main.shake(80, 0.0035)
  }

  private renderProjectiles(snapshot: Snapshot, width: number, height: number): void {
    const active = new Set<number>()
    snapshot.projectiles.forEach(projectile => {
      active.add(projectile.id)
      const laneX = (projectile.fieldX ?? (projectile.lane === 0 ? 27.5 : 72.5)) / 100 * width
      const y = projectile.x / 100 * height
      let node = this.projectileNodes.get(projectile.id)
      if (!node) {
        node = this.add.container(laneX, y)
        const trail = this.add.graphics()
        const color = Phaser.Display.Color.HexStringToColor(projectile.color).color
        const slow = projectile.speed < 26
        const fast = projectile.speed >= 52
        const glow = this.add.circle(0, 0, slow ? 10 : fast ? 7.5 : 7, color, slow ? 0.3 : fast ? 0.3 : 0.22)
        const bolt = this.add.graphics()
        bolt.fillStyle(color, 1)
        if (slow) {
          bolt.fillCircle(0, 0, 5)
          bolt.lineStyle(1.5, 0xffefd0, 0.82).strokeCircle(0, 0, 7)
        } else if (fast) {
          bolt.fillTriangle(-3.5, 6, 0, -7, 3.5, 6)
        } else {
          bolt.fillCircle(0, 0, 3.5)
        }
        node.setData('trail', trail)
        node.setData('bolt', bolt)
        node.add([trail, glow, bolt])
        node.setDepth(8)
        this.projectileNodes.set(projectile.id, node)
      }
      const origin = projectile.originX ?? projectile.x
      const travel = Math.max(0.01, Math.abs(projectile.targetX - origin))
      const progress = Phaser.Math.Clamp(Math.abs(projectile.x - origin) / travel, 0, 1)
      const ballisticOffset = projectile.speed < 26 && !this.reducedMotion
        ? Math.sin(progress * Math.PI) * (projectile.id % 2 === 0 ? 19 : -19)
        : 0
      node.setPosition(laneX + ballisticOffset, y)
      node.setScale(projectile.speed < 26 && !this.reducedMotion ? 0.92 + Math.sin(progress * Math.PI) * 0.18 : 1)
      const trail = node.getData('trail') as Phaser.GameObjects.Graphics
      const color = Phaser.Display.Color.HexStringToColor(projectile.color).color
      const direction = Math.sign(projectile.targetX - projectile.x) || (projectile.side === 'player' ? -1 : 1)
      const trailLength = this.reducedMotion ? 6 : Phaser.Math.Clamp(projectile.speed * 0.38, 9, 24)
      const trailWidth = projectile.speed < 26 ? 3 : 2
      const trailAlpha = this.reducedMotion ? 0.3 : projectile.speed >= 52 ? 0.72 : 0.55
      trail.clear().lineStyle(trailWidth, color, trailAlpha).lineBetween(0, 0, -ballisticOffset * 0.32, -direction * trailLength)
      const bolt = node.getData('bolt') as Phaser.GameObjects.Graphics
      bolt.setRotation(direction > 0 && projectile.speed >= 52 ? Math.PI : 0)
    })
    this.projectileNodes.forEach((node, id) => {
      if (!active.has(id)) {
        node.destroy()
        this.projectileNodes.delete(id)
      }
    })
  }

  private laneX(lane: 0 | 1, width: number): number {
    return width * (lane === 0 ? 0.275 : 0.725)
  }
}
