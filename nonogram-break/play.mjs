export function createBoard(solution){
  const n=Math.sqrt(solution.length);
  if(!Number.isInteger(n)||solution.some(v=>v!==0&&v!==1))throw Error('Invalid puzzle');
  let cells=solution.map(()=>-1),history=[],before=null;
  const valid=i=>Number.isInteger(i)&&i>=0&&i<cells.length;
  const end=()=>{if(before&&before.some((v,i)=>v!==cells[i]))history.push(before);before=null;};
  return {
    get cells(){return cells.slice();},get canUndo(){return history.length>0;},get drawing(){return before!==null;},
    begin(){end();before=cells.slice();},
    paint(i,value){if(!valid(i)||![-1,0,1].includes(value))return false;if(!before)throw Error('Begin a stroke first');cells[i]=value;return true;},
    end,cancel(){if(before)cells=before;before=null;},
    undo(){end();if(history.length)cells=history.pop();},
    reset(){end();const old=cells;cells=solution.map(()=>-1);if(old.some(v=>v!==-1))history.push(old);},
    check(){const wrong=cells.flatMap((v,i)=>v!==-1&&v!==solution[i]?[i]:[]);const missing=solution.filter((v,i)=>v===1&&cells[i]!==1).length;return {wrong,missing,solved:wrong.length===0&&missing===0};},
  };
}
export function cellAt(x,y,n=8){
  const col=Math.floor((x-67)/38),row=Math.floor((y-67)/38);
  return x>=67&&y>=67&&col<n&&row<n?row*n+col:null;
}
// Fast pointer moves still paint a continuous line of cells.
export function between(a,b,n=8){
  if(a===null||a===undefined)return [b];
  let x=a%n,y=Math.floor(a/n);const x2=b%n,y2=Math.floor(b/n),dx=Math.abs(x2-x),dy=-Math.abs(y2-y),sx=x<x2?1:-1,sy=y<y2?1:-1;let error=dx+dy;const out=[];
  while(true){out.push(y*n+x);if(x===x2&&y===y2)break;const twice=2*error;if(twice>=dy){error+=dy;x+=sx;}if(twice<=dx){error+=dx;y+=sy;}}
  return out;
}
