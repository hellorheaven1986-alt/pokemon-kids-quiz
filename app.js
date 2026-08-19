const MAX_POKEMON = 1025;
const NAMES_CACHE_KEY = "pokemon_names_ja_v1";
const STATS_KEY = "pokemon_quiz_stats_v2";
const SOUND_KEY = "pokemon_quiz_sound_v1";

const GENERATIONS = [
  {id:1,label:"第1世代",start:1,end:151},
  {id:2,label:"第2世代",start:152,end:251},
  {id:3,label:"第3世代",start:252,end:386},
  {id:4,label:"第4世代",start:387,end:493},
  {id:5,label:"第5世代",start:494,end:649},
  {id:6,label:"第6世代",start:650,end:721},
  {id:7,label:"第7世代",start:722,end:809},
  {id:8,label:"第8世代",start:810,end:905},
  {id:9,label:"第9世代",start:906,end:1025}
];

// 「かんたん」で出やすくする代表的なポケモン。
// 選択世代外は自動的に除外される。
const FAMOUS_IDS = new Set([
  1,4,7,25,26,35,37,39,52,54,58,63,66,74,92,94,104,113,129,130,131,133,134,135,136,143,147,149,150,151,
  152,155,158,172,175,179,196,197,202,212,214,225,243,244,245,249,250,251,
  252,255,258,280,282,302,303,304,306,311,312,333,359,371,373,376,380,381,382,383,384,385,386,
  387,390,393,403,417,425,427,443,445,447,448,453,461,470,471,475,479,483,484,487,491,492,493,
  494,495,498,501,506,519,529,532,551,559,570,571,572,573,587,610,612,624,625,633,635,643,644,646,647,648,649,
  650,653,656,659,661,674,677,700,704,706,714,715,716,717,718,719,720,721,
  722,725,728,734,744,745,747,751,757,759,761,764,769,778,782,784,785,786,787,788,789,791,792,800,801,802,807,808,809,
  810,813,816,819,821,831,835,837,848,849,854,856,859,868,870,872,876,877,878,884,885,887,888,889,890,891,892,893,894,895,896,897,898,899,900,901,902,903,904,905,
  906,909,912,915,919,921,924,926,928,931,932,935,937,938,939,940,941,942,943,944,945,946,947,948,949,950,951,952,953,954,955,956,957,958,959,960,961,962,963,964,965,966,967,968,969,970,971,972,973,974,975,976,977,978,979,980,981,982,983,984,985,986,987,988,989,990,991,992,993,994,995,996,997,998,999,1000,1001,1002,1003,1004,1005,1006,1007,1008,1009,1010,1011,1012,1013,1014,1015,1016,1017,1018,1019,1020,1021,1022,1023,1024,1025
]);

const state = {
  names:null,
  selectedGenerations:new Set([1]),
  questionCount:10,
  difficulty:"easy",
  pool:[],
  reviewIds:null,
  quizIds:[],
  currentIndex:0,
  score:0,
  streak:0,
  bestStreakThisRun:0,
  history:[],
  locked:false,
  soundOn:localStorage.getItem(SOUND_KEY)!=="off",
  dexId:1,
  dexPageStart:1,
  dexPageSize:20,
  dexNamesHidden:false,
  dexMode:"grid"
};

const screens = {
  menu:document.getElementById("menu"),
  setup:document.getElementById("setup"),
  quiz:document.getElementById("quiz"),
  result:document.getElementById("result"),
  dex:document.getElementById("dex")
};

function showScreen(name){
  Object.values(screens).forEach(s=>s.classList.remove("active"));
  screens[name].classList.add("active");
  document.getElementById("homeBtn").classList.toggle("hidden",name==="menu");
  window.scrollTo({top:0,behavior:"smooth"});
}

function pokemonImageUrl(id){
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
}

function fallbackSpriteUrl(id){
  return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
}

function generationForId(id){
  return GENERATIONS.find(g=>id>=g.start && id<=g.end) || GENERATIONS[0];
}

function padNo(id){
  return String(id).padStart(4,"0");
}

function shuffle(arr){
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function sample(arr,n){
  return shuffle(arr).slice(0,n);
}

function getStats(){
  try{
    const raw=localStorage.getItem(STATS_KEY);
    if(!raw) return {best:{},mistakes:{},plays:0};
    const x=JSON.parse(raw);
    x.best ||= {};
    x.mistakes ||= {};
    x.plays ||= 0;
    return x;
  }catch{
    return {best:{},mistakes:{},plays:0};
  }
}

function saveStats(stats){
  localStorage.setItem(STATS_KEY,JSON.stringify(stats));
}

function bestKey(){
  const gens=[...state.selectedGenerations].sort((a,b)=>a-b).join("-");
  return `${gens}|${state.questionCount}|${state.difficulty}`;
}

function updateBestSummary(){
  const stats=getStats();
  const values=Object.values(stats.best);
  const top=values.length ? Math.max(...values.map(Number)) : 0;
  document.getElementById("bestSummary").textContent=
    stats.plays ? `これまで ${stats.plays}かい あそんだよ　★ さいこう ${top}てん` : "はじめての クイズに ちょうせんしよう！";
}

function updateSoundButton(){
  document.getElementById("soundToggle").textContent=state.soundOn?"🔊 おと ON":"🔇 おと OFF";
}

function speak(text){
  if(!state.soundOn || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);
  u.lang="ja-JP";
  u.rate=0.9;
  u.pitch=1.05;
  window.speechSynthesis.speak(u);
}

function beep(correct){
  if(!state.soundOn) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;
    const ctx=new AC();
    const osc=ctx.createOscillator();
    const gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.frequency.value=correct?740:220;
    osc.type="sine";
    gain.gain.setValueAtTime(0.08,ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.22);
    osc.start();
    osc.stop(ctx.currentTime+0.22);
  }catch{}
}

async function loadJapaneseNames(){
  const cached=localStorage.getItem(NAMES_CACHE_KEY);
  if(cached){
    try{
      const parsed=JSON.parse(cached);
      if(parsed && parsed.length>=MAX_POKEMON+1){
        state.names=parsed;
        return;
      }
    }catch{}
  }

  const names=Array(MAX_POKEMON+1).fill("");
  const batchSize=30;

  for(let start=1;start<=MAX_POKEMON;start+=batchSize){
    const ids=[];
    for(let id=start;id<Math.min(start+batchSize,MAX_POKEMON+1);id++) ids.push(id);

    const rows=await Promise.all(ids.map(async id=>{
      try{
        const r=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);
        if(!r.ok) throw new Error();
        const data=await r.json();
        const ja=data.names.find(x=>x.language.name==="ja-Hrkt") || data.names.find(x=>x.language.name==="ja");
        return [id,ja?.name || `No.${id}`];
      }catch{
        return [id,`No.${id}`];
      }
    }));

    rows.forEach(([id,name])=>names[id]=name);
  }

  state.names=names;
  localStorage.setItem(NAMES_CACHE_KEY,JSON.stringify(names));
}

function nameOf(id){
  return state.names?.[id] || `No.${id}`;
}

function buildGenerationGrid(){
  const grid=document.getElementById("generationGrid");
  grid.innerHTML="";
  GENERATIONS.forEach(g=>{
    const label=document.createElement("label");
    label.className="gen-choice";
    label.innerHTML=`
      <input type="checkbox" data-gen="${g.id}" ${state.selectedGenerations.has(g.id)?"checked":""}>
      <span class="gen-title">${g.label}</span>
      <span class="gen-range">No.${g.start}〜${g.end}</span>
    `;
    const cb=label.querySelector("input");
    cb.addEventListener("change",()=>{
      cb.checked?state.selectedGenerations.add(g.id):state.selectedGenerations.delete(g.id);
    });
    grid.appendChild(label);
  });
}

function syncGenerationGrid(){
  document.querySelectorAll("[data-gen]").forEach(cb=>{
    cb.checked=state.selectedGenerations.has(Number(cb.dataset.gen));
  });
}

function selectedIds(){
  const ids=[];
  GENERATIONS.forEach(g=>{
    if(!state.selectedGenerations.has(g.id)) return;
    for(let id=g.start;id<=g.end;id++) ids.push(id);
  });
  return ids;
}

function makePool(){
  let ids=selectedIds();

  if(state.difficulty==="easy"){
    const famous=ids.filter(id=>FAMOUS_IDS.has(id));
    if(famous.length>=state.questionCount){
      ids=famous;
    }else{
      ids=shuffle([...famous,...ids.filter(id=>!FAMOUS_IDS.has(id))]);
    }
  }
  return ids;
}

function chooseQuizIds(pool,count){
  if(pool.length<=count) return shuffle(pool);
  return sample(pool,count);
}

function startNormalQuiz(){
  if(!state.selectedGenerations.size){
    const m=document.getElementById("setupMessage");
    m.textContent="1ついじょう せだいを えらんでね。";
    m.className="feedback bad";
    return;
  }

  state.questionCount=Number(document.querySelector('input[name="questionCount"]:checked')?.value||10);
  state.difficulty=document.querySelector('input[name="difficulty"]:checked')?.value||"easy";
  state.pool=makePool();
  state.reviewIds=null;

  const count=Math.min(state.questionCount,state.pool.length);
  startQuizWithIds(chooseQuizIds(state.pool,count));
}

function startQuizWithIds(ids){
  state.quizIds=[...ids];
  state.currentIndex=0;
  state.score=0;
  state.streak=0;
  state.bestStreakThisRun=0;
  state.history=[];
  state.locked=false;
  showScreen("quiz");
  showQuestion();
}

function showQuestion(){
  if(state.currentIndex>=state.quizIds.length){
    finishQuiz();
    return;
  }

  state.locked=false;
  document.getElementById("nextBtn").classList.add("hidden");
  document.getElementById("feedback").textContent="";
  document.getElementById("feedback").className="feedback";

  const id=state.quizIds[state.currentIndex];
  const gen=generationForId(id);
  document.getElementById("qCounter").textContent=`${state.currentIndex+1} / ${state.quizIds.length}`;
  document.getElementById("scoreCounter").textContent=`せいかい ${state.score}`;
  document.getElementById("streakCounter").textContent=`れんぞく ${state.streak}`;
  document.getElementById("genLabel").textContent=gen.label;

  const stats=getStats();
  const best=Number(stats.best[bestKey()]||0);
  document.getElementById("bestLabel").textContent=`BEST ${best}`;

  loadQuizImage(id);
  renderChoices(id);
}

function loadQuizImage(id){
  const img=document.getElementById("pokemonImage");
  const loading=document.getElementById("imageLoading");
  loading.classList.remove("hidden");
  img.classList.add("hidden");
  img.onerror=()=>{
    if(img.dataset.fallback!=="1"){
      img.dataset.fallback="1";
      img.src=fallbackSpriteUrl(id);
    }else{
      loading.textContent="がぞうを よみこめませんでした";
    }
  };
  img.onload=()=>{
    loading.classList.add("hidden");
    img.classList.remove("hidden");
  };
  img.dataset.fallback="0";
  img.src=pokemonImageUrl(id);
  img.alt=`No.${id} ${nameOf(id)}`;
}

function relatedCandidatePool(correctId){
  const gen=generationForId(correctId);
  const allGen=[];
  for(let id=gen.start;id<=gen.end;id++) if(id!==correctId) allGen.push(id);

  // 進化前後や図鑑番号が近いポケモンを優先。
  const nearby=[];
  for(let d=1;d<=12;d++){
    for(const x of [correctId-d,correctId+d]){
      if(x>=gen.start && x<=gen.end && x!==correctId) nearby.push(x);
    }
  }

  if(state.difficulty==="hard"){
    return [...new Set([...nearby,...shuffle(allGen)])];
  }
  if(state.difficulty==="normal"){
    return [...new Set([...nearby.slice(0,10),...shuffle(allGen)])];
  }

  // かんたんは、同世代の有名ポケモンを優先。
  const famous=allGen.filter(id=>FAMOUS_IDS.has(id));
  return [...new Set([...shuffle(famous),...shuffle(allGen)])];
}

function renderChoices(correctId){
  const box=document.getElementById("choices");
  box.innerHTML="";
  const distractors=relatedCandidatePool(correctId).slice(0,3);
  const options=shuffle([correctId,...distractors]);

  options.forEach(id=>{
    const btn=document.createElement("button");
    btn.className="choice-btn";
    btn.type="button";
    btn.textContent=nameOf(id);
    btn.dataset.id=String(id);
    btn.addEventListener("click",()=>answerQuestion(btn,id,correctId));
    box.appendChild(btn);
  });
}

function answerQuestion(button,selectedId,correctId){
  if(state.locked) return;
  state.locked=true;

  const ok=selectedId===correctId;
  const fb=document.getElementById("feedback");

  document.querySelectorAll(".choice-btn").forEach(btn=>{
    btn.disabled=true;
    const id=Number(btn.dataset.id);
    if(id===correctId) btn.classList.add("correct");
  });

  if(ok){
    state.score++;
    state.streak++;
    state.bestStreakThisRun=Math.max(state.bestStreakThisRun,state.streak);
    button.classList.add("correct");
    fb.textContent=`⭕ せいかい！ ${nameOf(correctId)}　${state.streak}れんぞく！`;
    fb.className="feedback good";
    beep(true);
    speak(`せいかい。${nameOf(correctId)}`);
  }else{
    state.streak=0;
    button.classList.add("wrong");
    fb.textContent=`おしい！ こたえは ${nameOf(correctId)}`;
    fb.className="feedback bad";
    beep(false);
    speak(`こたえは、${nameOf(correctId)}`);
  }

  state.history.push({
    id:correctId,
    selectedId,
    correctName:nameOf(correctId),
    selectedName:nameOf(selectedId),
    ok
  });

  document.getElementById("scoreCounter").textContent=`せいかい ${state.score}`;
  document.getElementById("streakCounter").textContent=`れんぞく ${state.streak}`;

  const next=document.getElementById("nextBtn");
  next.textContent=state.currentIndex===state.quizIds.length-1?"けっかを みる →":"つぎの もんだい →";
  next.classList.remove("hidden");
}

function finishQuiz(){
  const stats=getStats();
  stats.plays++;
  const key=bestKey();
  stats.best[key]=Math.max(Number(stats.best[key]||0),state.score);

  state.history.forEach(h=>{
    const id=String(h.id);
    const current=Number(stats.mistakes[id]||0);
    if(h.ok){
      stats.mistakes[id]=Math.max(0,current-1);
    }else{
      stats.mistakes[id]=current+2;
    }
  });

  saveStats(stats);
  showResults();
  updateBestSummary();
}

function showResults(){
  showScreen("result");
  document.getElementById("finalScore").textContent=`${state.score} / ${state.quizIds.length}`;

  const stats=getStats();
  const best=Number(stats.best[bestKey()]||state.score);
  document.getElementById("bestResult").textContent=`★ このせっていの さいこう：${best}てん　／　れんぞくBEST：${state.bestStreakThisRun}`;

  const ratio=state.score/state.quizIds.length;
  const msg=document.getElementById("resultMessage");
  if(ratio===1) msg.textContent="🏆 パーフェクト！ ポケモンはかせ！";
  else if(ratio>=0.8) msg.textContent="🌟 すごい！ とっても よくできました！";
  else if(ratio>=0.5) msg.textContent="😊 よく がんばりました！";
  else msg.textContent="📘 ずかんで ふくしゅうして もういちど！";

  const tbody=document.getElementById("resultBody");
  tbody.innerHTML="";
  state.history.forEach(h=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`
      <td><img class="thumb" src="${pokemonImageUrl(h.id)}" alt=""></td>
      <td>${escapeHtml(h.correctName)}</td>
      <td>${escapeHtml(h.selectedName)}</td>
      <td class="${h.ok?"ok":"ng"}">${h.ok?"○":"×"}</td>
    `;
    tbody.appendChild(tr);
  });

  const wrong=state.history.filter(h=>!h.ok);
  document.getElementById("wrongOnlyBtn").classList.toggle("hidden",wrong.length===0);
}

function startWrongOnly(){
  const ids=[...new Set(state.history.filter(h=>!h.ok).map(h=>h.id))];
  if(ids.length) startQuizWithIds(ids);
}

function startReviewMode(){
  const stats=getStats();
  const ranked=Object.entries(stats.mistakes)
    .map(([id,v])=>[Number(id),Number(v)])
    .filter(([id,v])=>id>=1&&id<=MAX_POKEMON&&v>0)
    .sort((a,b)=>b[1]-a[1])
    .map(([id])=>id);

  if(!ranked.length){
    alert("まだ にがてポケモンの きろくが ありません。まずは クイズを あそんでね！");
    return;
  }

  state.selectedGenerations=new Set(GENERATIONS.map(g=>g.id));
  state.questionCount=Math.min(10,ranked.length);
  state.difficulty="hard";
  state.reviewIds=ranked.slice(0,state.questionCount);
  startQuizWithIds(state.reviewIds);
}

function escapeHtml(text){
  const d=document.createElement("div");
  d.textContent=text;
  return d.innerHTML;
}

function buildDexGenerationJumps(){
  const box=document.getElementById("dexGenJumps");
  box.innerHTML="";
  GENERATIONS.forEach(g=>{
    const btn=document.createElement("button");
    btn.className="small";
    btn.type="button";
    btn.textContent=g.label;
    btn.addEventListener("click",()=>{
      state.dexPageStart=g.start;
      state.dexId=g.start;
      if(state.dexMode==="grid") renderDexGrid();
      else renderDexSingle();
    });
    box.appendChild(btn);
  });
}

function renderDexGrid(){
  const grid=document.getElementById("dexGrid");
  grid.innerHTML="";
  const start=state.dexPageStart;
  const end=Math.min(MAX_POKEMON,start+state.dexPageSize-1);

  for(let id=start;id<=end;id++){
    const item=document.createElement("button");
    item.type="button";
    item.className="dex-item";
    item.innerHTML=`
      <div class="dex-item-no">No.${padNo(id)}</div>
      <img src="${pokemonImageUrl(id)}" alt="${escapeHtml(nameOf(id))}" loading="lazy">
      <div class="dex-item-name">${state.dexNamesHidden?"？？？":escapeHtml(nameOf(id))}</div>
    `;
    const img=item.querySelector("img");
    img.onerror=()=>{img.src=fallbackSpriteUrl(id)};
    item.addEventListener("click",()=>{
      state.dexId=id;
      setDexMode("single");
      renderDexSingle();
    });
    grid.appendChild(item);
  }

  document.getElementById("dexPageLabel").textContent=`${start} - ${end}`;
  document.getElementById("dexPrevPageBtn").disabled=start<=1;
  document.getElementById("dexNextPageBtn").disabled=end>=MAX_POKEMON;
}

function renderDexSingle(){
  const id=state.dexId;
  document.getElementById("dexNo").textContent=`No.${padNo(id)}`;
  document.getElementById("dexName").textContent=state.dexNamesHidden?"？？？":nameOf(id);

  const img=document.getElementById("dexImage");
  const loading=document.getElementById("dexLoading");
  loading.classList.remove("hidden");
  img.classList.add("hidden");
  img.dataset.fallback="0";
  img.onload=()=>{loading.classList.add("hidden");img.classList.remove("hidden")};
  img.onerror=()=>{
    if(img.dataset.fallback!=="1"){
      img.dataset.fallback="1";
      img.src=fallbackSpriteUrl(id);
    }else{
      loading.textContent="がぞうを よみこめませんでした";
    }
  };
  img.src=pokemonImageUrl(id);
  img.alt=nameOf(id);

  document.getElementById("dexPrevBtn").disabled=id<=1;
  document.getElementById("dexNextBtn").disabled=id>=MAX_POKEMON;
}

function setDexMode(mode){
  state.dexMode=mode;
  document.getElementById("dexGridView").classList.toggle("hidden",mode!=="grid");
  document.getElementById("dexSingleView").classList.toggle("hidden",mode!=="single");
  document.getElementById("gridViewBtn").classList.toggle("active",mode==="grid");
  document.getElementById("singleViewBtn").classList.toggle("active",mode==="single");
}

function openDex(){
  showScreen("dex");
  if(state.dexMode==="grid") renderDexGrid();
  else renderDexSingle();
}

function jumpDex(){
  const val=Math.max(1,Math.min(MAX_POKEMON,Number(document.getElementById("dexNumberInput").value)||1));
  state.dexId=val;
  state.dexPageStart=Math.floor((val-1)/state.dexPageSize)*state.dexPageSize+1;
  if(state.dexMode==="grid") renderDexGrid();
  else renderDexSingle();
}

function toggleDexNames(){
  state.dexNamesHidden=!state.dexNamesHidden;
  document.getElementById("toggleNameBtn").textContent=state.dexNamesHidden?"👀 なまえを みる":"🙈 なまえを かくす";
  if(state.dexMode==="grid") renderDexGrid();
  else renderDexSingle();
}

function restoreSetupInputs(){
  syncGenerationGrid();
  document.querySelectorAll('input[name="questionCount"]').forEach(r=>r.checked=Number(r.value)===state.questionCount);
  document.querySelectorAll('input[name="difficulty"]').forEach(r=>r.checked=r.value===state.difficulty);
}

document.getElementById("soundToggle").addEventListener("click",()=>{
  state.soundOn=!state.soundOn;
  localStorage.setItem(SOUND_KEY,state.soundOn?"on":"off");
  updateSoundButton();
});

document.getElementById("homeBtn").addEventListener("click",()=>showScreen("menu"));
document.getElementById("quizSetupBtn").addEventListener("click",()=>{
  restoreSetupInputs();
  showScreen("setup");
});
document.getElementById("reviewModeBtn").addEventListener("click",startReviewMode);
document.getElementById("dexBtn").addEventListener("click",openDex);

document.getElementById("selectAllGenBtn").addEventListener("click",()=>{
  state.selectedGenerations=new Set(GENERATIONS.map(g=>g.id));
  syncGenerationGrid();
});
document.getElementById("clearGenBtn").addEventListener("click",()=>{
  state.selectedGenerations.clear();
  syncGenerationGrid();
});
document.getElementById("startQuizBtn").addEventListener("click",startNormalQuiz);
document.getElementById("nextBtn").addEventListener("click",()=>{
  state.currentIndex++;
  showQuestion();
});

document.getElementById("wrongOnlyBtn").addEventListener("click",startWrongOnly);
document.getElementById("retryBtn").addEventListener("click",()=>{
  const pool=state.reviewIds?state.reviewIds:makePool();
  startQuizWithIds(chooseQuizIds(pool,Math.min(state.questionCount,pool.length)));
});
document.getElementById("openDexFromResultBtn").addEventListener("click",()=>{
  const wrong=state.history.find(h=>!h.ok);
  if(wrong){
    state.dexId=wrong.id;
    state.dexPageStart=Math.floor((wrong.id-1)/state.dexPageSize)*state.dexPageSize+1;
  }
  openDex();
});
document.getElementById("changeSetupBtn").addEventListener("click",()=>{
  restoreSetupInputs();
  showScreen("setup");
});
document.getElementById("resultMenuBtn").addEventListener("click",()=>showScreen("menu"));

document.getElementById("dexPrevPageBtn").addEventListener("click",()=>{
  state.dexPageStart=Math.max(1,state.dexPageStart-state.dexPageSize);
  renderDexGrid();
});
document.getElementById("dexNextPageBtn").addEventListener("click",()=>{
  state.dexPageStart=Math.min(MAX_POKEMON,state.dexPageStart+state.dexPageSize);
  renderDexGrid();
});
document.getElementById("dexJumpBtn").addEventListener("click",jumpDex);
document.getElementById("toggleNameBtn").addEventListener("click",toggleDexNames);
document.getElementById("gridViewBtn").addEventListener("click",()=>{
  setDexMode("grid");
  renderDexGrid();
});
document.getElementById("singleViewBtn").addEventListener("click",()=>{
  setDexMode("single");
  renderDexSingle();
});
document.getElementById("dexPrevBtn").addEventListener("click",()=>{
  state.dexId=Math.max(1,state.dexId-1);renderDexSingle();
});
document.getElementById("dexNextBtn").addEventListener("click",()=>{
  state.dexId=Math.min(MAX_POKEMON,state.dexId+1);renderDexSingle();
});
document.getElementById("dexSpeakBtn").addEventListener("click",()=>speak(nameOf(state.dexId)));

(async function init(){
  buildGenerationGrid();
  buildDexGenerationJumps();
  updateSoundButton();
  updateBestSummary();

  const startButtons=[
    document.getElementById("quizSetupBtn"),
    document.getElementById("reviewModeBtn"),
    document.getElementById("dexBtn")
  ];
  startButtons.forEach(b=>b.disabled=true);
  document.getElementById("bestSummary").textContent="ポケモンの なまえを よみこみちゅう…";

  await loadJapaneseNames();

  startButtons.forEach(b=>b.disabled=false);
  updateBestSummary();
  renderDexGrid();
})();
