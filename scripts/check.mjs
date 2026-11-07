import fs from 'node:fs/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url);
for(const file of['pixel-runtime.js','inject.mjs','scripts/build.mjs','scripts/check.mjs']){
  const run=spawnSync(process.execPath,['--check',fileURLToPath(new URL(file,root))],{encoding:'utf8'});
  if(run.status!==0)throw Error(run.stderr||`Syntax check failed: ${file}`);
}
const gradient={addColorStop(){}};
const ctx=new Proxy({createLinearGradient:()=>gradient,createRadialGradient:()=>gradient,measureText:()=>({width:10})},{get:(t,k)=>k in t?t[k]:(()=>{})});
const sandbox={document:{createElement:()=>({width:0,height:0,getContext:()=>ctx})}};
const engine=await fs.readFile(new URL('src/engine.js',root),'utf8');
const test=`
if(THEMES.length!==9)throw Error('Expected nine scenes');
for(const theme of THEMES){
  for(const [width,height,cell] of [[1280,720,14],[144,84,5]]){
    const w=new World(document.createElement('canvas'));
    w.resize(width,height,cell,1);w.setTheme(theme);
    for(let i=0;i<36;i++)w.draw(1/12);
  }
}
`;
vm.runInNewContext(engine+test,sandbox,{timeout:15000});
console.log('Syntax checks and nine-scene engine smoke test passed.');
