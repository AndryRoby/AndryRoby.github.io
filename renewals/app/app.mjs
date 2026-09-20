import {pripojenie} from './pripojenie.mjs';
const root = new URL('./', import.meta.url);
const connection=pripojenie('renewals',root);
let publicRegistration=false;
const main = document.querySelector('#main');
const context = document.querySelector('#header-context');
const dialog = document.querySelector('#workspace-dialog');
const content = document.querySelector('#dialog-content');
const notice = document.querySelector('#notice');
const state = { me:null, dashboard:null, suppliers:[], tab:'requirements', filter:'all', search:'', auth:new URLSearchParams(location.search).get('start')==='1'?'register':'login', invitation:null, detail:null };
let noticeTimer;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = path => new URL('api/'+path,root).href;
const statusNames = {missing:'Missing',valid:'Current',expiring:'Expiring soon',expired:'Expired',pending:'Needs review',approved:'Approved',rejected:'Rejected'};
const status = value => `<span class="status status-${esc(statusNames[value]?value:'missing')}">${esc(statusNames[value] || value || 'Missing')}</span>`;
const date = value => { if(!value)return 'Not set'; const d=new Date(value.length===10?value+'T12:00:00Z':value); return Number.isNaN(d.valueOf())?'Not set':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(d); };
const datetime = value => { if(!value)return 'Not yet recorded'; const d=new Date(value);return Number.isNaN(d.valueOf())?'Not yet recorded':new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(d); };
const tomorrow = () => new Date(Date.now()+86400000).toISOString().slice(0,10);
const bytes = n => n>=1048576?(n/1048576).toFixed(1)+' MB':Math.max(1,Math.round(n/1024))+' KB';

async function api(path,{method='GET',body,headers={},portalToken}={}) {
  const h={Accept:'application/json',...headers};
  if(portalToken)h['X-Portal-Token']=portalToken;
  else if(method!=='GET'&&state.me?.csrfToken)h['X-CSRF-Token']=state.me.csrfToken;
  if(body && !(body instanceof Blob)){h['Content-Type']='application/json';body=JSON.stringify(body);}
  const response=await connection.request(path,{method,headers:h,body},!!portalToken);
  const data=await response.json().catch(()=>({error:'The server did not return a readable response.'}));
  if(!response.ok){
    if(response.status===401&&state.me&&!portalToken){state.me=null;state.dashboard=null;if(dialog.open)closeDialog();state.auth='login';renderAuth();toast('Your session ended. Log in again to continue.',true);}
    const error=new Error(data.error || 'The request could not be completed.');error.code=data.code;error.status=response.status;throw error;
  }
  return /^auth\/(login|register)$/.test(path)?connection.remember(data):data;
}
function toast(message,error=false){clearTimeout(noticeTimer);notice.textContent=message;notice.classList.toggle('error',error);notice.setAttribute('role',error?'alert':'status');notice.hidden=false;noticeTimer=setTimeout(()=>{notice.hidden=true;},7000);}
function formError(form,message){const e=form.querySelector('[data-error]');if(e){e.textContent=message;e.hidden=false;e.focus();}else toast(message,true);}
async function submit(form,work){const buttons=[...form.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);form.setAttribute('aria-busy','true');const e=form.querySelector('[data-error]');if(e)e.hidden=true;try{await work();}catch(error){formError(form,error.message || 'Could not connect. Try again.');}finally{buttons.forEach(b=>b.disabled=false);form.removeAttribute('aria-busy');}}
const errorLine = '<p class="form-error" data-error role="alert" tabindex="-1" hidden></p>';
function openDialog(title,description,body){const wasOpen=dialog.open,action=document.activeElement?.dataset.action;content.innerHTML=`<div class="dialog-head"><div><h2 id="dialog-title" tabindex="-1">${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div><button class="close-dialog" data-action="close" aria-label="Close dialog">×</button></div><div class="dialog-body">${body}</div>`;if(!wasOpen)dialog.showModal();else{const target=action?[...content.querySelectorAll('[data-action]')].find(e=>e.dataset.action===action):null;(target||document.querySelector('#dialog-title')).focus({preventScroll:true});}}
function closeDialog(){dialog.close();state.detail=null;state.invitation=null;}

function renderAuth(){
  clearTimeout(noticeTimer);notice.hidden=true;
  context.innerHTML='<span class="muted">'+(publicRegistration?'Free pilot':'Private pilot')+'</span>';
  const register=state.auth==='register';
  main.innerHTML=`<div class="auth"><section class="auth-story"><p class="eyebrow">A clear next step</p><h1>Know what is current.<br><span>See what needs a look.</span></h1><p>Keep supplier documents, renewal dates and the decision to approve them in one place.</p><ol class="process"><li><span>01</span><div><strong>Request the document</strong><small>Give your supplier a private upload link.</small></div></li><li><span>02</span><div><strong>Review what arrives</strong><small>A new upload waits for a person's decision.</small></div></li><li><span>03</span><div><strong>Keep the history</strong><small>See each version and export your records.</small></div></li></ol></section><section class="auth-form" aria-labelledby="auth-title"><div class="auth-tabs" aria-label="Access your workspace"><button data-action="auth-login" aria-pressed="${!register}">Log in</button><button data-action="auth-register" aria-pressed="${register}">Join the pilot</button></div><h2 id="auth-title">${register?'Start your workspace':'Welcome back'}</h2><p>${register?(publicRegistration?'Free pilot, no card needed. Your separate workspace is created when you join.':'A pilot code is required. Your workspace is created when you join.'):'Open your requirements, documents and review history.'}</p><form id="auth-form">${register?'<div class="field"><label for="auth-name">Your name</label><input id="auth-name" name="name" autocomplete="name" required maxlength="100"></div>':''}<div class="field"><label for="auth-email">Email address</label><input id="auth-email" name="email" type="email" autocomplete="email" required maxlength="254" placeholder="you@company.com"></div><div class="field"><label for="auth-password">Password</label><input id="auth-password" name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required ${register?'minlength="12"':''} maxlength="256">${register?'<p class="help">Use at least 12 characters.</p>':''}</div>${register&&!publicRegistration?'<div class="field"><label for="pilot-code">Pilot code</label><input id="pilot-code" name="pilotCode" autocomplete="off" required maxlength="200"><p class="help">Use the code provided with your pilot invitation.</p></div>':''}<button class="btn primary wide" type="submit">${register?'Create workspace':'Log in'}</button>${errorLine}</form><p class="footnote">Need help accessing your account? <a href="mailto:andrej@arling.sk">Contact Andrej</a>.</p></section></div>`;
}

async function loadWorkspace(){
  const [dashboard,suppliers]=await Promise.all([api('dashboard'),api('suppliers')]);
  state.dashboard=dashboard;state.suppliers=suppliers.suppliers || [];renderWorkspace();
}
function renderWorkspace(){
  const d=state.dashboard,s=d.summary || {},me=state.me;
  context.innerHTML=`<div class="header-user"><span>${esc(me.user.name)}</span><button data-action="logout">Log out</button></div>`;
  const note=d.emailEnabled?'Email transport is enabled. Check activity for the recorded delivery status.':'Due-date checks record reminders here. No reminder emails are being sent.';
  main.innerHTML=`<div class="workspace"><div class="workspace-heading"><div><p class="eyebrow">${esc(me.workspace.name)}</p><h1>Document renewals</h1><p>Collect the file. Review the version. Keep the record.</p></div><div class="actions"><button class="btn primary" data-action="add">Add a requirement <span aria-hidden="true">+</span></button></div></div><div class="summary-line" aria-label="Workspace totals"><div><strong>${esc(s.total||0)}</strong><span>tracked</span></div><div class="attention"><strong>${esc(s.pending||0)}</strong><span>need review</span></div><div><strong>${esc((s.expiring||0)+(s.expired||0))}</strong><span>due or overdue</span></div><div><strong>${esc(s.missing||0)}</strong><span>missing a file</span></div></div><p class="service-note"><strong>${d.emailEnabled?'Email transport enabled':'Email reminders are off'}</strong><span>${note}</span></p><nav class="workspace-tabs" aria-label="Workspace sections"><button data-tab="requirements" ${state.tab==='requirements'?'aria-current="page"':''}>Requirements</button><button data-tab="activity" ${state.tab==='activity'?'aria-current="page"':''}>Activity</button><button data-tab="workspace" ${state.tab==='workspace'?'aria-current="page"':''}>Workspace &amp; export</button></nav><div id="workspace-view"></div></div>`;
  renderView();
}
function renderView(){
  const target=document.querySelector('#workspace-view');
  if(state.tab==='activity'){
    target.innerHTML=`<p class="activity-intro">Changes, reviews and reminders recorded in this workspace. A reminder entry here does not mean an email was sent.</p>${activityList(state.dashboard.activity || [])}<p class="help">Last due-date check: ${esc(datetime(state.dashboard.scheduler?.lastRun))}. Next check: ${esc(datetime(state.dashboard.scheduler?.nextRun))}.</p><button class="text-button" data-action="refresh">Refresh activity</button>`;return;
  }
  if(state.tab==='workspace'){
    target.innerHTML=`<section class="workspace-settings"><h2>Your workspace</h2><dl class="definition-list"><div><dt>Workspace</dt><dd>${esc(state.me.workspace.name)}</dd></div><div><dt>Signed in as</dt><dd>${esc(state.me.user.email)}</dd></div><div><dt>Suppliers</dt><dd>${state.suppliers.length}</dd></div><div><dt>Email reminders</dt><dd>${state.dashboard.emailEnabled?'Transport enabled':'Off'}</dd></div><div><dt>Last due-date check</dt><dd>${esc(datetime(state.dashboard.scheduler?.lastRun))}</dd></div></dl><h2>Keep a copy of your records</h2><p>Export your workspace records and history. Document files are downloaded individually from each requirement's version history.</p><div class="actions"><button class="btn" data-action="download" data-path="export" data-filename="renewals-export.json">Export JSON</button><button class="btn" data-action="download" data-path="export?format=csv" data-filename="renewals-export.csv">Export CSV</button></div><h2>About this pilot</h2><p>You decide which documents to request and whether to approve them. Renewals tracks your decisions and dates; it does not verify insurance coverage, legal validity or compliance.</p><p>Need help with access, data or an account change? <a href="mailto:andrej@arling.sk">Contact Andrej</a>.</p></section>`;return;
  }
  const summary=state.dashboard.summary || {};
  const filters=[['all','All requirements',summary.total||0],['pending','Needs review',summary.pending||0],['expiring','Expiring soon',summary.expiring||0],['expired','Expired',summary.expired||0],['missing','Missing',summary.missing||0],['valid','Current',summary.valid||0]];
  target.innerHTML=`<div class="ledger-tools"><div class="search-wrap"><label class="help" for="search" hidden>Search supplier or document</label><input class="search" id="search" type="search" placeholder="Search supplier or document" aria-label="Search supplier or document" value="${esc(state.search)}"></div><div class="actions"><button class="btn quiet" data-action="refresh">Refresh</button><button class="btn" data-action="import">Import CSV</button></div></div><div class="ledger"><nav class="filters" aria-label="Filter requirements">${filters.map(([key,title,count])=>`<button data-filter="${key}" aria-pressed="${key===state.filter}"><span>${title}</span><span class="count">${count}</span></button>`).join('')}</nav><div class="ledger-content" id="ledger-rows"></div></div>`;
  renderRows();
}
function renderRows(){
  const all=state.dashboard.requirements || [],q=state.search.trim().toLowerCase();
  const rows=all.filter(r=>(state.filter==='all'||r.status===state.filter)&&(!q||(r.supplierName+' '+r.title+' '+(r.supplierEmail||'')).toLowerCase().includes(q)));
  document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.filter===state.filter)));
  const target=document.querySelector('#ledger-rows');
  if(!rows.length){target.innerHTML=`<div class="empty"><h2>${all.length?'No requirements match this view.':'Start with one document.'}</h2><p>${all.length?'Try another status or a different supplier name.':'Choose a supplier and name the document you need. Then create their private upload link.'}</p><button class="btn ${all.length?'':'primary'}" data-action="${all.length?'clear-filters':'add'}">${all.length?'Clear filters':'Add your first requirement'}</button>${!all.length?'<p class="help">Your supplier needs no account and uploads a PDF, JPEG or PNG up to 5 MB. Already have a spreadsheet? <button class="text-button" data-action="import">Import your CSV</button>.</p>':''}</div>`;return;}
  const hint=all.length===1?'<p class="onboard-hint">Next step: open the requirement, create the private upload link and send it to your supplier. The file that arrives waits for your review before it counts as approved.</p>':'';
  target.innerHTML=`${hint}<table class="table"><thead><tr><th scope="col">Supplier / document</th><th scope="col">Expiry date</th><th scope="col">Status</th><th scope="col"><span class="muted">Review</span></th></tr></thead><tbody>${rows.map(r=>`<tr><td><p class="supplier">${esc(r.supplierName)}</p><p class="document">${esc(r.title)}</p></td><td class="date">${esc(date(r.expiresOn))}</td><td>${status(r.status)}</td><td><button class="row-open" data-detail="${esc(r.id)}" aria-label="Open ${esc(r.title)} for ${esc(r.supplierName)}">Open <span aria-hidden="true">↗</span></button></td></tr>`).join('')}</tbody></table><div class="ledger-caption"><span role="status">${rows.length} of ${all.length} requirements</span><span>Uploaded files need your review before approval.</span></div>`;
}
function activityList(entries){return entries.length?`<ol class="activity-list">${entries.map(a=>`<li><time datetime="${esc(a.createdAt)}">${esc(datetime(a.createdAt))}</time><div><p class="type">${esc(String(a.type||'Workspace update').replaceAll('_',' '))}</p><p>${esc(a.message||'Workspace updated.')}</p></div></li>`).join('')}</ol>`:'<div class="empty"><h2>No activity yet.</h2><p>Changes and due-date reminders will appear here after you start adding requirements.</p></div>';}

function addDialog(){
  const existing=state.suppliers.length>0;
  openDialog('Add a requirement','Name the document you need from a supplier.',`<form id="requirement-form"><div class="field"><label for="supplier-select">Supplier</label><select name="supplierId" id="supplier-select"><option value="new">Create a supplier</option>${state.suppliers.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('')}</select>${existing?'<p class="help">Choose an existing supplier or create one here.</p>':''}</div><div id="new-supplier-fields" class="field-grid"><div class="field"><label for="supplier-name">Supplier name</label><input id="supplier-name" name="supplierName" required maxlength="160" placeholder="e.g. Northside Catering"></div><div class="field"><label for="supplier-email">Supplier email</label><input id="supplier-email" name="supplierEmail" type="email" required maxlength="254" placeholder="supplier@company.com"></div></div><div class="field"><label for="requirement-title">Document name</label><input id="requirement-title" name="title" required maxlength="160" placeholder="e.g. Public liability insurance"></div><div class="field"><label for="requirement-expiry">Known expiry date <span class="muted">(optional)</span></label><input id="requirement-expiry" name="expiresOn" type="date"><p class="help">Leave this empty if you do not know it yet. A date alone does not approve a document.</p></div><div class="actions actions-end"><button class="btn quiet" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">Add requirement</button></div>${errorLine}</form>`);
}
const csvSample='supplier,email,document,expires_on\nNorthside Catering,supplier@example.com,Public liability insurance,2027-06-30\n';
function importDialog(){openDialog('Import a CSV','Add up to 100 requirements from a spreadsheet.',`<p>Use these four column headings. Every row is checked before import; identical requirements are skipped.</p><pre class="import-example">supplier,email,document,expires_on</pre><div class="actions"><button class="btn small" data-action="csv-template">Download example CSV</button></div><form id="import-form"><div class="field import-file"><label for="csv-file">Choose a CSV file</label><input id="csv-file" type="file" accept=".csv,text/csv"></div><div class="field"><label for="csv-text">Or paste CSV text</label><textarea class="mono" id="csv-text" name="csv" rows="8" required placeholder="supplier,email,document,expires_on"></textarea><p class="help">Dates use YYYY-MM-DD. A blank expiry date is allowed. No invitations or emails are sent by this import.</p></div><div class="actions actions-end"><button class="btn quiet" type="button" data-action="close">Cancel</button><button class="btn primary" type="submit">Import requirements</button></div>${errorLine}<div id="import-result" aria-live="polite"></div></form>`);}

async function detailDialog(id){
  state.detail=id;state.invitation=null;
  openDialog('Requirement','Loading the document history…','<p role="status">Loading…</p>');
  try{const data=await api('requirements/'+encodeURIComponent(id)+'/versions');if(state.detail===id)renderDetail(data);}catch(error){openDialog('Could not open requirement','',`<p class="form-error" role="alert">${esc(error.message)}</p>`);}
}
function renderDetail(data){
  const r=data.requirement;state.detail=r.id;
  const versions=data.versions || [];
  const invitation=state.invitation?`<div class="invite-link"><input id="invitation-url" readonly aria-label="Private supplier upload link" value="${esc(state.invitation.url)}"><button class="btn" data-action="copy-invitation">Copy link</button></div><p class="help">Link expires ${esc(datetime(state.invitation.expiresAt))}. Anyone with this link can upload to this requirement.</p>`:'';
  openDialog(r.title,r.supplierName,`<div class="detail-meta">${status(r.status)}<span>Expiry: ${esc(date(r.expiresOn))}</span>${r.supplierEmail?`<span>${esc(r.supplierEmail)}</span>`:''}</div><section class="detail-section"><h3>Request a document</h3><p>Create a private link and share it with your supplier through your usual channel. This does not send an email.</p><div class="actions"><button class="btn" data-action="invitation">${state.invitation?'Replace upload link':'Create upload link'}</button><button class="text-button" data-action="revoke-invitation">Revoke upload links</button></div>${invitation}<p class="help">Creating a new link replaces the previous one.</p></section><section class="detail-section"><h3>Versions &amp; review</h3><p>A received file is pending until you review it. Approval records your decision; it does not verify the document's legal validity.</p>${versions.length?versions.map(v=>versionHtml(v,r)).join(''):'<div class="empty"><h2>No file received yet.</h2><p>Share an upload link with your supplier. Their first upload will appear here for review.</p></div>'}</section>${data.activity?.length?`<section class="detail-section"><h3>Requirement history</h3>${activityList(data.activity)}</section>`:''}`);
}
function versionHtml(v,r){return `<article class="version"><div class="version-head"><div><p class="version-name">${esc(v.fileName)}</p><p class="version-meta">Received ${esc(datetime(v.createdAt))} · ${esc(bytes(v.size || 0))}</p>${status(v.status)}</div><button class="btn small" data-action="download" data-path="versions/${esc(v.id)}/file" data-filename="${esc(v.fileName)}">Download</button></div>${v.reviewedAt?`<p class="help">Reviewed ${esc(datetime(v.reviewedAt))}. Expiry: ${esc(date(v.expiresOn))}.</p>`:''}${v.reviewNote?`<p class="version-note">${esc(v.reviewNote)}</p>`:''}${v.status==='pending'?`<form class="review-form" data-review="${esc(v.id)}"><p class="review-warning">Download and check the document before recording your decision.</p><div class="field-grid"><div class="field"><label for="decision-${esc(v.id)}">Your decision</label><select id="decision-${esc(v.id)}" name="decision"><option value="approved">Approve this version</option><option value="rejected">Reject this version</option></select></div><div class="field" data-expiry-field><label for="expiry-${esc(v.id)}">Confirmed expiry date</label><input id="expiry-${esc(v.id)}" name="expiresOn" type="date" min="${tomorrow()}" value="${esc(v.expiresOn || r.expiresOn || '')}" required></div></div><div class="field"><label for="review-note-${esc(v.id)}">Review note <span class="muted">(optional)</span></label><textarea id="review-note-${esc(v.id)}" name="note" maxlength="1000" rows="3" placeholder="What did you check, or what needs to change?"></textarea></div><button class="btn primary" type="submit">Record decision</button>${errorLine}</form>`:''}</article>`;}

async function portal(token){
  state.me=null;context.innerHTML='<span class="muted">Supplier upload</span>';
  try{
    const data=await api('portal',{portalToken:token}),r=data.requirement;
    main.innerHTML=`<section class="portal"><p class="eyebrow">Document requested by ${esc(data.workspaceName)}</p><h1>${esc(r.title)}</h1><p class="portal-intro">Upload the requested document for ${esc(r.supplierName)}. You do not need an account.</p><div class="portal-request"><dl><div><dt>Supplier</dt><dd>${esc(r.supplierName)}</dd></div><div><dt>Requested document</dt><dd>${esc(r.title)}</dd></div><div><dt>Current recorded expiry</dt><dd>${esc(date(r.expiresOn))}</dd></div><div><dt>This link expires</dt><dd>${esc(datetime(data.expiresAt))}</dd></div></dl></div><div id="portal-upload"><form id="portal-form" class="portal-form"><div class="field"><label for="document-file">Your document</label><input id="document-file" name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" required><p class="help">PDF, JPEG or PNG. Maximum 5 MB. Choose the document file, not a link.</p></div><div class="field"><label for="document-expiry">Expiry date shown on the document <span class="muted">(optional)</span></label><input id="document-expiry" name="expiresOn" type="date"><p class="help">If the document has no expiry date, leave this empty.</p></div><p class="portal-warning">The workspace owner will review your upload. Uploading a file does not mark it as approved or replace an approved version automatically.</p><button class="btn primary" type="submit">Upload for review</button>${errorLine}</form></div></section>`;
  }catch(error){main.innerHTML=`<section class="portal"><p class="eyebrow">Supplier upload</p><h1>This link is not available.</h1><p class="portal-intro">${esc(error.message)}</p><p class="muted">Ask the person who requested the document for a new upload link. No file has been uploaded.</p></section>`;}
}
function currentPortalToken(){return new URLSearchParams(location.hash.slice(1)).get('portal');}

document.addEventListener('submit',event=>{
  const form=event.target;if(!(form instanceof HTMLFormElement))return;event.preventDefault();
  if(form.id==='auth-form')return submit(form,async()=>{
    const data=Object.fromEntries(new FormData(form));if(new TextEncoder().encode(data.password).length>256)throw new Error('Use a password no longer than 256 bytes.');state.me=await api('auth/'+state.auth,{method:'POST',body:data});await loadWorkspace();
  });
  if(form.id==='requirement-form')return submit(form,async()=>{
    const data=Object.fromEntries(new FormData(form));let supplierId=data.supplierId;
    if(supplierId==='new'){const result=await api('suppliers',{method:'POST',body:{name:data.supplierName.trim(),email:data.supplierEmail.trim()}});supplierId=result.supplier.id;}
    await api('requirements',{method:'POST',body:{supplierId,title:data.title.trim(),expiresOn:data.expiresOn || null}});closeDialog();state.filter='all';state.search='';state.tab='requirements';await loadWorkspace();toast('Requirement added. Open it to create a supplier upload link.');
  });
  if(form.id==='import-form')return submit(form,async()=>{
    const data=await api('import',{method:'POST',body:{csv:form.elements.csv.value}});
    document.querySelector('#import-result').innerHTML=`<div class="import-results"><strong>Import complete</strong><p>${esc(data.created)} requirements added. ${esc(data.skipped)} duplicates skipped.</p></div>`;
    state.filter='all';state.search='';await loadWorkspace();toast('Your imported requirements are in the workspace.');
  });
  if(form.dataset.review)return submit(form,async()=>{
    const data=Object.fromEntries(new FormData(form)),id=state.detail;
    if(data.decision==='rejected')delete data.expiresOn;
    await api('versions/'+encodeURIComponent(form.dataset.review)+'/review',{method:'POST',body:data});
    await loadWorkspace();const detail=await api('requirements/'+encodeURIComponent(id)+'/versions');renderDetail(detail);toast(data.decision==='approved'?'Version approved. Your review is recorded.':'Version rejected. Your review is recorded.');
  });
  if(form.id==='portal-form')return submit(form,async()=>{
    const file=form.elements.file.files[0];if(!file)throw new Error('Choose a document first.');
    if(file.size>5*1024*1024)throw new Error('The file is larger than 5 MB. Choose a smaller file.');
    if(!['application/pdf','image/jpeg','image/png'].includes(file.type))throw new Error('Choose a PDF, JPEG or PNG file.');
    await api('portal/upload',{method:'POST',body:file,portalToken:currentPortalToken(),headers:{'Content-Type':file.type,'X-File-Name':encodeURIComponent(file.name),'X-Expires-On':form.elements.expiresOn.value}});
    document.querySelector('#portal-upload').innerHTML='<div class="portal-success" role="status"><p class="eyebrow">Upload received</p><h2>Your document is waiting for review.</h2><p>The workspace owner can now review this version. It has not been approved yet.</p><p>You can close this page.</p></div>';
  });
});

document.addEventListener('click',async event=>{
  const el=event.target.closest('button');if(!el)return;
  if(el.dataset.tab){state.tab=el.dataset.tab;renderWorkspace();document.querySelector(`[data-tab="${state.tab}"]`).focus();return;}
  if(el.dataset.filter){state.filter=el.dataset.filter;renderRows();return;}
  if(el.dataset.detail){await detailDialog(el.dataset.detail);return;}
  const action=el.dataset.action;if(!action)return;
  try{
    if(action==='auth-login'||action==='auth-register'){state.auth=action==='auth-login'?'login':'register';renderAuth();document.querySelector('[data-action="auth-'+state.auth+'"]').focus({preventScroll:true});}
    if(action==='add')addDialog();
    if(action==='import')importDialog();
    if(action==='close')closeDialog();
    if(action==='clear-filters'){state.filter='all';state.search='';renderView();document.querySelector('#search').focus();}
    if(action==='refresh'){el.disabled=true;await loadWorkspace();toast('Workspace refreshed.');}
    if(action==='logout'){await api('auth/logout',{method:'POST'});state.me=null;state.dashboard=null;state.auth='login';renderAuth();}
    if(action==='download'){el.disabled=true;const response=await connection.request(el.dataset.path);if(!response.ok)throw new Error('Download failed. Sign in again if your session has expired.');const href=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=href;a.download=el.dataset.filename.replace(/[\\/\x00-\x1f]/g,'_');a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
    if(action==='csv-template'){const blob=new Blob([csvSample],{type:'text/csv;charset=utf-8'}),href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download='renewals-example.csv';a.click();setTimeout(()=>URL.revokeObjectURL(href),1000);}
    if(action==='invitation'){
      el.disabled=true;state.invitation=await api('requirements/'+encodeURIComponent(state.detail)+'/invitation',{method:'POST'});
      const data=await api('requirements/'+encodeURIComponent(state.detail)+'/versions');renderDetail(data);toast('Upload link created. No email has been sent.');
    }
    if(action==='copy-invitation'){
      const field=document.querySelector('#invitation-url');
      try{await navigator.clipboard.writeText(field.value);toast('Private upload link copied. Share it only with this supplier.');}catch{field.focus();field.select();toast('Select and copy the highlighted link.');}
    }
    if(action==='revoke-invitation'){
      el.disabled=true;await api('requirements/'+encodeURIComponent(state.detail)+'/invitation',{method:'DELETE'});state.invitation=null;
      const data=await api('requirements/'+encodeURIComponent(state.detail)+'/versions');renderDetail(data);toast('Existing upload links for this requirement have been revoked.');
    }
  }catch(error){toast(error.message || 'Could not complete the action. Try again.',true);}finally{el.disabled=false;}
});
document.addEventListener('input',event=>{if(event.target.id==='search'){state.search=event.target.value;renderRows();}});
document.addEventListener('change',async event=>{
  const el=event.target;
  if(el.id==='supplier-select'){const box=document.querySelector('#new-supplier-fields'),isNew=el.value==='new';box.hidden=!isNew;box.querySelector('#supplier-name').required=isNew;box.querySelector('#supplier-email').required=isNew;box.querySelectorAll('input').forEach(input=>input.disabled=!isNew);}
  if(el.name==='decision'&&el.closest('[data-review]')){const box=el.form.querySelector('[data-expiry-field]'),approve=el.value==='approved';box.hidden=!approve;box.querySelector('input').required=approve;}
  if(el.id==='csv-file'&&el.files[0]){try{if(el.files[0].size>128*1024)throw new Error('Choose a CSV file no larger than 128 KB, with no more than 100 rows.');document.querySelector('#csv-text').value=await el.files[0].text();}catch(error){formError(el.form,error.message);}}
});
dialog.addEventListener('close',()=>{state.detail=null;state.invitation=null;});
async function start(){
  clearTimeout(noticeTimer);notice.hidden=true;
  const token=currentPortalToken();if(token){await portal(token);return;}
  try{state.me=await api('me');await loadWorkspace();}catch(error){if(error.status!==401&&error.status!==403)toast('The workspace could not be opened. '+error.message,true);state.me=null;renderAuth();}
}
window.addEventListener('hashchange',()=>{if(dialog.open)closeDialog();start();});
try{publicRegistration=(await api('access')).publicRegistration===true;}catch{}
start();
