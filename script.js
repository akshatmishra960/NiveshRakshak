const rules = [
 {name:"Guaranteed return",points:25,patterns:[/guaranteed/i,/guarantee[d]?/i,/fixed\s+return/i,/100\s*%\s*profit/i,/गारंटीड/i,/गारंटी/i],why:"Guaranteed-return language detected."},
 {name:"Urgency / FOMO",points:15,patterns:[/today\s+only/i,/act\s+now/i,/limited\s+(time|slots)/i,/last\s+chance/i,/invest\s+today/i,/आज\s*ही/i,/अभी\s*निवेश/i,/जल्दी/i],why:"Urgency or FOMO language detected."},
 {name:"Payment pressure",points:20,patterns:[/send\s*(₹|rs\.?|inr)?\s*\d+/i,/pay\s+now/i,/transfer\s+now/i,/immediately/i,/payment\s+today/i,/पैसे\s*भेज/i,/तुरंत\s*भुगतान/i],why:"Pressure to make an immediate payment detected."},
 {name:"Sensitive information",points:30,patterns:[/\botp\b/i,/password/i,/\bpin\b/i,/\bcvv\b/i,/share\s+your\s+kyc/i,/ओटीपी/i,/पासवर्ड/i,/पिन/i],why:"Request for sensitive credentials or personal information detected."},
 {name:"Unverified financial claim",points:15,patterns:[/insider\s+tip/i,/secret\s+tip/i,/exclusive\s+opportunity/i,/double\s+your\s+money/i,/10x/i,/sure\s+shot/i,/गुप्त\s*टिप/i,/पैसा\s*डबल/i],why:"Unverified or unusually strong financial claim detected."},
 {name:"Possible impersonation",points:20,patterns:[/official\s+representative/i,/sebi\s+officer/i,/bank\s+manager/i,/government\s+official/i,/सेबी\s+अधिकारी/i,/सरकारी\s+अधिकारी/i],why:"Possible authority/impersonation language detected."}
];
const $ = id => document.getElementById(id);
const SESSION_KEY = "niveshSessionId";
function sessionId(){
  let id=localStorage.getItem(SESSION_KEY);
  if(!id){ id=(crypto.randomUUID?crypto.randomUUID():"s_"+Date.now()+"_"+Math.random().toString(36).slice(2)); localStorage.setItem(SESSION_KEY,id); }
  return id;
}
function analyzeLocal(text){
  let score=0,signals=[];
  for(const r of rules) if(r.patterns.some(p=>p.test(text))){score+=r.points;signals.push(r)}
  score=Math.min(score,100);
  const level=score>=50?"HIGH RISK INDICATORS":score>=25?"NEEDS VERIFICATION":"LOW RISK INDICATORS";
  const tone=score>=50?"danger":score>=25?"warning":"safe";
  return {score,level,tone,signals,language:/[\u0900-\u097F]/.test(text)?"Hindi / Hinglish":"English"};
}
async function api(path, options={}){
  const r=await fetch(path,{headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||`Request failed (${r.status})`);
  return data;
}
async function checkBackend(){
  try{await api('/api/health'); $('apiStatus').textContent='● Backend + Database connected'; $('apiStatus').className='apiStatus online';}
  catch{ $('apiStatus').textContent='● Backend unavailable — start the server'; $('apiStatus').className='apiStatus offline'; }
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));}
function renderResult(text,result,source){
  const box=$("result"); box.className="result "+result.tone;
  $("riskTitle").textContent=result.level; $("score").textContent=result.score+"/100"; $("meterFill").style.width=result.score+"%";
  const sig=$("signals"); sig.innerHTML="";
  if(!result.signals.length) sig.innerHTML='<div class="signal safe"><span>✓</span><div><b>No configured red flags detected</b><small>This does not prove the message is safe.</small></div></div>';
  else result.signals.forEach(s=>sig.innerHTML+=`<div class="signal"><span>⚠</span><div><b>${escapeHtml(s.name)}</b><small>${escapeHtml(s.why)}</small></div><strong>+${s.points}</strong></div>`);
  $("actions").innerHTML=["Verify the sender and claim independently.","Do not share OTP, password, PIN, CVV or other sensitive credentials.","Do not transfer money only because a message creates urgency.","Use trusted/official sources before making a financial decision."].map(x=>`<li>${x}</li>`).join("");
  $("verifyText").textContent=result.score>=50?"Multiple risk indicators were detected. Pause and verify the sender, registration details and claim using trusted official sources before taking any action.":"Use trusted official sources to independently verify the sender and financial claim before acting.";
  box.classList.remove("hidden"); box.scrollIntoView({behavior:"smooth",block:"start"});
}
async function submitAnalysis(text,source){
  try{
    const data=await api('/api/analyze',{method:'POST',body:JSON.stringify({text,source,sessionId:sessionId()})});
    renderResult(text,data,source); await renderHistory(); return data;
  }catch(e){
    const local=analyzeLocal(text); renderResult(text,local,source);
    alert("Backend save failed, so this scan was analyzed locally.\n\n"+e.message);
    return local;
  }
}
async function renderHistory(){
  const el=$("historyList");
  try{
    const data=await api('/api/scans?sessionId='+encodeURIComponent(sessionId())); const h=data.scans||[];
    if(!h.length){el.innerHTML='<div class="emptyHistory">No scans yet.</div>';return;}
    el.innerHTML=h.map(x=>`<div class="historyItem"><div><b>${escapeHtml(x.source)}</b><small>${escapeHtml(x.language)} • ${new Date(x.created_at).toLocaleString()}<br>${escapeHtml(x.preview)}</small></div><span class="historyBadge ${x.score>=50?'danger':x.score>=25?'warning':'safe'}">${x.score}/100</span></div>`).join('');
  }catch{el.innerHTML='<div class="emptyHistory">History unavailable until the backend is running.</div>';}
}
$("analyzeBtn").onclick=async()=>{const text=$("message").value.trim(); if(!text){alert("Please paste a message first.");return;} const b=$("analyzeBtn");b.disabled=true;b.textContent="Analyzing…";await submitAnalysis(text,"Message");b.disabled=false;b.textContent="Analyze Now →";};

document.querySelectorAll(".tab").forEach(btn=>btn.onclick=()=>{document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));btn.classList.add("active");$("textPanel").classList.toggle("hidden",btn.dataset.tab!=="text");$("imagePanel").classList.toggle("hidden",btn.dataset.tab!=="image");});
$("imageInput").onchange=e=>{const f=e.target.files[0];if(!f)return;const url=URL.createObjectURL(f);$("preview").innerHTML=`<img src="${url}" alt="Uploaded screenshot">`;};
async function preprocessImage(file){const bitmap=await createImageBitmap(file);const maxWidth=2200;const scale=Math.min(2.2,maxWidth/bitmap.width);const width=Math.max(1,Math.round(bitmap.width*scale));const height=Math.max(1,Math.round(bitmap.height*scale));const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;const ctx=canvas.getContext("2d",{willReadFrequently:true});ctx.drawImage(bitmap,0,0,width,height);const image=ctx.getImageData(0,0,width,height);for(let i=0;i<image.data.length;i+=4){const r=image.data[i],g=image.data[i+1],b=image.data[i+2];const gray=Math.round(.299*r+.587*g+.114*b);const boosted=gray<150?Math.max(0,gray-10):Math.min(255,gray+10);image.data[i]=image.data[i+1]=image.data[i+2]=boosted;}ctx.putImageData(image,0,0);return canvas.toDataURL("image/png");}
$("imageAnalyzeBtn").onclick=async()=>{const input=$("imageInput"),btn=$("imageAnalyzeBtn");if(!input.files[0]){alert("Please upload a screenshot first.");return;}const file=input.files[0];if(!file.type.startsWith("image/")){alert("Please select a PNG, JPG or WebP image.");return;}btn.disabled=true;try{if(typeof Tesseract==="undefined")throw new Error("OCR library could not load. Check your internet connection and refresh the page.");const processed=await preprocessImage(file);btn.textContent="Loading OCR language data…";const {data}=await Tesseract.recognize(processed,"eng+hin",{logger:m=>{if(m.status==="recognizing text"&&typeof m.progress==="number")btn.textContent=`Reading screenshot… ${Math.round(m.progress*100)}%`;else if(m.status)btn.textContent=`OCR: ${m.status}…`;}});const text=(data.text||"").replace(/\r/g,"").trim();if(!text)throw new Error("No readable text found. Try a clearer screenshot with larger text and good contrast.");const old=$("ocrBox");if(old)old.remove();const box=document.createElement("div");box.className="ocrBox";box.id="ocrBox";box.innerHTML=`<b>OCR Extracted Text</b><pre>${escapeHtml(text)}</pre>`;$("preview").insertAdjacentElement("afterend",box);await submitAnalysis(text,"Screenshot OCR");}catch(err){console.error(err);alert("OCR failed: "+(err?.message||err));}finally{btn.disabled=false;btn.textContent="Extract Text & Analyze →";}};
$("clearHistory").onclick=async()=>{try{await api('/api/scans?sessionId='+encodeURIComponent(sessionId()),{method:'DELETE'});await renderHistory();}catch(e){alert(e.message);}};
$("langBtn").onclick=()=>{const btn=$("langBtn"),hindi=btn.textContent==="हिन्दी";$("title").innerHTML=hindi?"सोचें, <span>फिर भरोसा करें।</span>":"Check before <span>you trust.</span>";$("subtitle").textContent=hindi?"संदिग्ध वित्तीय संदेशों में जोखिम संकेतों की पहचान करें।":"Analyze suspicious financial messages and identify common risk indicators before you act.";$("message").placeholder=hindi?"उदाहरण: 7 दिनों में 40% गारंटीड लाभ। आज ही निवेश करें…":"Example: Guaranteed 40% profit in 7 days. Invest today…";btn.textContent=hindi?"English":"हिन्दी";};

document.querySelectorAll(".demoCard").forEach(card=>card.onclick=()=>{const samples={high:"Guaranteed 40% profit in 7 days. Invest today. Limited slots. Send ₹5000 immediately.",medium:"Exclusive investment opportunity with an insider tip. This could double your money.",low:"This educational article explains how diversification can reduce portfolio concentration risk."};const t=samples[card.dataset.demo];$("message").value=t;$("charCount").textContent=t.length;$("message").scrollIntoView({behavior:"smooth",block:"center"});});
$("message").addEventListener("input",()=>$("charCount").textContent=$("message").value.length);
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")$("analyzeBtn").click();});
checkBackend();renderHistory();
