import { Cloud } from './api.js';
import { CookieCloud } from './cookie-api.js';
import * as V from './validation.js';
import { CONFIG } from './config.js';
import { deriveKey, newSalt, ITERATIONS, seal, open, exportKey, importKey, itemContext, verifierContext, generatePassword } from './crypto.js';
const $ = s => document.querySelector(s);
const extension = location.protocol === 'chrome-extension:';
if(window.top!==window.self || !isSecureContext) throw new V.ValidationError('Open the vault directly in a secure context.');
const cookieMode=!extension&&CONFIG.authMode==='cookie';
const cloud = cookieMode?new CookieCloud():new Cloud();
const originalFresh = cloud.fresh.bind(cloud);
cloud.fresh = async () => { if (extension && key) { const r = await ext({type:'SESSION'}); if(!r.session) { await lock(); throw new V.ValidationError('Extension locked. Sign in again.'); } cloud.session=r.session; } else await originalFresh(); };
let key=null, meta=null, entries=[], selected=null, editing=null, signup=false, epoch=0, activity=Date.now(), authStarted=Date.now(), accountDigest=null, revealTimer;
let currentView='vault', authBusy=false, unlockFailures=0, unlockAfter=0, loginAfter=0, loginFailures=0, pendingMfa=null, lastTouch=0;
const revealTimers=new Map();
const expired=()=>(CONFIG.idleMinutes>0&&Date.now()-activity>CONFIG.idleMinutes*60000)||Date.now()-authStarted>CONFIG.absoluteHours*3600000;
function requireUnlocked(){if(!key||expired()){lock().catch(()=>{});throw new V.ValidationError('Unlock your vault again.');}}
function notice(message,error=false) { const el=$('#status');el.textContent=message;el.classList.toggle('error',error);el.hidden=false;clearTimeout(notice.timer);notice.timer=setTimeout(()=>el.hidden=true,error?12000:5500); }
function report(e) { notice(e.name==='TimeoutError' ? 'Connection timed out. Please try again.' : V.safeMessage(e),true); }
function el(tag,cls,text) { const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node; }
async function busy(button,fn) { const label=button.textContent;button.disabled=true;button.textContent='Please wait…';try {await fn();}catch(e){report(e);}finally{button.disabled=false;button.textContent=label;}}
async function ext(message) { const r=await chrome.runtime.sendMessage(message);if(!r?.ok)throw new V.ValidationError(r?.error||'Extension is unavailable.');return r; }
function view(name) { currentView=name; for(const v of ['vault','extension','security'])$(`#${v}-view`).hidden=v!==name;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===name));$('#breadcrumb-title').textContent=name==='vault'?'My vault':name==='extension'?'Browser extension':'Security'; }
function hidePasswords(){for(const t of revealTimers.values())clearTimeout(t);revealTimers.clear(); for(const b of document.querySelectorAll('.show-password')){ $('#'+b.dataset.target).type='password'; b.textContent='Show'; } }
function renderState() { const signed=!!cloud.session;$('#auth-panel').hidden=signed;$('#mfa-panel').hidden=!pendingMfa;$('#unlock-panel').hidden=!signed||!!key||!!pendingMfa;$('#vault-content').hidden=!key;$('#new-login').disabled=!key;$('#lock').hidden=!signed;$('#export-backup').disabled=!key;$('#lock-status').textContent=key?'Vault unlocked':'Vault locked';$('#lock-status').classList.toggle('unlocked',!!key);$('#avatar').textContent=cloud.session?.user?.email?.[0]?.toUpperCase()||'P';$('#nav-count').textContent=key?entries.length:'—'; }
async function prepareUnlock() {
 const ticket=epoch,uid=cloud.uid;const loaded=await cloud.metadata();if(ticket!==epoch||cloud.session?.user?.id!==uid)return;
 meta=loaded;$('#unlock-email').textContent=cloud.session.user.email;$('#unlock-title').textContent=meta?'Unlock your vault':'Create your vault';$('#unlock-description').textContent=meta?'Enter your master password to decrypt your logins.':'Choose a separate master password for this vault.';$('#confirm-master-wrap').hidden=!!meta;$('#confirm-master').required=!meta;$('#master-password').minLength=meta?1:14;$('#master-password').value='';$('#confirm-master').value='';$('#unlock-submit').textContent=meta?'Unlock vault':'Create encrypted vault';renderState();$('#master-password').focus();
}
function eraseUI(){
 epoch++;key=null;meta=null;entries=[];selected=null;editing=null;pendingMfa=null;clearTimeout(revealTimer);accountDigest=null;
 $('#login-dialog').close();for(const f of document.querySelectorAll('form'))f.reset();$('#search').value='';$('#login-list').replaceChildren();$('#detail-panel').replaceChildren();$('#unlock-email').textContent='';hidePasswords();
}
async function lock() {
 const previous=cloud.session;let retired=null;if(!extension&&previous){retired=cookieMode?new CookieCloud():new Cloud(previous);if(cookieMode){retired.session=previous;retired.csrf=cloud.csrf;}}
 eraseUI();cloud.clear();renderState();notice('Vault locked.');
 try{if(extension){const r=await ext({type:'LOCK'});if(r.revoked===false)throw new V.ValidationError('Server sign-out not confirmed.');}else if(retired)await retired.signOut();}catch{notice('Local vault locked. Server sign-out could not be confirmed.',true);}
}
async function loadEntries() {
  const ticket=epoch, currentKey=key, uid=cloud.uid;
  if(!currentKey)return;requireUnlocked();
  $('#sync-label').textContent='Syncing…';
  try {
    const rows=await cloud.listItems();
    const values=await Promise.all(rows.map(async row=>({...row,value:V.login(await open(currentKey,row.encrypted,itemContext(uid,row.id)))})));
    if(ticket!==epoch)return;
    entries=values.sort((a,b)=>a.value.name.localeCompare(b.value.name));
    $('#sync-label').textContent='Synced just now';renderList();if(selected&&!entries.some(x=>x.id===selected))selected=null;renderDetail();renderState();
  }catch(e){if(ticket===epoch){$('#sync-label').textContent='Sync failed';throw e;}}
}
function renderList() {
  const q=$('#search').value.toLowerCase().trim();const list=$('#login-list');list.replaceChildren();
  const filtered=entries.filter(x=>[x.value.name,x.value.username,x.value.url].join(' ').toLowerCase().includes(q));
  $('#item-count').textContent=`${entries.length} ${entries.length===1?'login':'logins'}`;
  if(!filtered.length){const empty=el('div','empty-list',q?'No matching logins.':'Your vault is ready. Add a login or save one with the browser extension.');list.append(empty);return;}
  for(const entry of filtered){const b=el('button','login-row'+(entry.id===selected?' selected':''));b.type='button';b.setAttribute('aria-pressed',String(entry.id===selected));const icon=el('span','site-icon',entry.value.name[0]?.toUpperCase()||'•');const text=el('span','row-text');text.append(el('strong','',entry.value.name),el('small','',entry.value.username));b.append(icon,text,el('span','row-arrow','›'));b.addEventListener('click',()=>{selected=entry.id;renderList();renderDetail();});list.append(b);}
}
async function copy(value) { try{requireUnlocked();await navigator.clipboard.writeText(value);notice('Copied to clipboard.');}catch{notice('Clipboard permission is blocked. You can reveal and select the value.',true);} }
function renderDetail() {
  clearTimeout(revealTimer);const panel=$('#detail-panel');panel.replaceChildren();const item=entries.find(e=>e.id===selected);
  if(!item){const empty=el('div','detail-empty');empty.append(el('div','square-icon','⌑'),el('h2','','A place for every login'),el('p','','Select a login to see its details, or add your first one.'));panel.append(empty);return;}
  const v=item.value;const heading=el('div','detail-heading');const title=el('div');title.append(el('h2','',v.name),el('p','',v.url||'Saved login'));heading.append(el('div','site-icon',v.name[0]?.toUpperCase()||'•'),title);panel.append(heading);
  for(const [label,value,secret] of [['USERNAME',v.username,false],['PASSWORD',v.password,true],['WEBSITE',v.url,false],['NOTES',v.notes,false]]){
    if(!value)continue;const field=el('div','detail-field');const line=el('div','field-line');const text=el('span','field-value'+(secret?' secret':''),secret?'••••••••••••••••':value);line.append(text);
    if(secret){const toggle=el('button','text-button','Show');toggle.type='button';toggle.addEventListener('click',()=>{requireUnlocked();clearTimeout(revealTimer);const show=toggle.textContent==='Show';text.textContent=show?value:'••••••••••••••••';toggle.textContent=show?'Hide':'Show';if(show)revealTimer=setTimeout(()=>{text.textContent='••••••••••••••••';toggle.textContent='Show';},20000);});line.append(toggle);}
    if(label!=='NOTES'){const b=el('button','text-button','Copy');b.type='button';b.addEventListener('click',()=>copy(value));line.append(b);}
    field.append(el('div','field-label',label),line);panel.append(field);
  }
  const actions=el('div','detail-actions');const edit=el('button','button subtle','Edit login');edit.addEventListener('click',()=>editor(item));const remove=el('button','button subtle danger','Delete');remove.addEventListener('click',()=>{requireUnlocked();if(confirm(`Delete “${v.name}” from your cloud vault?`))busy(remove,async()=>{await cloud.deleteItem(item.id,item.revision);selected=null;await loadEntries();notice('Login deleted.');});});actions.append(edit,remove);panel.append(actions);
}
function editor(item=null) { if(!key)return;requireUnlocked();editing=item;$('#login-form').reset();$('#editor-error').textContent='';$('#editor-title').textContent=item?'Edit login':'Add a login';for(const f of ['name','url','username','password','notes'])$(`#entry-${f}`).value=item?.value[f]||'';$('#entry-password').type='password';document.querySelector('[data-target="entry-password"]').textContent='Show';$('#login-dialog').showModal();$('#entry-name').focus(); }
const digest = async p => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(p)))).join(',');
$('#auth-form').addEventListener('submit',e=>{e.preventDefault();busy($('#auth-submit'),async()=>{
  if(authBusy)throw new V.ValidationError('An authentication request is already running.');if(Date.now()<loginAfter)throw new V.ValidationError('Wait before trying to sign in again.');authBusy=true;$('#switch-auth').disabled=true;
  const ticket=epoch;const email=$('#email').value.trim();let password=$('#account-password').value;const hashed=await digest(password);let session;
  try {session=signup?await cloud.signUp(email,password):await cloud.signIn(email,password);loginFailures=0;loginAfter=0;}catch(e){loginFailures++;loginAfter=Date.now()+Math.min(60000,1000*2**Math.min(loginFailures,6));throw e;}finally{password='';$('#account-password').value='';authBusy=false;$('#switch-auth').disabled=false;}
  if(ticket!==epoch){cloud.clear();return;}accountDigest=hashed;authStarted=Date.now();activity=Date.now();
  if(!cloud.session){notice('Check your email to confirm your account, then return here and sign in.');signup=false;renderAuthMode();return;}
  if(cloud.session.user?.is_anonymous)throw new V.ValidationError('An email account is required.');
  const factor=cloud.session.user.factors?.find(f=>f.status==='verified'&&f.factor_type==='totp');if(cloud.session.user.factors?.length&&!factor)throw new V.ValidationError('This account requires an authentication factor that this app does not support.');if(factor){pendingMfa=factor.id;renderState();$('#mfa-code').focus();return;}
  await prepareUnlock();
});});
function renderAuthMode(){ $('#auth-title').textContent=signup?'Create your account':'Welcome back';$('#auth-description').textContent=signup?'Start with your email and an account password.':'Sign in to open your vault.';$('#auth-submit').textContent=signup?'Create account':'Sign in →';$('#switch-description').textContent=signup?'Already have an account?':'New here?';$('#switch-auth').textContent=signup?'Sign in':'Create an account';$('#account-password').minLength=signup?14:1;$('#account-password').autocomplete=signup?'new-password':'current-password'; }
$('#switch-auth').addEventListener('click',()=>{if(authBusy)return;signup=!signup;renderAuthMode();});
$('#unlock-form').addEventListener('submit',e=>{e.preventDefault();busy($('#unlock-submit'),async()=>{
  if(Date.now()<unlockAfter)throw new V.ValidationError('Wait before trying your master password again.');
  const ticket=epoch;const uid=cloud.uid;let password=$('#master-password').value;
  if(!meta&&password!==$('#confirm-master').value)throw new V.ValidationError('The master passwords do not match.');
  if(!meta&&password.length<14)throw new V.ValidationError('Use at least 14 characters for your master password.');
  if(!meta&&accountDigest&&await digest(password)===accountDigest)throw new V.ValidationError('Choose a master password different from your account password.');
  const salt=meta?.salt||newSalt();let derived;
  try{derived=await deriveKey(password,salt,meta?.iterations||ITERATIONS,extension);}finally{password='';$('#master-password').value='';$('#confirm-master').value='';}
  if(ticket!==epoch)return;
  if(meta){let check;try{check=await open(derived,meta.verifier,verifierContext(uid));}catch{unlockFailures++;unlockAfter=Date.now()+Math.min(60000,1000*2**Math.min(unlockFailures,6));throw new V.ValidationError('Incorrect master password, or damaged vault key settings.');}if(check?.check!=='pocket-vault-unlock-v1')throw new V.ValidationError('Vault verification failed.');}
  else {const created={salt,iterations:ITERATIONS,verifier:await seal(derived,{check:'pocket-vault-unlock-v1'},verifierContext(uid))};try{await cloud.createMetadata(created);meta=created;}catch(e){await prepareUnlock();throw e;}}
  if(ticket!==epoch)return;unlockFailures=0;unlockAfter=0;activity=Date.now();
  if(extension){await ext({type:'UNLOCK',session:cloud.session,jwk:await exportKey(derived)});if(ticket!==epoch){await ext({type:'LOCK'});return;}key=await importKey(await exportKey(derived));}else key=derived;
  renderState();await loadEntries();notice('Vault unlocked.');
});});
$('#login-form').addEventListener('submit',e=>{e.preventDefault();const b=$('#save-login');busy(b,async()=>{
  $('#editor-error').textContent='';const ticket=epoch;requireUnlocked();
  const value=V.login(Object.fromEntries(['name','url','username','password','notes'].map(f=>[f,$(`#entry-${f}`).value])));
  const id=editing?.id||crypto.randomUUID();const encrypted=await seal(key,value,itemContext(cloud.uid,id));if(ticket!==epoch)return;
  try{if(editing)await cloud.updateItem(id,editing.revision,encrypted);else await cloud.addItem(id,encrypted);}catch(e){$('#editor-error').textContent=V.safeMessage(e);throw e;}
  if(ticket!==epoch)return;$('#login-dialog').close();$('#login-form').reset();selected=id;await loadEntries();notice('Login encrypted and saved to the cloud.');
});});
$('#new-login').addEventListener('click',()=>editor());
for(const id of ['close-dialog','cancel-dialog'])$('#'+id).addEventListener('click',()=>{$('#login-dialog').close();$('#login-form').reset();editing=null;});
$('#login-dialog').addEventListener('close',()=>{$('#login-form').reset();editing=null;});
$('#generate').addEventListener('click',()=>{$('#entry-password').value=generatePassword();notice('Generated a 24-character password.');});
$('#search').addEventListener('input',()=>{if($('#search').value.length>320)$('#search').value=$('#search').value.slice(0,320);renderList();});
$('#refresh').addEventListener('click',()=>busy($('#refresh'),loadEntries));
$('#lock').addEventListener('click',()=>lock().catch(report));$('#sign-out').addEventListener('click',()=>lock(true).catch(report));
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>view(b.dataset.view));
for(const b of document.querySelectorAll('.show-password'))b.addEventListener('click',()=>{const field=$('#'+b.dataset.target);const show=field.type==='password';field.type=show?'text':'password';b.textContent=show?'Hide':'Show';clearTimeout(revealTimers.get(field.id));if(show)revealTimers.set(field.id,setTimeout(()=>{field.type='password';b.textContent='Show';},15000));});
$('#export-backup').addEventListener('click',()=>busy($('#export-backup'),async()=>{requireUnlocked();const ticket=epoch,uid=cloud.uid;const metadata=meta;const rows=await cloud.listItems();if(ticket!==epoch)return;requireUnlocked();const blob=new Blob([JSON.stringify({format:'pocket-vault-encrypted-backup-v1',user_id:uid,metadata,items:rows},null,2)],{type:'application/json'});const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download='pocket-vault-encrypted-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);notice('Encrypted backup downloaded.');}));
for(const event of ['pointerdown','keydown'])document.addEventListener(event,e=>{
 if(!e.isTrusted)return;if((key||cloud.session)&&expired()){lock().catch(report);return;}activity=Date.now();
 if(key&&Date.now()-lastTouch>30000){lastTouch=Date.now();if(extension)ext({type:'TOUCH'}).catch(()=>lock());else if(cookieMode)cloud.touch().catch(()=>lock());}
},{capture:true,passive:true});
setInterval(()=>{if((key||cloud.session)&&expired())lock().catch(report);},1000);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&(key||cloud.session)&&expired())lock().catch(report);else if(document.visibilityState==='hidden'){hidePasswords();if(key)renderDetail();}});
window.addEventListener('pagehide',()=>{eraseUI();cloud.clear();renderState();});
window.addEventListener('pageshow',e=>{if(e.persisted)location.reload();});
$('#mfa-form').addEventListener('submit',e=>{e.preventDefault();busy($('#mfa-submit'),async()=>{const ticket=epoch;const code=$('#mfa-code').value;$('#mfa-code').value='';await cloud.verifyMfa(pendingMfa,code);if(ticket!==epoch)return;pendingMfa=null;await prepareUnlock();});});
$('#enable-detection').addEventListener('click',async()=>{try{const granted=await chrome.permissions.request({origins:['https://*/*']});if(!granted)throw new V.ValidationError('Permission was not granted.');await ext({type:'ENABLE'});await detectionStatus();notice('Login detection enabled, including already-open HTTPS tabs.');}catch(e){report(e);}});
$('#disable-detection').addEventListener('click',async()=>{try{await ext({type:'DISABLE'});await chrome.permissions.remove({origins:['https://*/*']});await detectionStatus();notice('Login detection disabled.');}catch(e){report(e);}});
async function detectionStatus(){const r=await ext({type:'STATE'});$('#enable-detection').hidden=r.enabled;$('#disable-detection').hidden=!r.enabled;$('#detection-status').textContent=r.enabled?'Login detection is enabled for HTTPS websites.':'Login detection is off until you allow it.';}
async function init(){
  if(!crypto.subtle){notice('Open this website over HTTPS or localhost to use encryption.',true);$('#auth-submit').disabled=true;return;}
  if(cookieMode){await cloud.restore();if(cloud.session){authStarted=Date.now();activity=Date.now();const f=cloud.session.user.factors?.find(f=>f.factor_type==='totp'&&f.status==='verified');if(f)pendingMfa=f.id;else await prepareUnlock();}}
  if(extension){
    chrome.storage.onChanged.addListener((changes,area)=>{
      if(area!=='session'||!changes.unlock)return;
      const next=changes.unlock.newValue;
      if(!next || (cloud.session&&next.session.user.id!==cloud.session.user.id)){eraseUI();cloud.clear();renderState();}
      else if(key){cloud.session=V.session(next.session);activity=next.lastActive;authStarted=next.created;}
    });
    const ticket=epoch;$('#enable-detection').hidden=false;await detectionStatus();
    const r=await ext({type:'RESTORE'});if(ticket!==epoch)return;
    if(r.session&&r.jwk){
      const restored=await importKey(r.jwk);if(ticket!==epoch)return;
      cloud.session=V.session(r.session);key=restored;authStarted=r.created;activity=r.lastActive;
      const loaded=await cloud.metadata();if(ticket!==epoch)return;meta=loaded;await loadEntries();
    }
  }
  renderState();
}
init().catch(report);
