const MAX_POKEMON=1025;
const NAME_CACHE_KEY="pokemon_name_cache_ja_v4";
const DETAIL_CACHE_KEY="pokemon_detail_cache_ja_v1";
const STATS_KEY="pokemon_quiz_stats_v2";
const SOUND_KEY="pokemon_quiz_sound_v1";

const GENERATIONS=[
{id:1,label:"第1世代",start:1,end:151},{id:2,label:"第2世代",start:152,end:251},
{id:3,label:"第3世代",start:252,end:386},{id:4,label:"第4世代",start:387,end:493},
{id:5,label:"第5世代",start:494,end:649},{id:6,label:"第6世代",start:650,end:721},
{id:7,label:"第7世代",start:722,end:809},{id:8,label:"第8世代",start:810,end:905},
{id:9,label:"第9世代",start:906,end:1025}
];

const FAMOUS_IDS=new Set([
1,4,7,25,39,52,54,58,63,92,94,129,130,131,133,134,135,136,143,149,150,151,
152,155,158,172,175,196,197,202,212,214,243,244,245,249,250,251,
252,255,258,282,302,303,306,333,359,373,376,380,381,382,383,384,385,386,
387,390,393,403,417,425,443,445,447,448,470,471,475,479,483,484,487,491,492,493,
494,495,498,501,506,519,529,532,551,559,570,571,587,610,612,624,625,633,635,643,644,646,649,
650,653,656,659,674,677,700,704,706,714,715,716,717,718,719,720,721,
722,725,728,734,744,745,759,761,778,782,784,785,786,787,788,789,791,792,800,801,802,807,808,809,
810,813,816,821,831,835,848,849,854,856,859,868,870,872,884,885,887,888,889,890,891,892,898,899,900,905,
906,909,912,915,921,924,926,928,931,935,937,938,939,940,941,942,943,944,945,950,953,954,957,959,963,964,967,971,972,973,974,975,980,981,982,983,999,1000,1007,1008,1024,1025
]);

function loadNameCache(){
  try{return JSON.parse(localStorage.getItem(NAME_CACHE_KEY)||"{}")||{};}catch{return {};}
}
function loadDetailCache(){try{return JSON.parse(localStorage.getItem(DETAIL_CACHE_KEY)||"{}")||{};}catch{return {};}}
const state={
 nameCache:loadNameCache(),detailCache:loadDetailCache(),selectedGenerations:new Set([1]),questionCount:10,difficulty:"easy",
 pool:[],reviewIds:null,quizIds:[],currentIndex:0,score:0,streak:0,bestStreakThisRun:0,
 history:[],locked:false,soundOn:localStorage.getItem(SOUND_KEY)!=="off",
 dexId:1,dexPageStart:1,dexPageSize:20,dexNamesHidden:false,dexMode:"grid"
};

const screens={menu:document.getElementById("menu"),setup:document.getElementById("setup"),
quiz:document.getElementById("quiz"),result:document.getElementById("result"),dex:document.getElementById("dex")};

function saveNameCache(){try{localStorage.setItem(NAME_CACHE_KEY,JSON.stringify(state.nameCache));}catch{}}
function saveDetailCache(){try{localStorage.setItem(DETAIL_CACHE_KEY,JSON.stringify(state.detailCache));}catch{}}
const TYPE_JA={normal:"ノーマル",fire:"ほのお",water:"みず",electric:"でんき",grass:"くさ",ice:"こおり",fighting:"かくとう",poison:"どく",ground:"じめん",flying:"ひこう",psychic:"エスパー",bug:"むし",rock:"いわ",ghost:"ゴースト",dragon:"ドラゴン",dark:"あく",steel:"はがね",fairy:"フェアリー"};
function cleanFlavorText(text){return (text||"").replace(/\f/g," ").replace(/\n/g," ").replace(/\r/g," ").replace(/\s+/g," ").trim();}
function japaneseFlavorEntry(species){
 const entries=species.flavor_text_entries.filter(x=>x.language?.name==="ja-Hrkt"||x.language?.name==="ja");
 return entries.length?entries[entries.length-1]:null;
}
function fetchWithTimeout(url,ms=8000){
 const controller=new AbortController();
 const timer=setTimeout(()=>controller.abort(),ms);
 return fetch(url,{signal:controller.signal})
   .finally(()=>clearTimeout(timer));
}

async function getPokemonDetail(id){
 if(state.detailCache[id]) return state.detailCache[id];

 const fallback={
  name:cachedName(id),
  genus:"",
  description:"ずかんせつめいを よみこめませんでした。",
  version:"",
  types:[],
  heightMeters:null,
  weightKg:null
 };

 let species=null;
 let pokemon=null;

 try{
  const results=await Promise.allSettled([
   fetchWithTimeout(`https://pokeapi.co/api/v2/pokemon-species/${id}/`,8000),
   fetchWithTimeout(`https://pokeapi.co/api/v2/pokemon/${id}/`,8000)
  ]);

  if(results[0].status==="fulfilled" && results[0].value.ok){
   species=await results[0].value.json();
  }
  if(results[1].status==="fulfilled" && results[1].value.ok){
   pokemon=await results[1].value.json();
  }
 }catch(err){
  console.warn("図鑑詳細取得エラー",id,err);
 }

 if(species){
  const jaName=species.names.find(x=>x.language.name==="ja-Hrkt")
    || species.names.find(x=>x.language.name==="ja");
  const jaGenus=species.genera.find(x=>x.language.name==="ja-Hrkt")
    || species.genera.find(x=>x.language.name==="ja");
  const flavor=japaneseFlavorEntry(species);

  fallback.name=jaName?.name || fallback.name;
  fallback.genus=jaGenus?.genus || "";
  fallback.description=cleanFlavorText(flavor?.flavor_text || "")
    || "ずかんせつめいが ありません。";
  fallback.version=flavor?.version?.name || "";
 }

 if(pokemon){
  fallback.types=pokemon.types
    .slice()
    .sort((a,b)=>a.slot-b.slot)
    .map(x=>TYPE_JA[x.type.name]||x.type.name);
  fallback.heightMeters=pokemon.height/10;
  fallback.weightKg=pokemon.weight/10;
 }

 state.nameCache[id]=fallback.name;
 state.detailCache[id]=fallback;
 saveNameCache();
 saveDetailCache();
 return fallback;
}

async function getPokemonName(id){
 if(state.nameCache[id]) return state.nameCache[id];
 try{
  const r=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
  if(!r.ok) throw new Error();
  const d=await r.json();
  const ja=d.names.find(x=>x.language.name==="ja-Hrkt")||d.names.find(x=>x.language.name==="ja");
  const n=ja?.name||`No.${id}`;
  state.nameCache[id]=n; saveNameCache(); return n;
 }catch{return `No.${id}`;}
}
async function getPokemonNames(ids){
 const pairs=await Promise.all([...new Set(ids)].map(async id=>[id,await getPokemonName(id)]));
 return Object.fromEntries(pairs);
}
function cachedName(id){return state.nameCache[id]||`No.${id}`;}
function pokemonImageUrl(id){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;}
function fallbackSpriteUrl(id){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;}
function generationForId(id){return GENERATIONS.find(g=>id>=g.start&&id<=g.end)||GENERATIONS[0];}
function padNo(id){return String(id).padStart(4,"0");}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function sample(a,n){return shuffle(a).slice(0,n);}
function escapeHtml(t){const d=document.createElement("div");d.textContent=t;return d.innerHTML;}

function showScreen(name){
 Object.values(screens).forEach(s=>s.classList.remove("active"));screens[name].classList.add("active");
 document.getElementById("homeBtn").classList.toggle("hidden",name==="menu");window.scrollTo({top:0,behavior:"smooth"});
}
function getStats(){
 try{const x=JSON.parse(localStorage.getItem(STATS_KEY)||'{"best":{},"mistakes":{},"plays":0}');
 x.best||={};x.mistakes||={};x.plays||=0;return x;}catch{return {best:{},mistakes:{},plays:0};}
}
function saveStats(x){localStorage.setItem(STATS_KEY,JSON.stringify(x));}
function bestKey(){return `${[...state.selectedGenerations].sort((a,b)=>a-b).join("-")}|${state.questionCount}|${state.difficulty}`;}
function updateBestSummary(){
 const s=getStats(),vals=Object.values(s.best),top=vals.length?Math.max(...vals.map(Number)):0;
 document.getElementById("bestSummary").textContent=s.plays?`これまで ${s.plays}かい あそんだよ　★ さいこう ${top}てん`:"はじめての クイズに ちょうせんしよう！";
}
function updateSoundButton(){document.getElementById("soundToggle").textContent=state.soundOn?"🔊 おと ON":"🔇 おと OFF";}
function speak(t){if(!state.soundOn||!("speechSynthesis"in window))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang="ja-JP";u.rate=.9;u.pitch=1.05;window.speechSynthesis.speak(u);}
function beep(ok){if(!state.soundOn)return;try{const AC=window.AudioContext||window.webkitAudioContext,c=new AC(),o=c.createOscillator(),g=c.createGain();o.connect(g);g.connect(c.destination);o.frequency.value=ok?740:220;g.gain.setValueAtTime(.08,c.currentTime);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.22);o.start();o.stop(c.currentTime+.22);}catch{}}

function buildGenerationGrid(){
 const grid=document.getElementById("generationGrid");grid.innerHTML="";
 GENERATIONS.forEach(g=>{const l=document.createElement("label");l.className="gen-choice";
 l.innerHTML=`<input type="checkbox" data-gen="${g.id}" ${state.selectedGenerations.has(g.id)?"checked":""}><span class="gen-title">${g.label}</span><span class="gen-range">No.${g.start}〜${g.end}</span>`;
 const cb=l.querySelector("input");cb.addEventListener("change",()=>cb.checked?state.selectedGenerations.add(g.id):state.selectedGenerations.delete(g.id));grid.appendChild(l);});
}
function syncGenerationGrid(){document.querySelectorAll("[data-gen]").forEach(cb=>cb.checked=state.selectedGenerations.has(Number(cb.dataset.gen)));}
function selectedIds(){const a=[];GENERATIONS.forEach(g=>{if(state.selectedGenerations.has(g.id))for(let i=g.start;i<=g.end;i++)a.push(i);});return a;}
function makePool(){let ids=selectedIds();if(state.difficulty==="easy"){const f=ids.filter(id=>FAMOUS_IDS.has(id));if(f.length>=state.questionCount)ids=f;}return ids;}
function chooseQuizIds(pool,count){return pool.length<=count?shuffle(pool):sample(pool,count);}

function startNormalQuiz(){
 if(!state.selectedGenerations.size){const m=document.getElementById("setupMessage");m.textContent="1ついじょう せだいを えらんでね。";m.className="feedback bad";return;}
 state.questionCount=Number(document.querySelector('input[name="questionCount"]:checked')?.value||10);
 state.difficulty=document.querySelector('input[name="difficulty"]:checked')?.value||"easy";
 state.pool=makePool();state.reviewIds=null;startQuizWithIds(chooseQuizIds(state.pool,Math.min(state.questionCount,state.pool.length)));
}
function startQuizWithIds(ids){state.quizIds=[...ids];state.currentIndex=0;state.score=0;state.streak=0;state.bestStreakThisRun=0;state.history=[];state.locked=false;showScreen("quiz");showQuestion();}

async function showQuestion(){
 if(state.currentIndex>=state.quizIds.length){finishQuiz();return;}
 state.locked=true;document.getElementById("nextBtn").classList.add("hidden");
 const fb=document.getElementById("feedback");fb.textContent="なまえを よみこみちゅう…";fb.className="feedback";
 const id=state.quizIds[state.currentIndex],gen=generationForId(id);
 document.getElementById("qCounter").textContent=`${state.currentIndex+1} / ${state.quizIds.length}`;
 document.getElementById("scoreCounter").textContent=`せいかい ${state.score}`;
 document.getElementById("streakCounter").textContent=`れんぞく ${state.streak}`;
 document.getElementById("genLabel").textContent=gen.label;
 document.getElementById("bestLabel").textContent=`BEST ${Number(getStats().best[bestKey()]||0)}`;
 loadQuizImage(id);await renderChoices(id);fb.textContent="";state.locked=false;
}
function loadQuizImage(id){
 const img=document.getElementById("pokemonImage"),loading=document.getElementById("imageLoading");
 loading.textContent="よみこみちゅう…";loading.classList.remove("hidden");img.classList.add("hidden");img.dataset.fallback="0";
 img.onload=()=>{loading.classList.add("hidden");img.classList.remove("hidden")};
 img.onerror=()=>{if(img.dataset.fallback!=="1"){img.dataset.fallback="1";img.src=fallbackSpriteUrl(id)}else loading.textContent="がぞうを よみこめませんでした";};
 img.src=pokemonImageUrl(id);img.alt=`No.${id}`;
}
function relatedCandidatePool(correctId){
 const g=generationForId(correctId),all=[];for(let id=g.start;id<=g.end;id++)if(id!==correctId)all.push(id);
 const near=[];for(let d=1;d<=12;d++)for(const x of[correctId-d,correctId+d])if(x>=g.start&&x<=g.end)near.push(x);
 if(state.difficulty==="hard")return[...new Set([...near,...shuffle(all)])];
 if(state.difficulty==="normal")return[...new Set([...near.slice(0,10),...shuffle(all)])];
 return[...new Set([...shuffle(all.filter(id=>FAMOUS_IDS.has(id))),...shuffle(all)])];
}
async function renderChoices(correctId){
 const box=document.getElementById("choices");box.innerHTML="";
 const options=shuffle([correctId,...relatedCandidatePool(correctId).slice(0,3)]),names=await getPokemonNames(options);
 options.forEach(id=>{const b=document.createElement("button");b.className="choice-btn";b.type="button";b.textContent=names[id];b.dataset.id=id;b.addEventListener("click",()=>answerQuestion(b,id,correctId,names));box.appendChild(b);});
}
function answerQuestion(button,selectedId,correctId,names){
 if(state.locked)return;state.locked=true;const ok=selectedId===correctId,fb=document.getElementById("feedback");
 document.querySelectorAll(".choice-btn").forEach(b=>{b.disabled=true;if(Number(b.dataset.id)===correctId)b.classList.add("correct");});
 const cn=names[correctId]||cachedName(correctId),sn=names[selectedId]||cachedName(selectedId);
 if(ok){state.score++;state.streak++;state.bestStreakThisRun=Math.max(state.bestStreakThisRun,state.streak);button.classList.add("correct");fb.textContent=`⭕ せいかい！ ${cn}　${state.streak}れんぞく！`;fb.className="feedback good";beep(true);speak(`せいかい。${cn}`);}
 else{state.streak=0;button.classList.add("wrong");fb.textContent=`おしい！ こたえは ${cn}`;fb.className="feedback bad";beep(false);speak(`こたえは、${cn}`);}
 state.history.push({id:correctId,selectedId,correctName:cn,selectedName:sn,ok});
 document.getElementById("scoreCounter").textContent=`せいかい ${state.score}`;document.getElementById("streakCounter").textContent=`れんぞく ${state.streak}`;
 const n=document.getElementById("nextBtn");n.textContent=state.currentIndex===state.quizIds.length-1?"けっかを みる →":"つぎの もんだい →";n.classList.remove("hidden");
}

function finishQuiz(){
 const s=getStats();s.plays++;s.best[bestKey()]=Math.max(Number(s.best[bestKey()]||0),state.score);
 state.history.forEach(h=>{const k=String(h.id),v=Number(s.mistakes[k]||0);s.mistakes[k]=h.ok?Math.max(0,v-1):v+2;});
 saveStats(s);showResults();updateBestSummary();
}
function showResults(){
 showScreen("result");document.getElementById("finalScore").textContent=`${state.score} / ${state.quizIds.length}`;
 const best=Number(getStats().best[bestKey()]||state.score);document.getElementById("bestResult").textContent=`★ このせっていの さいこう：${best}てん　／　れんぞくBEST：${state.bestStreakThisRun}`;
 const r=state.score/state.quizIds.length,m=document.getElementById("resultMessage");m.textContent=r===1?"🏆 パーフェクト！ ポケモンはかせ！":r>=.8?"🌟 すごい！ とっても よくできました！":r>=.5?"😊 よく がんばりました！":"📘 ずかんで ふくしゅうして もういちど！";
 const body=document.getElementById("resultBody");body.innerHTML="";
 state.history.forEach(h=>{const tr=document.createElement("tr");tr.innerHTML=`<td><img class="thumb" src="${pokemonImageUrl(h.id)}" alt=""></td><td>${escapeHtml(h.correctName)}</td><td>${escapeHtml(h.selectedName)}</td><td class="${h.ok?"ok":"ng"}">${h.ok?"○":"×"}</td>`;body.appendChild(tr);});
 document.getElementById("wrongOnlyBtn").classList.toggle("hidden",!state.history.some(h=>!h.ok));
}
function startWrongOnly(){const ids=[...new Set(state.history.filter(h=>!h.ok).map(h=>h.id))];if(ids.length)startQuizWithIds(ids);}
function startReviewMode(){
 const ranked=Object.entries(getStats().mistakes).map(([id,v])=>[Number(id),Number(v)]).filter(([id,v])=>id>=1&&id<=MAX_POKEMON&&v>0).sort((a,b)=>b[1]-a[1]).map(([id])=>id);
 if(!ranked.length){alert("まだ にがてポケモンの きろくが ありません。まずは クイズを あそんでね！");return;}
 state.selectedGenerations=new Set(GENERATIONS.map(g=>g.id));state.questionCount=Math.min(10,ranked.length);state.difficulty="hard";state.reviewIds=ranked.slice(0,state.questionCount);startQuizWithIds(state.reviewIds);
}

function buildDexGenerationJumps(){
 const box=document.getElementById("dexGenJumps");box.innerHTML="";
 GENERATIONS.forEach(g=>{const b=document.createElement("button");b.className="small";b.type="button";b.textContent=g.label;b.addEventListener("click",()=>{state.dexPageStart=g.start;state.dexId=g.start;state.dexMode==="grid"?renderDexGrid():renderDexSingle();});box.appendChild(b);});
}
async function renderDexGrid(){
 const grid=document.getElementById("dexGrid"),start=state.dexPageStart,end=Math.min(MAX_POKEMON,start+state.dexPageSize-1),ids=[];for(let i=start;i<=end;i++)ids.push(i);
 grid.innerHTML='<div class="loading">ずかんを よみこみちゅう…</div>';const names=await getPokemonNames(ids);grid.innerHTML="";
 ids.forEach(id=>{const item=document.createElement("button");item.type="button";item.className="dex-item";item.innerHTML=`<div class="dex-item-no">No.${padNo(id)}</div><img src="${pokemonImageUrl(id)}" alt="${escapeHtml(names[id])}" loading="lazy"><div class="dex-item-name">${state.dexNamesHidden?"？？？":escapeHtml(names[id])}</div>`;item.querySelector("img").onerror=e=>e.currentTarget.src=fallbackSpriteUrl(id);item.addEventListener("click",()=>{state.dexId=id;setDexMode("single");renderDexSingle();});grid.appendChild(item);});
 document.getElementById("dexPageLabel").textContent=`${start} - ${end}`;document.getElementById("dexPrevPageBtn").disabled=start<=1;document.getElementById("dexNextPageBtn").disabled=end>=MAX_POKEMON;
}
async function renderDexSingle(){
 const id=state.dexId;

 document.getElementById("dexNo").textContent=`No.${padNo(id)}`;
 document.getElementById("dexName").textContent="よみこみちゅう…";
 document.getElementById("dexCategory").textContent="ぶんるい：よみこみちゅう…";
 document.getElementById("dexTypes").innerHTML="";
 document.getElementById("dexHeight").textContent="-";
 document.getElementById("dexWeight").textContent="-";
 document.getElementById("dexDescription").textContent="よみこみちゅう…";
 document.getElementById("dexDescriptionVersion").textContent="";

 let detail;
 try{
  detail=await getPokemonDetail(id);
 }catch(err){
  console.warn("図鑑表示エラー",id,err);
  detail={
   name:await getPokemonName(id),
   genus:"",
   description:"ずかんせつめいを よみこめませんでした。",
   version:"",
   types:[],
   heightMeters:null,
   weightKg:null
  };
 }

 // 「次へ」をすぐ押した場合、古い通信結果で上書きしない
 if(id!==state.dexId) return;

 document.getElementById("dexName").textContent=
   state.dexNamesHidden?"？？？":detail.name;
 document.getElementById("dexCategory").textContent=
   detail.genus?`ぶんるい：${detail.genus}`:"ぶんるい：-";

 const typeBox=document.getElementById("dexTypes");
 typeBox.innerHTML="";
 if(detail.types.length){
  detail.types.forEach(type=>{
   const s=document.createElement("span");
   s.className="type-badge";
   s.textContent=type;
   typeBox.appendChild(s);
  });
 }else{
  const s=document.createElement("span");
  s.className="type-badge";
  s.textContent="タイプ：-";
  typeBox.appendChild(s);
 }

 document.getElementById("dexHeight").textContent=
   detail.heightMeters==null?"-":`${detail.heightMeters.toFixed(1)} m`;
 document.getElementById("dexWeight").textContent=
   detail.weightKg==null?"-":`${detail.weightKg.toFixed(1)} kg`;

 document.getElementById("dexDescription").textContent=
   detail.description || "ずかんせつめいが ありません。";
 document.getElementById("dexDescriptionVersion").textContent=
   detail.version?`しゅってんゲーム：${detail.version}`:"";

 const img=document.getElementById("dexImage");
 const loading=document.getElementById("dexLoading");
 loading.textContent="よみこみちゅう…";
 loading.classList.remove("hidden");
 img.classList.add("hidden");
 img.dataset.fallback="0";

 img.onload=()=>{
  if(id!==state.dexId) return;
  loading.classList.add("hidden");
  img.classList.remove("hidden");
 };
 img.onerror=()=>{
  if(img.dataset.fallback!=="1"){
   img.dataset.fallback="1";
   img.src=fallbackSpriteUrl(id);
  }else{
   loading.textContent="がぞうを よみこめませんでした";
  }
 };

 img.src=pokemonImageUrl(id);
 img.alt=detail.name;

 document.getElementById("dexPrevBtn").disabled=id<=1;
 document.getElementById("dexNextBtn").disabled=id>=MAX_POKEMON;
}

function setDexMode(mode){state.dexMode=mode;document.getElementById("dexGridView").classList.toggle("hidden",mode!=="grid");document.getElementById("dexSingleView").classList.toggle("hidden",mode!=="single");document.getElementById("gridViewBtn").classList.toggle("active",mode==="grid");document.getElementById("singleViewBtn").classList.toggle("active",mode==="single");}
function openDex(){showScreen("dex");state.dexMode==="grid"?renderDexGrid():renderDexSingle();}
function jumpDex(){const v=Math.max(1,Math.min(MAX_POKEMON,Number(document.getElementById("dexNumberInput").value)||1));state.dexId=v;state.dexPageStart=Math.floor((v-1)/state.dexPageSize)*state.dexPageSize+1;state.dexMode==="grid"?renderDexGrid():renderDexSingle();}
function toggleDexNames(){state.dexNamesHidden=!state.dexNamesHidden;document.getElementById("toggleNameBtn").textContent=state.dexNamesHidden?"👀 なまえを みる":"🙈 なまえを かくす";state.dexMode==="grid"?renderDexGrid():renderDexSingle();}
function restoreSetupInputs(){syncGenerationGrid();document.querySelectorAll('input[name="questionCount"]').forEach(r=>r.checked=Number(r.value)===state.questionCount);document.querySelectorAll('input[name="difficulty"]').forEach(r=>r.checked=r.value===state.difficulty);}

document.getElementById("soundToggle").addEventListener("click",()=>{state.soundOn=!state.soundOn;localStorage.setItem(SOUND_KEY,state.soundOn?"on":"off");updateSoundButton();});
document.getElementById("homeBtn").addEventListener("click",()=>showScreen("menu"));
document.getElementById("quizSetupBtn").addEventListener("click",()=>{restoreSetupInputs();showScreen("setup");});
document.getElementById("reviewModeBtn").addEventListener("click",startReviewMode);
document.getElementById("dexBtn").addEventListener("click",openDex);
document.getElementById("selectAllGenBtn").addEventListener("click",()=>{state.selectedGenerations=new Set(GENERATIONS.map(g=>g.id));syncGenerationGrid();});
document.getElementById("clearGenBtn").addEventListener("click",()=>{state.selectedGenerations.clear();syncGenerationGrid();});
document.getElementById("startQuizBtn").addEventListener("click",startNormalQuiz);
document.getElementById("nextBtn").addEventListener("click",()=>{state.currentIndex++;showQuestion();});
document.getElementById("wrongOnlyBtn").addEventListener("click",startWrongOnly);
document.getElementById("retryBtn").addEventListener("click",()=>{const p=state.reviewIds?state.reviewIds:makePool();startQuizWithIds(chooseQuizIds(p,Math.min(state.questionCount,p.length)));});
document.getElementById("openDexFromResultBtn").addEventListener("click",()=>{const w=state.history.find(h=>!h.ok);if(w){state.dexId=w.id;state.dexPageStart=Math.floor((w.id-1)/state.dexPageSize)*state.dexPageSize+1;}openDex();});
document.getElementById("changeSetupBtn").addEventListener("click",()=>{restoreSetupInputs();showScreen("setup");});
document.getElementById("resultMenuBtn").addEventListener("click",()=>showScreen("menu"));
document.getElementById("dexPrevPageBtn").addEventListener("click",()=>{state.dexPageStart=Math.max(1,state.dexPageStart-state.dexPageSize);renderDexGrid();});
document.getElementById("dexNextPageBtn").addEventListener("click",()=>{state.dexPageStart=Math.min(MAX_POKEMON,state.dexPageStart+state.dexPageSize);renderDexGrid();});
document.getElementById("dexJumpBtn").addEventListener("click",jumpDex);
document.getElementById("toggleNameBtn").addEventListener("click",toggleDexNames);
document.getElementById("gridViewBtn").addEventListener("click",()=>{setDexMode("grid");renderDexGrid();});
document.getElementById("singleViewBtn").addEventListener("click",()=>{setDexMode("single");renderDexSingle();});
document.getElementById("dexPrevBtn").addEventListener("click",()=>{state.dexId=Math.max(1,state.dexId-1);renderDexSingle();});
document.getElementById("dexNextBtn").addEventListener("click",()=>{state.dexId=Math.min(MAX_POKEMON,state.dexId+1);renderDexSingle();});
document.getElementById("dexSpeakBtn").addEventListener("click",async()=>speak(await getPokemonName(state.dexId)));
document.getElementById("dexDescriptionSpeakBtn").addEventListener("click",async()=>{const d=await getPokemonDetail(state.dexId);speak(d.description||"ずかんせつめいが ありません。");});

buildGenerationGrid();
buildDexGenerationJumps();
updateSoundButton();
updateBestSummary();
showScreen("menu");
