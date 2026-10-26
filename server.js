import express from 'express';
import multer from 'multer';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import OpenAI from 'openai';
import ffmpegPath from 'ffmpeg-static';

dotenv.config();
const execFileAsync=promisify(execFile);
const app=express(); const PORT=process.env.PORT||8080;
const root=path.resolve(process.cwd(),'..');
app.use(express.json({limit:'1mb'})); app.use(express.static(root));
const upload=multer({dest:path.join(os.tmpdir(),'ai-agent-uploads'),limits:{fileSize:200*1024*1024}});
const client=()=>{if(!process.env.OPENAI_API_KEY)throw new Error('AI provider is not configured. Add OPENAI_API_KEY to server/.env and restart the server.');return new OpenAI({apiKey:process.env.OPENAI_API_KEY})};
app.get('/api/health',(_,res)=>res.json({ok:true,service:'AI Agent Studio',configured:Boolean(process.env.OPENAI_API_KEY)}));
const stamp=t=>{t=Math.max(0,Number(t)||0);const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60),ms=Math.floor((t-Math.floor(t))*1000);return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(ms).padStart(3,'0')}`};
const clean=s=>String(s??'').replace(/\r/g,'').trim();
async function transcribeVideo(file,source){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-agent-job-')); const audio=path.join(dir,'audio.mp3');
 try{
  await execFileAsync(ffmpegPath,['-y','-i',file,'-vn','-ac','1','-ar','16000','-b:a','48k',audio],{timeout:15*60*1000,maxBuffer:1024*1024});
  const stat=fs.statSync(audio); if(stat.size>24*1024*1024) throw new Error('The audio track is longer/larger than this starter supports (24 MB after compression). Try a shorter video.');
  const ai=client(); const response=await ai.audio.transcriptions.create({file:fs.createReadStream(audio),model:'whisper-1',response_format:'verbose_json',...(source&&source!=='auto'?{language:({'English':'en','Chinese':'zh','Thai':'th','Japanese':'ja','Korean':'ko','Hindi':'hi','Myanmar':'my'})[source]||undefined}:{})});
  return {text:clean(response.text),segments:(response.segments||[]).map(s=>({start:s.start,end:s.end,text:clean(s.text)})).filter(s=>s.text),dir};
 }catch(e){fs.rmSync(dir,{recursive:true,force:true});throw e}
}
async function translateSegments(segments,target){
 const ai=client(), out=[]; const language=target==='Myanmar (Burmese)'?'Burmese (Myanmar)':target;
 for(let i=0;i<segments.length;i+=35){const batch=segments.slice(i,i+35);const input=batch.map((s,j)=>({id:j,text:s.text}));const response=await ai.chat.completions.create({model:process.env.TEXT_MODEL||'gpt-4o-mini',temperature:0.2,response_format:{type:'json_object'},messages:[{role:'system',content:`Translate each subtitle segment naturally into ${language}. Preserve meaning, names, tone, and numbering. Return only JSON in the shape {"translations":[{"id":0,"text":"..."}]}. Do not merge or omit segments.`},{role:'user',content:JSON.stringify(input)}]});let parsed;try{parsed=JSON.parse(response.choices[0].message.content)}catch{throw new Error('Translation response could not be parsed. Please retry.')};const map=new Map((parsed.translations||[]).map(x=>[Number(x.id),clean(x.text)]));batch.forEach((s,j)=>out.push({...s,translated:map.get(j)||s.text}));}
 return out;
}
function makeSrt(segments){return segments.map((s,i)=>`${i+1}\n${stamp(s.start)} --> ${stamp(Math.max(s.start+0.25,s.end))}\n${s.translated||s.text}\n`).join('\n')}
app.post('/api/process',upload.single('video'),async(req,res)=>{
 if(!req.file)return res.status(400).json({error:'Please upload a video file.'});let jobDir;
 try{
  const mode=req.body.mode==='recap'?'recap':'translate'; const source=req.body.source||'auto',target=req.body.target||'Myanmar (Burmese)';
  const result=await transcribeVideo(req.file.path,source);jobDir=result.dir;
  if(!result.text)return res.status(422).json({error:'No speech was detected in this video.'});
  if(mode==='recap'){
   const ai=client();const summary=await ai.chat.completions.create({model:process.env.TEXT_MODEL||'gpt-4o-mini',messages:[{role:'system',content:'You are a skilled movie recap writer. Based only on the provided transcript, write a clear, engaging narration script in the requested language. Organize it with a short title, spoiler-aware story summary, and a voiceover-ready recap. Do not invent scenes absent from the transcript. If the transcript is incomplete, mention that.'},{role:'user',content:`Write in ${target}. Transcript:\n${result.text.slice(0,45000)}`}],temperature:0.5});
   return res.json({ok:true,title:'Movie recap script',text:clean(summary.choices[0].message.content),filename:'movie-recap.txt'});
  }
  let segments=result.segments;
  if(!segments.length)segments=[{start:0,end:Math.max(1,result.text.length/12),text:result.text}];
  const translated=await translateSegments(segments,target);const srt=makeSrt(translated);const transcript=translated.map(s=>s.translated).join('\n');
  res.json({ok:true,title:'Translated subtitles',text:transcript,filename:'translated-transcript.txt',srt});
 }catch(e){console.error(e);res.status(500).json({error:e.message||'Processing failed. Please check your server configuration.'})}
 finally{try{fs.unlinkSync(req.file.path)}catch{}if(jobDir)fs.rmSync(jobDir,{recursive:true,force:true})}
});
app.post('/api/prompt',async(req,res)=>{try{const idea=clean(req.body.idea);if(!idea)return res.status(400).json({error:'Describe your video idea first.'});const ai=client();const r=await ai.chat.completions.create({model:process.env.TEXT_MODEL||'gpt-4o-mini',temperature:0.7,messages:[{role:'system',content:'You are an expert generative-video prompt writer. Create one detailed, ready-to-use video generation prompt including subject, action, setting, camera movement, lighting, atmosphere, realistic motion, composition, and negative constraints. Respect the requested aspect ratio and style. Do not claim to render a video.'},{role:'user',content:`Idea: ${idea}\nAspect ratio: ${req.body.format||'Vertical 9:16'}\nStyle: ${req.body.style||'Cinematic realistic'}`} ]});res.json({ok:true,prompt:clean(r.choices[0].message.content)})}catch(e){console.error(e);res.status(500).json({error:e.message||'Prompt generation failed.'})}});
app.listen(PORT,()=>console.log(`AI Agent Studio running on http://localhost:${PORT}`));
