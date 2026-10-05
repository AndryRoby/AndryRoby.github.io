import {explain} from './lesson.mjs';
import {createBoard,cellAt,between} from './play.mjs';
const NS='http://www.w3.org/2000/svg',board=document.querySelector('#board');
const label=document.querySelector('#step-label'),text=document.querySelector('#explanation'),next=document.querySelector('#next'),progress=document.querySelector('#progress');
const track=name=>{try{window.umami?.track(name);}catch{}};
document.querySelectorAll('[data-event]').forEach(a=>a.addEventListener('click',()=>track(a.dataset.event)));
const element=(tag,attrs,content)=>{const e=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>e.setAttribute(k,v));if(content!==undefined)e.textContent=content;return e;};
let puzzle,lesson,play,position=0,mode='play',tool=1,focus=0,stroke=null,checked=false,solvedTracked=false,started=false;
const cells=[],clues=[];
function initGrid(){
  const grid=element('g',{id:'grid'});board.append(grid);
  for(let row=0;row<8;row++){
    const line=element('g',{role:'row'});grid.append(line);
    for(let col=0;col<8;col++){
      const i=row*8+col,x=67+col*38,y=67+row*38;
      const group=element('g',{role:'gridcell','data-cell':i,tabindex:i===0?'0':'-1'});
      const rect=element('rect',{x,y,width:38,height:38,class:'cell'}),cross=element('path',{d:`M${x+15},${y+15}l8,8m0,-8l-8,8`,class:'cross'});
      group.append(rect,cross);line.append(group);cells.push({group,rect,cross});
    }
  }
  for(const axis of ['rows','cols'])puzzle.clues[axis].forEach((values,line)=>{
    const numbers=values.length?values:[0];
    numbers.forEach((v,j)=>{
      const e=element('text',{'text-anchor':axis==='rows'?'end':'middle',x:axis==='rows'?57-(numbers.length-j-1)*15:86+line*38,y:axis==='rows'?90+line*38:57-(numbers.length-j-1)*16,class:'clue'},v);board.append(e);clues.push({e,axis,line});
    });
  });
}
function render(){
  board.classList.toggle('playing',mode==='play');
  const step=mode==='learn'&&position?lesson.steps[position-1]:null,state=mode==='play'?play.cells:step?.board||Array(64).fill(-1);
  const changed=new Set(step?.changes.map(x=>x.cell)),result=play.check(),wrong=new Set(checked?result.wrong:[]);
  cells.forEach(({group,rect,cross},i)=>{
    group.setAttribute('class',[changed.has(i)?'recent':'',mode==='play'&&wrong.has(i)?'wrong':''].join(' '));
    rect.setAttribute('class',state[i]===1?'cell filled':'cell');cross.setAttribute('visibility',state[i]===0?'visible':'hidden');
    group.setAttribute('tabindex',mode==='play'&&focus===i?'0':'-1');
    group.setAttribute('aria-label',`Row ${Math.floor(i/8)+1}, column ${i%8+1}: ${state[i]===1?'filled':state[i]===0?'marked empty':'undecided'}`);
  });
  clues.forEach(({e,axis,line})=>e.setAttribute('class',step?.axis===axis&&step.line===line?'clue clue-active':'clue'));
  document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===mode)));
  document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.tool)===tool)));
  document.querySelector('#manual-controls').hidden=mode!=='play';document.querySelector('#lesson-controls').hidden=mode!=='learn';
  document.querySelector('#undo').disabled=!play.canUndo;
  document.querySelector('#lesson-title').textContent=mode==='play'?'Try it yourself':'Follow the logic';
  document.querySelector('#keyboard-help').textContent=mode==='play'?'Tap or drag to mark squares. Keyboard: arrows to move, Space to fill, X for empty, Backspace to erase.':'This is the explanation. Switch to Solve yourself to mark your own grid.';
  let finished;
  if(mode==='play'){
    finished=result.solved&&!play.drawing;label.textContent=finished?'PUZZLE SOLVED':checked&&result.wrong.length?'CHECK YOUR MARKS':'YOUR PENCIL BREAK';
    text.textContent=finished?'Every filled block matches the clues. Nicely solved! Empty marks are optional.':checked?(result.wrong.length?`${result.wrong.length} marked square${result.wrong.length===1?' needs':'s need'} another look. They are outlined in red. You can undo or erase them.`:`Your marks are correct so far. ${result.missing} filled square${result.missing===1?' is':'s are'} still missing.`):'Choose Fill, Empty or Erase, then tap or drag across the grid. Empty marks help you reason, but are optional for finishing.';
    progress.textContent=finished?'Sample complete · Try the next puzzle on paper.':`${state.filter(v=>v===1).length} squares filled · No timer`;
    if(finished&&!solvedTracked){solvedTracked=true;track('nonogram_break_solved');}
  }else{
    finished=position===lesson.steps.length;
    if(!position){label.textContent='YOUR FIRST DEDUCTION';text.textContent='Press below to see which squares can be decided with certainty. Your own grid is kept while you follow this explanation.';}
    else{
      const filled=step.changes.filter(x=>x.value===1).length,empty=step.changes.length-filled;
      label.textContent=`${step.axis==='rows'?'ROW':'COLUMN'} ${step.line+1} · CLUES ${step.clues.length?step.clues.join(', '):'0'}`;
      const blocks=step.clues.reduce((a,b)=>a+b,0),gaps=Math.max(0,step.clues.length-1),crossAxis=step.axis==='rows'?'columns':'rows';
      const positions=value=>step.changes.filter(x=>x.value===value).map(x=>step.axis==='rows'?x.cell%8+1:Math.floor(x.cell/8)+1).join(', ');
      const deduction=`${filled?`Fill ${crossAxis} ${positions(1)}. `:''}${empty?`Mark ${crossAxis} ${positions(0)} empty.`:''}`;
      text.textContent=blocks+gaps===8?`${step.clues.join(' + ')} filled squares + ${gaps} mandatory gap${gaps===1?'':'s'} = all 8 squares. The blocks cannot shift. ${deduction}`:step.possibilities===1?`The clues and squares already decided allow just one arrangement. ${deduction}`:`Compare the ${step.possibilities} arrangements that still fit: every one agrees on these highlighted squares. ${deduction} The other undecided squares stay open.`;
    }
    next.innerHTML=finished?'Replay the example <span aria-hidden="true">↺</span>':'Explain the next step <span aria-hidden="true">→</span>';
    progress.textContent=finished?'Every square follows the clues. Try the next puzzle on paper.':`${position} / ${lesson.steps.length} logical steps · No guessing`;
  }
  document.querySelector('#completed').hidden=!finished;
  board.setAttribute('aria-label',`Nonogram, 8 by 8. ${mode==='play'?'Use arrow keys to move, Space to fill, X to mark empty and Backspace to erase.':'Guided explanation.'}`);
}
function finish(cancel=false){if(!stroke)return;cancel?play.cancel():play.end();const id=stroke.id;stroke=null;if(board.hasPointerCapture(id))board.releasePointerCapture(id);render();}
function beginPlay(){checked=false;if(!started){started=true;track('nonogram_break_start');}}
function at(event){const ctm=board.getScreenCTM();if(!ctm)return null;const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(ctm.inverse());return cellAt(point.x,point.y);}
board.addEventListener('pointerdown',e=>{
  if(!play||mode!=='play'||stroke||!e.isPrimary||![0,2].includes(e.button))return;
  const i=at(e);if(i===null)return;e.preventDefault();beginPlay();
  const chosen=e.button===2?0:tool,value=chosen!==-1&&play.cells[i]===chosen?-1:chosen;
  play.begin();stroke={id:e.pointerId,last:i,value};play.paint(i,value);board.setPointerCapture(e.pointerId);render();
});
board.addEventListener('pointermove',e=>{
  if(!stroke||e.pointerId!==stroke.id)return;e.preventDefault();
  const i=at(e);if(i===null){stroke.last=null;return;}
  between(stroke.last,i).forEach(c=>play.paint(c,stroke.value));stroke.last=i;render();
});
board.addEventListener('pointerup',e=>{if(e.pointerId===stroke?.id)finish();});
board.addEventListener('pointercancel',e=>{if(e.pointerId===stroke?.id)finish(true);});
board.addEventListener('lostpointercapture',e=>{if(e.pointerId===stroke?.id)finish(true);});
window.addEventListener('blur',()=>finish(true));
board.addEventListener('contextmenu',e=>{if(mode==='play'&&at(e)!==null)e.preventDefault();});
board.addEventListener('keydown',e=>{
  if(mode!=='play'||!e.target.hasAttribute('data-cell'))return;
  focus=Number(e.target.getAttribute('data-cell'));let to=focus;
  if(e.key==='ArrowRight')to=focus%8<7?focus+1:focus;
  else if(e.key==='ArrowLeft')to=focus%8>0?focus-1:focus;
  else if(e.key==='ArrowDown')to=focus<56?focus+8:focus;
  else if(e.key==='ArrowUp')to=focus>=8?focus-8:focus;
  else if([' ','Enter','x','X','Backspace','Delete'].includes(e.key)){
    e.preventDefault();finish();beginPlay();const value=['x','X'].includes(e.key)?0:['Backspace','Delete'].includes(e.key)?-1:1;
    play.begin();play.paint(focus,play.cells[focus]===value&&value!==-1?-1:value);play.end();render();return;
  }else return;
  e.preventDefault();focus=to;render();cells[to].group.focus();
});
try{
  const response=await fetch('puzzle.json');if(!response.ok)throw Error('Puzzle unavailable');
  puzzle=await response.json();lesson=explain(puzzle);if(!lesson.complete)throw Error('Incomplete logical example');play=createBoard(lesson.board);initGrid();
  document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{finish();mode=b.dataset.mode;render();}));
  document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{finish();tool=Number(b.dataset.tool);render();}));
  document.querySelector('#undo').addEventListener('click',()=>{finish();play.undo();checked=false;render();});
  // Analytics count one real solve per page view; undoing a reset is not a new solve.
  document.querySelector('#reset').addEventListener('click',()=>{finish();play.reset();checked=false;render();});
  document.querySelector('#check').addEventListener('click',()=>{finish();checked=true;render();});
  next.addEventListener('click',()=>{position=position===lesson.steps.length?0:position+1;if(position===1)track('nonogram_break_lesson_start');if(position===lesson.steps.length)track('nonogram_break_lesson_complete');render();});
  document.querySelector('#restart').addEventListener('click',()=>{position=0;render();});render();
}catch{
  document.querySelector('#manual-controls').hidden=true;document.querySelector('#lesson-controls').hidden=true;
  text.textContent='The example could not load. Download the free PDF sample below the introduction to try it on paper.';progress.textContent='The sample and the book links still work.';
}
