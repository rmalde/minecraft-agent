(async () => {
 const {startRecording}=await import('/recording-session.js');
 const W=960,H=540;let state={},recorder,textures={};
 const overlay=document.createElement('canvas');overlay.width=W;overlay.height=H;overlay.style='position:fixed;inset:0;width:100%;height:100%;z-index:99;pointer-events:none';document.body.append(overlay);const hud=overlay.getContext('2d');
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');const images=new Map();
 const image=src=>{if(!images.has(src)){const im=new Image();im.src=src;images.set(src,im);}return images.get(src);};
 const icons=image('/textures/1.16.4/gui/icons.png');const widgets=image('/textures/1.16.4/gui/widgets.png');
 fetch('/item-textures.json').then(r=>r.json()).then(d=>textures=d);
 function sprite(im,sx,sy,sw,sh,x,y,w,h){if(im.complete&&im.naturalWidth)hud.drawImage(im,sx,sy,sw,sh,x,y,w,h);}
 function drawItem(it,x,y,size){if(!it)return;if(it.name.endsWith('_bed')){hud.fillStyle=it.name.startsWith('yellow')?'#e9be2b':'#eee';hud.fillRect(x+size*.12,y+size*.26,size*.78,size*.47);hud.fillStyle='#fafafa';hud.fillRect(x+size*.12,y+size*.26,size*.24,size*.47);hud.fillStyle='#956339';hud.fillRect(x+size*.12,y+size*.72,size*.78,size*.1);hud.fillRect(x+size*.15,y+size*.8,size*.1,size*.12);hud.fillRect(x+size*.74,y+size*.8,size*.1,size*.12);}else{const src=textures[it.name];if(src){const im=image(src);if(im.complete&&im.naturalWidth)hud.drawImage(im,x,y,size,size);}else{hud.fillStyle='#bbb';hud.fillRect(x+4,y+4,size-8,size-8);}}}
 function text(t,x,y,size=12,color='#fff'){hud.font=`${size}px monospace`;hud.lineWidth=3;hud.strokeStyle='#000b';hud.strokeText(t,x,y);hud.fillStyle=color;hud.fillText(t,x,y);}
 function drawHUD(){
  hud.clearRect(0,0,W,H);hud.imageSmoothingEnabled=false;
  hud.fillStyle='#06111cda';hud.fillRect(0,0,W,86);
  text((state.plannerName||'Planner').toUpperCase()+' + JEV  |  Minecraft 1.16.5  |  Survival / '+(state.difficulty||'Connecting'),12,18,14);
  text(`${state.run||'Connecting'}  ·  Actions ${state.steps||0}  ·  XYZ ${state.position?Object.values(state.position).join(' / '):'—'}`,12,36,12,'#b4d9f5');
  text(((state.plannerName||'Planner')+': '+(state.plan?.objective||'Waiting')).slice(0,124),12,54);
  text(('JEV: '+(state.active||'Waiting')).slice(0,124),12,72,12,'#ffd980');
  if(state.battle){const hp=Math.max(0,state.battle.health||0);text('Ender Dragon '+hp.toFixed(1)+'/200',350,108,14,'#f7b9ff');hud.fillStyle='#2e1239';hud.fillRect(250,115,460,10);hud.fillStyle='#c041d6';hud.fillRect(250,115,460*hp/200,10);}
  const held=state.heldItem;if(!held){hud.fillStyle='#cda17c';hud.save();hud.translate(W-55,H-110);hud.rotate(-.35);hud.fillRect(-25,-35,50,100);hud.restore();text('Empty hand',W-160,H-61,12);}
  if(held){hud.save();hud.translate(W-95,H-133);hud.rotate(state.digging?Math.sin(Date.now()/120)*.12:-.35);drawItem(held,-42,-42,84);hud.restore();text(held.name.replaceAll('_',' '),W-205,H-61,12);}
  const s=2.5,bx=(W-182*s)/2,by=H-70;
  sprite(widgets,0,0,182,22,bx,by,182*s,22*s);
  const slot=state.selectedSlot??0;sprite(widgets,0,22,24,22,bx-1*s+slot*20*s,by-1*s,24*s,22*s);
  (state.hotbar||[]).forEach((it,i)=>{if(!it)return;drawItem(it,bx+(3+i*20)*s,by+3*s,16*s);if(it.count>1)text(String(it.count),bx+(16+i*20)*s,by+19*s,14);});
  for(let i=0;i<10;i++){const x=bx+i*8*s,y=by-30; sprite(icons,16,0,9,9,x,y,9*s,9*s);const remain=(state.health||0)-i*2;if(remain>0)sprite(icons,remain>=2?52:61,0,9,9,x,y,9*s,9*s);const fx=bx+182*s-9*s-i*8*s;sprite(icons,16,27,9,9,fx,y,9*s,9*s);const f=(state.food||0)-i*2;if(f>0)sprite(icons,f>=2?52:61,27,9,9,fx,y,9*s,9*s);}
  text(`HP ${(state.health||0).toFixed(1)}/20`,bx,by-38,11);text(`FOOD ${state.food||0}/20`,bx+182*s-110,by-38,11);
  if(state.oxygen<20)text(`AIR ${state.oxygen}/20`,bx+185,by-38,11,'#75d8ff');
  if(state.xp?.level)text(String(state.xp.level),W/2-5,by-8,14,'#b4f65b');
  hud.strokeStyle='#fff';hud.lineWidth=1;hud.beginPath();hud.moveTo(W/2-5,H/2);hud.lineTo(W/2+5,H/2);hud.moveTo(W/2,H/2-5);hud.lineTo(W/2,H/2+5);hud.stroke();
  if(state.won&&state.dragonKilled){hud.fillStyle='#06111ce8';hud.fillRect(160,190,640,105);text('ENDER DRAGON DEFEATED',245,234,25,'#c0ff91');text('Exit portal reached · Game completion verified',221,270,17);}
 }
 async function tick(){try{state=await(await fetch(statusBase)).json();if(state.record&&!recorder&&new URL(location.href).searchParams.get('run')===state.run)start();if(!state.record&&recorder?.state==='recording')recorder.stop();}catch{}setTimeout(tick,250);}
 let last=0;function paint(now){if(now-last>75){last=now;drawHUD();const game=[...document.querySelectorAll('canvas')].find(c=>c!==canvas&&c!==overlay);if(game){ctx.drawImage(game,0,0,W,H);ctx.drawImage(overlay,0,0);}}requestAnimationFrame(paint);}
 let starting=false,recordFailed=false;
 const fragment=new URLSearchParams(location.hash.slice(1)),recordToken=fragment.get('token');
 const statusPort=Number(new URL(location.href).searchParams.get('statusPort')||3078);
 if(!Number.isInteger(statusPort)||statusPort<1||statusPort>65535)throw Error('Invalid statusPort');
 const statusBase='http://127.0.0.1:'+statusPort;
 if(recordToken)history.replaceState(null,'',location.pathname+location.search);
 async function sendRecord(path,body){const r=await fetch(statusBase+path,{method:'POST',headers:{Authorization:'Bearer '+recordToken},body});if(!r.ok)throw Error('Recording request failed: '+r.status);}
 async function start(){
  if(starting||recordFailed)return;starting=true;
  try{
   if(!recordToken)throw Error('Recording needs a token URL fragment. See SETUP.md.');
   recorder=await startRecording({canvas,send:sendRecord,onError:e=>{recordFailed=true;console.error(e.message);},onFinish:()=>{recorder=null;}});
  }catch(e){recordFailed=true;console.error(e.message);}finally{starting=false;}
 }
 requestAnimationFrame(paint);tick();
})();
