import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const dir=path.dirname(fileURLToPath(import.meta.url));
const port=19327;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
let target;
for(let attempt=0;attempt<90;attempt++){
  try{
    const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1500)});
    const targets=await response.json();
    target=targets.find(t=>t.type==='page'&&t.url==='app://-/index.html'&&t.webSocketDebuggerUrl);
    if(target)break;
  }catch{}
  await delay(1000);
}
if(!target)throw Error('Không tìm thấy renderer Codex qua CDP. Chưa chèn nền.');
// Startup can replace a temporary renderer. Wait for a stable main target.
for(let stable=0,attempt=0;stable<6&&attempt<60;attempt++){
  await delay(500);
  const list=await(await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1500)})).json();
  const next=list.find(t=>t.type==='page'&&t.url==='app://-/index.html'&&t.webSocketDebuggerUrl);
  if(next?.id===target.id)stable++;else if(next){target=next;stable=0}
}
const endpoint=new URL(target.webSocketDebuggerUrl);
if(!['127.0.0.1','[::1]','localhost'].includes(endpoint.hostname)||endpoint.port!==String(port)||endpoint.protocol!=='ws:')throw Error('Từ chối WebSocket không phải loopback đã chọn.');
const source=await fs.readFile(path.join(dir,'pixel-runtime.js'),'utf8');
const socket=new WebSocket(endpoint);
await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('WebSocket timeout')),10000);socket.onopen=()=>{clearTimeout(timeout);resolve()};socket.onerror=e=>{clearTimeout(timeout);reject(e)}});
let sequence=0;
const pending=new Map();
socket.onmessage=e=>{const m=JSON.parse(e.data);const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
function call(method,params){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{pending.delete(id);reject(Error(`CDP timeout: ${method}`))},15000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}))})}
try{
  let ready=false;
  for(let attempt=0;attempt<100;attempt++){
    const check=await call('Runtime.evaluate',{expression:"!!(document.body&&document.querySelector('#root main')&&document.querySelector('#root nav,#root [role=toolbar]'))",returnByValue:true});
    if(check.result?.value){ready=true;break}await delay(300);
  }
  if(!ready)throw Error('Codex chưa dựng xong giao diện. Chưa chèn nền.');
  const result=await call('Runtime.evaluate',{expression:source,returnByValue:true,awaitPromise:true});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));
  // Reinstall the button on renderer reloads, only for this running Codex session.
  const statePath=path.join(dir,'.runtime-session.json');
  let previous;
  try{previous=JSON.parse(await fs.readFile(statePath,'utf8'))}catch{}
  if(previous?.targetId===target.id&&typeof previous.scriptId==='string'){
    await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:previous.scriptId}).catch(()=>{});
  }
  const hook=await call('Page.addScriptToEvaluateOnNewDocument',{source:`(()=>{const install=()=>{${source}\n};if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',install,{once:true})}else{install()}})()`});
  await fs.writeFile(statePath,JSON.stringify({targetId:target.id,scriptId:hook.identifier}));
  console.log(JSON.stringify({...result.result?.value,reapplyOnReload:true}));
}finally{socket.close()}
