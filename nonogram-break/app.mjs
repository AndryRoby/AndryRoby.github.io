import {explain} from './lesson.mjs';
const NS='http://www.w3.org/2000/svg';
const board=document.querySelector('#board');
const label=document.querySelector('#step-label'), text=document.querySelector('#explanation');
const next=document.querySelector('#next'), progress=document.querySelector('#progress');
const track=name=>{try{window.umami?.track(name);}catch{}};
document.querySelectorAll('[data-event]').forEach(a=>a.addEventListener('click',()=>track(a.dataset.event)));
const element=(tag,attrs,content)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(content!==undefined)e.textContent=content;return e;};
let puzzle,lesson,position=0;
function render(){
  const step=position?lesson.steps[position-1]:null, state=step?.board || Array(64).fill(-1);
  board.replaceChildren();
  const changed=new Set(step?.changes.map(x=>x.cell));
  const x0=67,y0=67,cell=38;
  state.forEach((v,i)=>{
    const x=x0+i%8*cell,y=y0+Math.floor(i/8)*cell;
    const group=element('g',{class:changed.has(i)?'recent':''});
    group.append(element('rect',{x,y,width:cell,height:cell,class:v===1?'cell filled':'cell'}));
    if(v===0)group.append(element('path',{d:`M${x+15},${y+15}l8,8m0,-8l-8,8`,class:'cross'}));
    board.append(group);
  });
  for(const axis of ['rows','cols']) puzzle.clues[axis].forEach((values,line)=>{
    const numbers=values.length?values:[0],active=step?.axis===axis && step.line===line;
    const attrs={class:active?'clue clue-active':'clue','text-anchor':axis==='rows'?'end':'middle'};
    if(axis==='rows')numbers.forEach((v,j)=>board.append(element('text',{...attrs,x:x0-10-(numbers.length-j-1)*15,y:y0+line*cell+cell/2+4},v)));
    else numbers.forEach((v,j)=>board.append(element('text',{...attrs,x:x0+line*cell+cell/2,y:y0-10-(numbers.length-j-1)*16},v)));
  });
  if(!position){label.textContent='YOUR FIRST DEDUCTION';text.textContent='Press below to see which squares can be decided with certainty. This is a guided example, not a timed challenge.';}
  else {
    const filled=step.changes.filter(x=>x.value===1).length,empty=step.changes.length-filled;
    label.textContent=`${step.axis==='rows'?'ROW':'COLUMN'} ${step.line+1} · CLUES ${step.clues.length?step.clues.join(', '):'0'}`;
    const blocks=step.clues.reduce((a,b)=>a+b,0), gaps=Math.max(0,step.clues.length-1);
    const crossAxis=step.axis==='rows'?'columns':'rows';
    const positions=value=>step.changes.filter(x=>x.value===value).map(x=>step.axis==='rows'?x.cell%8+1:Math.floor(x.cell/8)+1).join(', ');
    const deduction=`${filled?`Fill ${crossAxis} ${positions(1)}. `:''}${empty?`Mark ${crossAxis} ${positions(0)} empty.`:''}`;
    text.textContent=blocks+gaps===8
      ? `${step.clues.join(' + ')} filled squares + ${gaps} mandatory gap${gaps===1?'':'s'} = all 8 squares. The blocks cannot shift. ${deduction}`
      : step.possibilities===1
        ? `The clues and squares already decided allow just one arrangement. ${deduction}`
        : `Compare the ${step.possibilities} arrangements that still fit: every one agrees on these highlighted squares. ${deduction} The other undecided squares stay open.`;
  }
  const finished=position===lesson.steps.length;
  document.querySelector('#completed').hidden=!finished;
  next.innerHTML=finished?'Replay the example <span aria-hidden="true">↺</span>':'Explain the next step <span aria-hidden="true">→</span>';
  progress.textContent=finished?'Every square follows the clues. Try the next puzzle on paper.':`${position} / ${lesson.steps.length} logical steps · No guessing`;
  board.setAttribute('aria-label',`Nonogram, 8 by 8. ${state.filter(v=>v>=0).length} of 64 squares decided. ${finished?'Complete.':text.textContent}`);
}
try{
  const response=await fetch('puzzle.json');if(!response.ok)throw Error('Puzzle unavailable');
  puzzle=await response.json();lesson=explain(puzzle);if(!lesson.complete)throw Error('Incomplete logical example');
  next.addEventListener('click',()=>{
    if(position===lesson.steps.length)position=0;else position++;
    if(position===1)track('nonogram_break_start');
    if(position===lesson.steps.length)track('nonogram_break_lesson_complete');
    render();
  });
  document.querySelector('#restart').addEventListener('click',()=>{position=0;render();});
  render();
}catch{
  next.hidden=true;document.querySelector('#restart').hidden=true;
  text.textContent='The guided example could not load. Download the free PDF sample below the introduction to try it on paper.';
  progress.textContent='The sample and the book links still work.';
}
