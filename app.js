(()=>{
const $=id=>document.getElementById(id);
const audio=new Audio();audio.preload='auto';
let lines=[],cur=-1,syncMode=false,syncIdx=0,ctx,master,recDest,micStream,micGain,analyser,revGain,echoGain,recorder,chunks=[];
$('karaoke').onchange=()=>applyKaraoke();
const DEMO_LRC=`[ti:Limelight Demo]
[00:00.00]♪ (count in — one, two, three, four)
[00:02.40]Step into the light tonight
[00:04.80]Every note is burning bright
[00:07.20]Hold the mic and close your eyes
[00:09.60]Let the chorus touch the sky
[00:12.00]Sing it loud, the room is ours
[00:14.40]Underneath a thousand stars
[00:16.80]One more line before the end
[00:19.20]Take it from the top again
[00:21.60]Oh-oh, oh-oh, carry on
[00:24.00]Till the final note is gone
[00:26.40]♪ (applause)`;
const fmt=s=>{s=Math.max(0,s||0);return Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0')};
const lrcTime=s=>{const m=Math.floor(s/60),r=(s-m*60).toFixed(2).padStart(5,'0');return `[${String(m).padStart(2,'0')}:${r}]`};
function parse(txt){const out=[];let timed=false;
  txt.split(/\r?\n/).forEach(l=>{const tags=[...l.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)];const text=l.replace(/\[[^\]]*\]/g,'').trim();
    if(tags.length){timed=true;tags.forEach(t=>out.push({t:+t[1]*60+ +t[2],text}))}else if(text&&!/^\[/.test(l))out.push({t:null,text})});
  if(timed)return{timed,lines:out.filter(x=>x.t!=null).sort((a,b)=>a.t-b.t)};return{timed,lines:out}}
function setLyrics(txt){const p=parse(txt);lines=p.lines;cur=-1;render();if(!p.timed&&lines.length)startSync();else stopSync()}
function setLines(arr){lines=arr;cur=-1;stopSync();render()}
function render(){const L=$('lyrics');L.innerHTML='';
  if(!lines.length){L.innerHTML='<div class="empty"><p class="big">No lyrics yet.</p><p>Load an .lrc or paste lyrics.</p></div>';return}
  lines.forEach((l,i)=>{const d=document.createElement('div');d.className='line'+(l.t==null?' unsynced':'');if(l.words&&l.words.length){l.words.forEach(w=>{const s=document.createElement('span');s.className='w';s.textContent=w.w;d.appendChild(s);d.appendChild(document.createTextNode(' '))});d.classList.add('worded')}else d.textContent=l.text||'♪';
    d.onclick=()=>{if(l.t!=null){audio.currentTime=l.t}};L.appendChild(d)});scrollTo(0)}
function scrollTo(i){const L=$('lyrics'),el=L.children[i];if(!el)return;L.style.transform=`translateY(${-(el.offsetTop+el.offsetHeight/2)}px)`}
function tick(){const t=audio.currentTime,d=audio.duration||0;
  $('cur').textContent=fmt(t);$('dur').textContent=fmt(d);if(!seeking&&d)$('seek').value=t/d*1000;
  if(syncMode){highlight(syncIdx-1,0)}else if(lines.length&&lines[0].t!=null){let i=-1;for(let k=0;k<lines.length;k++)if(lines[k].t<=t)i=k;
    let p=0;if(i>=0){const end=lines[i+1]?lines[i+1].t:(d||lines[i].t+4);p=Math.min(1,(t-lines[i].t)/Math.max(.3,end-lines[i].t))}highlight(i,p)}
  if(analyser){const a=new Uint8Array(analyser.fftSize);analyser.getByteTimeDomainData(a);let s=0;for(const v of a)s+=((v-128)/128)**2;$('meter').style.width=Math.min(100,Math.sqrt(s/a.length)*400)+'%'}
  requestAnimationFrame(tick)}
function highlight(i,p){const L=$('lyrics');if(i!==cur){[...L.children].forEach((c,k)=>{c.classList.toggle('cur',k===i);c.classList.toggle('near',Math.abs(k-i)===1)});cur=i;scrollTo(Math.max(0,i))}
  const el=L.children[i];if(el&&el.classList.contains('line')){el.style.setProperty('--p',(p*100).toFixed(1)+'%');
  const ws=lines[i]&&lines[i].words;if(ws){const t=audio.currentTime;[...el.querySelectorAll('.w')].forEach((s,k)=>{const w=ws[k];const q=t>=w.e?1:t<=w.t?0:(t-w.t)/Math.max(.05,w.e-w.t);s.style.setProperty('--q',(q*100).toFixed(0)+'%');s.classList.toggle('sung',q>0)})}}}
// audio graph
function ensureCtx(){if(ctx)return;ctx=new AudioContext();master=ctx.createGain();master.connect(ctx.destination);recDest=ctx.createMediaStreamDestination();master.connect(recDest);
  const src=ctx.createMediaElementSource(audio);
  const dry=ctx.createGain();src.connect(dry);dry.connect(master);
  const sp=ctx.createChannelSplitter(2),inv=ctx.createGain();inv.gain.value=-1;src.connect(sp);
  const side=ctx.createGain();sp.connect(side,0);sp.connect(inv,1);inv.connect(side);
  const hp=ctx.createBiquadFilter();hp.type='highpass';hp.frequency.value=220;side.connect(hp);
  const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=220;src.connect(lp);
  wet=ctx.createGain();hp.connect(wet);lp.connect(wet);wet.connect(master);
  dryG=dry;applyKaraoke()}
let wet,dryG;function applyKaraoke(){if(!wet)return;const on=$('karaoke').checked;const t=ctx.currentTime;wet.gain.setTargetAtTime(on?1:0,t,.05);dryG.gain.setTargetAtTime(on?0:1,t,.05)}
function loadAudio(url,name){lines=[];render();audio.src=url;$('trackName').textContent=name;audio.load()}
function play(){ensureCtx();ctx.resume();audio.src&&audio.play().catch(e=>console.warn(e))}
audio.onplay=()=>$('playBtn').textContent='❚❚';audio.onpause=()=>$('playBtn').textContent='▶';
$('playBtn').onclick=()=>audio.paused?play():audio.pause();
let seeking=false;$('seek').oninput=e=>{seeking=true;if(audio.duration)audio.currentTime=e.target.value/1000*audio.duration};$('seek').onchange=()=>seeking=false;
$('vol').oninput=e=>audio.volume=+e.target.value;audio.volume=.9;
const applyRate=()=>{audio.playbackRate=+$('rate').value;audio.preservesPitch=audio.mozPreservesPitch=audio.webkitPreservesPitch=$('keepPitch').checked};
$('rate').onchange=applyRate;$('keepPitch').onchange=applyRate;audio.onloadedmetadata=applyRate;
// loading
function loadFile(f){if(!f)return;if(f.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|flac|aac|opus)$/i.test(f.name)){loadAudio(URL.createObjectURL(f),f.name);window.LLauto&&window.LLauto(f)}
  else f.text().then(t=>setLyrics(t))}
$('audioFile').onchange=e=>loadFile(e.target.files[0]);$('lrcFile').onchange=e=>loadFile(e.target.files[0]);
$('demoBtn').onclick=()=>{loadAudio(window.DEMO_AUDIO,'Limelight Demo — generated beat · 0:29');setLyrics(DEMO_LRC)};
addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag')});
addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag')});
addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag');[...e.dataTransfer.files].forEach(loadFile)});
$('lyricsBtn').onclick=()=>$('dlg').showModal();$('applyLyrics').onclick=()=>setLyrics($('lyricsText').value);
// tap sync
function startSync(){syncMode=true;syncIdx=0;lines.forEach(l=>l.t=null);$('syncBar').hidden=false;updSync();render()}
function stopSync(){syncMode=false;$('syncBar').hidden=true}
function updSync(){$('syncCount').textContent=`${syncIdx}/${lines.length} stamped`}
function tap(){if(!syncMode||syncIdx>=lines.length)return;lines[syncIdx].t=audio.currentTime;$('lyrics').children[syncIdx].classList.remove('unsynced');syncIdx++;updSync();if(syncIdx>=lines.length)stopSync()}
function exportLrc(){const txt=lines.filter(l=>l.t!=null).map(l=>lrcTime(l.t)+l.text).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain'}));a.download=($('trackName').textContent.replace(/\.[^.]+$/,'')||'lyrics')+'.lrc';a.click()}
$('syncExport').onclick=exportLrc;$('syncDone').onclick=stopSync;
// mic
function impulse(sec){const n=ctx.sampleRate*sec,b=ctx.createBuffer(2,n,ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,3)}return b}
$('micBtn').onclick=async()=>{ensureCtx();ctx.resume();if(micStream){micStream.getTracks().forEach(t=>t.stop());micStream=null;$('micBtn').textContent='Enable mic';$('micBtn').classList.remove('on');micGain.disconnect();analyser=null;$('meter').style.width=0;return}
  try{micStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:false}})}catch(e){(window.toast||console.warn)('Mic unavailable: '+e.message);return}
  const src=ctx.createMediaStreamSource(micStream);micGain=ctx.createGain();micGain.gain.value=+$('micVol').value;analyser=ctx.createAnalyser();analyser.fftSize=1024;
  src.connect(micGain);micGain.connect(analyser);micGain.connect(master);
  const conv=ctx.createConvolver();conv.buffer=impulse(2.2);revGain=ctx.createGain();revGain.gain.value=$('fxRev').checked?.45:0;micGain.connect(conv);conv.connect(revGain);revGain.connect(master);
  const dl=ctx.createDelay(1);dl.delayTime.value=.32;const fb=ctx.createGain();fb.gain.value=.35;echoGain=ctx.createGain();echoGain.gain.value=$('fxEcho').checked?.5:0;
  micGain.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(echoGain);echoGain.connect(master);
  $('micBtn').textContent='Disable mic';$('micBtn').classList.add('on')};
$('micVol').oninput=e=>micGain&&(micGain.gain.value=+e.target.value);
$('fxRev').onchange=e=>revGain&&(revGain.gain.value=e.target.checked?.45:0);$('fxEcho').onchange=e=>echoGain&&(echoGain.gain.value=e.target.checked?.5:0);
// record
$('recBtn').onclick=()=>{ensureCtx();ctx.resume();if(recorder&&recorder.state==='recording'){recorder.stop();return}
  const mime=['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
  recorder=new MediaRecorder(recDest.stream,mime?{mimeType:mime}:{});chunks=[];recorder.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  recorder.onstop=()=>{const b=new Blob(chunks,{type:recorder.mimeType});const a=$('recLink');a.href=URL.createObjectURL(b);a.download='karaoke-take.'+(b.type.includes('mp4')?'m4a':b.type.includes('ogg')?'ogg':'webm');a.hidden=false;$('recBtn').textContent='● Record';$('recBtn').classList.remove('on')};
  recorder.start(250);$('recBtn').textContent='■ Stop';$('recBtn').classList.add('on');if(audio.paused)play()};
// keys
addEventListener('keydown',e=>{if(e.target.matches('textarea,input[type=text]')||$('dlg').open)return;
  if(e.code==='Space'){e.preventDefault();if(syncMode&&!audio.paused&&e.shiftKey)tap();else audio.paused?play():audio.pause()}
  else if(e.code==='Enter'||e.key==='t'){e.preventDefault();tap()}
  else if(e.code==='ArrowRight'){if(audio.duration)audio.currentTime=Math.min(audio.duration,audio.currentTime+5)}else if(e.code==='ArrowLeft')audio.currentTime=Math.max(0,audio.currentTime-5);
  else if(e.key==='m')$('micBtn').click();else if(e.key==='r')$('recBtn').click()});
requestAnimationFrame(tick);
window.LL={audio,play,setLines,setLyrics,loadAudio,lrcTime,get lines(){return lines},enableMic:()=>{if(!micStream)$('micBtn').click()}};
})();
