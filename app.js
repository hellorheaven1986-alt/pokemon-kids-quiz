const TOTAL_QUESTIONS = 10;
const MAX_POKEMON_ID = 1025;
const GENERATIONS = [
  { id: 1, name: "第1世代", start: 1, end: 151 },
  { id: 2, name: "第2世代", start: 152, end: 251 },
  { id: 3, name: "第3世代", start: 252, end: 386 },
  { id: 4, name: "第4世代", start: 387, end: 493 },
  { id: 5, name: "第5世代", start: 494, end: 649 },
  { id: 6, name: "第6世代", start: 650, end: 721 },
  { id: 7, name: "第7世代", start: 722, end: 809 },
  { id: 8, name: "第8世代", start: 810, end: 905 },
  { id: 9, name: "第9世代", start: 906, end: 1025 },
];

const state = {
  selectedGenerations: new Set(GENERATIONS.map(g => g.id)),
  quizPool: [], questionNo: 0, score: 0,
  currentId: null, currentName: "", currentChoices: [],
  usedIds: new Set(), history: [], dexId: 1, dexNameHidden: false,
};

const screens = {
  menu: document.getElementById("menuScreen"), generations: document.getElementById("generationScreen"),
  quiz: document.getElementById("quizScreen"), result: document.getElementById("resultScreen"), dex: document.getElementById("dexScreen"),
};
const homeBtn = document.getElementById("homeBtn");
const generationGrid = document.getElementById("generationGrid");
const selectedCount = document.getElementById("selectedCount");
const questionCounter = document.getElementById("questionCounter");
const scoreDisplay = document.getElementById("scoreDisplay");
const quizImage = document.getElementById("quizImage");
const imageLoading = document.getElementById("imageLoading");
const answerGrid = document.getElementById("answerGrid");
const feedback = document.getElementById("feedback");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const resultScore = document.getElementById("resultScore");
const resultMessage = document.getElementById("resultMessage");
const resultBody = document.getElementById("resultBody");
const dexImage = document.getElementById("dexImage");
const dexLoading = document.getElementById("dexLoading");
const dexNumber = document.getElementById("dexNumber");
const dexName = document.getElementById("dexName");
const dexJump = document.getElementById("dexJump");
const hideNameBtn = document.getElementById("hideNameBtn");

function showScreen(name){Object.values(screens).forEach(s=>s.classList.remove("active"));screens[name].classList.add("active");homeBtn.classList.toggle("hidden",name==="menu");window.scrollTo({top:0,behavior:"smooth"});}
function buildGenerationGrid(){generationGrid.innerHTML="";GENERATIONS.forEach(gen=>{const label=document.createElement("label");label.className="generation-card selected";label.innerHTML=`<input type="checkbox" data-gen="${gen.id}" checked><span class="gen-name">${gen.name}</span><span class="gen-range">No.${gen.start}〜${gen.end}</span>`;const cb=label.querySelector("input");cb.addEventListener("change",()=>{cb.checked?state.selectedGenerations.add(gen.id):state.selectedGenerations.delete(gen.id);label.classList.toggle("selected",cb.checked);updateSelectedCount();});generationGrid.appendChild(label);});updateSelectedCount();}
function syncGenerationCheckboxes(){document.querySelectorAll("[data-gen]").forEach(cb=>{cb.checked=state.selectedGenerations.has(Number(cb.dataset.gen));cb.closest(".generation-card").classList.toggle("selected",cb.checked);});updateSelectedCount();}
function updateSelectedCount(){selectedCount.textContent=state.selectedGenerations.size===0?"せだいが えらばれていません":`${state.selectedGenerations.size}この せだいを えらんでいます`;}
function buildQuizPool(){const pool=[];GENERATIONS.forEach(gen=>{if(!state.selectedGenerations.has(gen.id))return;for(let id=gen.start;id<=gen.end;id++)pool.push(id);});return pool;}
function randomChoice(a){return a[Math.floor(Math.random()*a.length)];}
function sample(a,n){const c=[...a];for(let i=c.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[c[i],c[j]]=[c[j],c[i]];}return c.slice(0,n);}
function shuffle(a){return sample(a,a.length);}
async function getPokemonName(id){const key=`poke-name-ja-${id}`;const cached=localStorage.getItem(key);if(cached)return cached;const r=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}/`);if(!r.ok)throw new Error(`name fetch failed: ${r.status}`);const data=await r.json();const jaHrkt=data.names.find(x=>x.language?.name==="ja-Hrkt");const ja=data.names.find(x=>x.language?.name==="ja");const name=jaHrkt?.name||ja?.name||data.name||`No.${id}`;try{localStorage.setItem(key,name);}catch(_){ }return name;}
function officialArtworkUrl(id){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;}
function normalSpriteUrl(id){return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;}
function setPokemonImage(img,loading,id){loading.classList.remove("hidden");img.classList.add("hidden");let fallback=false;img.onerror=()=>{if(!fallback){fallback=true;img.src=normalSpriteUrl(id);return;}loading.textContent="がぞうを よみこめませんでした";loading.classList.remove("hidden");img.classList.add("hidden");};img.onload=()=>{loading.classList.add("hidden");img.classList.remove("hidden");};loading.textContent="がぞうを よみこみちゅう…";img.src=officialArtworkUrl(id);}
async function startQuiz(){state.quizPool=buildQuizPool();if(state.quizPool.length<4){alert("しゅつだいする せだいを 1ついじょう えらんでください。");return;}state.questionNo=0;state.score=0;state.currentId=null;state.currentName="";state.currentChoices=[];state.usedIds.clear();state.history=[];showScreen("quiz");await nextQuestion();}
async function nextQuestion(){if(state.questionNo>=TOTAL_QUESTIONS){showResults();return;}state.questionNo++;feedback.textContent="";feedback.className="feedback";nextQuestionBtn.classList.add("hidden");answerGrid.innerHTML="";questionCounter.textContent=`${state.questionNo} / ${TOTAL_QUESTIONS}`;scoreDisplay.textContent=`せいかい ${state.score}`;let remaining=state.quizPool.filter(id=>!state.usedIds.has(id));if(remaining.length===0){state.usedIds.clear();remaining=[...state.quizPool];}state.currentId=randomChoice(remaining);state.usedIds.add(state.currentId);setPokemonImage(quizImage,imageLoading,state.currentId);try{state.currentName=await getPokemonName(state.currentId);const wrongIds=sample(state.quizPool.filter(id=>id!==state.currentId),3);const wrongNames=await Promise.all(wrongIds.map(getPokemonName));state.currentChoices=shuffle([state.currentName,...wrongNames]);renderAnswers();}catch(e){console.error(e);feedback.textContent="データを よみこめませんでした。つぎへ すすんでください。";feedback.classList.add("bad");nextQuestionBtn.classList.remove("hidden");}}
function renderAnswers(){answerGrid.innerHTML="";state.currentChoices.forEach(name=>{const b=document.createElement("button");b.className="answer-btn";b.type="button";b.textContent=name;b.addEventListener("click",()=>answerQuestion(name,b));answerGrid.appendChild(b);});}
function answerQuestion(selectedName,clickedButton){const buttons=[...answerGrid.querySelectorAll(".answer-btn")];buttons.forEach(b=>b.disabled=true);const isCorrect=selectedName===state.currentName;state.history.push({question:state.questionNo,id:state.currentId,correct:state.currentName,selected:selectedName,isCorrect});if(isCorrect){state.score++;feedback.textContent=`⭕ せいかい！ ${state.currentName}`;feedback.className="feedback good";clickedButton.classList.add("correct");}else{feedback.textContent=`おしい！ せいかいは「${state.currentName}」`;feedback.className="feedback bad";clickedButton.classList.add("wrong");buttons.forEach(b=>{if(b.textContent===state.currentName)b.classList.add("correct");});}scoreDisplay.textContent=`せいかい ${state.score}`;nextQuestionBtn.textContent=state.questionNo===TOTAL_QUESTIONS?"けっかを みる →":"つぎの もんだい →";nextQuestionBtn.classList.remove("hidden");}
function showResults(){showScreen("result");resultScore.textContent=`${state.score} / ${TOTAL_QUESTIONS}`;resultMessage.textContent=state.score===TOTAL_QUESTIONS?"🏆 すごい！ ポケモンはかせ！":state.score>=8?"🌟 すごい！ とても よくできました！":state.score>=5?"😊 よく がんばりました！":"📖 ずかんで ふくしゅうして もういちど やってみよう！";resultBody.innerHTML="";state.history.forEach(item=>{const tr=document.createElement("tr");tr.innerHTML=`<td>${item.question}</td><td>${item.id}</td><td>${escapeHtml(item.correct)}</td><td>${escapeHtml(item.selected)}</td><td class="${item.isCorrect?"result-ok":"result-ng"}">${item.isCorrect?"○":"×"}</td>`;resultBody.appendChild(tr);});}
function escapeHtml(text){const d=document.createElement("div");d.textContent=text;return d.innerHTML;}
async function showDex(id=state.dexId){state.dexId=Math.max(1,Math.min(MAX_POKEMON_ID,id));const requestedId=state.dexId;showScreen("dex");dexNumber.textContent=`No.${String(state.dexId).padStart(4,"0")}`;dexName.textContent="よみこみちゅう…";dexName.classList.remove("covered");dexJump.value=state.dexId;setPokemonImage(dexImage,dexLoading,state.dexId);try{const name=await getPokemonName(state.dexId);if(state.dexId!==requestedId)return;renderDexName(name);}catch(e){console.error(e);dexName.textContent="なまえを よみこめませんでした";}}
function renderDexName(name){dexName.dataset.name=name;if(state.dexNameHidden){dexName.textContent="？？？？";dexName.classList.add("covered");hideNameBtn.textContent="なまえを みる";}else{dexName.textContent=name;dexName.classList.remove("covered");hideNameBtn.textContent="なまえを かくす";}}
function toggleDexName(){state.dexNameHidden=!state.dexNameHidden;renderDexName(dexName.dataset.name||"");}
function jumpDex(){const v=Number(dexJump.value);if(!Number.isInteger(v)||v<1||v>MAX_POKEMON_ID){alert("1〜1025 の すうじを いれてください。");return;}showDex(v);}

document.getElementById("goQuizBtn").addEventListener("click",()=>{syncGenerationCheckboxes();showScreen("generations");});
document.getElementById("goDexBtn").addEventListener("click",()=>showDex(state.dexId));
homeBtn.addEventListener("click",()=>showScreen("menu"));
document.getElementById("selectAllBtn").addEventListener("click",()=>{GENERATIONS.forEach(g=>state.selectedGenerations.add(g.id));syncGenerationCheckboxes();});
document.getElementById("clearAllBtn").addEventListener("click",()=>{state.selectedGenerations.clear();syncGenerationCheckboxes();});
document.getElementById("startQuizBtn").addEventListener("click",startQuiz);
nextQuestionBtn.addEventListener("click",nextQuestion);
document.getElementById("retryBtn").addEventListener("click",startQuiz);
document.getElementById("changeGenerationBtn").addEventListener("click",()=>{syncGenerationCheckboxes();showScreen("generations");});
document.getElementById("resultDexBtn").addEventListener("click",()=>{const wrong=state.history.find(x=>!x.isCorrect);showDex(wrong?wrong.id:(state.history[0]?.id||1));});
document.getElementById("prevDexBtn").addEventListener("click",()=>showDex(state.dexId<=1?MAX_POKEMON_ID:state.dexId-1));
document.getElementById("nextDexBtn").addEventListener("click",()=>showDex(state.dexId>=MAX_POKEMON_ID?1:state.dexId+1));
document.getElementById("jumpBtn").addEventListener("click",jumpDex);
dexJump.addEventListener("keydown",e=>{if(e.key==="Enter")jumpDex();});
hideNameBtn.addEventListener("click",toggleDexName);

buildGenerationGrid();showScreen("menu");
