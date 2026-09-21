import { recordingHandler } from './lib/recording-server.mjs';
import { localToken } from './lib/config.mjs';
import mineflayer from 'mineflayer';
import {currentWaypoint,boundedWaypoint} from './navigation.mjs';
import {findCraftingTables} from './crafting-access.mjs';
import {startNativeRecording} from './native-record.mjs';
import {installNativeMirror} from './native-mirror.mjs';
import pathfinderPkg from 'mineflayer-pathfinder';
import viewerPkg from 'prismarine-viewer';
import {Vec3} from 'vec3';
import {mkdirSync,writeFileSync,appendFileSync,readFileSync,existsSync} from 'node:fs';
import http from 'node:http';
import {terrainObservation} from './observe.mjs';
import {dragonKillAward,gameWon,dragonDeathState} from './evidence.mjs';
import {extraActions,battleObservation,updateDragonSensor} from './extra-actions.mjs';
import {installBoat} from './boat.mjs';
import {decide,plan,plannerModel,plannerName} from './models.mjs';
import {reachedWaypoint,failureCooldown,planTrigger,stageFor,selectUsefulOptions,preparationNeeds,woodNeeded,craftNeeded} from './optimization/policy.mjs';
const {pathfinder,Movements,goals}=pathfinderPkg;
const run=process.env.RUN_ID||'practice-01';const dir='runs/'+run;mkdirSync(dir,{recursive:true});
const bot=mineflayer.createBot({host:'127.0.0.1',port:Number(process.env.MC_PORT||25576),username:process.env.BOT_NAME||'JevAstra',version:'1.16.5'});bot.loadPlugin(pathfinder);const boatControl=installBoat(bot);
const nativeMirror=process.env.NATIVE_VIEW==='1'?installNativeMirror(bot):null;
const saved=existsSync(dir+'/status.json')?JSON.parse(readFileSync(dir+'/status.json','utf8')):{};
let currentPlan=saved.plan||null,steps=saved.steps||0,busy=false,last=saved.recent||[],dead=false,stopped=false,active='connecting',plans=0,errors=0;
if(process.env.DRAGON_SENSOR_URL)setInterval(async()=>{try{const r=await fetch(process.env.DRAGON_SENSOR_URL,{signal:AbortSignal.timeout(500)});updateDragonSensor(await r.json());}catch{}},50);
const seedRoute=JSON.parse(readFileSync('optimization/seed-route.json','utf8')).waypoints;let routeIndex=saved.routeIndex||0,travelStarted=!!saved.travelStarted;
let planning=null,planStep=-999,planDimension=null,lastPlanAt=0,planStage=null,planRouteIndex=-1;
let dragonKilled=false,won=false,recordReady=false,recordFinished=false,captureEnabled=false,finishNative=null;
const looted=new Set(saved.looted||[]),failed=new Map();
const log=(type,data)=>appendFileSync(dir+'/events.jsonl',JSON.stringify({time:new Date().toISOString(),type,...data})+'\n');
const pos=p=>({x:Math.round(p.x*10)/10,y:Math.round(p.y*10)/10,z:Math.round(p.z*10)/10});
const inv=()=>Object.fromEntries(bot.inventory.items().map(i=>i.name).filter((n,i,a)=>a.indexOf(n)===i).map(n=>[n,bot.inventory.items().filter(i=>i.name===n).reduce((s,i)=>s+i.count,0)]));
function snapshot(){if(bot.entity&&!travelStarted&&stageFor({inventory:inv(),dimension:bot.game?.dimension,position:bot.entity.position,vehicle:bot.vehicle})==='travel')travelStarted=true;if(bot.entity&&stageFor({inventory:inv(),dimension:bot.game?.dimension,position:bot.entity.position,vehicle:bot.vehicle,travelStarted})==='travel')while(routeIndex<seedRoute.length&&Math.hypot(bot.entity.position.x-seedRoute[routeIndex].x,bot.entity.position.z-seedRoute[routeIndex].z)<(routeIndex===seedRoute.length-1?2.5:12))routeIndex++;return {run,routeIndex,travelStarted,steps,active,plannerModel,plannerName,dragonKilled,won,recordReady,recordFinished,looted:[...looted],position:bot.entity?pos(bot.entity.position):null,health:bot.health,food:bot.food,oxygen:bot.oxygenLevel,inWater:bot.entity?.isInWater,difficulty:bot.game?.difficulty,vehicle:bot.vehicle?{name:bot.vehicle.name,position:pos(bot.vehicle.position)}:null,dimension:bot.game?.dimension,kitNeeds:preparationNeeds(inv(),travelStarted,!(bot.vehicle?.name==='boat'||travelStarted&&routeIndex>=seedRoute.length-1)),stage:stageFor({inventory:inv(),dimension:bot.game?.dimension,position:bot.entity?.position,vehicle:bot.vehicle,won,dragonKilled,travelStarted}),record:captureEnabled&&(process.env.RECORD==='1'||existsSync(dir+'/record-enable'))&&!stopped,time:bot.time?.timeOfDay,terrain:terrainObservation(bot),battle:battleObservation(bot),inventory:inv(),hotbar:bot.inventory.slots.slice(36,45).map(i=>i?{name:i.name,count:i.count,durabilityUsed:i.durabilityUsed}:null),heldItem:bot.heldItem?{name:bot.heldItem.name,count:bot.heldItem.count}:null,digging:!!bot.targetDigBlock,selectedSlot:bot.quickBarSlot,xp:bot.experience,assist:bot.entity?.isInWater?'Keep head above water':null,equipment:bot.inventory.slots.slice(5,9).map(i=>i?.name||null),tools:bot.inventory.items().filter(i=>i.name.includes('pickaxe')||i.name.includes('axe')).map(i=>({name:i.name,durabilityUsed:i.durabilityUsed})),knownSeed:{travelRoute:{next:seedRoute[routeIndex]||{x:1015,y:35,z:-1221},remaining:seedRoute.slice(routeIndex),source:'Read-only survey of prior runs; route avoids the rocky shore'},activePortal:{x:1015,y:35,z:-1221},village:{x:205,y:65,z:195},blacksmithChest:{x:205,y:64,z:213},blacksmithLoot:'16 obsidian and 2 iron ingots verified in prior practice'},plan:currentPlan,recent:last.slice(-10),entities:bot.entity?Object.values(bot.entities).filter(e=>e.id!==bot.entity.id&&(e.name==='ender_dragon'||e.name==='end_crystal'||e.position.distanceTo(bot.entity.position)<50)).sort((a,b)=>a.position.distanceTo(bot.entity.position)-b.position.distanceTo(bot.entity.position)).slice(0,30).map(e=>({id:e.id,name:e.name,position:pos(e.position),distance:Math.round(e.position.distanceTo(bot.entity.position)),metadata:e.name==='ender_dragon'?e.metadata:undefined})):[]};}
const viewerOrigin='http://127.0.0.1:'+Number(process.env.VIEWER_PORT||3077);
const recordHttp=process.env.RECORD==='1'?recordingHandler({dir,token:localToken(),origin:viewerOrigin,onStart:captureId=>{recordReady=true;recordFinished=false;log('recording_started',{captureId});},onDone:captureId=>{recordFinished=true;log('recording_finished',{captureId});},onAbort:captureId=>{recordReady=false;recordFinished=false;stopped=true;log('capture_failure',{captureId});}}):null;
http.createServer({requestTimeout:15000,headersTimeout:10000},async(req,res)=>{
 if(recordHttp&&await recordHttp(req,res))return;
 if(req.url.startsWith('/recording')){res.writeHead(403);res.end();return;}
 res.setHeader('Access-Control-Allow-Origin',viewerOrigin);
 res.setHeader('Content-Type','application/json');res.end(JSON.stringify(snapshot()));
}).listen(Number(process.env.STATUS_PORT||3078),'127.0.0.1');
setInterval(()=>{if(bot.entity)writeFileSync(dir+'/status.json',JSON.stringify(snapshot(),null,2));},2000);
setInterval(()=>{if(bot.entity&&recordReady&&!recordFinished){log('display_state',{position:pos(bot.entity.position),inventory:inv(),health:bot.health,dimension:bot.game?.dimension,stage:stageFor({inventory:inv(),dimension:bot.game?.dimension,position:bot.entity.position,travelStarted,dragonKilled,won}),routeIndex,active,steps,won,dragonKilled});}},1000);
bot.on('physicsTick',()=>{if(bot.entity?.isInWater)bot.setControlState('jump',true);});
bot.on('error',e=>log('error',{error:e.message}));bot.on('kicked',r=>{log('kicked',{reason:r});stopped=true;});bot.on('end',()=>{stopped=true;});
bot.on('death',()=>{dead=true;log('death',{state:snapshot()});stopped=true;active='Run failed: player died';});bot.on('spawn',()=>{dead=false;});bot.on('messagestr',message=>log('game_message',{message}));
bot._client.on('advancements',packet=>{log('advancements',{packet});if(dragonKillAward(packet)){dragonKilled=true;log('dragon_killed',{state:snapshot()});}});bot._client.on('game_state_change',packet=>{log('game_state_change',{packet});if(gameWon(packet)){won=true;log('game_won',{packet,dragonKilled});if(dragonKilled){writeFileSync(dir+'/victory.json',JSON.stringify({run,dragonKilled,won,time:new Date().toISOString(),state:snapshot()},null,2));setTimeout(async()=>{stopped=true;active='Dragon defeated. Exit portal reached.';if(finishNative){try{await finishNative();recordFinished=true;writeFileSync(dir+'/status.json',JSON.stringify(snapshot(),null,2));}catch(e){log('capture_failure',{reason:e.message});}}},5000);}}});bot._client.on('entity_status',packet=>{if(packet.entityStatus===3)log('entity_death',{packet,name:bot.entities[packet.entityId]?.name});});
async function bounded(promise,ms=20000){let t;try{return await Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>{bot.pathfinder.setGoal(null);bot.clearControlStates();bot.stopDigging();reject(new Error('Action timeout'));},ms);})]);}finally{clearTimeout(t);}}
async function go(p,range=2,ms=20000){if(bot.entity.position.distanceTo(p.offset(.5,.5,.5))<range)return;await bounded(bot.pathfinder.goto(new goals.GoalNear(p.x,p.y,p.z,range)),ms);if(bot.entity.position.distanceTo(p.offset(.5,0,.5))>range+1)throw new Error('Path stopped before reaching target');}
async function approachResource(q){
 if(bot.entity.isInWater){const stands=[];for(let dx=-3;dx<=3;dx++)for(let dz=-3;dz<=3;dz++)for(let dy=-2;dy<=2;dy++){const s=q.offset(dx,dy,dz);if(bot.blockAt(s.offset(0,-1,0))?.boundingBox==='block'&&['air','grass','tall_grass'].includes(bot.blockAt(s)?.name)&&['air','grass','tall_grass'].includes(bot.blockAt(s.offset(0,1,0))?.name)&&s.offset(.5,1.62,.5).distanceTo(q.offset(.5,.5,.5))<4.3)stands.push(s);}
  stands.sort((a,b)=>a.distanceTo(bot.entity.position)-b.distanceTo(bot.entity.position));if(stands[0]){await go(stands[0],0,10000);return;}}
 await go(q,3);
}
async function tool(block){const item=bot.pathfinder.bestHarvestTool(block);if(item)await bot.equip(item,'hand');}
function item(name){return bot.inventory.items().find(i=>i.name===name);}
async function place(name){
 const it=item(name);if(!it)throw new Error('Missing '+name);const p=bot.entity.position;
 const refs=bot.findBlocks({matching:b=>b.boundingBox==='block',maxDistance:6,count:300}).map(q=>bot.blockAt(q)).filter(b=>bot.blockAt(b.position.offset(0,1,0))?.name==='air'&&bot.blockAt(b.position.offset(0,2,0))?.name==='air'&&b.position.offset(.5,1,.5).distanceTo(p)>1.1).sort((a,b)=>a.position.distanceTo(p)-b.position.distanceTo(p));
 for(const ref of refs.slice(0,8)){const dest=ref.position.offset(0,1,0);if(dest.offset(.5,.5,.5).distanceTo(bot.entity.position.offset(0,1.62,0))>4.3)await go(dest,2,5000);if(dest.offset(.5,0,.5).distanceTo(bot.entity.position)<1)continue;await bot.equip(it,'hand');try{await bounded(bot.placeBlock(bot.blockAt(ref.position),new Vec3(0,1,0)),2500);if(bot.blockAt(dest)?.name===name)return 'Placed '+name+' at '+dest;}catch{}}
 throw new Error('No reachable clear placement site; move to open ground');
}
function atWaterSurface(){const p=bot.entity?.position;return !!p&&(bot.entity.isInWater||[0,-1].some(dy=>bot.blockAt(p.floored().offset(0,dy,0))?.name==='water'));}
async function swim(dx,dz,ticks){
 const start=bot.entity.position.clone(),health=bot.health;bot.pathfinder.setGoal(null);await bot.lookAt(start.offset(dx*10,1.62,dz*10),true);bot.setControlState('forward',true);bot.setControlState('jump',true);
 try{for(let t=0;t<ticks;t+=5){await bot.waitForTicks(5);if(dead||stopped)throw new Error('Player no longer active');if(bot.health<health-2)throw new Error('Incoming damage: fight nearby enemy or escape before continuing');if(t>=35&&Math.hypot(bot.entity.position.x-start.x,bot.entity.position.z-start.z)<.7)throw new Error('Swim blocked: choose a side detour or shore path, not forward again');}return 'Swam '+Math.hypot(bot.entity.position.x-start.x,bot.entity.position.z-start.z).toFixed(1)+' blocks';}finally{bot.clearControlStates();}
}
function nearLava(q){for(let x=-2;x<=2;x++)for(let y=-1;y<=2;y++)for(let z=-2;z<=2;z++)if(bot.blockAt(q.offset(x,y,z))?.name==='lava')return true;return false;}
async function recoverBoat(entity){
 const nearby=entity||Object.values(bot.entities).find(e=>e.name==='boat'&&e.position.distanceTo(bot.entity.position)<5);if(!nearby)throw Error('No reachable boat to recover');
 const at=nearby.position.clone(),axe=item('stone_axe');if(axe)await bot.equip(axe,'hand');for(let n=0;n<8&&bot.entities[nearby.id];n++){bot.attack(nearby);await bot.waitForTicks(2);}if(bot.entities[nearby.id])throw Error('Boat did not break');
 await bot.waitForTicks(3);const drop=Object.values(bot.entities).find(e=>e.name==='item'&&e.getDroppedItem?.()?.name.endsWith('_boat')&&e.position.distanceTo(at)<4);if(drop)await go(drop.position,.6,4000);await bot.waitForTicks(5);if(!bot.inventory.items().some(i=>i.name.endsWith('_boat')))throw Error('Boat drop not collected');return 'Boat recovered';
}
function candidates(){
 const options=[];const state=inv();const add=(key,description,fn)=>{if((failed.get(key)||0)>Date.now())return;options.push({key,description,fn});};
 const p=bot.entity.position,travelling=stageFor(snapshot())==='travel',finalLand=travelling&&routeIndex>=seedRoute.length-1;
 if(bot.vehicle?.name==='boat'){
  const w=currentWaypoint(snapshot(),currentPlan,seedRoute)||{x:1015,z:-1221};
  const routes=boatControl.routes(w),landAhead=(seedRoute[routeIndex]?.terrain==='land'||routeIndex>=seedRoute.length)&&routes[0].distance<8;
  for(const route of routes.filter(r=>r.distance>=6&&!landAhead))add(route.degrees===0?'row_boat':'row_detour_'+route.degrees,`Row ${route.degrees===0?'toward the waypoint':route.degrees+' degrees from the waypoint direction'} through an observed clear water path of ${route.distance} blocks; stop before land`,()=>boatControl.drive(route.target,Math.min(20000,Math.max(2500,route.distance/5*1000))));
  add('leave_boat','Dismount the boat at shore, then recover it and use normal walking',async()=>{const boat=bot.vehicle;await boatControl.dismount();return recoverBoat(boat);});
  if(bot.food<20&&item('bread'))add('eat_bread','Eat bread while safe in the boat',async()=>{await bot.equip(item('bread'),'hand');await bot.consume();});
  return options;
 }
 const carriedBoat=bot.inventory.items().find(i=>i.name.endsWith('_boat'));
 if(carriedBoat&&travelling&&routeIndex<seedRoute.length&&seedRoute[routeIndex].terrain!=='land'&&boatControl.placementSite(currentWaypoint(snapshot(),currentPlan,seedRoute)))add('place_boat','Place the carried boat on nearby water and board it for safer, faster travel',()=>boatControl.place(currentWaypoint(snapshot(),currentPlan,seedRoute)));
 const nearbyBoat=Object.values(bot.entities).find(e=>e.name==='boat'&&e.position.distanceTo(p)<4);
 if(nearbyBoat)add('recover_boat','Break and recover the nearby boat to carry it across land',()=>recoverBoat(nearbyBoat));
 if(bot.game.dimension==='the_end'){
  extraActions(bot,add,{go,tool,item,place,bounded,inv});
  if(bot.food<20)for(const name of ['bread','apple'])if(item(name))add('eat_'+name,'Eat one '+name+' to maintain healing',async()=>{await bot.equip(item(name),'hand');await bot.consume();});
  if(!options.length)add('wait','Wait one tick for a valid combat action',()=>bot.waitForTicks(1));return options;
 }
 for(const [label,regex,count] of [['logs',/_log$/,3],['beds',/_bed$/,3],['food',/^hay_block$/,2],['stone',/^(stone|cobblestone)$/,2],['iron',/^iron_ore$/,2],['fuel',/^coal_ore$/,1],['blocks',/^(dirt|gravel)$/,2],['chests',/^chest$/,4],['table',/^crafting_table$/,1]]){
  if(travelling&&!(['blocks','stone'].includes(label)&&(state.dirt||0)+(state.cobblestone||0)<4)&&!(label==='logs'&&!state.oak_boat&&woodNeeded(state)>0))continue;
  if(bot.game.difficulty==='peaceful'&&['food','iron','fuel'].includes(label))continue;
  if(label==='logs'&&(finalLand||woodNeeded(state)===0))continue;
  if(label==='chests'&&(state.obsidian||0)>=12)continue;
  if(label==='table'&&(bot.game.difficulty==='peaceful'||state.crafting_table||!state.oak_boat))continue;
  if(['beds','blocks'].includes(label)&&!state.stone_axe)continue;
  if(label==='stone'&&preparationNeeds(state).cobblestoneForTools===0&&(!travelling||(state.dirt||0)+(state.cobblestone||0)>=4))continue;
  if(label==='blocks'&&preparationNeeds(state).navigationBlocks===0)continue;
  if(label==='beds'&&Object.entries(state).filter(([n])=>n.endsWith('_bed')).reduce((a,[,v])=>a+v,0)>=8)continue;
  const coords=bot.findBlocks({matching:b=>regex.test(b.name)&&(label!=='beds'||b.getProperties().part==='head'),maxDistance:label==='beds'?96:48,count:count*3});
  let n=0;for(const q of coords){const b=bot.blockAt(q);const harvestTool=bot.pathfinder.bestHarvestTool(b);if(label!=='chests'&&(!b.canHarvest(harvestTool?.type)||nearLava(q)))continue;if(label==='chests'&&looted.has(q.toString()))continue;if(++n>count)break;
   const key=label+q.toString();
   if(label==='beds'&&p.distanceTo(q)>32){add('approach_bed_'+q.toString(),`Walk toward observed village bed at ${q}, ${Math.round(p.distanceTo(q))} blocks away; use one short loaded path segment`,async()=>{const start=bot.entity.position.clone(),next=boundedWaypoint(start,q);try{await bounded(bot.pathfinder.goto(new goals.GoalXZ(next.x,next.z)),12000);}catch(e){if(bot.entity.position.distanceTo(start)<3)throw e;}finally{bot.pathfinder.setGoal(null);}return 'Moved toward observed bed';});continue;}
   add(key,`${label==='chests'?'Loot chest':'Mine and collect one '+b.name} at ${q.toString()}, distance ${Math.round(p.distanceTo(q))}`,async()=>{await approachResource(q);bot.pathfinder.setGoal(null);bot.clearControlStates();const target=bot.blockAt(q);if(label==='chests'){const c=await bot.openContainer(target);try{for(const it of c.containerItems())await c.withdraw(it.type,it.metadata,it.count);}finally{c.close();}looted.add(q.toString());return 'Chest looted';}await tool(target);if(!target.canHarvest(bot.heldItem?.type))throw new Error('Need better harvest tool');await bot.dig(target,true);await bot.waitForTicks(6);const drop=Object.values(bot.entities).filter(e=>e.name==='item'&&e.position.distanceTo(q)<3).sort((a,b)=>a.position.distanceTo(bot.entity.position)-b.position.distanceTo(bot.entity.position))[0];if(drop)await go(drop.position,.6,7000).catch(()=>{});await bot.waitForTicks(4);return 'Mined '+b.name;});
  }
 }
 const names=['oak_boat','oak_planks','birch_planks','spruce_planks','stick','crafting_table','wooden_pickaxe','stone_pickaxe','stone_axe','stone_sword','furnace','wheat','bread','bucket','iron_pickaxe','iron_sword','iron_axe','iron_helmet','iron_chestplate','iron_leggings','iron_boots','shield','bow','arrow'];
 const {near:table,remote:remoteTable}=findCraftingTables(bot);
 for(const name of names){if(finalLand)continue;if(travelling&&!['oak_boat','crafting_table','oak_planks','birch_planks','spruce_planks'].includes(name)||!craftNeeded(name,state,!!table))continue;if(bot.game.difficulty==='peaceful'&&!['oak_boat','oak_planks','birch_planks','spruce_planks','stick','crafting_table','wooden_pickaxe','stone_pickaxe','stone_axe'].includes(name))continue;const unique=/(_pickaxe|_axe|_sword|_helmet|_chestplate|_leggings|_boots)$/.test(name)||['crafting_table','oak_boat','bucket','shield','bow','furnace'].includes(name);if(unique&&state[name])continue;const id=bot.registry.itemsByName[name]?.id;if(!id)continue;const recipes=bot.recipesFor(id,null,1,table);if(!recipes.length)continue;const recipe=recipes[0];let max=1;while(max<16&&bot.recipesFor(id,null,(max+1)*recipe.result.count,table).length)max++;
  for(const count of [...new Set(unique||name==='stick'?[1]:[1,max])])add('craft_'+name+'_'+count,`Craft ${count*recipe.result.count} ${name}; inventory now ${state[name]||0}; uses ${count} recipe operations`,async()=>{await bot.craft(recipe,count,table);return 'Crafted '+name;});
 }
 if((!travelling||!state.oak_boat)&&!table&&item('crafting_table'))add('place_table','Place carried crafting table beside player for tool and bread recipes',()=>place('crafting_table'));
 if((!state.stone_pickaxe||!state.stone_axe||!state.oak_boat)&&!table&&remoteTable)add('approach_table','Walk to existing crafting table at '+remoteTable.position,()=>go(remoteTable.position,2));
 if(bot.food<20)for(const name of ['bread','apple','cooked_beef','cooked_porkchop','carrot','potato'])if(item(name))add('eat_'+name,'Eat one '+name,async()=>{await bot.equip(item(name),'hand');await bot.consume();});
 for(const [name,dest] of [['iron_helmet','head'],['iron_chestplate','torso'],['iron_leggings','legs'],['iron_boots','feet'],['shield','off-hand']])if(item(name))add('equip_'+name,'Equip '+name,async()=>{await bot.equip(item(name),dest);});
 const w=currentWaypoint(snapshot(),currentPlan,seedRoute);
 if(atWaterSurface()){
  const dryLand=(terrainObservation(bot)?.dryLand||[]).filter(q=>q.y<=p.y+5);
  const shores=[...dryLand].sort((a,b)=>w?Math.hypot(a.x-w.x,a.z-w.z)-Math.hypot(b.x-w.x,b.z-w.z):a.distance-b.distance).slice(0,3);
  for(const dry of shores)add('swim_shore_'+dry.x+'_'+dry.z,`Swim toward observed dry land (${dry.x},${dry.y},${dry.z}), ${dry.distance} blocks away, ${w?Math.round(Math.hypot(dry.x-w.x,dry.z-w.z)):'unknown'} blocks remaining to waypoint`,()=>{const dx=dry.x-p.x,dz=dry.z-p.z,d=Math.hypot(dx,dz)||1;return swim(dx/d,dz/d,Math.min(100,Math.max(20,d/0.14)));});
  for(const dry of shores.filter(q=>q.distance<12&&q.y<=p.y+5))add('climb_shore_'+dry.x+'_'+dry.z,`Climb or dig a normal path out of water to dry bank (${dry.x},${dry.y},${dry.z}); stop after six seconds`,()=>go(new Vec3(dry.x,dry.y,dry.z),1,6000));
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const q=p.floored().offset(dx,1,dz),above=bot.blockAt(q.offset(0,1,0)),front=bot.blockAt(q),floor=bot.blockAt(q.offset(0,-1,0));
   if(front?.boundingBox==='block'&&front.diggable&&above&&above.name!=='lava'&&floor?.boundingBox==='block'&&!nearLava(q))add('clear_bank_'+dx+'_'+dz,`Mine a two-block-high exit in the adjacent bank at ${q}, then jump onto it using normal movement`,async()=>{bot.pathfinder.setGoal(null);for(const pos of [q.offset(0,1,0),q]){const b=bot.blockAt(pos);if(b?.boundingBox==='block'&&b.diggable){await tool(b);await bot.dig(b,true);}}return swim(dx,dz,50);});
  }
  add('surface','Swim straight upward for two seconds to restore air',async()=>{bot.pathfinder.setGoal(null);bot.clearControlStates();bot.setControlState('jump',true);await bot.waitForTicks(40);});
 }

 if(w&&Math.hypot(w.x-p.x,w.z-p.z)>4){
  const dx=w.x-p.x,dz=w.z-p.z,d=Math.hypot(dx,dz)||1;
  for(const side of [-1,1])add('detour_'+side,`Take a short ${side===1?'right':'left'} detour around blocked terrain toward waypoint`,async()=>{const x=Math.round(p.x+dx/d*6+side*dz/d*6),z=Math.round(p.z+dz/d*6-side*dx/d*6);await bounded(bot.pathfinder.goto(new goals.GoalXZ(x,z)),8000);});
  if(atWaterSurface()){
   add('swim_forward','Swim toward waypoint for up to eight seconds. Stop on blocked movement or incoming damage.',()=>swim(dx/d,dz/d,Math.max(10,Math.min(160,Math.floor(d/0.14)))));
   for(const side of [-1,1])add('swim_detour_'+side,`Swim ${side<0?'left':'right'} around the blocked shore for three seconds`,()=>swim((dx*.5+side*dz*.866)/d,(dz*.5-side*dx*.866)/d,60));
  }
 }
 if(w&&!atWaterSurface()&&!(bot.game.dimension==='overworld'&&w.y<60&&Math.hypot(w.x-p.x,w.z-p.z)<1.5)&&(w.y>=60&&bot.game.dimension==='overworld'?Math.hypot(w.x-p.x,w.z-p.z)>3:p.distanceTo(new Vec3(w.x,w.y,w.z))>3))add('waypoint',`Travel toward planner waypoint ${JSON.stringify(w)}. Stop after 20 seconds if not reached.`,async()=>{const dx=w.x-p.x,dz=w.z-p.z,d=Math.hypot(dx,dz);if(d>32){const x=Math.round(p.x+dx/d*32),z=Math.round(p.z+dz/d*32);await bounded(bot.pathfinder.goto(new goals.GoalXZ(x,z)),20000);}else if(bot.game.dimension==='overworld'&&(w.y>=60||d>1.0))await bounded(bot.pathfinder.goto(new goals.GoalXZ(w.x,w.z)),20000);else await go(new Vec3(w.x,w.y,w.z),2);return 'Waypoint progress';});
 if(bot.game.difficulty!=='peaceful'&&bot.time.timeOfDay>12550){const bed=bot.findBlock({matching:b=>b.name.endsWith('_bed'),maxDistance:32});if(bed)add('sleep','Sleep in nearby village bed to skip night and set respawn',async()=>{await go(bed.position,2);await bot.sleep(bed);await bot.waitForTicks(110);});}
 for(const e of Object.values(bot.entities).filter(e=>['zombie','skeleton','spider','silverfish','drowned'].includes(e.name)&&e.position.distanceTo(p)<5).slice(0,3))add('attack_'+e.id,'Attack nearby '+e.name,async()=>{const weapon=item('iron_sword')||item('stone_sword')||item('stone_axe');if(weapon)await bot.equip(weapon,'hand');await bot.lookAt(e.position.offset(0,1,0),true);bot.attack(e);await bot.waitForTicks(14);});
 extraActions(bot,add,{go,tool,item,place,bounded,inv});
 add('wait','Wait one second to observe changes',()=>bot.waitForTicks(20));return options;
}
async function main(){
 await bot.waitForChunksToLoad();const m=new Movements(bot);m.canDig=true;m.liquidCost=5;m.exclusionAreasBreak.push(block=>nearLava(block.position)?100:0);m.allow1by1towers=true;m.allowParkour=false;m.maxDropDown=3;bot.pathfinder.setMovements(m);bot.pathfinder.thinkTimeout=3000;
 viewerPkg.mineflayer(bot,{port:Number(process.env.VIEWER_PORT||3077),firstPerson:true,viewDistance:6});
 if(nativeMirror&&process.env.WAIT_NATIVE==='1'){active='Waiting for native Minecraft view';while(!nativeMirror.ready)await new Promise(r=>setTimeout(r,250));}
 captureEnabled=true;
 if(process.env.NATIVE_RECORD==='1'){active='Starting native video capture';finishNative=await startNativeRecording(dir,log);recordReady=true;}
 if(process.env.RECORD==='1'){active='Waiting for video capture';while(!recordReady)await new Promise(r=>setTimeout(r,500));}
 log('start',{seed:'-4530634556500121041',version:bot.version,difficulty:bot.game.difficulty,state:snapshot()});
 while(!stopped){try{
  if(nativeMirror&&process.env.NATIVE_RECORD==='1'&&!nativeMirror.captureHealthy){active='Native display disconnected; recording run stopped';stopped=true;log('capture_failure',{reason:'Native display disconnected'});break;}
  if(existsSync(dir+'/stop')){stopped=true;active='Run stopped for review';log('development_trial_ended',{reason:readFileSync(dir+'/stop','utf8')});break;}
  if(existsSync(dir+'/paused')){active='Agent paused for review or update';await new Promise(r=>setTimeout(r,500));continue;}
  if(won){await new Promise(r=>setTimeout(r,250));continue;}if(dead){await bot.waitForTicks(20);continue;}
  const battle=battleObservation(bot);if(!dragonKilled&&dragonDeathState(battle)){dragonKilled=true;log('dragon_killed',{source:'server entity health zero and dying phase',battle});}
  if(dragonKilled){active='Dragon defeated; waiting for exit portal';await new Promise(r=>setTimeout(r,500));if(won)continue;}
  let options=candidates();let feedback=existsSync(process.env.FEEDBACK_FILE||'feedback.txt')?readFileSync(process.env.FEEDBACK_FILE||'feedback.txt','utf8'):'';
  const state=snapshot(),stage=stageFor(state),arrived=stage!=='travel'&&reachedWaypoint(bot.entity.position,currentPlan?.waypoint,bot.game.dimension);
  const reason=planTrigger({plan:currentPlan,dimension:bot.game.dimension,previousDimension:planDimension,errors,arrived,now:Date.now(),lastPlanAt,stage,previousStage:planStage,noUseful:options.every(o=>o.key==='wait')});
  if(!planning&&reason&&!dragonKilled){
   planRouteIndex=routeIndex;planStep=steps;planDimension=bot.game.dimension;planStage=stage;lastPlanAt=Date.now();
   planning=plan({...state,feedback,reviewReason:reason,availableActions:options.map(o=>o.description)}).then(r=>{currentPlan=r.result;plans++;log('plan',{...r,reviewReason:reason});console.log('PLAN',JSON.stringify(currentPlan));}).catch(e=>{log('plan_error',{error:e.message});}).finally(()=>planning=null);
   if(!currentPlan||arrived){active=plannerName+' planning';await planning;options=candidates();}
  }
  if((arrived||!currentPlan||options.every(o=>o.key==='wait'))&&planning){active=plannerName+' planning';await planning;options=candidates();}
  options=selectUsefulOptions(options,{unsafe:options.some(o=>o.key.startsWith('escape_')),arrived:stage!=='travel'&&reachedWaypoint(bot.entity.position,currentPlan?.waypoint,bot.game.dimension)});
  if(!options.length){await bot.waitForTicks(10);continue;}
  active='JEV decision';const observation={...snapshot(),feedback};const r=await decide(observation,options);if(stopped||dead||won)break;active=r.selected.description;
  log('decision',{step:steps,request:r.body,response:r.data,latencyMs:r.latencyMs,selected:r.selected.key});console.log('ACTION',steps,active);
  const actionStart=bot.entity.position.clone(),actionDimension=bot.game.dimension;let result;try{result=await bounded(r.selected.fn(),25000);if((r.selected.key==='waypoint'||r.selected.key.startsWith('detour_'))&&bot.game.dimension===actionDimension&&bot.entity.position.distanceTo(actionStart)<.75)throw new Error('Movement blocked; choose a different route');errors=0;}catch(e){result='FAILED '+e.message;failed.set(r.selected.key,Date.now()+failureCooldown(r.selected.key,bot.game.dimension));errors++;}
  steps++;last.push({step:steps,action:r.selected.description,result:typeof result==='string'?result:'done',position:pos(bot.entity.position),inventory:inv()});last=last.slice(-20);log('result',last.at(-1));if(errors>=3)currentPlan=null;
 }catch(e){log('loop_error',{error:e.message});console.log('ERROR',e.message);if(e.message.includes('402')){stopped=true;active='Paused: OpenRouter has insufficient credits';bot.pathfinder.setGoal(null);bot.clearControlStates();writeFileSync(dir+'/status.json',JSON.stringify(snapshot(),null,2));bot.quit();break;}await new Promise(r=>setTimeout(r,2000));}}
 if(finishNative){await finishNative();recordFinished=true;writeFileSync(dir+'/status.json',JSON.stringify(snapshot(),null,2));}
}
bot.once('spawn',()=>main().catch(e=>{console.error(e);log('fatal',{error:e.message});process.exitCode=1;}));
process.on('SIGINT',async()=>{stopped=true;bot.pathfinder.setGoal(null);bot.clearControlStates();bot.stopDigging();if(finishNative)try{await finishNative();recordFinished=true;}catch(e){console.error(e.message);}bot.quit();process.exit(0);});
