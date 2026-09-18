import * as V from './validation.js';
import {CloudError} from './api.js';
export class CookieCloud {
 constructor(){this.session=null;this.csrf=null;this.generation=0;this.controllers=new Set();}
 clear(){this.generation++;this.session=null;this.csrf=null;for(const c of this.controllers)c.abort();this.controllers.clear();}
 get uid(){return V.uuid(this.session?.user?.id);}
 async request(path,body,method='POST'){
  const generation=this.generation,ctl=new AbortController();this.controllers.add(ctl);const timeout=setTimeout(()=>ctl.abort(),20000);
  try{const r=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',redirect:'error',referrerPolicy:'no-referrer',headers:{'Content-Type':'application/json',...(method!=='GET'?{'X-Pocket-CSRF':this.csrf||''}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:ctl.signal});if(generation!==this.generation)throw new CloudError('Session ended.',401);const data=await r.json();if(generation!==this.generation)throw new CloudError('Session ended.',401);if(!r.ok)throw new CloudError(typeof data.error==='string'?data.error:'Request failed.',r.status);if(data.csrf)this.csrf=V.string(data.csrf,43,43,'CSRF token');return data;}finally{clearTimeout(timeout);this.controllers.delete(ctl);}
 }
 async restore(){const r=await this.request('session',undefined,'GET');this.session=r.session;return r;}
 async fresh(){if(!this.session)throw new CloudError('Please sign in again.',401);}
 async signIn(email,password){await this.restore();const r=await this.request('signin',V.credentials(email,password));this.session=r.session;return this.session;}
 async signUp(email,password){await this.restore();const r=await this.request('signup',V.credentials(email,password,true));this.session=r.session;return this.session||{confirmationRequired:true};}
 async verifyMfa(factorId,code){const r=await this.request('mfa',{factorId:V.uuid(factorId),code:V.string(code,6,6,'code')});this.session=r.session;return this.session;}
 async signOut(){const result=this.request('signout',{});try{await result;}finally{this.clear();this.csrf=null;}}
 async metadata(){const r=await this.request('meta',undefined,'GET');return r.value?V.metadataRow(r.value,this.uid):null;}
 async createMetadata(value){return this.request('meta',V.metadata(value));}
 async listItems(){const r=await this.request('items',undefined,'GET');if(!Array.isArray(r.items)||r.items.length>2000)throw new V.ValidationError('Invalid vault response.');return r.items.map(x=>V.itemRow(x,this.uid));}
 async addItem(id,encrypted){const r=await this.request('items',{id:V.uuid(id),encrypted:V.envelope(encrypted)});return V.itemRow(r.item,this.uid);}
 async updateItem(id,revision,encrypted){const r=await this.request('items',{id:V.uuid(id),revision:V.integer(revision),encrypted:V.envelope(encrypted)},'PATCH');return V.itemRow(r.item,this.uid);}
 async deleteItem(id,revision){return this.request('items',{id:V.uuid(id),revision:V.integer(revision)},'DELETE');}
 async touch(){if(this.session)await this.request('touch',{});}
}
