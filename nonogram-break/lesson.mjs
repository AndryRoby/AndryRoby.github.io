// Enumerate all legal lines. Show only deductions shared by EVERY legal line.
export function patterns(n, clues) {
  const out=[];
  for (let mask=0; mask < 2**n; mask++) {
    const bits=Array.from({length:n},(_,i)=>(mask>>i)&1);
    const runs=[]; let run=0;
    for(const bit of [...bits,0]) { if(bit) run++; else if(run) { runs.push(run);run=0; } }
    if(JSON.stringify(runs)===JSON.stringify(clues)) out.push(bits);
  }
  return out;
}
export function explain(puzzle) {
  const {n,clues}=puzzle, board=Array(n*n).fill(-1), steps=[];
  let changed=true;
  while(changed) {
    changed=false;
    for(const axis of ['rows','cols']) for(let line=0;line<n;line++) {
      const indexes=Array.from({length:n},(_,i)=>axis==='rows'?line*n+i:i*n+line);
      const legal=patterns(n,clues[axis][line]).filter(p=>p.every((v,i)=>board[indexes[i]]<0 || board[indexes[i]]===v));
      if(!legal.length) throw Error('The clues contradict the known squares.');
      const changes=[];
      indexes.forEach((cell,i)=>{
        if(board[cell]<0 && legal.every(p=>p[i]===legal[0][i])) changes.push({cell,value:legal[0][i]});
      });
      if(changes.length) {
        changes.forEach(x=>board[x.cell]=x.value);
        steps.push({axis,line,clues:clues[axis][line],possibilities:legal.length,changes,board:[...board]});
        changed=true;
      }
    }
  }
  return {steps,board,complete:board.every(v=>v>=0)};
}
