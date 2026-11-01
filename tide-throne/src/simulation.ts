export type Side = 'player' | 'enemy'
export type Lane = 0 | 1
export type CardKind = 'melee' | 'ranged' | 'tank' | 'spell' | 'building'
export type BattleMode = 'ranked' | 'storm' | 'friendly' | 'practice'
export type TargetMode = 'any' | 'buildings'
export type UnitWeight = 'light' | 'medium' | 'heavy' | 'structure'
export type TargetPriority = 'nearest' | 'weakest' | 'cluster'

export interface Card { id:string; name:string; kind:CardKind; cost:number; icon:string; color:string; hp:number; damage:number; range:number; speed:number; description:string; hitSpeed?:number; attackWindup?:number; firstAttackDelay?:number; retargetDelay?:number; targetPriority?:TargetPriority; projectileSpeed?:number; weight?:UnitWeight; knockbackResistance?:number; airborne?:boolean; canTargetAir?:boolean; targetMode?:TargetMode; splashRadius?:number; spellRadius?:number; deathDamage?:number; deathRadius?:number; chargeDistance?:number; chargeMultiplier?:number; shield?:number; spawnCount?:number; spawnSpacing?:number; level?:number }
export interface Unit { id:number; side:Side; lane:Lane; x:number; fieldX?:number; hp:number; maxHp:number; damage:number; range:number; speed:number; attackCd:number; kind:CardKind; color:string; icon:string; cardId?:string; name?:string; hitSpeed?:number; attackWindup?:number; firstAttackDelay?:number; firstAttackRemaining?:number; retargetDelay?:number; retargetRemaining?:number; targetPriority?:TargetPriority; projectileSpeed?:number; weight?:UnitWeight; knockbackResistance?:number; windupRemaining?:number; windupDuration?:number; pendingTargetId?:number; pendingTowerId?:string; pendingTargetX?:number; pendingTargetFieldX?:number; airborne?:boolean; canTargetAir?:boolean; targetMode?:TargetMode; splashRadius?:number; deathDamage?:number; deathRadius?:number; chargeDistance?:number; chargeMultiplier?:number; chargeTravel?:number; chargeReady?:boolean; shield?:number; maxShield?:number; radius?:number; lifetime?:number; slowRemaining?:number; stunRemaining?:number; deployDelay?:number; targetId?:number }
export interface Tower { id:string; side:Side; lane:Lane|'core'; hp:number; maxHp:number; range:number; damage:number; attackCd:number; active:boolean; hitSpeed:number; attackWindup:number; projectileSpeed:number; retargetDelay:number; retargetRemaining:number; windupRemaining:number; windupDuration:number; canTargetAir?:boolean; targetId?:number; pendingTargetId?:number }
export interface Projectile { id:number; side:Side; lane:Lane; x:number; fieldX?:number; originX?:number; originFieldX?:number; targetX:number; targetFieldX?:number; damage:number; speed:number; color:string; splashRadius?:number; targetUnitId?:number; targetTowerId?:string }
export type EffectStyle = 'flare' | 'static' | 'undertow' | 'gale'
export interface Effect { id:number; kind:'shot'|'attack'|'burst'|'impact'|'death'|'damage'|'heal'|'shield'|'charge'|'knockback'|'deploy'; side:Side; x1:number; x2:number; fieldX1?:number; fieldX2?:number; lane:Lane; ttl:number; value?:number; radius?:number; style?:EffectStyle }
export interface BattleStats { playerDeployments:number; enemyDeployments:number; playerSpellcasts:number; enemySpellcasts:number; enemyTowersDown:number; playerTowersDown:number }
export interface ReplayAction { at:number; side:Side; cardId:string; lane:Lane; position:number; fieldX?:number }
export interface Snapshot { time:number; countdown:number; mana:number; enemyMana:number; manaRate:number; phase:'opening'|'surge'|'overtime'; mode:BattleMode; hand:Card[]; nextCard:Card; units:Unit[]; towers:Tower[]; projectiles:Projectile[]; effects:Effect[]; stats:BattleStats; logs:string[]; result:'win'|'lose'|'draw'|null; paused:boolean }

export const CARDS:Card[]=[
 {id:'iron-scout',name:'铁潮卫士',kind:'melee',cost:3,icon:'✦',color:'#efb35e',hp:105,damage:18,range:34,speed:42,hitSpeed:1.05,attackWindup:.18,firstAttackDelay:.16,retargetDelay:.16,targetPriority:'nearest',weight:'medium',knockbackResistance:.25,description:'近战推进，优先锁定地面单位'},
 {id:'signal-archer',name:'信标射手',kind:'ranged',cost:3,icon:'⌁',color:'#74d6c4',hp:62,damage:14,range:150,speed:30,hitSpeed:1.2,attackWindup:.22,firstAttackDelay:.24,retargetDelay:.2,targetPriority:'nearest',projectileSpeed:58,weight:'light',knockbackResistance:.1,canTargetAir:true,description:'快速信标箭远程支援，可锁定空中单位'},
 {id:'reef-bomber',name:'礁火投弹手',kind:'ranged',cost:4,icon:'◉',color:'#e9ad6a',hp:86,damage:20,range:145,speed:25,hitSpeed:1.5,attackWindup:.32,firstAttackDelay:.38,retargetDelay:.28,targetPriority:'cluster',projectileSpeed:20,weight:'medium',knockbackResistance:.3,splashRadius:8,description:'缓慢曲线投弹，优先轰击密集地面目标'},
 {id:'ember-charger',name:'余烬冲锋者',kind:'melee',cost:3,icon:'✹',color:'#ef8079',hp:76,damage:16,range:30,speed:52,hitSpeed:.9,attackWindup:.12,firstAttackDelay:.08,retargetDelay:.1,targetPriority:'weakest',weight:'light',knockbackResistance:.05,deathDamage:30,deathRadius:8,chargeDistance:10,chargeMultiplier:2,description:'追击受损目标，冲锋首击造成双倍伤害'},
 {id:'breakwater',name:'堤岸巨像',kind:'tank',cost:5,icon:'◆',color:'#da7663',hp:260,damage:28,range:38,speed:19,hitSpeed:1.4,attackWindup:.35,firstAttackDelay:.45,retargetDelay:.28,targetPriority:'nearest',weight:'heavy',knockbackResistance:.68,targetMode:'buildings',description:'高生命攻城前排，只锁定建筑目标'},
 {id:'flare-burst',name:'炽光脉冲',kind:'spell',cost:4,icon:'✹',color:'#ef6c69',hp:0,damage:48,range:180,speed:0,spellRadius:22,description:'自由落点的范围法术，清除目标区域'},
 {id:'reef-runners',name:'礁石突袭队',kind:'melee',cost:2,icon:'≋',color:'#7db6e6',hp:54,damage:9,range:28,speed:66,hitSpeed:.85,attackWindup:.12,firstAttackDelay:.06,retargetDelay:.08,targetPriority:'weakest',weight:'light',knockbackResistance:.05,spawnCount:3,spawnSpacing:1.5,description:'三人低费快攻，集中追击受损目标'},
 {id:'lantern-school',name:'灯潮游群',kind:'melee',cost:3,icon:'✣',color:'#f0c46e',hp:44,damage:8,range:26,speed:60,hitSpeed:1,attackWindup:.14,firstAttackDelay:.1,retargetDelay:.1,targetPriority:'weakest',weight:'light',knockbackResistance:0,spawnCount:4,spawnSpacing:1.2,description:'四名轻甲单位入场，擅长包围残血目标'},
 {id:'cloud-sailor',name:'云帆侦察艇',kind:'ranged',cost:3,icon:'◇',color:'#8ed8d0',hp:66,damage:15,range:165,speed:34,hitSpeed:1.15,attackWindup:.2,firstAttackDelay:.2,retargetDelay:.16,targetPriority:'nearest',projectileSpeed:48,weight:'light',knockbackResistance:.12,airborne:true,canTargetAir:true,description:'空中远射，地面近战无法锁定'},
 {id:'tide-emplacement',name:'潮汐炮台',kind:'building',cost:4,icon:'◈',color:'#b9a4e8',hp:180,damage:16,range:170,speed:0,hitSpeed:1.2,attackWindup:.24,firstAttackDelay:.32,retargetDelay:.25,targetPriority:'nearest',projectileSpeed:38,weight:'structure',knockbackResistance:1,description:'固定驻守 30 秒，自动攻击最近敌军'},
 {id:'anchor-golem',name:'锚链巨像',kind:'tank',cost:6,icon:'⬟',color:'#c98f66',hp:340,damage:34,range:36,speed:13,hitSpeed:1.6,attackWindup:.38,firstAttackDelay:.55,retargetDelay:.35,targetPriority:'nearest',weight:'heavy',knockbackResistance:.82,targetMode:'buildings',description:'重型攻城单位，只锁定建筑目标'},
 {id:'static-field',name:'静电禁区',kind:'spell',cost:5,icon:'⚡',color:'#e8c26d',hp:0,damage:72,range:180,speed:0,spellRadius:24,description:'可在全战场自由落点，压制密集部队'},
 {id:'mist-pike',name:'雾矛游骑',kind:'ranged',cost:2,icon:'╱',color:'#8cc6bb',hp:72,damage:11,range:175,speed:37,hitSpeed:1,attackWindup:.16,firstAttackDelay:.12,retargetDelay:.12,targetPriority:'weakest',projectileSpeed:64,weight:'light',knockbackResistance:.08,canTargetAir:true,description:'高速雾矛远射，优先收割受损单位'},
 {id:'harbor-mortar',name:'港湾投石机',kind:'building',cost:5,icon:'◉',color:'#d5a268',hp:220,damage:23,range:195,speed:0,hitSpeed:1.65,attackWindup:.4,firstAttackDelay:.5,retargetDelay:.3,targetPriority:'cluster',projectileSpeed:18,weight:'structure',knockbackResistance:1,description:'重型慢速炮弹，优先轰击密集敌军'},
 {id:'undertow',name:'逆潮牵引',kind:'spell',cost:3,icon:'↯',color:'#6ca8d9',hp:0,damage:30,range:170,speed:0,spellRadius:20,description:'范围冲击，削弱目标区域的部队与塔群'},
 {id:'brine-guards',name:'盐沫盾卫',kind:'melee',cost:4,icon:'⬢',color:'#b7c6d8',hp:150,damage:22,range:32,speed:27,hitSpeed:1.25,attackWindup:.26,firstAttackDelay:.24,retargetDelay:.2,targetPriority:'nearest',weight:'medium',knockbackResistance:.48,shield:36,spawnCount:2,spawnSpacing:1.5,description:'双人守线，护盾可先抵消来袭伤害'},
 {id:'mending-current',name:'修复潮涌',kind:'spell',cost:3,icon:'✚',color:'#65c89f',hp:0,damage:0,range:170,speed:0,spellRadius:20,description:'治疗目标区域的友军与防御塔'},
 {id:'gale-pulse',name:'逆风冲波',kind:'spell',cost:3,icon:'➤',color:'#85bddd',hp:0,damage:26,range:170,speed:0,spellRadius:20,description:'范围冲击，轻型敌军会被推得更远'}
]
const ENEMY_DECK_IDS=['iron-scout','signal-archer','breakwater','flare-burst','reef-runners','lantern-school','brine-guards','ember-charger','tide-emplacement','mending-current','static-field']
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
const WEIGHT_RESISTANCE:Record<UnitWeight,number>={light:.08,medium:.3,heavy:.7,structure:1}
const UNIT_SIGHT_RANGE=18
const TARGET_LEASH_RANGE=24
const BUILDING_PULL_RANGE=25
const MOVEMENT_SCALE=10
const TOWER_RADIUS=3.5
const FIELD_ASPECT_SCALE=.75
const RIVER_NORTH_BANK=47.5
const RIVER_SOUTH_BANK=52.5
const BRIDGE_FIELD_POSITIONS=[27.5,72.5] as const
const BRIDGE_HALF_WIDTH=7.5

const laneFieldX=(lane:Lane):number=>lane===0?27.5:72.5
const unitFieldX=(unit:Pick<Unit,'lane'|'fieldX'>):number=>unit.fieldX??laneFieldX(unit.lane)
const towerFieldX=(tower:Pick<Tower,'lane'>):number=>tower.lane==='core'?50:laneFieldX(tower.lane)
const fieldDistance=(x1:number,fieldX1:number,x2:number,fieldX2:number):number=>Math.hypot(x2-x1,(fieldX2-fieldX1)*FIELD_ASPECT_SCALE)
const onBridge=(fieldX:number):boolean=>BRIDGE_FIELD_POSITIONS.some(bridge=>Math.abs(fieldX-bridge)<=BRIDGE_HALF_WIDTH)

export function towerProgress(side:Side,lane:Lane|'core'):number{
 return lane==='core'?(side==='player'?86:14):(side==='player'?76:24)
}

function arenaAttackRange(range:number):number{return clamp(range/20,1.6,10)}

export class BattleSimulation {
 mode:BattleMode='ranked'
 get duration(){return this.mode==='storm'?90:150}
 mana=5; enemyMana=5; time=this.duration; countdown=3; paused=false; overtime=false; result:Snapshot['result']=null; units:Unit[]=[]; towers:Tower[]=[]; projectiles:Projectile[]=[]; effects:Effect[]=[]; logs:string[]=[]; hand:Card[]=[]; stats:BattleStats={playerDeployments:0,enemyDeployments:0,playerSpellcasts:0,enemySpellcasts:0,enemyTowersDown:0,playerTowersDown:0}
 private deckIndex=0; private nextId=1; private aiTimer=3.5; private overtimeEnemyCrowns=0; private overtimePlayerCrowns=0; private deck:Card[]; private enemyDeck:Card[]; private enemyDeckIndex=0; private enemyHand:Card[]=[]; private towerNotices=new Set<string>(); private actionTimeline:ReplayAction[]=[]; private replaying=false
 constructor(deck:Card[]=CARDS){this.deck=deck.map(card=>({...card}));this.enemyDeck=ENEMY_DECK_IDS.map(id=>CARDS.find(card=>card.id===id)!).map(card=>({...card}));this.reset()}
 setPlayerDeck(deck:Card[]){this.deck=deck.map(card=>({...card}));this.reset()}
 setMode(mode:BattleMode){this.mode=mode;this.reset()}
 reset(){
  this.mana=5;this.enemyMana=5;this.time=this.duration;this.countdown=3;this.paused=false;this.overtime=false;this.overtimeEnemyCrowns=0;this.overtimePlayerCrowns=0;this.result=null;this.nextId=1;this.aiTimer=this.mode==='storm'?2.4:this.mode==='practice'?5.5:2.7;this.deckIndex=4;this.enemyDeckIndex=4;this.units=[];this.projectiles=[];this.effects=[];this.logs=[this.mode==='storm'?'风暴冲刺：90 秒限时，能量潮汐加速。':this.mode==='friendly'?'友谊战：不影响奖杯与赛季排名。':this.mode==='practice'?'潮汐演练：较慢对手，不记录奖励与战绩。':'准备战斗：倒计时结束后部署卡牌。'];this.hand=this.deck.slice(0,4);this.enemyHand=this.enemyDeck.slice(0,4)
  this.stats={playerDeployments:0,enemyDeployments:0,playerSpellcasts:0,enemySpellcasts:0,enemyTowersDown:0,playerTowersDown:0};this.actionTimeline=[];this.replaying=false
  this.towerNotices.clear(); this.towers=[
   {id:'enemy-left',side:'enemy',lane:0,hp:180,maxHp:180,range:180,damage:12,attackCd:0,active:true,hitSpeed:1.2,attackWindup:.18,projectileSpeed:46,retargetDelay:.22,retargetRemaining:0,windupRemaining:0,windupDuration:0},{id:'enemy-right',side:'enemy',lane:1,hp:180,maxHp:180,range:180,damage:12,attackCd:0,active:true,hitSpeed:1.2,attackWindup:.18,projectileSpeed:46,retargetDelay:.22,retargetRemaining:0,windupRemaining:0,windupDuration:0},{id:'enemy-core',side:'enemy',lane:'core',hp:300,maxHp:300,range:170,damage:18,attackCd:0,active:false,hitSpeed:1,attackWindup:.24,projectileSpeed:52,retargetDelay:.16,retargetRemaining:0,windupRemaining:0,windupDuration:0},
   {id:'player-left',side:'player',lane:0,hp:180,maxHp:180,range:180,damage:12,attackCd:0,active:true,hitSpeed:1.2,attackWindup:.18,projectileSpeed:46,retargetDelay:.22,retargetRemaining:0,windupRemaining:0,windupDuration:0},{id:'player-right',side:'player',lane:1,hp:180,maxHp:180,range:180,damage:12,attackCd:0,active:true,hitSpeed:1.2,attackWindup:.18,projectileSpeed:46,retargetDelay:.22,retargetRemaining:0,windupRemaining:0,windupDuration:0},{id:'player-core',side:'player',lane:'core',hp:300,maxHp:300,range:170,damage:18,attackCd:0,active:false,hitSpeed:1,attackWindup:.24,projectileSpeed:52,retargetDelay:.16,retargetRemaining:0,windupRemaining:0,windupDuration:0}
  ]
 }
 togglePause(){if(!this.result)this.paused=!this.paused}
 setPaused(value:boolean){if(!this.result)this.paused=value}
 sendEmote(message:string){if(!this.result)this.logs.unshift(`你：${message}`)}
 deploymentMinimum(lane:Lane):number{
  const laneTower=this.towers.find(tower=>tower.side==='enemy'&&tower.lane===lane)
  return laneTower && laneTower.hp <= 0 ? .34 : .52
 }
 private enemyDeploymentMaximum(lane:Lane):number{
  const laneTower=this.towers.find(tower=>tower.side==='player'&&tower.lane===lane)
  return laneTower && laneTower.hp <= 0 ? .66 : .48
 }
 canDeployAt(card:Card,lane:Lane,position:number,fieldPosition:number):boolean{
  if(card.kind==='spell')return true
  if(position<this.deploymentMinimum(lane))return false
  const fieldX=clamp(fieldPosition*100,6,94)
  const overRiver=position*100>RIVER_NORTH_BANK&&position*100<RIVER_SOUTH_BANK
  return card.airborne||!overRiver||onBridge(fieldX)
 }
 deploy(card:Card,lane:Lane,position=0.75,fieldPosition=laneFieldX(lane)/100){
  if(this.paused||this.result)return false
  if(this.countdown>0){this.logs.unshift('战斗尚未开始。');return false}
  const handIndex=this.hand.findIndex(c=>c.id===card.id)
  if(handIndex<0||this.mana<card.cost){this.logs.unshift(this.mana<card.cost?`能量不足：${card.name} 需要 ${card.cost} 点。`:'这张卡已不在当前手牌。');return false}
  const deploymentMinimum=this.deploymentMinimum(lane)
  const fieldX=clamp(fieldPosition*100,6,94)
  if(card.kind!=='spell'&&position<deploymentMinimum){this.logs.unshift(deploymentMinimum<.52?'该位置已越过当前前线。':'单位只能部署在己方半场。');return false}
  if(!this.canDeployAt(card,lane,position,fieldPosition)){this.logs.unshift('地面单位不能部署在河面，请选择桥梁或岸边。');return false}
  this.mana-=card.cost; this.hand[handIndex]=this.drawNext(); this.stats.playerDeployments++
  if(card.kind==='spell') this.applySpell(card,'player',lane,position*100,fieldX)
   else{
   const count=card.spawnCount??1;const spacing=card.spawnSpacing??1.5;const spawnProgress=clamp(position*100,deploymentMinimum*100+4,88)
   for(let i=0;i<count;i++){const lateralOffset=(i-(count-1)/2)*spacing*1.6;this.spawnUnit(card,'player',lane,spawnProgress+i*spacing*.45,i*.08,fieldX+lateralOffset)}
   this.logs.unshift(`${card.name} ${position<.52?'从推进前线':''}驶入战场。`)
  }
  this.recordAction(card,'player',lane,position,fieldX/100)
 return true
 }
 private recordAction(card:Card,side:Side,lane:Lane,position:number,fieldX=laneFieldX(lane)/100){
  if(this.replaying)return
  this.actionTimeline.push({at:Math.round((this.duration-this.time)*10)/10,side,cardId:card.id,lane,position:Math.round(clamp(position,.04,.96)*1000)/1000,fieldX:Math.round(clamp(fieldX,.04,.96)*1000)/1000})
 }
 replayActions():ReplayAction[]{return this.actionTimeline.map(action=>({...action}))}
 beginReplay(){
  this.reset();this.countdown=0;this.mana=10;this.enemyMana=10;this.aiTimer=Number.POSITIVE_INFINITY;this.replaying=true
  this.logs=['战斗回放：按原始部署时间线重演。']
 }
 replayAction(action:ReplayAction):boolean{
  if(!this.replaying||this.result)return false
  const card=(action.side==='player'?this.deck:this.enemyDeck).find(candidate=>candidate.id===action.cardId)??CARDS.find(candidate=>candidate.id===action.cardId)
  if(!card)return false
  const position=clamp(action.position,.04,.96)
  const fieldX=clamp((action.fieldX??laneFieldX(action.lane)/100)*100,6,94)
  if(card.kind==='spell') this.applySpell(card,action.side,action.lane,position*100,fieldX)
  else{
   const count=card.spawnCount??1;const spacing=card.spawnSpacing??1.5;const minimum=action.side==='player'?this.deploymentMinimum(action.lane)*100+4:8;const maximum=action.side==='player'?88:this.enemyDeploymentMaximum(action.lane)*100-4
   const spawnProgress=clamp(position*100,Math.min(minimum,maximum),Math.max(minimum,maximum))
   for(let index=0;index<count;index++){const lateralOffset=(index-(count-1)/2)*spacing*1.6;this.spawnUnit(card,action.side,action.lane,spawnProgress+(action.side==='player'?1:-1)*index*spacing*.45,index*.08,fieldX+lateralOffset)}
   this.logs.unshift(`回放：${action.side==='player'?'己方':'敌方'}部署 ${card.name}。`)
  }
  this.actionTimeline.push({...action})
  return true
 }
 private spawnUnit(card:Card,side:Side,lane:Lane,x:number,attackCd=0,fieldX=laneFieldX(lane)){
  const id=this.nextId++
   const placedFieldX=clamp(fieldX,6,94)
   this.units.push({id,side,lane,x,fieldX:placedFieldX,hp:card.hp,maxHp:card.hp,damage:card.damage,range:card.range,speed:card.speed,attackCd,kind:card.kind,color:side==='player'?card.color:'#d75f61',icon:card.icon,cardId:card.id,name:card.name,hitSpeed:card.hitSpeed,attackWindup:card.attackWindup,firstAttackDelay:card.firstAttackDelay,firstAttackRemaining:card.firstAttackDelay,retargetDelay:card.retargetDelay,retargetRemaining:0,targetPriority:card.targetPriority,projectileSpeed:card.projectileSpeed,weight:card.weight,knockbackResistance:card.knockbackResistance,windupRemaining:0,windupDuration:0,airborne:card.airborne,canTargetAir:card.canTargetAir,targetMode:card.targetMode,splashRadius:card.splashRadius,deathDamage:card.deathDamage,deathRadius:card.deathRadius,chargeDistance:card.chargeDistance,chargeMultiplier:card.chargeMultiplier,chargeTravel:0,chargeReady:false,shield:card.shield,maxShield:card.shield,radius:card.kind==='building'?3.5:card.airborne?2:card.spawnCount&&card.spawnCount>=3?1.5:2.5,lifetime:card.kind==='building'?30:undefined,slowRemaining:0,stunRemaining:0,deployDelay:.7})
  this.effects.push({id:this.nextId++,kind:'deploy',side,x1:x,x2:x,fieldX1:placedFieldX,fieldX2:placedFieldX,lane,ttl:.7})
 }
  private drawNext(){const card=this.deck[this.deckIndex%this.deck.length];this.deckIndex++;return card}
  private drawEnemyNext(){const card=this.enemyDeck[this.enemyDeckIndex%this.enemyDeck.length];this.enemyDeckIndex++;return card}
  private useEnemyCard(card:Card):boolean{
   const index=this.enemyHand.findIndex(candidate=>candidate.id===card.id)
   if(index<0||this.enemyMana<card.cost)return false
   this.enemyMana-=card.cost
   this.enemyHand[index]=this.drawEnemyNext()
   return true
  }
 private applySpell(card:Card,side:Side,lane:Lane,center=50,fieldX=laneFieldX(lane)){
  if(side==='player')this.stats.playerSpellcasts++;else this.stats.enemySpellcasts++
  const impact=clamp(center,8,92)
  const radius=card.spellRadius??20
  const healing=card.id==='mending-current'
  const targetSide=healing?side:side==='player'?'enemy':'player'
  const impactFieldX=clamp(fieldX,6,94)
  const victims=this.units.filter(u=>u.side===targetSide&&u.hp>0&&fieldDistance(u.x,unitFieldX(u),impact,impactFieldX)<=radius)
  if(healing){victims.forEach(u=>{u.hp=clamp(u.hp+48,0,u.maxHp)});const friendlyTower=this.towers.filter(t=>t.side===side&&t.hp>0&&fieldDistance(towerProgress(side,t.lane),towerFieldX(t),impact,impactFieldX)<=radius).sort((a,b)=>fieldDistance(towerProgress(side,a.lane),towerFieldX(a),impact,impactFieldX)-fieldDistance(towerProgress(side,b.lane),towerFieldX(b),impact,impactFieldX))[0];if(friendlyTower)friendlyTower.hp=clamp(friendlyTower.hp+32,0,friendlyTower.maxHp);this.effects.push({id:this.nextId++,kind:'heal',side,x1:impact,x2:impact,fieldX1:impactFieldX,fieldX2:impactFieldX,lane,ttl:.55,value:48,radius});this.logs.unshift(`${side==='player'?'你施放':'敌方施放'} ${card.name}，目标区域恢复。`);return}
   victims.forEach(u=>{
    this.damageUnit(u,card.damage,side)
    if(card.id==='undertow')u.slowRemaining=Math.max(u.slowRemaining??0,2.4)
    if(card.id==='static-field'){u.stunRemaining=Math.max(u.stunRemaining??0,.85);this.clearPendingAttack(u)}
    if(card.id==='gale-pulse'&&u.hp>0){
     const before=u.x
     const resistance=clamp(u.knockbackResistance??WEIGHT_RESISTANCE[u.weight??'medium'],0,1)
     const distance=5*(1-resistance)
     u.x=clamp(u.x+(side==='player'?-distance:distance),4,96)
     const moved=Math.abs(u.x-before)
     if(moved>.1){this.clearPendingAttack(u);this.startRetargetDelay(u)}
     this.effects.push({id:this.nextId++,kind:'knockback',side,x1:before,x2:u.x,fieldX1:unitFieldX(u),fieldX2:unitFieldX(u),lane:u.lane,ttl:.42,value:Math.round(moved*10)/10})
    }
   })
  const tower=this.towers.filter(t=>t.side===targetSide&&t.hp>0&&fieldDistance(towerProgress(targetSide,t.lane),towerFieldX(t),impact,impactFieldX)<=radius).sort((a,b)=>fieldDistance(towerProgress(targetSide,a.lane),towerFieldX(a),impact,impactFieldX)-fieldDistance(towerProgress(targetSide,b.lane),towerFieldX(b),impact,impactFieldX))[0]
  if(tower){tower.hp=clamp(tower.hp-Math.round(card.damage*.65),0,tower.maxHp);if(tower.lane==='core')tower.active=true}
  const style: EffectStyle | undefined = card.id === 'flare-burst' ? 'flare'
    : card.id === 'static-field' ? 'static'
      : card.id === 'undertow' ? 'undertow'
        : card.id === 'gale-pulse' ? 'gale'
          : undefined
  this.effects.push({id:this.nextId++,kind:'burst',side,x1:impact,x2:impact,fieldX1:impactFieldX,fieldX2:impactFieldX,lane,ttl:.45,radius,style})
  const status=card.id==='undertow'?'减速 2.4 秒':card.id==='static-field'?'眩晕 0.85 秒':card.id==='gale-pulse'?'按重量击退敌军':'伤害'
  this.logs.unshift(`${side==='player'?'你施放':'敌方施放'} ${card.name}，目标区域范围${status}。`)
 }
 private crownCount(side:Side){const sideDown=this.towers.filter(t=>t.side===side&&t.lane!=='core'&&t.hp<=0).length;const coreDown=this.towers.some(t=>t.side===side&&t.lane==='core'&&t.hp<=0)?3:0;return sideDown+coreDown}
 private nearestBridge(fieldX:number,destinationFieldX:number):number{
  return [...BRIDGE_FIELD_POSITIONS].sort((a,b)=>(Math.abs(fieldX-a)+Math.abs(destinationFieldX-a)*.35)-(Math.abs(fieldX-b)+Math.abs(destinationFieldX-b)*.35))[0]
 }
 private movementDestination(unit:Unit,destinationX:number,destinationFieldX:number):{x:number;fieldX:number}{
  if(unit.airborne||unit.kind==='building')return{x:destinationX,fieldX:destinationFieldX}
  const currentFieldX=unitFieldX(unit)
  const bridge=this.nearestBridge(currentFieldX,destinationFieldX)
  if(unit.x>RIVER_NORTH_BANK&&destinationX<RIVER_NORTH_BANK){
   if(unit.x>RIVER_SOUTH_BANK+.25)return{x:RIVER_SOUTH_BANK+.15,fieldX:bridge}
   return{x:RIVER_NORTH_BANK-.2,fieldX:bridge}
  }
  if(unit.x<RIVER_SOUTH_BANK&&destinationX>RIVER_SOUTH_BANK){
   if(unit.x<RIVER_NORTH_BANK-.25)return{x:RIVER_NORTH_BANK-.15,fieldX:bridge}
   return{x:RIVER_SOUTH_BANK+.2,fieldX:bridge}
  }
  return{x:destinationX,fieldX:destinationFieldX}
 }
 private riverBlocksMelee(unit:Unit,targetX:number,targetFieldX:number):boolean{
  if(unit.airborne||unit.kind==='ranged'||unit.kind==='building')return false
  const crossesRiver=(unit.x>RIVER_SOUTH_BANK&&targetX<RIVER_NORTH_BANK)||(unit.x<RIVER_NORTH_BANK&&targetX>RIVER_SOUTH_BANK)
  return crossesRiver&&(!onBridge(unitFieldX(unit))||!onBridge(targetFieldX))
 }
  private aiDeploy(){
   const heal=this.enemyHand.find(c=>c.id==='mending-current'&&c.cost<=this.enemyMana)
   const damagedLane=([0,1] as Lane[]).find(lane=>this.units.filter(u=>u.side==='enemy'&&u.lane===lane&&u.hp>0).some(u=>u.hp/u.maxHp<.65))
   if(heal&&damagedLane!==undefined&&this.useEnemyCard(heal)){const targets=this.units.filter(u=>u.side==='enemy'&&u.lane===damagedLane&&u.hp>0&&u.hp/u.maxHp<.65);const center=targets.length?targets.reduce((sum,u)=>sum+u.x,0)/targets.length:50;const centerFieldX=targets.length?targets.reduce((sum,u)=>sum+unitFieldX(u),0)/targets.length:laneFieldX(damagedLane);this.applySpell(heal,'enemy',damagedLane,center,centerFieldX);this.recordAction(heal,'enemy',damagedLane,center/100,centerFieldX/100);this.stats.enemyDeployments++;return true}
   const crowdedLane=([0,1] as Lane[]).find(lane=>this.units.filter(u=>u.side==='player'&&u.lane===lane&&u.hp>0).length>=2)
   const spells=this.enemyHand.filter(c=>c.kind==='spell'&&c.cost<=this.enemyMana)
   if(crowdedLane!==undefined&&spells.length){const c=spells.sort((a,b)=>b.damage-a.damage)[0];if(this.useEnemyCard(c)){const targets=this.units.filter(u=>u.side==='player'&&u.lane===crowdedLane&&u.hp>0);const center=targets.length?targets.reduce((sum,u)=>sum+u.x,0)/targets.length:50;const centerFieldX=targets.length?targets.reduce((sum,u)=>sum+unitFieldX(u),0)/targets.length:laneFieldX(crowdedLane);this.applySpell(c,'enemy',crowdedLane,center,centerFieldX);this.recordAction(c,'enemy',crowdedLane,center/100,centerFieldX/100);this.stats.enemyDeployments++;return true}}
   const activePlayerUnits=this.units.filter(u=>u.side==='player'&&u.hp>0&&!(u.deployDelay!>0))
   const airThreat=activePlayerUnits.find(u=>u.airborne)
   const basePool=this.enemyHand.filter(c=>c.kind!=='spell'&&c.cost<=this.enemyMana)
   const antiAirPool=basePool.filter(c=>c.canTargetAir)
   const pool=airThreat&&antiAirPool.length?antiAirPool:basePool
  if(!pool.length)return false
  const laneScores=([0,1] as Lane[]).map(lane=>activePlayerUnits.filter(u=>u.lane===lane).length+(180-(this.towers.find(t=>t.side==='enemy'&&t.lane===lane)?.hp??180))/90)
   const pressureLane=(laneScores[1]>laneScores[0]?1:0) as Lane
   const lane=(airThreat?.lane??(Math.random()>.35?pressureLane:(Math.random()>.5?1:0))) as Lane
   const c=pool[Math.floor(Math.random()*pool.length)]
   if(!this.useEnemyCard(c))return false
   const count=c.spawnCount??1;const spacing=c.spawnSpacing??1.5;const enemyFront=this.enemyDeploymentMaximum(lane);const spawnProgress=enemyFront>.48?enemyFront*100-4:18;const deploymentFieldX=clamp(airThreat?unitFieldX(airThreat):laneFieldX(lane)+(Math.random()-.5)*24,8,92);for(let i=0;i<count;i++){const lateralOffset=(i-(count-1)/2)*spacing*1.6;this.spawnUnit(c,'enemy',lane,spawnProgress-i*spacing*.45,i*.08,deploymentFieldX+lateralOffset)}this.recordAction(c,'enemy',lane,spawnProgress/100,deploymentFieldX/100);this.stats.enemyDeployments++;this.logs.unshift(`敌方部署 ${c.name}${airThreat?'，拦截空中威胁':''}${enemyFront>.48?'，前线压进':''}。`);return true
  }
 update(dt:number){
  if(this.paused||this.result)return
  if(this.countdown>0){this.countdown=Math.max(0,this.countdown-dt);if(this.countdown===0)this.logs.unshift('开战：潮汐通道已开放。');return}
  const surgeThreshold=this.mode==='storm'?45:75;const phase=this.overtime?'overtime':this.time<=surgeThreshold?'surge':'opening';const manaRate=this.overtime?(this.mode==='storm'?2.8:2.2):phase==='surge'?(this.mode==='storm'?2.2:1.7):(this.mode==='storm'?1.3:0.85)
  this.time=Math.max(0,this.time-dt);this.mana=clamp(this.mana+dt*manaRate,0,10);this.enemyMana=clamp(this.enemyMana+dt*manaRate,0,10)
  if(!this.replaying){this.aiTimer-=dt;if(this.aiTimer<=0){const normalDelay=phase==='surge'?(this.mode==='storm'?2.4:3.4)+Math.random()*2:(this.mode==='storm'?3.5:5)+Math.random()*3;this.aiTimer=this.aiDeploy()?(this.mode==='practice'?normalDelay*1.45:normalDelay):.7}}
  this.units.forEach(u=>{const deployBefore=Math.max(0,u.deployDelay??0);const activeDt=Math.max(0,dt-Math.min(dt,deployBefore));u.attackCd-=dt;u.slowRemaining=Math.max(0,(u.slowRemaining??0)-dt);u.stunRemaining=Math.max(0,(u.stunRemaining??0)-dt);u.deployDelay=Math.max(0,deployBefore-dt);u.firstAttackRemaining=Math.max(0,(u.firstAttackRemaining??0)-activeDt);u.retargetRemaining=Math.max(0,(u.retargetRemaining??0)-dt);if(u.kind==='building'&&u.lifetime!==undefined){u.lifetime=Math.max(0,u.lifetime-dt);u.hp-=u.maxHp/30*dt}})
  for(const u of this.units){
   if(u.hp<=0||u.stunRemaining!>0||u.deployDelay!>0)continue
   if(u.windupRemaining!>0){u.windupRemaining=Math.max(0,u.windupRemaining!-dt);if(u.windupRemaining!<=0)this.resolvePendingAttack(u);continue}
   const target=this.acquireUnitTarget(u)
   const reach=arenaAttackRange(u.range)+(u.radius??2.5)
   const attackReady=u.firstAttackRemaining!<=0&&u.retargetRemaining!<=0
   if(target&&!this.riverBlocksMelee(u,target.x,unitFieldX(target))&&fieldDistance(u.x,unitFieldX(u),target.x,unitFieldX(target))<=reach){
    if(attackReady&&u.attackCd<=0)this.attackUnit(u,target)
    continue
   }
   const tower=this.targetTowerFor(u)
   const objectiveX=tower?towerProgress(tower.side,tower.lane):u.side==='player'?4:96
   const objectiveFieldX=tower?towerFieldX(tower):unitFieldX(u)
   if(!target&&tower&&fieldDistance(u.x,unitFieldX(u),objectiveX,objectiveFieldX)<=arenaAttackRange(u.range)+TOWER_RADIUS){
    if(attackReady&&u.attackCd<=0)this.attackTower(u,tower,objectiveX)
    continue
   }
   const directDestination=target?.x??objectiveX
   const directDestinationFieldX=target?unitFieldX(target):objectiveFieldX
   const routedDestination=this.movementDestination(u,directDestination,directDestinationFieldX)
   const destination=routedDestination.x
   const destinationFieldX=routedDestination.fieldX
   const previousX=u.x
   const previousFieldX=unitFieldX(u)
   const dx=destination-u.x
   const dFieldX=destinationFieldX-previousFieldX
   const distance=Math.max(.001,fieldDistance(u.x,previousFieldX,destination,destinationFieldX))
   const step=Math.min(distance,u.speed*dt/MOVEMENT_SCALE*(u.slowRemaining!>0?.45:1))
   u.x=clamp(u.x+dx/distance*step,4,96)
   u.fieldX=clamp(previousFieldX+dFieldX/distance*step,5,95)
   if(!u.airborne&&u.x>RIVER_NORTH_BANK&&u.x<RIVER_SOUTH_BANK&&!onBridge(u.fieldX)){
    u.x=previousX<50?RIVER_NORTH_BANK-.05:RIVER_SOUTH_BANK+.05
    u.fieldX=previousFieldX
   }
   u.lane=(u.fieldX<50?0:1) as Lane
   if(u.chargeDistance&&!u.chargeReady){u.chargeTravel=(u.chargeTravel??0)+fieldDistance(previousX,previousFieldX,u.x,u.fieldX);if(u.chargeTravel>=u.chargeDistance)u.chargeReady=true}
  }
  this.resolveGroundSpacing()
  this.units.forEach(unit=>{if(!unit.airborne&&unit.x>RIVER_NORTH_BANK&&unit.x<RIVER_SOUTH_BANK&&!onBridge(unitFieldX(unit)))unit.fieldX=this.nearestBridge(unitFieldX(unit),unitFieldX(unit))})
  const activate=(side:Side)=>{const crown=this.towers.filter(t=>t.side===side&&t.lane!=='core').some(t=>t.hp<=0);const core=this.towers.find(t=>t.side===side&&t.lane==='core');if(core&&crown)core.active=true}
  activate('player');activate('enemy')
  this.towers.forEach(t=>{if(t.hp<=0&&!this.towerNotices.has(`${t.id}:down`)){this.towerNotices.add(`${t.id}:down`);const owner=t.side==='player'?'己方':'敌方';const label=t.lane==='core'?'主塔':t.lane===0?'左塔':'右塔';this.logs.unshift(`${owner}${label}被摧毁。`)}if(t.lane==='core'&&t.active&&!this.towerNotices.has(`${t.id}:active`)){this.towerNotices.add(`${t.id}:active`);this.logs.unshift(`${t.side==='player'?'己方':'敌方'}主塔已激活，火力升级。`)}})
  this.updateTowers(dt)
  this.updateProjectiles(dt)
  this.emitUnitDeaths()
  this.effects=this.effects.map(e=>({...e,ttl:e.ttl-dt})).filter(e=>e.ttl>0)
  this.units=this.units.filter(u=>u.hp>0&&u.x>3&&u.x<97)
  const pc=this.towers.find(t=>t.id==='player-core')!,ec=this.towers.find(t=>t.id==='enemy-core')!
  if(ec.hp<=0)this.result='win';else if(pc.hp<=0)this.result='lose';else if(this.overtime&&this.crownCount('enemy')>this.overtimeEnemyCrowns)this.result='win';else if(this.overtime&&this.crownCount('player')>this.overtimePlayerCrowns)this.result='lose';else if(this.time<=0&&!this.overtime){this.overtime=true;this.time=this.mode==='storm'?20:30;this.overtimeEnemyCrowns=this.crownCount('enemy');this.overtimePlayerCrowns=this.crownCount('player');this.logs.unshift(`${this.mode==='storm'?'风暴冲刺':'常规时间'}结束：突然死亡加时开始。`)}else if(this.time<=0&&this.overtime){const score=this.towers.filter(t=>t.side==='enemy').reduce((s,t)=>s+t.maxHp-t.hp,0)-this.towers.filter(t=>t.side==='player').reduce((s,t)=>s+t.maxHp-t.hp,0);this.result=score>0?'win':score<0?'lose':'draw'}
  if(this.result&&!this.logs[0].includes('胜利')&&!this.logs[0].includes('失败')&&!this.logs[0].includes('平局'))this.logs.unshift(this.result==='win'?'胜利：敌方主塔失守。':this.result==='lose'?'失败：己方主塔失守。':'平局：时间耗尽。')
 }
 private canTargetUnit(attacker:Unit,target:Unit):boolean{
  return target.side!==attacker.side&&target.hp>0&&!(target.deployDelay!>0)&&(attacker.canTargetAir||!target.airborne)&&(attacker.targetMode!=='buildings'||target.kind==='building')
 }
 private acquireUnitTarget(attacker:Unit):Unit|undefined{
  const reach=arenaAttackRange(attacker.range)
  const leash=attacker.targetMode==='buildings'?BUILDING_PULL_RANGE+6:Math.max(TARGET_LEASH_RANGE,reach+5)
  const locked=this.units.find(target=>target.id===attacker.targetId&&this.canTargetUnit(attacker,target)&&fieldDistance(attacker.x,unitFieldX(attacker),target.x,unitFieldX(target))<=leash)
  if(locked)return locked
  if(attacker.targetId!==undefined)this.startRetargetDelay(attacker)
  if(attacker.retargetRemaining!>0)return undefined
  const sight=attacker.targetMode==='buildings'?BUILDING_PULL_RANGE:Math.max(UNIT_SIGHT_RANGE,reach+4)
  const target=this.units.filter(candidate=>this.canTargetUnit(attacker,candidate)&&fieldDistance(attacker.x,unitFieldX(attacker),candidate.x,unitFieldX(candidate))<=sight).sort((a,b)=>this.targetScore(attacker,a)-this.targetScore(attacker,b))[0]
  attacker.targetId=target?.id
  return target
 }
 private targetScore(attacker:Unit,candidate:Unit):number{
  const distance=fieldDistance(attacker.x,unitFieldX(attacker),candidate.x,unitFieldX(candidate))
  if(attacker.targetPriority==='weakest')return candidate.hp/Math.max(1,candidate.maxHp)*12+distance*.25
  if(attacker.targetPriority==='cluster'){
   const radius=attacker.splashRadius??8
   const nearby=this.units.filter(unit=>this.canTargetUnit(attacker,unit)&&unit.airborne===candidate.airborne&&fieldDistance(unit.x,unitFieldX(unit),candidate.x,unitFieldX(candidate))<=radius).length
   return distance-Math.max(0,nearby-1)*7
  }
  return distance
 }
 private startRetargetDelay(attacker:Unit):void{
  attacker.targetId=undefined
  attacker.retargetRemaining=Math.max(attacker.retargetRemaining??0,attacker.retargetDelay??0)
 }
 private targetTowerFor(attacker:Unit):Tower|undefined{
  return this.towers.filter(tower=>tower.side!==attacker.side&&tower.hp>0).sort((a,b)=>fieldDistance(attacker.x,unitFieldX(attacker),towerProgress(a.side,a.lane),towerFieldX(a))-fieldDistance(attacker.x,unitFieldX(attacker),towerProgress(b.side,b.lane),towerFieldX(b)))[0]
 }
 private attackDelay(attacker:Unit):number{
  if(attacker.hitSpeed&&attacker.hitSpeed>0)return attacker.hitSpeed
  if(attacker.kind==='building')return 1.25
  if(attacker.kind==='ranged')return 1.1
  if(attacker.kind==='tank')return 1.2
  return .8
 }
 private attackWindupDelay(attacker:Unit):number{
  if(attacker.attackWindup&&attacker.attackWindup>0)return attacker.attackWindup
  if(attacker.kind==='building')return .28
  if(attacker.kind==='ranged')return .22
  if(attacker.kind==='tank')return .3
  return .16
 }
 private attackUnit(attacker:Unit,target:Unit):void{
  this.beginAttack(attacker,target.x,target.id,undefined,unitFieldX(target))
 }
 private attackTower(attacker:Unit,tower:Tower,targetX:number):void{
  this.beginAttack(attacker,targetX,undefined,tower.id,towerFieldX(tower))
 }
 private beginAttack(attacker:Unit,targetX:number,targetId?:number,towerId?:string,targetFieldX=unitFieldX(attacker)):void{
  const windup=this.attackWindupDelay(attacker)
  attacker.windupRemaining=windup
  attacker.windupDuration=windup
  attacker.pendingTargetId=targetId
  attacker.pendingTowerId=towerId
  attacker.pendingTargetX=targetX
  attacker.pendingTargetFieldX=targetFieldX
  attacker.attackCd=this.attackDelay(attacker)
  this.effects.push({id:this.nextId++,kind:'attack',side:attacker.side,x1:attacker.x,x2:targetX,fieldX1:unitFieldX(attacker),fieldX2:targetFieldX,lane:attacker.lane,ttl:windup})
 }
 private resolvePendingAttack(attacker:Unit):void{
  const target=attacker.pendingTargetId===undefined?undefined:this.units.find(candidate=>candidate.id===attacker.pendingTargetId&&candidate.hp>0)
  const tower=attacker.pendingTowerId===undefined?undefined:this.towers.find(candidate=>candidate.id===attacker.pendingTowerId&&candidate.hp>0)
  const ranged=attacker.kind==='ranged'||attacker.kind==='building'
  if(target&&this.canTargetUnit(attacker,target)&&!this.riverBlocksMelee(attacker,target.x,unitFieldX(target))&&fieldDistance(attacker.x,unitFieldX(attacker),target.x,unitFieldX(target))<=arenaAttackRange(attacker.range)+(attacker.radius??2.5)+1){
   const damage=this.attackDamage(attacker,target.x)
   if(ranged)this.launchProjectile(attacker.side,attacker.lane,attacker.x,target.x,damage,attacker.color,attacker.projectileSpeed??40,attacker.splashRadius,target.id,undefined,unitFieldX(attacker),unitFieldX(target))
   else this.applyUnitDamage(attacker.side,attacker.lane,attacker.x,target,damage,unitFieldX(attacker))
  }else if(tower&&tower.side!==attacker.side&&!this.riverBlocksMelee(attacker,towerProgress(tower.side,tower.lane),towerFieldX(tower))&&fieldDistance(attacker.x,unitFieldX(attacker),towerProgress(tower.side,tower.lane),towerFieldX(tower))<=arenaAttackRange(attacker.range)+TOWER_RADIUS+1){
   const targetX=towerProgress(tower.side,tower.lane)
   const damage=this.attackDamage(attacker,targetX)
   if(ranged)this.launchProjectile(attacker.side,attacker.lane,attacker.x,targetX,damage,attacker.color,attacker.projectileSpeed??40,0,undefined,tower.id,unitFieldX(attacker),towerFieldX(tower))
   else this.applyTowerDamage(attacker.side,attacker.lane,attacker.x,tower,targetX,damage,unitFieldX(attacker))
  }else if(attacker.pendingTargetId!==undefined){
   this.startRetargetDelay(attacker)
  }
  this.clearPendingAttack(attacker)
 }
 private clearPendingAttack(attacker:Unit):void{
  attacker.windupRemaining=0
  attacker.windupDuration=0
  attacker.pendingTargetId=undefined
  attacker.pendingTowerId=undefined
  attacker.pendingTargetX=undefined
  attacker.pendingTargetFieldX=undefined
 }
 private attackDamage(attacker:Unit,targetX:number):number{
  if(!attacker.chargeReady)return attacker.damage
  const damage=Math.round(attacker.damage*(attacker.chargeMultiplier??2))
  attacker.chargeReady=false
  attacker.chargeTravel=0
  this.effects.push({id:this.nextId++,kind:'charge',side:attacker.side,x1:attacker.x,x2:targetX,fieldX1:unitFieldX(attacker),fieldX2:attacker.pendingTargetFieldX??unitFieldX(attacker),lane:attacker.lane,ttl:.42,value:damage})
  this.logs.unshift(`${attacker.side==='player'?'己方':'敌方'}${attacker.name??'单位'}冲锋命中，造成 ${damage} 伤害。`)
  return damage
 }
  private launchProjectile(side:Side,lane:Lane,x:number,targetX:number,damage:number,color:string,speed:number,splashRadius=0,targetUnitId?:number,targetTowerId?:string,fieldX=laneFieldX(lane),targetFieldX=fieldX):void{
  this.projectiles.push({id:this.nextId++,side,lane,x,fieldX,originX:x,originFieldX:fieldX,targetX,targetFieldX,damage,speed,color,splashRadius,targetUnitId,targetTowerId})
 }
 private applyUnitDamage(side:Side,lane:Lane,sourceX:number,target:Unit,damage:number,sourceFieldX=laneFieldX(lane)):void{
  const dealt=this.damageUnit(target,damage,side)
  this.effects.push({id:this.nextId++,kind:'burst',side,x1:sourceX,x2:target.x,fieldX1:sourceFieldX,fieldX2:unitFieldX(target),lane,ttl:.28})
  if(dealt>0)this.effects.push({id:this.nextId++,kind:'damage',side,x1:target.x,x2:target.x,fieldX1:unitFieldX(target),fieldX2:unitFieldX(target),lane:target.lane,ttl:.55,value:dealt})
 }
 private damageUnit(target:Unit,damage:number,side:Side):number{
  const shieldBefore=target.shield??0
  const absorbed=Math.min(shieldBefore,damage)
  if(absorbed>0){target.shield=shieldBefore-absorbed;this.effects.push({id:this.nextId++,kind:'shield',side,x1:target.x,x2:target.x,fieldX1:unitFieldX(target),fieldX2:unitFieldX(target),lane:target.lane,ttl:.4,value:absorbed})}
  const dealt=damage-absorbed
  target.hp-=dealt
  return dealt
 }
 private applyTowerDamage(side:Side,lane:Lane,sourceX:number,tower:Tower,targetX:number,damage:number,sourceFieldX=laneFieldX(lane)):void{
  tower.hp=clamp(tower.hp-damage,0,tower.maxHp)
  if(tower.lane==='core')tower.active=true
  this.effects.push({id:this.nextId++,kind:'burst',side,x1:sourceX,x2:targetX,fieldX1:sourceFieldX,fieldX2:towerFieldX(tower),lane,ttl:.28})
  this.effects.push({id:this.nextId++,kind:'damage',side,x1:targetX,x2:targetX,fieldX1:towerFieldX(tower),fieldX2:towerFieldX(tower),lane,ttl:.55,value:damage})
 }
 private towerCanTarget(tower:Tower,unit:Unit):boolean{
  const towerX=towerProgress(tower.side,tower.lane)
  return unit.side!==tower.side&&unit.hp>0&&!(unit.deployDelay!>0)&&(tower.canTargetAir!==false||!unit.airborne)&&fieldDistance(unit.x,unitFieldX(unit),towerX,towerFieldX(tower))<=arenaAttackRange(tower.range)+2
 }
 private clearTowerAttack(tower:Tower):void{
  tower.windupRemaining=0
  tower.windupDuration=0
  tower.pendingTargetId=undefined
 }
 private startTowerRetarget(tower:Tower):void{
  tower.targetId=undefined
  this.clearTowerAttack(tower)
  tower.retargetRemaining=Math.max(tower.retargetRemaining,tower.retargetDelay)
 }
 private beginTowerAttack(tower:Tower,target:Unit):void{
  const towerX=towerProgress(tower.side,tower.lane)
  tower.windupRemaining=tower.attackWindup
  tower.windupDuration=tower.attackWindup
  tower.pendingTargetId=target.id
  tower.attackCd=tower.hitSpeed
  this.effects.push({id:this.nextId++,kind:'attack',side:tower.side,x1:towerX,x2:target.x,fieldX1:towerFieldX(tower),fieldX2:unitFieldX(target),lane:target.lane,ttl:tower.attackWindup})
 }
 private resolveTowerAttack(tower:Tower):void{
  const target=this.units.find(unit=>unit.id===tower.pendingTargetId&&this.towerCanTarget(tower,unit))
  this.clearTowerAttack(tower)
  if(!target){this.startTowerRetarget(tower);return}
  const towerX=towerProgress(tower.side,tower.lane)
  this.launchProjectile(tower.side,target.lane,towerX,target.x,tower.damage,tower.side==='player'?'#74d6c4':'#ef6c69',tower.projectileSpeed,0,target.id,undefined,towerFieldX(tower),unitFieldX(target))
 }
 private updateTowers(dt:number):void{
  for(const tower of this.towers){
   tower.attackCd-=dt
   tower.retargetRemaining=Math.max(0,tower.retargetRemaining-dt)
   if(!tower.active||tower.hp<=0){tower.targetId=undefined;this.clearTowerAttack(tower);continue}
   if(tower.windupRemaining>0){tower.windupRemaining=Math.max(0,tower.windupRemaining-dt);if(tower.windupRemaining<=0)this.resolveTowerAttack(tower);continue}
   const towerX=towerProgress(tower.side,tower.lane)
   const locked=this.units.find(unit=>unit.id===tower.targetId&&this.towerCanTarget(tower,unit))
   if(tower.targetId!==undefined&&!locked){this.startTowerRetarget(tower);continue}
   if(tower.retargetRemaining>0)continue
   const target=locked??this.units.filter(unit=>this.towerCanTarget(tower,unit)).sort((a,b)=>fieldDistance(a.x,unitFieldX(a),towerX,towerFieldX(tower))-fieldDistance(b.x,unitFieldX(b),towerX,towerFieldX(tower)))[0]
   tower.targetId=target?.id
   if(target&&tower.attackCd<=0)this.beginTowerAttack(tower,target)
  }
 }
 private updateProjectiles(dt:number):void{
  const active:Projectile[]=[]
  for(const projectile of this.projectiles){
   const unit=projectile.targetUnitId===undefined?undefined:this.units.find(candidate=>candidate.id===projectile.targetUnitId&&candidate.hp>0)
   const tower=projectile.targetTowerId===undefined?undefined:this.towers.find(candidate=>candidate.id===projectile.targetTowerId&&candidate.hp>0)
   if(unit){projectile.targetX=unit.x;projectile.targetFieldX=unitFieldX(unit)}
   else if(tower){projectile.targetX=towerProgress(tower.side,tower.lane);projectile.targetFieldX=towerFieldX(tower)}
   const currentFieldX=projectile.fieldX??laneFieldX(projectile.lane)
   const targetFieldX=projectile.targetFieldX??currentFieldX
   const distance=fieldDistance(projectile.x,currentFieldX,projectile.targetX,targetFieldX)
   const step=projectile.speed*dt
   if(distance>step+.25){
    projectile.x+=(projectile.targetX-projectile.x)/distance*step
    projectile.fieldX=clamp(currentFieldX+(targetFieldX-currentFieldX)/distance*step,3,97)
    active.push(projectile)
    continue
   }
   projectile.x=projectile.targetX
   projectile.fieldX=targetFieldX
   if(unit){
    const splash=projectile.splashRadius??0
    const victims=splash>0?this.units.filter(candidate=>candidate.side!==projectile.side&&candidate.hp>0&&candidate.airborne===unit.airborne&&fieldDistance(candidate.x,unitFieldX(candidate),projectile.x,targetFieldX)<=splash):[unit]
    victims.forEach(victim=>{const dealt=this.damageUnit(victim,projectile.damage,projectile.side);if(dealt>0)this.effects.push({id:this.nextId++,kind:'damage',side:projectile.side,x1:victim.x,x2:victim.x,fieldX1:unitFieldX(victim),fieldX2:unitFieldX(victim),lane:victim.lane,ttl:.55,value:dealt})})
   }else if(tower){tower.hp=clamp(tower.hp-projectile.damage,0,tower.maxHp);if(tower.lane==='core')tower.active=true;this.effects.push({id:this.nextId++,kind:'damage',side:projectile.side,x1:projectile.x,x2:projectile.x,fieldX1:targetFieldX,fieldX2:targetFieldX,lane:projectile.lane,ttl:.55,value:projectile.damage})}
   this.effects.push({id:this.nextId++,kind:'impact',side:projectile.side,x1:projectile.x,x2:projectile.x,fieldX1:targetFieldX,fieldX2:targetFieldX,lane:projectile.lane,ttl:.3,radius:projectile.splashRadius})
  }
  this.projectiles=active
 }
  private emitUnitDeaths():void{
   for(const unit of this.units){
    if(unit.hp>0)continue
    const deathRadius=unit.deathRadius??unit.radius
    this.effects.push({id:this.nextId++,kind:'death',side:unit.side,x1:unit.x,x2:unit.x,fieldX1:unitFieldX(unit),fieldX2:unitFieldX(unit),lane:unit.lane,ttl:.52,radius:deathRadius})
    const owner=unit.side==='player'?'己方':'敌方'
    this.logs.unshift(`${owner}${unit.name??'单位'}被击沉。`)
    if(unit.deathDamage&&unit.deathRadius){
     const radius=unit.deathRadius
     const victims=this.units.filter(candidate=>candidate.side!==unit.side&&candidate.hp>0&&!candidate.airborne&&fieldDistance(candidate.x,unitFieldX(candidate),unit.x,unitFieldX(unit))<=radius)
     victims.forEach(victim=>{const dealt=this.damageUnit(victim,unit.deathDamage!,unit.side);if(dealt>0)this.effects.push({id:this.nextId++,kind:'damage',side:unit.side,x1:victim.x,x2:victim.x,fieldX1:unitFieldX(victim),fieldX2:unitFieldX(victim),lane:victim.lane,ttl:.55,value:dealt})})
     const tower=this.towers.filter(candidate=>candidate.side!==unit.side&&candidate.hp>0&&fieldDistance(towerProgress(candidate.side,candidate.lane),towerFieldX(candidate),unit.x,unitFieldX(unit))<=radius).sort((a,b)=>fieldDistance(towerProgress(a.side,a.lane),towerFieldX(a),unit.x,unitFieldX(unit))-fieldDistance(towerProgress(b.side,b.lane),towerFieldX(b),unit.x,unitFieldX(unit)))[0]
     if(tower){tower.hp=clamp(tower.hp-unit.deathDamage,0,tower.maxHp);if(tower.lane==='core')tower.active=true;this.effects.push({id:this.nextId++,kind:'damage',side:unit.side,x1:unit.x,x2:unit.x,fieldX1:unitFieldX(unit),fieldX2:unitFieldX(unit),lane:unit.lane,ttl:.55,value:unit.deathDamage})}
     this.effects.push({id:this.nextId++,kind:'burst',side:unit.side,x1:unit.x,x2:unit.x,fieldX1:unitFieldX(unit),fieldX2:unitFieldX(unit),lane:unit.lane,ttl:.45,radius})
     this.logs.unshift(`${owner}${unit.name??'单位'}爆裂，范围伤害。`)
    }
   }
  }
 private resolveGroundSpacing(){
  for(let i=0;i<this.units.length;i++){
   const a=this.units[i]
   if(a.hp<=0||a.airborne)continue
   for(let j=i+1;j<this.units.length;j++){
    const b=this.units[j]
    if(b.hp<=0||b.airborne||a.side!==b.side)continue
    const minDistance=(a.radius??2.5)+(b.radius??2.5)
    const aFieldX=unitFieldX(a);const bFieldX=unitFieldX(b)
    const distance=fieldDistance(a.x,aFieldX,b.x,bFieldX)
    if(distance>=minDistance)continue
    const offset=(minDistance-distance)/2
    if(distance<.01){const direction=a.id<b.id?-1:1;a.fieldX=clamp(aFieldX+direction*offset,5,95);b.fieldX=clamp(bFieldX-direction*offset,5,95);continue}
    const dx=(a.x-b.x)/distance;const dFieldX=(aFieldX-bFieldX)*FIELD_ASPECT_SCALE/distance
    a.x=clamp(a.x+dx*offset,4,96);b.x=clamp(b.x-dx*offset,4,96)
    a.fieldX=clamp(aFieldX+dFieldX*offset/FIELD_ASPECT_SCALE,5,95);b.fieldX=clamp(bFieldX-dFieldX*offset/FIELD_ASPECT_SCALE,5,95)
   }
  }
 }
  snapshot():Snapshot{const enemyTowersDown=this.crownCount('enemy');const playerTowersDown=this.crownCount('player');const surgeThreshold=this.mode==='storm'?45:75;const phase=this.overtime?'overtime':this.time<=surgeThreshold?'surge':'opening';const manaRate=this.overtime?(this.mode==='storm'?2.8:2.2):phase==='surge'?(this.mode==='storm'?2.2:1.7):(this.mode==='storm'?1.3:0.85);const nextCard=this.deck[this.deckIndex%this.deck.length];return{time:this.time,countdown:this.countdown,mana:this.mana,enemyMana:this.enemyMana,manaRate,phase,mode:this.mode,hand:this.hand.map(c=>({...c})),nextCard:{...nextCard},units:this.units.map(u=>({...u})),towers:this.towers.map(t=>({...t})),projectiles:this.projectiles.map(p=>({...p})),effects:this.effects.map(e=>({...e})),stats:{...this.stats,enemyTowersDown,playerTowersDown},logs:this.logs.slice(0,5),result:this.result,paused:this.paused}}
}
