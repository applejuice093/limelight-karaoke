import {pipeline,env} from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.1';
env.allowLocalModels=false;
let asr,cur;
self.onmessage=async({data})=>{try{
  if(!asr||cur!==data.model){cur=data.model;const files={};
    asr=await pipeline('automatic-speech-recognition',data.model,{dtype:{encoder_model:'fp32',decoder_model_merged:'q8'},device:'wasm',
      progress_callback:p=>{if(p.status==='progress'){files[p.file]=[p.loaded,p.total];let l=0,t=0;for(const k in files){l+=files[k][0];t+=files[k][1]}self.postMessage({type:'dl',loaded:l,total:t})}}})}
  self.postMessage({type:'run'});
  const out=await asr(data.audio,{return_timestamps:'word',chunk_length_s:30,stride_length_s:5});
  self.postMessage({type:'done',chunks:out.chunks||[],text:out.text});
}catch(e){self.postMessage({type:'error',message:String(e&&e.message||e)})}};
