import { CONFIG } from './config.js';
export class Cloud {
  constructor(session = null, onSession = () => {}) { this.session = session; this.onSession = onSession; this.refreshing = null; }
  async request(path, {method='GET',body,auth=true,headers={}} = {}) {
    if (auth) await this.fresh();
    const res = await fetch(CONFIG.supabaseUrl + path, {
      method, cache:'no-store', credentials:'omit', referrerPolicy:'no-referrer',
      headers:{apikey:CONFIG.publishableKey,'Content-Type':'application/json',...(auth ? {Authorization:`Bearer ${this.session.access_token}`} : {}),...headers},
      ...(body !== undefined ? {body:JSON.stringify(body)} : {}), signal:AbortSignal.timeout(20000)
    });
    const raw = await res.text();
    let data; try { data = raw ? JSON.parse(raw) : null; } catch { throw new Error('The cloud returned an unreadable response.'); }
    if (!res.ok) {
      const error = new Error(data?.msg || data?.error_description || data?.message || `Cloud request failed (${res.status}).`);
      error.status = res.status; throw error;
    }
    return data;
  }
  async setSession(session) {
    this.session = {...session, expires_at:session.expires_at || Math.floor(Date.now()/1000)+session.expires_in};
    await this.onSession(this.session); return this.session;
  }
  async fresh() {
    if (!this.session?.access_token) throw new Error('Please sign in again.');
    if (this.session.expires_at * 1000 > Date.now()+60000) return;
    if (!this.refreshing) this.refreshing = this.request('/auth/v1/token?grant_type=refresh_token',{method:'POST',auth:false,body:{refresh_token:this.session.refresh_token}}).then(s=>this.setSession(s)).finally(()=>{this.refreshing=null;});
    await this.refreshing;
  }
  async signIn(email,password) { return this.setSession(await this.request('/auth/v1/token?grant_type=password',{method:'POST',auth:false,body:{email,password}})); }
  async signUp(email,password) {
    const result = await this.request('/auth/v1/signup',{method:'POST',auth:false,body:{email,password}});
    if (result?.access_token) await this.setSession(result);
    return result;
  }
  async signOut() {
    try { if (this.session) await this.request('/auth/v1/logout?scope=local',{method:'POST'}); } finally {this.session=null;}
  }
  get uid() { return this.session?.user?.id; }
  async metadata() { return (await this.request(`/rest/v1/pocket_vault_meta?user_id=eq.${this.uid}&select=*`))[0] || null; }
  async createMetadata(meta) { return this.request('/rest/v1/pocket_vault_meta',{method:'POST',body:{user_id:this.uid,...meta},headers:{Prefer:'return=representation'}}); }
  async listItems() {
    const all = [];
    for (let offset=0; ;offset+=500) {
      const rows = await this.request(`/rest/v1/pocket_vault_items?user_id=eq.${this.uid}&select=*&order=id&limit=500&offset=${offset}`);
      all.push(...rows); if (rows.length<500) return all;
    }
  }
  async addItem(id, encrypted) {
    return (await this.request('/rest/v1/pocket_vault_items',{method:'POST',body:{id,user_id:this.uid,encrypted,revision:1},headers:{Prefer:'return=representation'}}))[0];
  }
  async updateItem(id,revision,encrypted) {
    const rows = await this.request(`/rest/v1/pocket_vault_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${this.uid}&revision=eq.${revision}`,{method:'PATCH',body:{encrypted,revision:revision+1,updated_at:new Date().toISOString()},headers:{Prefer:'return=representation'}});
    if (!rows?.length) throw new Error('This login changed on another device. Refresh the vault and try again.');
    return rows[0];
  }
  async deleteItem(id,revision) {
    const rows = await this.request(`/rest/v1/pocket_vault_items?id=eq.${encodeURIComponent(id)}&user_id=eq.${this.uid}&revision=eq.${revision}`,{method:'DELETE',headers:{Prefer:'return=representation'}});
    if (!rows?.length) throw new Error('This login changed on another device. Refresh before deleting.');
  }
}
