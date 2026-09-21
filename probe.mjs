import { request } from './models.mjs';
import { writeFileSync } from 'node:fs';
for (const [name,path,body] of [
['jev','/api/alpha/decisions',{model:'typesafe/jev-1.13',state:'Minecraft survival. Health 20. A log is within reach. No tools or wood. Goal: get wood for tools.',questions:{action:{type:'choice',instructions:'Select the next player action.',criteria:{mine_log:'Break the nearby log to get wood.',wait:'Stand still.'}}}}],
['astra','/api/v1/chat/completions',{model:'openai/gpt-6-astra',messages:[{role:'user',content:'We are building a Minecraft 1.16.5 Mineflayer bot, you are the high-level planner, Jev selects legal actions. Seed -4530634556500121041 has active End portal 1007 33 -1220. Survival Easy, no cheats. Give a compact viable plan to kill Ender Dragon using gathered resources. Suggest minimal gear and a robust fight strategy. No game actions yet.'}],reasoning:{effort:'medium'},max_tokens:2500}]
]) {
 const result=await request(path,body);writeFileSync('research/'+name+'-probe.json',JSON.stringify(result,null,2));console.log(name,'completed',result.latencyMs);
}
