const EXAM_META = {
  'jee-main':['JEE Main','acc-jee-main'], 'jee-adv':['JEE Advanced','acc-jee-adv'],
  'bitsat':['BITSAT','acc-bitsat'], 'kcet':['KCET','acc-kcet'],
  'apcalc':['AP Calculus AB','acc-apcalc'], 'igcse':['Cambridge IGCSE','acc-igcse'],
  'riemann':['Riemann Sums','acc-riemann'], 'practice':['Practice Drill','acc-practice']
};

const EXAM_PACE_PRESETS = [
  { id:'speed', label:'Speed pace', exams:['bitsat','kcet'], note:'Fast, formula-recall style.' },
  { id:'depth', label:'Depth pace', exams:['jee-adv'], note:'Multi-step, technique-combination style.' },
  { id:'standard', label:'Standard pace', exams:['jee-main','kcet','apcalc'], note:'One clean technique per question.' }
];

const state = {
  subject:'math', topic:'limits', route:'dashboard', search:'',
  bookmarks:{}, mistakes:{},
  test:null,
  filters:{ exams:new Set(), difficulties:new Set(), technique:null, pace:null },
  solved:{}, mastery:{}, drill:null
};

const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => [...root.querySelectorAll(sel)];
const app = $('#app');

function currentTopic(){ return DATA.topics.find(t=>t.id===state.topic); }
function topicsForSubject(subject){ return DATA.topics.filter(t=>t.subject===subject); }
function liveTopics(){ return DATA.topics.filter(t=>t.live); }
function questionsForTopic(topicId){ return DATA.questions.filter(q=>q.topic===topicId); }
function allSubjectQuestions(subject){
  const ids = new Set(topicsForSubject(subject).map(t=>t.id));
  return DATA.questions.filter(q=>ids.has(q.topic));
}
function examMeta(id){ return EXAM_META[id] || [id,id]; }
function techniqueLabel(tid, topic=currentTopic()){
  const found = topic?.toolkit?.find(x=>x.id===tid);
  return found ? found.title : tid;
}
function escapeHtml(value){
  return String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function isSolved(key){ return !!state.solved[key]; }
function questionKey(q){ return `${q.qid}|${q.topic}`; }
function masteryPct(id){ const m=state.mastery[id]; return m?.seen ? Math.round(100*m.correct/m.seen) : null; }
function topicStats(topicId){
  const qs=questionsForTopic(topicId); const solved=qs.filter(q=>isSolved(questionKey(q))).length;
  return { questions:qs.length, solved, completion:qs.length?Math.round(100*solved/qs.length):0 };
}
function subjectStats(subject){
  const ts=topicsForSubject(subject), qs=allSubjectQuestions(subject), solved=qs.filter(q=>isSolved(questionKey(q))).length;
  return {topics:ts.length, live:ts.filter(t=>t.live).length, questions:qs.length, solved, completion:qs.length?Math.round(100*solved/qs.length):0};
}

async function loadState(){
  state.solved = await TrickbankStorage.get('solved-map', {});
  state.mastery = await TrickbankStorage.get('mastery-map', {});
  state.bookmarks = await TrickbankStorage.get('bookmarks-map', {});
  state.mistakes = await TrickbankStorage.get('mistakes-map', {});
}
async function persistSolved(){ await TrickbankStorage.set('solved-map',state.solved); }
async function persistMastery(){ await TrickbankStorage.set('mastery-map',state.mastery); }
async function persistBookmarks(){ await TrickbankStorage.set('bookmarks-map',state.bookmarks); }
async function persistMistakes(){ await TrickbankStorage.set('mistakes-map',state.mistakes); }
function isBookmarked(q){ return !!state.bookmarks[questionKey(q)]; }
function isMistake(q){ return !!state.mistakes[questionKey(q)]; }
function toggleBookmark(q){ const k=questionKey(q); if(state.bookmarks[k]) delete state.bookmarks[k]; else state.bookmarks[k]=true; persistBookmarks(); render(); toast(state.bookmarks[k]?'Bookmarked':'Removed bookmark'); }
function toggleMistake(q){ const k=questionKey(q); if(state.mistakes[k]) delete state.mistakes[k]; else state.mistakes[k]=true; persistMistakes(); render(); toast(state.mistakes[k]?'Added to mistake notebook':'Removed from mistake notebook'); }
function toggleSolved(q){
  const key=questionKey(q); state.solved[key]=!state.solved[key]; persistSolved(); render();
  toast(state.solved[key]?'Marked as solved':'Removed from solved');
}
function recordDrill(id,correct){
  if(!state.mastery[id]) state.mastery[id]={seen:0,correct:0};
  state.mastery[id].seen++; if(correct) state.mastery[id].correct++;
  persistMastery();
}
function toast(message){
  const el=$('#toast'); el.textContent=message; el.classList.add('show');
  clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),1800);
}

function navigate(route){
  const routes=['dashboard','exams','topics','questions','toolkit','tests','bookmarks','mistakes','formulas','progress'];
  state.route=routes.includes(route)?route:'dashboard';
  if(location.hash.slice(1)!==state.route) history.replaceState(null,'','#'+state.route);
  render(); window.scrollTo({top:0,behavior:'smooth'}); app.focus();
}
function resetFilters(){ state.filters={exams:new Set(),difficulties:new Set(),technique:null,pace:null}; }

function renderSubjectSwitch(){
  $('#subjectSwitch').innerHTML=DATA.subjects.map(s=>`<button class="subject-btn ${s.id===state.subject?'active':''}" data-subject="${s.id}">${escapeHtml(s.label)}</button>`).join('');
  $$('.subject-btn',$('#subjectSwitch')).forEach(btn=>btn.addEventListener('click',()=>{
    state.subject=btn.dataset.subject;
    const first=topicsForSubject(state.subject).find(t=>t.live) || topicsForSubject(state.subject)[0];
    state.topic=first?.id || null; state.search=''; $('#searchInput').value=''; resetFilters(); navigate('dashboard');
  }));
}

function renderNav(){
  $$('.main-nav a').forEach(a=>a.classList.toggle('active',a.dataset.route===state.route));
  const names={dashboard:'Dashboard',topics:'Topics',questions:'Question Bank',toolkit:'Trick Toolkit',formulas:'Formula Sheet',progress:'My Progress'};
  $('#breadcrumbs').textContent=`${state.subject==='math'?'Mathematics':'Physics'} / ${names[state.route]}`;
}

function hero(){
  const s=subjectStats(state.subject);
  return `<section class="hero-panel">
    <div class="hero-copy"><span class="eyebrow">Trickbank learning portal</span>
      <h1>Learn the <em>pattern</em>, then solve the problem.</h1>
      <p>Build exam readiness around recurring techniques instead of isolated answers. Move from topic → trick → question → drill → mastery.</p>
      <div class="hero-actions"><button class="primary-btn" data-action="continue">Continue learning →</button><button class="secondary-btn" data-route="topics">Browse topics</button></div>
    </div>
    <div class="hero-stat"><span class="eyebrow">${state.subject==='math'?'Mathematics':'Physics'}</span><strong>${s.questions}</strong><span>questions currently in the bank</span><div class="mini-progress"><i style="width:${s.completion}%"></i></div><small>${s.completion}% marked solved</small></div>
  </section>`;
}

function dashboard(){
  const s=subjectStats(state.subject), topics=topicsForSubject(state.subject), live=topics.filter(t=>t.live);
  const allQs=allSubjectQuestions(state.subject), solved=allQs.filter(q=>isSolved(questionKey(q)));
  const bookmarked=allQs.filter(q=>isBookmarked(q)).length, mistakes=allQs.filter(q=>isMistake(q)).length;
  const recent=live.slice(0,4);
  const nextTopic=live.find(t=>topicStats(t.id).completion<100) || live[0];
  const nextStats=nextTopic?topicStats(nextTopic.id):null;
  const examCounts=[...new Set(allQs.map(q=>q.exam_id))].map(id=>({id,n:allQs.filter(q=>q.exam_id===id).length})).sort((a,b)=>b.n-a.n).slice(0,5);
  return `${hero()}
    <section class="stats-grid">
      <div class="metric"><span>Questions solved</span><strong>${s.solved}</strong><em>of ${s.questions} available</em></div>
      <div class="metric"><span>Overall mastery</span><strong>${s.completion}%</strong><em>marked solved</em></div>
      <div class="metric"><span>Bookmarks</span><strong>${bookmarked}</strong><em>saved for revision</em></div>
      <div class="metric"><span>Mistakes</span><strong>${mistakes}</strong><em>in your notebook</em></div>
    </section>
    <section class="dashboard-grid">
      <article class="continue-card">
        <div><span class="eyebrow">Continue learning</span><h2>${escapeHtml(nextTopic?.label||'Choose a topic')}</h2><p>${nextStats?`${nextStats.solved} of ${nextStats.questions} questions solved · ${nextStats.completion}% complete`:'Select a live topic to begin your first study session.'}</p></div>
        <div class="continue-progress"><div class="progress-track"><i style="width:${nextStats?.completion||0}%"></i></div><strong>${nextStats?.completion||0}%</strong></div>
        <button class="primary-btn" data-topic-go="${nextTopic?.id||''}" ${nextTopic?'':'disabled'}>${nextStats?.solved?'Continue topic →':'Start topic →'}</button>
      </article>
      <article class="daily-card"><span class="eyebrow">Today's plan</span><h2>15 focused questions</h2><p>Warm up with recognition, then finish with one deeper problem.</p><div class="plan-row"><span>5 easy</span><span>7 medium</span><span>3 hard</span></div><button class="secondary-btn" data-start-test="challenge">Start challenge →</button></article>
    </section>
    <section class="content-section"><div class="section-heading"><div><span class="eyebrow">Your curriculum</span><h2>Topics for ${state.subject==='math'?'Mathematics':'Physics'}</h2></div><button class="text-btn" data-route="topics">View all →</button></div>
      <div class="topic-grid">${recent.map(topicCard).join('')}</div>
    </section>
    <section class="dashboard-grid">
      <article class="feature-card"><span class="eyebrow">Exam coverage</span><h2>Practice by exam shape</h2><div class="exam-list">${examCounts.map(({id,n})=>`<div><span class="exam-dot ${examMeta(id)[1]}"></span><b>${examMeta(id)[0]}</b><span>${n} questions</span></div>`).join('')}</div><button class="text-btn" data-route="exams">Explore exam modes →</button></article>
      <article class="feature-card dark"><span class="eyebrow">Revision loop</span><h2>Turn mistakes into mastery.</h2><p>Review saved mistakes, revisit bookmarked questions, then drill the technique behind them.</p><div class="hero-actions"><button class="light-btn" data-route="mistakes">Mistake notebook</button><button class="light-btn" data-route="bookmarks">Bookmarks</button></div></article>
    </section>`;
}
function topicCard(t){
  const st=topicStats(t.id); return `<article class="topic-card ${t.live?'':'disabled'}" data-topic="${t.id}">
    <div class="topic-card-top"><span class="topic-status">${t.live?'LIVE':'COMING SOON'}</span><span>${st.questions} Q</span></div><h3>${escapeHtml(t.label)}</h3><p>${escapeHtml(t.blurb||'A new Trickbank topic is being prepared.')}</p><div class="topic-progress"><i style="width:${st.completion}%"></i></div><footer><span>${st.completion}% complete</span><button ${t.live?'':'disabled'} data-topic-go="${t.id}">${t.live?'Study →':'Soon'}</button></footer></article>`;
}

function examsView(){
  const subjectQs=allSubjectQuestions(state.subject);
  const examIds=[...new Set(subjectQs.map(q=>q.exam_id))];
  return `<section class="page-header"><span class="eyebrow">Exam modes</span><h1>Choose your exam shape</h1><p>Jump into the question bank using the exam coverage already present in Trickbank.</p></section>
  <div class="exam-dashboard">${examIds.map(id=>{const qs=subjectQs.filter(q=>q.exam_id===id),sol=qs.filter(q=>isSolved(questionKey(q))).length;return `<article class="exam-card" data-exam-launch="${id}"><div class="exam-title"><b>${escapeHtml(examMeta(id)[0])}</b><span class="exam-badge ${examMeta(id)[1]}">${qs.length} Q</span></div><small>${sol} solved · ${Math.round(sol/Math.max(qs.length,1)*100)}% complete</small><div class="progress-track"><i style="width:${sol/Math.max(qs.length,1)*100}%"></i></div></article>`}).join('')}</div>`;
}

function testsView(){
  const live=topicsForSubject(state.subject).filter(t=>t.live), total=allSubjectQuestions(state.subject).length;
  return `<section class="page-header"><span class="eyebrow">Assessment</span><h1>Timed Tests</h1><p>Generate a focused test from the current subject and work under a clock.</p></section>
  <div class="test-grid">${[
    ['quick','Quick 5','5 questions','5 minutes'],['standard','Standard 10','10 questions','12 minutes'],['challenge','Challenge 15','15 questions','18 minutes']
  ].map(([id,title,desc,time])=>`<article class="test-card"><span class="eyebrow">${escapeHtml(state.subject==='math'?'Mathematics':'Physics')}</span><h3>${title}</h3><p>${desc}. Mixed across live topics, weighted toward the available bank.</p><div class="test-meta"><span class="result-badge">${time}</span><span class="result-badge">${live.length} live topics</span><span class="result-badge">${total} available</span></div><button class="primary-btn" data-start-test="${id}">Start test →</button></article>`).join('')}</div>`;
}

function bookmarksView(){
  const qs=allSubjectQuestions(state.subject).filter(isBookmarked);
  return `<section class="page-header"><span class="eyebrow">Saved for later</span><h1>Bookmarks</h1><p>Keep high-value questions here for revision.</p></section>${qs.length?qs.map(qcard).join(''):`<div class="empty-state"><h2>No bookmarks yet</h2><p>Use ★ Bookmark on any question you want to revisit.</p><div class="empty-action"><button class="primary-btn" data-route="questions">Browse questions →</button></div></div>`}`;
}

function mistakesView(){
  const qs=allSubjectQuestions(state.subject).filter(isMistake);
  return `<section class="page-header"><span class="eyebrow">Revision loop</span><h1>Mistake Notebook</h1><p>Questions you flagged as needing another look.</p></section>${qs.length?qs.map(qcard).join(''):`<div class="empty-state"><h2>Your notebook is clear</h2><p>Flag a question with ⚠ Mistake when you get stuck or want to revisit the solution.</p></div>`}`;
}

function topicsView(){
  const topics=topicsForSubject(state.subject); return `<section class="page-header"><span class="eyebrow">Curriculum</span><h1>Topics</h1><p>Choose a topic to see its questions, toolkit and formula sheet.</p></section>
    <div class="topic-grid large">${topics.map(topicCard).join('')}</div>`;
}

function filterBar(){
  const t=currentTopic(); if(!t?.live) return '';
  const qs=questionsForTopic(t.id), exams=[...new Set(qs.map(q=>q.exam_id))];
  let html=`<div class="filter-panel"><div class="filter-row"><div><span class="filter-label">Exam pace</span><div class="chip-row">${EXAM_PACE_PRESETS.map(p=>`<button class="chip ${state.filters.pace===p.id?'active':''}" data-pace="${p.id}">${p.label}</button>`).join('')}</div></div><div><span class="filter-label">Exam</span><div class="chip-row">${exams.map(e=>`<button class="chip ${state.filters.exams.has(e)?'active':''}" data-exam="${e}">${examMeta(e)[0]}</button>`).join('')}</div></div><div><span class="filter-label">Difficulty</span><div class="chip-row">${[1,2,3,4,5].map(d=>`<button class="chip ${state.filters.difficulties.has(d)?'active':''}" data-diff="${d}">${'●'.repeat(d)}</button>`).join('')}</div></div>`;
  if(state.filters.technique) html+=`<div><span class="filter-label">Technique</span><div class="chip-row"><button class="chip active" data-clear-tech="1">${escapeHtml(techniqueLabel(state.filters.technique))} ×</button></div></div>`;
  const active=state.filters.exams.size||state.filters.difficulties.size||state.filters.technique||state.filters.pace||state.search;
  if(active) html+=`<button class="clear-btn" data-clear-filters="1">Clear all</button>`;
  return html+'</div></div>';
}

function matchesFilters(q){
  if(state.filters.exams.size&&!state.filters.exams.has(q.exam_id)) return false;
  if(state.filters.difficulties.size&&!state.filters.difficulties.has(q.difficulty)) return false;
  if(state.filters.technique&&!(q.technique_ids||[]).includes(state.filters.technique)) return false;
  if(state.search){ const hay=[q.question,q.source,q.answer,q.tip].join(' ').toLowerCase(); if(!hay.includes(state.search.toLowerCase())) return false; }
  return true;
}
function qcard(q){
  const key=questionKey(q), solved=isSolved(key), bookmarked=isBookmarked(q), mistake=isMistake(q), dots=[1,2,3,4,5].map(i=>`<i class="${i<=q.difficulty?'on':''}"></i>`).join('');
  return `<article class="question-card ${examMeta(q.exam_id)[1]} ${solved?'solved':''}"><div class="question-meta"><div><b>${escapeHtml(q.qid)}</b><span>${escapeHtml(q.source)}</span></div><span class="difficulty" title="Difficulty ${q.difficulty}/5">${dots}</span></div><div class="question-body">${q.question}</div><details><summary>Show solution</summary><div class="solution">${q.solution}</div></details>${q.answer?`<span class="answer">Answer: ${escapeHtml(q.answer)}</span>`:''}${q.tip?`<div class="tip">${q.tip}</div>`:''}<div class="question-footer"><div class="tech-tags">${(q.technique_ids||[]).map(id=>`<button data-tech="${id}">${escapeHtml(techniqueLabel(id))}</button>`).join('')}</div><div class="question-actions"><button class="q-action ${bookmarked?'active':''}" data-bookmark="${escapeHtml(key)}">★ ${bookmarked?'Saved':'Bookmark'}</button><button class="q-action danger ${mistake?'active':''}" data-mistake="${escapeHtml(key)}">⚠ ${mistake?'Flagged':'Mistake'}</button><label><input type="checkbox" data-solved="${escapeHtml(key)}" ${solved?'checked':''}> solved</label></div></div></article>`;
}

function questionsView(){
  const topics=topicsForSubject(state.subject), t=currentTopic()||topics.find(x=>x.live); if(!t) return '<div class="empty-state">No topics available.</div>';
  state.topic=t.id; const qs=questionsForTopic(t.id);
  if(!t.live) return `<section class="page-header"><span class="eyebrow">Question Bank</span><h1>${escapeHtml(t.label)}</h1></section><div class="empty-state"><h2>Coming soon</h2><p>This topic is listed in the curriculum but does not have a live question bank yet.</p></div>`;
  const matched=qs.filter(matchesFilters), order=t.exam_order||[...new Set(qs.map(q=>q.exam_id))];
  const grouped=state.filters.exams.size||state.filters.difficulties.size||state.filters.technique||state.search ? '' : order.map(e=>{const group=qs.filter(q=>q.exam_id===e); return group.length?`<section class="question-group"><div class="group-head"><span class="exam-badge ${examMeta(e)[1]}">${examMeta(e)[0]}</span><h2>${group.length} questions</h2></div>${group.map(qcard).join('')}</section>`:''}).join('');
  const body=grouped||`<section class="question-group"><div class="group-head"><h2>${matched.length} matching questions</h2></div>${matched.length?matched.map(qcard).join(''):'<div class="empty-state"><h3>No matches</h3><p>Try clearing a filter or changing your search.</p></div>'}</section>`;
  return `<section class="page-header compact"><div><span class="eyebrow">Question Bank</span><h1>${escapeHtml(t.label)}</h1><p>${qs.length} questions · filter by exam, difficulty or technique.</p></div><select id="topicSelect" aria-label="Select topic">${topics.map(x=>`<option value="${x.id}" ${x.id===t.id?'selected':''} ${x.live?'':'disabled'}>${escapeHtml(x.label)}${x.live?'':' — soon'}</option>`).join('')}</select></section>${filterBar()}<div class="results-line"><b>${matched.length}</b> of ${qs.length} questions shown</div>${body}`;
}

function toolkitView(){
  const t=currentTopic(); if(!t?.live) return `<section class="page-header"><span class="eyebrow">Toolkit</span><h1>Trick Toolkit</h1><p>Select a live topic first.</p></section>`;
  const qs=questionsForTopic(t.id); return `<section class="page-header compact"><div><span class="eyebrow">Technique library</span><h1>Trick Toolkit</h1><p>Recurring moves for <b>${escapeHtml(t.label)}</b>.</p></div><button class="secondary-btn" data-route="questions">Practice questions →</button></section><div class="toolkit-grid large">${(t.toolkit||[]).map(tool=>{const count=qs.filter(q=>(q.technique_ids||[]).includes(tool.id)).length,pct=masteryPct(tool.id);return `<article class="tool-card"><span class="tool-number">${tool.id}</span><h3>${escapeHtml(tool.title)}</h3><p>${tool.desc}</p>${pct===null?'<span class="mastery-note">Not drilled yet</span>':`<div class="mastery-bar"><i style="width:${pct}%"></i></div><span class="mastery-note">${pct}% correct in drills</span>`}<div class="tool-actions"><span>${count} questions</span><button class="chip" data-tech-practice="${tool.id}">Practice</button><button class="chip accent" data-drill="${tool.id}" ${count?'':'disabled'}>Drill</button></div></article>`}).join('')}</div>`;
}

function formulasView(){
  const t=currentTopic(); if(!t?.live) return `<section class="page-header"><span class="eyebrow">Reference</span><h1>Formula Sheet</h1><p>Select a live topic first.</p></section>`;
  return `<section class="page-header compact"><div><span class="eyebrow">Reference</span><h1>Formula Sheet</h1><p>Formulas used by the ${escapeHtml(t.label)} question bank.</p></div><button class="secondary-btn" data-route="questions">Back to questions →</button></section><div class="formula-wrap">${(t.formulas||[]).map(cat=>`<section class="formula-category"><h2>${escapeHtml(cat.cat)}</h2><div class="formula-grid">${cat.items.map(item=>`<div>${item}</div>`).join('')}</div></section>`).join('')}</div>`;
}

function progressView(){
  const qs=allSubjectQuestions(state.subject), solved=qs.filter(q=>isSolved(questionKey(q))).length, live=topicsForSubject(state.subject).filter(t=>t.live);
  const techniques=live.flatMap(t=>t.toolkit||[]); return `<section class="page-header"><span class="eyebrow">Your learning record</span><h1>My Progress</h1><p>Progress is saved locally in this browser.</p></section><section class="progress-hero"><strong>${qs.length?Math.round(100*solved/qs.length):0}%</strong><span>${solved} of ${qs.length} questions marked solved</span><div class="progress-track"><i style="width:${qs.length?100*solved/qs.length:0}%"></i></div></section><section class="content-section"><div class="section-heading"><div><span class="eyebrow">Topic progress</span><h2>Where you stand</h2></div></div><div class="progress-list">${live.map(t=>{const s=topicStats(t.id);return `<div><div><b>${escapeHtml(t.label)}</b><span>${s.solved}/${s.questions}</span></div><div class="progress-track"><i style="width:${s.completion}%"></i></div></div>`}).join('')}</div></section><section class="content-section"><div class="section-heading"><div><span class="eyebrow">Technique mastery</span><h2>Drill accuracy</h2></div></div><div class="mastery-table">${techniques.map(tool=>{const p=masteryPct(tool.id),m=state.mastery[tool.id];return `<div><span>${escapeHtml(tool.title)}</span><b>${p===null?'—':p+'%'}</b><small>${m?.seen||0} drill attempts</small></div>`}).join('')}</div></section>`;
}

function render(){
  renderSubjectSwitch(); renderNav();
  const views={dashboard,exams:examsView,topics:topicsView,questions:questionsView,toolkit:toolkitView,tests:testsView,bookmarks:bookmarksView,mistakes:mistakesView,formulas:formulasView,progress:progressView};
  app.innerHTML=views[state.route](); bindEvents();
  if(window.MathJax?.typesetPromise) MathJax.typesetPromise([app]).catch(()=>{});
}

function bindEvents(){
  $$('[data-route]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();navigate(el.dataset.route);}));
  $$('[data-topic-go]').forEach(el=>el.addEventListener('click',e=>{e.stopPropagation();if(!el.disabled){state.topic=el.dataset.topic;navigate('questions');}}));
  $$('.topic-card[data-topic]').forEach(el=>el.addEventListener('click',()=>{if(!el.classList.contains('disabled')){state.topic=el.dataset.topic;navigate('questions');}}));
  $$('[data-action="continue"]').forEach(el=>el.addEventListener('click',()=>navigate('questions')));
  $$('[data-solved]').forEach(el=>el.addEventListener('change',()=>{const q=DATA.questions.find(x=>questionKey(x)===el.dataset.solved);if(q)toggleSolved(q);}));
  $$('[data-bookmark]').forEach(el=>el.addEventListener('click',()=>{const q=DATA.questions.find(x=>questionKey(x)===el.dataset.bookmark);if(q)toggleBookmark(q);}));
  $$('[data-mistake]').forEach(el=>el.addEventListener('click',()=>{const q=DATA.questions.find(x=>questionKey(x)===el.dataset.mistake);if(q)toggleMistake(q);}));
  $$('[data-exam-launch]').forEach(el=>el.addEventListener('click',()=>{state.filters.exams=new Set([el.dataset.examLaunch]);state.filters.difficulties.clear();state.filters.technique=null;state.topic=topicsForSubject(state.subject).find(t=>t.live)?.id||state.topic;navigate('questions');}));
  $$('[data-start-test]').forEach(el=>el.addEventListener('click',()=>startTest(el.dataset.startTest)));
  $$('[data-tech]').forEach(el=>el.addEventListener('click',()=>{state.filters.technique=el.dataset.tech;navigate('questions');}));
  $$('[data-tech-practice]').forEach(el=>el.addEventListener('click',()=>{state.filters.technique=el.dataset.tech;navigate('questions');}));
  $$('[data-drill]').forEach(el=>el.addEventListener('click',()=>startDrill(el.dataset.drill)));
  $$('[data-pace]').forEach(el=>el.addEventListener('click',()=>{const p=EXAM_PACE_PRESETS.find(x=>x.id===el.dataset.pace);if(state.filters.pace===p.id){state.filters.pace=null;state.filters.exams.clear();}else{state.filters.pace=p.id;state.filters.exams=new Set(p.exams);}render();}));
  $$('[data-exam]').forEach(el=>el.addEventListener('click',()=>{const id=el.dataset.exam;state.filters.exams.has(id)?state.filters.exams.delete(id):state.filters.exams.add(id);state.filters.pace=null;render();}));
  $$('[data-diff]').forEach(el=>el.addEventListener('click',()=>{const d=Number(el.dataset.diff);state.filters.difficulties.has(d)?state.filters.difficulties.delete(d):state.filters.difficulties.add(d);render();}));
  $$('[data-clear-filters]').forEach(el=>el.addEventListener('click',()=>{resetFilters();state.search='';$('#searchInput').value='';render();}));
  $$('[data-clear-tech]').forEach(el=>el.addEventListener('click',()=>{state.filters.technique=null;render();}));
  const select=$('#topicSelect'); if(select) select.addEventListener('change',()=>{state.topic=select.value;resetFilters();render();});
}

function startTest(mode){
  const sizes={quick:5,standard:10,challenge:15}, mins={quick:5,standard:12,challenge:18};
  const pool=allSubjectQuestions(state.subject).filter(q=>q.topic && topicsForSubject(state.subject).some(t=>t.id===q.topic && t.live));
  const size=Math.min(sizes[mode]||5,pool.length); if(!size){toast('No questions available');return;}
  const queue=[...pool].sort(()=>Math.random()-.5).slice(0,size);
  state.test={mode,queue,idx:0,answers:{},started:Date.now(),endsAt:Date.now()+mins[mode]*60000,result:null};
  renderTest();
}
function renderTest(){
  const root=$('#drillRoot'); if(!state.test){root.innerHTML='';return;}
  const t=state.test;
  if(!t.result && Date.now()>=t.endsAt){finishTest(true);return;}
  if(t.result){
    const correct=t.result.correct,total=t.queue.length,pct=Math.round(correct/total*100);
    root.innerHTML=`<div class="test-overlay"><div class="test-card"><div class="test-result"><span class="eyebrow">Test complete</span><strong>${pct}%</strong><h2>${correct} / ${total} correct</h2><div class="result-badges"><span class="result-badge">${t.result.answered} answered</span><span class="result-badge">${total-t.result.answered} unanswered</span><span class="result-badge">${t.result.expired?'Time expired':'Completed on time'}</span></div><div class="empty-action"><button class="primary-btn" data-test-close="1">Back to portal</button><button class="secondary-btn" data-test-again="${t.mode}">Try again</button></div></div></div></div>`;
    $('[data-test-close]')?.addEventListener('click',()=>{state.test=null;renderTest();render();});
    $('[data-test-again]')?.addEventListener('click',()=>startTest(t.mode)); return;
  }
  const q=t.queue[t.idx], selected=t.answers[t.idx], remain=Math.max(0,t.endsAt-Date.now()), sec=Math.ceil(remain/1000);
  root.innerHTML=`<div class="test-overlay"><div class="test-card"><div class="test-top"><div><span class="eyebrow">Timed test · ${t.idx+1}/${t.queue.length}</span><h2>${escapeHtml(q.qid)} · ${escapeHtml(q.topic)}</h2></div><div class="test-timer">${String(Math.floor(sec/60)).padStart(2,'0')}:${String(sec%60).padStart(2,'0')}</div></div><div class="test-q"><div>${q.question}</div><details><summary>Reveal solution</summary><div class="solution">${q.solution}</div></details></div><div class="test-options"><button class="test-option ${selected==='correct'?'selected':''}" data-test-answer="correct">I can solve this</button><button class="test-option ${selected==='review'?'selected':''}" data-test-answer="review">Mark for review</button><button class="test-option ${selected==='skip'?'selected':''}" data-test-answer="skip">Skip</button></div><div class="test-nav"><button class="secondary-btn" data-test-prev ${t.idx===0?'disabled':''}>← Previous</button>${t.idx===t.queue.length-1?'<button class="primary-btn" data-test-finish>Finish test</button>':'<button class="primary-btn" data-test-next>Next →</button>'}</div></div></div>`;
  $$('[data-test-answer]').forEach(btn=>btn.addEventListener('click',()=>{t.answers[t.idx]=btn.dataset.testAnswer;renderTest();}));
  $('[data-test-prev]')?.addEventListener('click',()=>{if(t.idx>0)t.idx--;renderTest();});
  $('[data-test-next]')?.addEventListener('click',()=>{if(t.idx<t.queue.length-1)t.idx++;renderTest();});
  $('[data-test-finish]')?.addEventListener('click',()=>finishTest(false));
  clearTimeout(renderTest.timer); renderTest.timer=setTimeout(renderTest,1000);
  if(window.MathJax?.typesetPromise) MathJax.typesetPromise([root]).catch(()=>{});
}
function finishTest(expired){
  if(!state.test||state.test.result)return;
  const t=state.test; const answered=Object.keys(t.answers).length; const correct=Object.values(t.answers).filter(v=>v==='correct').length;
  t.result={correct,answered,expired};
  t.queue.forEach((q,i)=>{if(t.answers[i]==='correct')state.solved[questionKey(q)]=true;});
  persistSolved(); renderTest();
}

function startDrill(techniqueId){
  const t=currentTopic(), qs=questionsForTopic(t.id).filter(q=>(q.technique_ids||[]).includes(techniqueId)); if(!qs.length)return;
  state.drill={techniqueId,queue:[...qs].sort(()=>Math.random()-.5),idx:0,score:0,revealed:false}; renderDrill();
}
function renderDrill(){
  const root=$('#drillRoot'); if(!state.drill){root.innerHTML='';return;}
  const d=state.drill, done=d.idx>=d.queue.length, t=currentTopic();
  const content=done?`<div class="drill-done"><span class="eyebrow">Session complete</span><h2>${d.score} / ${d.queue.length}</h2><p>correct on <b>${escapeHtml(techniqueLabel(d.techniqueId,t))}</b></p><button class="primary-btn" data-drill-again="1">Drill again</button></div>`:(()=>{const q=d.queue[d.idx];return `<span class="drill-progress">${d.idx+1} / ${d.queue.length} · ${escapeHtml(techniqueLabel(d.techniqueId,t))}</span><div class="drill-q">${q.question}</div>${d.revealed?`<div class="drill-answer"><b>Answer:</b> ${escapeHtml(q.answer||'See solution')}<div>${q.tip||''}</div></div><div class="drill-rate"><button class="miss" data-drill-result="0">Missed it</button><button class="got" data-drill-result="1">Got it</button></div>`:'<button class="primary-btn" data-reveal="1">Show answer</button>'}`})();
  root.innerHTML=`<div class="drill-overlay"><div class="drill-card"><button class="drill-close" data-close-drill="1">×</button>${content}</div></div>`;
  $('[data-close-drill]')?.addEventListener('click',()=>{state.drill=null;renderDrill();});
  $('[data-drill-again]')?.addEventListener('click',()=>startDrill(d.techniqueId));
  $('[data-reveal]')?.addEventListener('click',()=>{d.revealed=true;renderDrill();});
  $$('[data-drill-result]').forEach(btn=>btn.addEventListener('click',()=>{const correct=btn.dataset.drillResult==='1';recordDrill(d.techniqueId,correct);if(correct)d.score++;d.idx++;d.revealed=false;renderDrill();}));
  if(window.MathJax?.typesetPromise) MathJax.typesetPromise([root]).catch(()=>{});
}

$('#searchInput').addEventListener('input',e=>{state.search=e.target.value.trim();if(state.route!=='questions')state.route='questions';render();});
$('#clearSearch').addEventListener('click',()=>{state.search='';$('#searchInput').value='';render();});
$('#mobileMenu').addEventListener('click',()=>$('#sidebar').classList.toggle('open'));
window.addEventListener('hashchange',()=>{state.route=location.hash.slice(1)||'dashboard';render();});

(async function init(){
  state.route=location.hash.slice(1)||'dashboard';
  if(!['dashboard','exams','topics','questions','toolkit','tests','bookmarks','mistakes','formulas','progress'].includes(state.route))state.route='dashboard';
  await loadState();
  try {
    await loadContentData();
    render();
  } catch (error) {
    console.error(error);
    app.innerHTML = `<section class="page-header"><span class="eyebrow">Trickbank</span><h1>Content could not be loaded</h1><p>Run the portal through a local web server so the JSON content files can be fetched.</p></section>`;
  }
})();
