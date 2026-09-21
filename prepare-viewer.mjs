import {readFileSync,writeFileSync,copyFileSync,existsSync,cpSync} from 'node:fs';
const base='node_modules/prismarine-viewer/public/';
const file=base+'index.html';
let html=readFileSync(file,'utf8');
if(!html.includes('/recording-client.js'))html=html.replace('</body>','<script src="/recording-client.js"></script></body>');
copyFileSync('recording-session.js',base+'recording-session.js');
writeFileSync(file,html);copyFileSync('recording-client.js',base+'recording-client.js');
if(existsSync('item-textures.json'))copyFileSync('item-textures.json',base+'item-textures.json');
console.log('Viewer HUD installed');

const viewerFile='node_modules/prismarine-viewer/lib/mineflayer.js';
let viewer=readFileSync(viewerFile,'utf8');
if(!viewer.includes('    botPosition()'))viewer=viewer.replace("    bot.on('move', botPosition)","    botPosition()\n    bot.on('move', botPosition)");
if (!viewer.includes("http.listen(port, '127.0.0.1',")) {
  const before = 'http.listen(port, () => {';
  if (!viewer.includes(before)) throw Error('Viewer listener changed; review loopback patch');
  viewer = viewer.replace(before, "http.listen(port, '127.0.0.1', () => {");
}
writeFileSync(viewerFile,viewer);

cpSync('node_modules/minecraft-assets/minecraft-assets/data/1.16.4',base+'textures/1.16.4',{recursive:true});
