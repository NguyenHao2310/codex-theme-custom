import fs from 'node:fs/promises';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const engine=await fs.readFile(new URL('src/engine.js',root),'utf8');
const adapter=await fs.readFile(new URL('src/adapter.js',root),'utf8');
const result=`/* Pixel engine: aqua2409z, MIT. See LICENSE. Codex Pixel Studio V2. */\n(()=>{\n'use strict';\n${engine}\n${adapter}\n})()\n`;
new vm.Script(result,{filename:'pixel-runtime.js'});
await fs.writeFile(new URL('pixel-runtime.js',root),result);
console.log('Built pixel-runtime.js');
