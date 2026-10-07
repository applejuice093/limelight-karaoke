// Limelight auto pipeline: drop song -> cache / LRCLIB / Whisper -> play -> mic
const $=id=>document.getElementById(id);const LL=window.LL;
const toast=window.toast=(m,ms=4000)=>{const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,ms)};
const status=(title,sub='',pct=null)=>{const s=$('status');if(title==null){s.hidden=true;return}s.hidden=false;$('stTitle').textContent=title;$('stSub').textContent=sub;
  const b=$('stBar').parentElement;b.classList.toggle('indet',pct==null);if(pct!=null)$('stBar').style.width=pct+'%'};
// IndexedDB cache
const db=new Promise((res,rej)=>{const r=indexedDB.open('limelight',1);r.onupgradeneeded=()=>r.result.createObjectStore('lyrics');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
const idb=async(mode,fn)=>{const d=await db;return new Promise((res,rej)=>{const q=fn(d.transaction('lyrics',mode).objectStore('lyrics'));q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})};
const cacheGet=k=>idb('readonly',s=>s.get(k)).catch(()=>null),cachePut=(k,v)=>idb('readwrite',s=>s.put(v,k)).catch(()=>{});
async function fileKey(f){const head=await f.slice(0,262144).arrayBuffer();const h=await crypto.subtle.digest('SHA-256',head);return [...new Uint8Array(h)].slice(0,12).map(b=>b.toString(16).padStart(2,'0')).join('')+':'+f.size}
// ID3v2 tags
async function id3(f){try{const b=new Uint8Array(await f.slice(0,131072).arrayBuffer());if(String.fromCharCode(...b.slice(0,3))!=='ID3')return{};
  const v=b[3],size=(b[6]<<21)|(b[7]<<14)|(b[8]<<7)|b[9];let p=10;const out={};
  while(p<size&&p+10<b.length){const id=String.fromCharCode(...b.slice(p,p+4));if(!/^[A-Z0-9]{4}$/.test(id))break;
    const n=v===4?(b[p+4]<<21)|(b[p+5]<<14)|(b[p+6]<<7)|b[p+7]:(b[p+4]<<24)|(b[p+5]<<16)|(b[p+6]<<8)|b[p+7];
    if(id==='TIT2'||id==='TPE1'){const enc=b[p+10],raw=b.slice(p+11,p+10+n);let s;
      if(enc===1||enc===2)s=new TextDecoder(enc===1?'utf-16':'utf-16be').decode(raw);else s=new TextDecoder(enc===3?'utf-8':'latin1').decode(raw);
      out[id==='TIT2'?'title':'artist']=s.replace(/\0/g,'').trim()}p+=10+n}return out}catch{return{}}}
function guessMeta(f,tags){let title=tags.title,artist=tags.artist;if(!title){const base=f.name.replace(/\.[^.]+$/,'').replace(/[_]+/g,' ').replace(/\(.*?(official|lyrics?|audio|video|hd).*?\)|\[.*?\]/gi,'').trim();
  const m=base.split(/\s+-\s+/);if(m.length>1){artist=artist||m[0].trim();title=m.slice(1).join(' - ').trim()}else title=base}return{title,artist}}
async function lrclib(meta,dur){const q=new URLSearchParams({track_name:meta.title});if(meta.artist)q.set('artist_name',meta.artist);
  for(const url of ['https://lrclib.net/api/search?'+q,'https://lrclib.net/api/search?q='+encodeURIComponent((meta.artist||'')+' '+meta.title)]){
    try{const r=await fetch(url);if(!r.ok)continue;const list=(await r.json()).filter(x=>x.syncedLyrics&&(!dur||Math.abs(x.duration-dur)<6));
      if(list.length){list.sort((a,b)=>Math.abs(a.duration-dur)-Math.abs(b.duration-dur));return list[0]}}catch{}}return null}
// decode -> 16k mono, vocal-focused (mid channel, band-pass 120–5000 Hz)
async function prepAudio(f){const ab=await f.arrayBuffer();const tmp=new AudioContext();const buf=await tmp.decodeAudioData(ab);tmp.close();
  const sr=16000,off=new OfflineAudioContext(1,Math.ceil(buf.duration*sr),sr);const s=off.createBufferSource();s.buffer=buf;
  const hp=off.createBiquadFilter();hp.type='highpass';hp.frequency.value=120;const lp=off.createBiquadFilter();lp.type='lowpass';lp.frequency.value=5000;
  s.connect(hp);hp.connect(lp);lp.connect(off.destination);s.start();const r=await off.startRendering();
  const d=r.getChannelData(0);let m=0;for(let i=0;i<d.length;i++)m=Math.max(m,Math.abs(d[i]));if(m>0)for(let i=0;i<d.length;i++)d[i]/=m;return{pcm:d,duration:buf.duration}}
// words -> lines
function buildLines(chunks){const words=[];chunks.forEach(c=>{const w={w:c.text.trim(),t:c.timestamp[0],e:c.timestamp[1]??c.timestamp[0]+.3};const prev=words[words.length-1];
    if(prev&&w.w&&!/^\s/.test(c.text)&&/^[\w'-]/.test(w.w)){prev.w+=w.w;prev.e=w.e}else words.push(w)});const _w=words.splice(0).filter(w=>w.w&&!/^\[.*\]$|^\(.*\)$/.test(w.w));
  words.push(..._w);const lines=[];let curL=[];const push=()=>{if(curL.length)lines.push({t:curL[0].t,text:curL.map(x=>x.w).join(' '),words:curL});curL=[]};
  words.forEach((w,i)=>{const prev=curL[curL.length-1];if(prev&&(w.t-prev.e>0.9||curL.length>=9||(curL.length>=4&&/[.,!?;]$/.test(prev.w))))push();curL.push(w)});push();return lines}
let worker;function whisper(pcm,model){return new Promise((res,rej)=>{worker=worker||new Worker('worker.js',{type:'module'});
  worker.onmessage=({data:m})=>{if(m.type==='dl')status('Downloading speech model','One-time download, cached by your browser afterwards',m.total?Math.round(m.loaded/m.total*100):null);
    else if(m.type==='run')status('Listening to the song…','Whisper is transcribing in your browser — no uploads');else if(m.type==='done')res(m.chunks);else if(m.type==='error')rej(new Error(m.message))};
  worker.postMessage({audio:pcm,model})})}
let current=null;
async function auto(f,force=false){current=f;const key=await fileKey(f);const meta=guessMeta(f,await id3(f));
  $('trackName').textContent=meta.artist?`${meta.artist} — ${meta.title}`:meta.title;
  const go=()=>{status(null);if(current===f){LL.play();setTimeout(()=>LL.enableMic(),600)}};
  if(!force){const c=await cacheGet(key);if(c){apply(c);toast('Loaded lyrics from cache');return go()}}
  status('Preparing audio','Decoding and isolating the vocal band');let prep;try{prep=await prepAudio(f)}catch(e){status(null);toast('Could not decode audio: '+e.message);return}
  if(!force&&$('useLrclib').checked){status('Looking up lyrics','Searching LRCLIB for “'+meta.title+'”');const hit=await lrclib(meta,prep.duration);
    if(hit){const c={kind:'lrc',lrc:hit.syncedLyrics,src:`LRCLIB · ${hit.artistName} — ${hit.trackName}`};await cachePut(key,c);apply(c);toast('Synced lyrics found on LRCLIB');return go()}}
  try{const chunks=await whisper(prep.pcm,$('model').value);const lines=buildLines(chunks);
    if(!lines.length){status(null);toast('No vocals detected — playing instrumental');return go()}
    const c={kind:'words',lines,src:'Whisper transcription'};await cachePut(key,c);apply(c);toast('Lyrics transcribed — word timing is automatic');go()}
  catch(e){console.warn(e);status(null);toast('Transcription failed: '+e.message,7000);go()}}
function apply(c){if(c.kind==='lrc')LL.setLyrics(c.lrc);else LL.setLines(c.lines)}
window.LLauto=f=>auto(f);window.LLprep=prepAudio;window.LLbuild=buildLines;
$('retranscribe').onclick=()=>current?auto(current,true):toast('Drop a song first');
$('exportLrc').onclick=()=>{const t=LL.lines.filter(l=>l.t!=null).map(l=>LL.lrcTime(l.t)+l.text).join('\n');if(!t)return toast('No timed lyrics');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t]));a.download='lyrics.lrc';a.click()};
if(location.protocol==='file:')toast('Tip: serve over http(s) for auto-lyrics & mic — e.g. python3 -m http.server',8000);
