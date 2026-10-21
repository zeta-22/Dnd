// Sincronizzazione delle campagne con Supabase, con copia locale in IndexedDB.
//
// • Ogni pezzo della campagna (vedi store.js) è una riga di tavolo_entities.
// • Le modifiche locali vengono raccolte e inviate dopo pochi istanti, solo per i pezzi cambiati.
// • Gli aggiornamenti degli altri arrivano in tempo reale (Supabase Realtime); in più ogni
//   pochi secondi si confrontano i numeri di revisione, così nulla va perso se il tempo reale cade.
// • Se il cloud non è raggiungibile o non è configurato, tutto continua a funzionare in locale.

const ENTITY_TABLE = 'tavolo_entities';
const FLUSH_DELAY_MS = 300;
const RECONCILE_REALTIME_MS = 20000;
const RECONCILE_POLLING_MS = 4000;

const Sync = {
  mode: 'connecting',        // 'connecting' | 'cloud' | 'local' | 'setup' | 'offline' | 'locked'
  realtime: false,
  client: null,
  access: null,              // { protected, member, signedIn } dal database
  lastError: '',
  lastSyncAt: 0,
  activeId: null,
  channel: null,
  pending: {},               // campId → { dirty: Set, deleted: Set }
  inflight: {},              // campId → Set
  flushTimer: null,
  retryDelay: 0,
  reconcileTimer: null,
  localSaveTimers: {},
  reconnectTimer: null,
  onRemoteChange: null,      // (campId, keys) => void
  onStatusChange: null,      // () => void
  onCampaignGone: null,      // (campId) => void

  // -------------------------------------------------------------------------
  // Avvio e stato
  // -------------------------------------------------------------------------

  async init() {
    await this.loadLocalCampaigns();
    await this.connect();
    window.addEventListener('online', () => { if (this.mode !== 'cloud') this.connect(); else this.scheduleFlush(0); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.mode === 'cloud' && this.activeId) this.reconcile();
    });
  },

  async connect() {
    clearTimeout(this.reconnectTimer);
    if (!TAVOLO_CONFIG.supabaseUrl || !TAVOLO_CONFIG.supabaseKey) {
      this.setMode('local');
      return;
    }
    if (!window.supabase?.createClient) {
      this.lastError = 'Libreria Supabase non caricata (sei offline?)';
      this.setMode('offline');
      this.scheduleReconnect();
      return;
    }
    if (!this.client) {
      // La sessione (anonima) serve solo se il tavolo è protetto dal codice del gruppo
      this.client = window.supabase.createClient(TAVOLO_CONFIG.supabaseUrl, TAVOLO_CONFIG.supabaseKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'iltavolo-auth' }
      });
    }
    this.setMode('connecting');
    try {
      if (await this.checkAccess() === 'locked') {
        this.lastError = '';
        this.setMode('locked');
        return;
      }
      const { error } = await this.client.from(ENTITY_TABLE).select('campaign_id').limit(1);
      if (error) throw error;
      this.lastError = '';
      this.setMode('cloud');
      this.retryDelay = 0;
      if (this.activeId) await this.subscribe(this.activeId);
      this.scheduleFlush(0);
    } catch (err) {
      this.lastError = describeSupabaseError(err);
      if (isMissingTableError(err)) {
        this.setMode('setup');
      } else {
        this.setMode('offline');
        this.scheduleReconnect();
      }
    }
  },

  // 'open' se si può entrare, 'locked' se serve il codice del gruppo
  async checkAccess() {
    try {
      this.access = await this.rpc('tavolo_access', {});
    } catch (err) {
      // Database configurato con una versione precedente di setup.sql: nessun codice del gruppo
      if (err?.code === 'PGRST202' || /tavolo_access/.test(String(err?.message || ''))) {
        this.access = null;
        return 'open';
      }
      throw err;
    }
    return this.access.protected && !this.access.member ? 'locked' : 'open';
  },

  // Una risposta vuota può voler dire "non sei più nel gruppo" (codice cambiato): prima di
  // considerare cancellata un'avventura controlliamo di poterla ancora vedere
  async stillMember() {
    try {
      if (await this.checkAccess() === 'open') return true;
      this.setMode('locked');
    } catch (err) {
      // Nel dubbio non cancelliamo niente
    }
    return false;
  },

  async joinGroup(code) {
    if (!this.client) return { ok: false, reason: 'offline' };
    try {
      const { data } = await this.client.auth.getSession();
      if (!data?.session) {
        const { error } = await this.client.auth.signInAnonymously();
        if (error) {
          this.lastError = describeSupabaseError(error);
          return { ok: false, reason: isNetworkError(error) ? 'offline' : 'anon_disabled' };
        }
      }
      const res = await this.rpc('tavolo_join', { p_code: code });
      if (res.ok) await this.connect();
      return res;
    } catch (err) {
      this.lastError = describeSupabaseError(err);
      return { ok: false, reason: isNetworkError(err) ? 'offline' : 'error' };
    }
  },

  scheduleReconnect() {
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 20000);
  },

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'cloud') this.realtime = false;
    this.restartReconcileTimer();
    this.notifyStatus();
  },

  notifyStatus() {
    if (this.onStatusChange) this.onStatusChange();
  },

  isCloud() { return this.mode === 'cloud' && Boolean(this.client); },

  pendingCount() {
    // Le campagne solo locali non hanno niente da inviare
    let n = 0;
    Object.keys(this.pending).forEach(id => {
      if (Campaigns[id]?.synced) n += this.pending[id].dirty.size + this.pending[id].deleted.size;
    });
    Object.values(this.inflight).forEach(s => { n += s.size; });
    return n;
  },

  // -------------------------------------------------------------------------
  // Copia locale
  // -------------------------------------------------------------------------

  async loadLocalCampaigns() {
    const rows = await idbGetAll('campaigns');
    rows.forEach(row => {
      if (!row?.id || !row.ents) return;
      const ents = {};
      Object.keys(row.ents).forEach(k => { ents[k] = normalizeEntity(k, row.ents[k]); });
      Campaigns[row.id] = { id: row.id, ents, rev: row.rev || {}, synced: Boolean(row.synced) };
      // Modifiche fatte offline e mai inviate
      if (Array.isArray(row.dirty) && row.dirty.length) row.dirty.forEach(k => this.getPending(row.id).dirty.add(k));
      if (Array.isArray(row.deleted) && row.deleted.length) row.deleted.forEach(k => this.getPending(row.id).deleted.add(k));
    });
    // Campagne della prima versione salvate su questo dispositivo
    const legacy = await readLegacyLocalCampaigns();
    for (const old of legacy) {
      if (!old?.id || Campaigns[old.id]) continue;
      const conv = convertLegacyCampaign(old);
      Campaigns[old.id] = { id: old.id, ents: conv.ents, rev: {}, synced: false, legacy: true };
      await this.saveLocalVault(old.id, conv.password, conv.vault);
      await this.saveLocalNow(old.id);
    }
    if (legacy.length) Prefs.set('iltavolo_legacy_imported', '1');
  },

  scheduleLocalSave(campId) {
    clearTimeout(this.localSaveTimers[campId]);
    this.localSaveTimers[campId] = setTimeout(() => this.saveLocalNow(campId), 500);
  },

  async saveLocalNow(campId) {
    const camp = Campaigns[campId];
    if (!camp) return;
    const p = this.pending[campId];
    const inflight = this.inflight[campId];
    const dirty = new Set([...(p?.dirty || []), ...(inflight || [])]);
    await idbPut('campaigns', {
      id: camp.id, ents: camp.ents, rev: camp.rev, synced: camp.synced,
      dirty: [...dirty], deleted: [...(p?.deleted || [])], savedAt: Date.now()
    });
  },

  async forgetCampaign(campId) {
    delete Campaigns[campId];
    delete this.pending[campId];
    delete this.inflight[campId];
    await idbDelete('campaigns', campId);
    await idbDelete('vaults', campId);
  },

  // -------------------------------------------------------------------------
  // Modifiche locali
  // -------------------------------------------------------------------------

  getPending(campId) {
    if (!this.pending[campId]) this.pending[campId] = { dirty: new Set(), deleted: new Set() };
    return this.pending[campId];
  },

  isPending(campId, key) {
    const p = this.pending[campId];
    return Boolean(p && (p.dirty.has(key) || p.deleted.has(key))) || Boolean(this.inflight[campId]?.has(key));
  },

  put(campId, key, data) {
    const camp = Campaigns[campId];
    if (!camp) return;
    camp.ents[key] = data;
    this.touch(campId, key);
  },

  touch(campId, key) {
    const p = this.getPending(campId);
    p.deleted.delete(key);
    p.dirty.add(key);
    this.scheduleLocalSave(campId);
    this.scheduleFlush();
    this.notifyStatus();
  },

  remove(campId, key) {
    const camp = Campaigns[campId];
    if (!camp) return;
    delete camp.ents[key];
    const p = this.getPending(campId);
    p.dirty.delete(key);
    p.deleted.add(key);
    this.scheduleLocalSave(campId);
    this.scheduleFlush();
    this.notifyStatus();
  },

  scheduleFlush(delay = FLUSH_DELAY_MS) {
    clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), delay);
  },

  async flush() {
    if (!this.isCloud()) return;
    for (const campId of Object.keys(this.pending)) {
      const camp = Campaigns[campId];
      const p = this.pending[campId];
      if (!camp || !camp.synced || (!p.dirty.size && !p.deleted.size)) continue;
      const inflight = this.inflight[campId] || (this.inflight[campId] = new Set());
      const keys = [...p.dirty].filter(k => camp.ents[k] !== undefined && !inflight.has(k));
      const delKeys = [...p.deleted].filter(k => !inflight.has(k));
      keys.forEach(k => { p.dirty.delete(k); inflight.add(k); });
      delKeys.forEach(k => { p.deleted.delete(k); inflight.add(k); });
      try {
        for (let i = 0; i < keys.length; i += 40) {
          const chunk = keys.slice(i, i + 40);
          const rows = chunk.map(k => ({ campaign_id: campId, key: k, data: camp.ents[k], updated_by: DEVICE_ID }));
          const { data, error } = await this.client.from(ENTITY_TABLE).upsert(rows, { onConflict: 'campaign_id,key' }).select('key, rev');
          if (error) throw error;
          (data || []).forEach(r => { camp.rev[r.key] = Number(r.rev); });
          chunk.forEach(k => inflight.delete(k));
        }
        for (let i = 0; i < delKeys.length; i += 40) {
          const chunk = delKeys.slice(i, i + 40);
          const { error } = await this.client.from(ENTITY_TABLE).delete().eq('campaign_id', campId).in('key', chunk);
          if (error) throw error;
          chunk.forEach(k => { delete camp.rev[k]; inflight.delete(k); });
        }
        this.lastSyncAt = Date.now();
        this.lastError = '';
        this.retryDelay = 0;
      } catch (err) {
        // Rimetti in coda ciò che non è partito e riprova più tardi
        keys.forEach(k => { if (inflight.has(k)) { inflight.delete(k); p.dirty.add(k); } });
        delKeys.forEach(k => { if (inflight.has(k)) { inflight.delete(k); p.deleted.add(k); } });
        this.lastError = describeSupabaseError(err);
        this.retryDelay = Math.min(30000, (this.retryDelay || 1500) * 2);
        this.scheduleFlush(this.retryDelay);
        if (isNetworkError(err)) {
          this.setMode('offline');
          this.scheduleReconnect();
        } else if (err?.code === '42501') {
          // Scrittura rifiutata dal database: forse il codice del gruppo è cambiato
          await this.stillMember();
        }
      }
      this.scheduleLocalSave(campId);
    }
    this.notifyStatus();
  },

  // -------------------------------------------------------------------------
  // Lobby e apertura di una campagna
  // -------------------------------------------------------------------------

  // Elenco delle avventure: quelle nel cloud più quelle solo locali
  async fetchLobby() {
    const list = [];
    const seen = new Set();
    if (this.isCloud()) {
      try {
        const [metaRes, charRes] = await Promise.all([
          this.client.from(ENTITY_TABLE).select('campaign_id, data, rev').eq('key', 'meta').limit(500),
          this.client.from(ENTITY_TABLE).select('campaign_id, key, name:data->>name, isNpc:data->>isNpc, ownerId:data->>ownerId').like('key', 'char:%').limit(2000)
        ]);
        if (metaRes.error) throw metaRes.error;
        if (charRes.error) throw charRes.error;
        const charsByCamp = {};
        (charRes.data || []).forEach(r => {
          (charsByCamp[r.campaign_id] = charsByCamp[r.campaign_id] || []).push({
            id: r.key.slice(5), name: r.name || 'Senza nome', isNpc: r.isNpc === 'true', ownerId: r.ownerId || null
          });
        });
        (metaRes.data || []).forEach(r => {
          seen.add(r.campaign_id);
          list.push({ id: r.campaign_id, meta: normalizeMeta(r.data), pcs: (charsByCamp[r.campaign_id] || []).filter(c => !c.isNpc), source: 'cloud' });
          const local = Campaigns[r.campaign_id];
          if (local) local.synced = true;
        });
        // Campagne che conoscevamo dal cloud ma che sono state eliminate
        const gone = Object.values(Campaigns).filter(camp => camp.synced && !seen.has(camp.id) && !this.isPending(camp.id, 'meta'));
        if (gone.length && await this.stillMember()) {
          for (const camp of gone) {
            if (camp.id === this.activeId && this.onCampaignGone) this.onCampaignGone(camp.id);
            else await this.forgetCampaign(camp.id);
          }
        }
      } catch (err) {
        this.lastError = describeSupabaseError(err);
        if (isNetworkError(err)) { this.setMode('offline'); this.scheduleReconnect(); }
      }
    }
    Object.values(Campaigns).forEach(camp => {
      if (seen.has(camp.id)) return;
      const pcs = Object.keys(camp.ents).filter(k => k.startsWith('char:')).map(k => camp.ents[k]).filter(c => c && !c.isNpc)
        .map(c => ({ id: c.id, name: c.name, ownerId: c.ownerId }));
      list.push({ id: camp.id, meta: normalizeMeta(camp.ents.meta), pcs, source: camp.synced ? 'cache' : 'local' });
    });
    list.sort((a, b) => (b.meta.createdAt || 0) - (a.meta.createdAt || 0));
    return list;
  },

  // Scarica tutta la campagna dal cloud (se c'è) e si iscrive agli aggiornamenti
  async openCampaign(campId) {
    if (this.activeId && this.activeId !== campId) await this.closeCampaign();
    this.activeId = campId;
    let camp = Campaigns[campId];
    if (this.isCloud()) {
      try {
        const { data, error } = await this.client.from(ENTITY_TABLE).select('key, data, rev').eq('campaign_id', campId).limit(5000);
        if (error) throw error;
        if (data && data.length) {
          if (!camp) camp = Campaigns[campId] = { id: campId, ents: {}, rev: {}, synced: true };
          camp.synced = true;
          const remoteKeys = new Set();
          data.forEach(row => {
            remoteKeys.add(row.key);
            if (this.isPending(campId, row.key)) return;
            camp.ents[row.key] = normalizeEntity(row.key, row.data);
            camp.rev[row.key] = Number(row.rev);
          });
          Object.keys(camp.ents).forEach(k => {
            if (!remoteKeys.has(k) && !this.isPending(campId, k)) { delete camp.ents[k]; delete camp.rev[k]; }
          });
          this.scheduleLocalSave(campId);
        } else if (camp && camp.synced && await this.stillMember()) {
          await this.forgetCampaign(campId);
          this.activeId = null;
          return null;
        }
      } catch (err) {
        this.lastError = describeSupabaseError(err);
        if (isNetworkError(err)) { this.setMode('offline'); this.scheduleReconnect(); }
      }
      if (camp?.synced && this.isCloud()) await this.subscribe(campId);
    }
    if (!camp) { this.activeId = null; return null; }
    ['meta', 'scene', 'initmeta'].forEach(k => { camp.ents[k] = normalizeEntity(k, camp.ents[k] || {}); });
    this.restartReconcileTimer();
    this.scheduleFlush(0);
    return camp;
  },

  async closeCampaign() {
    await this.unsubscribe();
    this.activeId = null;
    this.restartReconcileTimer();
  },

  // -------------------------------------------------------------------------
  // Tempo reale e controllo periodico
  // -------------------------------------------------------------------------

  async subscribe(campId) {
    await this.unsubscribe();
    if (!this.isCloud()) return;
    const handleRow = (payload) => {
      const row = payload.new;
      if (!row || row.campaign_id !== campId || this.activeId !== campId) return;
      // Le righe grandi (immagine della mappa) possono arrivare troncate: le riscarichiamo
      if (row.key === 'map' || row.data === undefined || (payload.errors && payload.errors.length)) {
        this.fetchKeys(campId, [row.key]);
        return;
      }
      this.applyRemoteRows(campId, [row]);
    };
    const channel = this.client.channel(`tavolo-${campId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: ENTITY_TABLE, filter: `campaign_id=eq.${campId}` }, handleRow)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: ENTITY_TABLE, filter: `campaign_id=eq.${campId}` }, handleRow)
      // Le cancellazioni non si possono filtrare per colonna: arrivano tutte e scegliamo noi
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: ENTITY_TABLE }, (payload) => {
        const old = payload.old;
        if (!old || old.campaign_id !== campId || this.activeId !== campId) return;
        this.applyRemoteDeletes(campId, [old.key]);
      });
    this.channel = channel;
    channel.subscribe((status) => {
      if (this.channel !== channel) return;
      const live = status === 'SUBSCRIBED';
      if (live !== this.realtime) {
        this.realtime = live;
        this.restartReconcileTimer();
        this.notifyStatus();
        // Appena ci si (ri)collega, recupera ciò che può essere sfuggito
        if (live) this.reconcile();
      }
    });
  },

  async unsubscribe() {
    const ch = this.channel;
    this.channel = null;
    this.realtime = false;
    if (ch && this.client) {
      try { await this.client.removeChannel(ch); } catch (e) {}
    }
  },

  restartReconcileTimer() {
    clearInterval(this.reconcileTimer);
    this.reconcileTimer = null;
    if (this.mode !== 'cloud' || !this.activeId) return;
    this.reconcileTimer = setInterval(() => this.reconcile(), this.realtime ? RECONCILE_REALTIME_MS : RECONCILE_POLLING_MS);
  },

  // Confronta le revisioni con il server: scarica ciò che è cambiato, toglie ciò che è stato cancellato
  async reconcile() {
    const campId = this.activeId;
    const camp = Campaigns[campId];
    if (!this.isCloud() || !camp || !camp.synced || this.reconciling) return;
    this.reconciling = true;
    try {
      const { data, error } = await this.client.from(ENTITY_TABLE).select('key, rev').eq('campaign_id', campId).limit(5000);
      if (error) throw error;
      if (this.activeId !== campId) return;
      if (!data.length) {
        if (await this.stillMember() && this.activeId === campId && this.onCampaignGone) this.onCampaignGone(campId);
        return;
      }
      const remote = new Map(data.map(r => [r.key, Number(r.rev)]));
      const changed = [];
      remote.forEach((rev, key) => {
        if (!this.isPending(campId, key) && (camp.rev[key] === undefined || rev > camp.rev[key])) changed.push(key);
      });
      const gone = Object.keys(camp.ents).filter(k => !remote.has(k) && camp.rev[k] !== undefined && !this.isPending(campId, k));
      if (gone.length) this.applyRemoteDeletes(campId, gone);
      if (changed.length) await this.fetchKeys(campId, changed);
      this.lastSyncAt = Date.now();
    } catch (err) {
      this.lastError = describeSupabaseError(err);
      if (isNetworkError(err)) { this.setMode('offline'); this.scheduleReconnect(); }
    } finally {
      this.reconciling = false;
    }
  },

  async fetchKeys(campId, keys) {
    for (let i = 0; i < keys.length; i += 40) {
      const chunk = keys.slice(i, i + 40);
      const { data, error } = await this.client.from(ENTITY_TABLE).select('key, data, rev').eq('campaign_id', campId).in('key', chunk);
      if (error) { this.lastError = describeSupabaseError(error); return; }
      this.applyRemoteRows(campId, data || []);
    }
  },

  applyRemoteRows(campId, rows) {
    const camp = Campaigns[campId];
    if (!camp) return;
    const changed = [];
    rows.forEach(row => {
      const rev = Number(row.rev);
      if (this.isPending(campId, row.key)) return;
      if (camp.rev[row.key] !== undefined && rev <= camp.rev[row.key]) return;
      camp.ents[row.key] = normalizeEntity(row.key, row.data);
      camp.rev[row.key] = rev;
      changed.push(row.key);
    });
    if (!changed.length) return;
    this.lastSyncAt = Date.now();
    this.scheduleLocalSave(campId);
    if (this.onRemoteChange) this.onRemoteChange(campId, changed);
  },

  applyRemoteDeletes(campId, keys) {
    const camp = Campaigns[campId];
    if (!camp) return;
    const changed = keys.filter(k => camp.ents[k] !== undefined && !this.isPending(campId, k));
    changed.forEach(k => { delete camp.ents[k]; delete camp.rev[k]; });
    if (!changed.length) return;
    this.scheduleLocalSave(campId);
    if (this.onRemoteChange) this.onRemoteChange(campId, changed);
  },

  // -------------------------------------------------------------------------
  // Creazione e caricamento nel cloud
  // -------------------------------------------------------------------------

  async createCampaign(ents, password, vaultData) {
    const id = uid('camp');
    Campaigns[id] = { id, ents, rev: {}, synced: false };
    if (this.isCloud()) {
      const ok = await this.uploadCampaign(id, password, vaultData);
      if (ok) return id;
    }
    await this.saveLocalVault(id, password, vaultData);
    await this.saveLocalNow(id);
    return id;
  },

  async uploadCampaign(campId, password, vaultData) {
    const camp = Campaigns[campId];
    if (!camp || !this.isCloud()) return false;
    try {
      const keys = Object.keys(camp.ents);
      for (let i = 0; i < keys.length; i += 40) {
        const rows = keys.slice(i, i + 40).map(k => ({ campaign_id: campId, key: k, data: camp.ents[k], updated_by: DEVICE_ID }));
        const { data, error } = await this.client.from(ENTITY_TABLE).upsert(rows, { onConflict: 'campaign_id,key' }).select('key, rev');
        if (error) throw error;
        (data || []).forEach(r => { camp.rev[r.key] = Number(r.rev); });
      }
      const res = await this.rpc('tavolo_dm_create', { p_campaign: campId, p_password: password || '', p_data: normalizeVault(vaultData) });
      if (!res.ok && res.reason !== 'exists') throw new Error(res.reason || 'vault');
      camp.synced = true;
      delete this.pending[campId];
      await idbDelete('vaults', campId);
      await this.saveLocalNow(campId);
      return true;
    } catch (err) {
      this.lastError = describeSupabaseError(err);
      return false;
    }
  },

  // -------------------------------------------------------------------------
  // Cassaforte del Master
  // -------------------------------------------------------------------------

  async rpc(fn, params) {
    const { data, error } = await this.client.rpc(fn, params);
    if (error) throw error;
    return data || { ok: false, reason: 'empty' };
  },

  usesCloudVault(campId) {
    return this.isCloud() && Boolean(Campaigns[campId]?.synced);
  },

  async saveLocalVault(campId, password, data) {
    await idbPut('vaults', { id: campId, pwdHash: password ? await sha256Hex(password) : null, data: normalizeVault(data) });
  },

  // → { ok, data, hasPassword } oppure { ok:false, reason: 'wrong_password' | 'no_vault' | 'offline' }
  async openVault(campId, password) {
    if (this.usesCloudVault(campId)) {
      try {
        const res = await this.rpc('tavolo_dm_open', { p_campaign: campId, p_password: password || '' });
        if (res.ok) res.data = normalizeVault(res.data);
        return res;
      } catch (err) {
        this.lastError = describeSupabaseError(err);
        return { ok: false, reason: 'offline' };
      }
    }
    if (Campaigns[campId]?.synced) return { ok: false, reason: 'offline' };
    const v = await idbGet('vaults', campId);
    if (!v) return { ok: false, reason: 'no_vault' };
    if (v.pwdHash && v.pwdHash !== await sha256Hex(password || '')) return { ok: false, reason: 'wrong_password' };
    return { ok: true, data: normalizeVault(v.data), hasPassword: Boolean(v.pwdHash) };
  },

  // Crea la cassaforte se manca (avventura nata senza, o caricata da un file)
  async ensureVault(campId, password, data) {
    if (this.usesCloudVault(campId)) {
      try {
        return await this.rpc('tavolo_dm_create', { p_campaign: campId, p_password: password || '', p_data: normalizeVault(data) });
      } catch (err) {
        return { ok: false, reason: 'offline' };
      }
    }
    await this.saveLocalVault(campId, password, data);
    return { ok: true };
  },

  async saveVault(campId, password, data) {
    if (this.usesCloudVault(campId)) {
      try {
        return await this.rpc('tavolo_dm_save', { p_campaign: campId, p_password: password || '', p_data: normalizeVault(data) });
      } catch (err) {
        this.lastError = describeSupabaseError(err);
        return { ok: false, reason: 'offline' };
      }
    }
    const v = await idbGet('vaults', campId);
    await idbPut('vaults', { id: campId, pwdHash: v?.pwdHash || null, data: normalizeVault(data) });
    return { ok: true };
  },

  async setVaultPassword(campId, password, newPassword) {
    if (this.usesCloudVault(campId)) {
      try {
        const res = await this.rpc('tavolo_dm_set_password', { p_campaign: campId, p_password: password || '', p_new_password: newPassword || '' });
        // La funzione aggiorna anche meta.hasPassword: ricarichiamola subito
        if (res.ok) await this.fetchKeys(campId, ['meta']);
        return res;
      } catch (err) {
        return { ok: false, reason: 'offline' };
      }
    }
    const v = await idbGet('vaults', campId);
    if (v?.pwdHash && v.pwdHash !== await sha256Hex(password || '')) return { ok: false, reason: 'wrong_password' };
    await idbPut('vaults', { id: campId, pwdHash: newPassword ? await sha256Hex(newPassword) : null, data: normalizeVault(v?.data) });
    const camp = Campaigns[campId];
    if (camp?.ents.meta) { camp.ents.meta.hasPassword = Boolean(newPassword); this.touch(campId, 'meta'); }
    return { ok: true };
  },

  // -------------------------------------------------------------------------
  // Messaggi privati dei giocatori al Master
  // -------------------------------------------------------------------------

  async whisperDm(campId, id, fromName, fromChar, text) {
    if (!this.usesCloudVault(campId)) return { ok: false, reason: Campaigns[campId]?.synced ? 'offline' : 'local' };
    try {
      return await this.rpc('tavolo_whisper_dm', { p_campaign: campId, p_id: id, p_from_name: fromName || '', p_from_char: fromChar || '', p_text: text });
    } catch (err) {
      this.lastError = describeSupabaseError(err);
      return { ok: false, reason: 'offline' };
    }
  },

  async listDmInbox(campId, password) {
    if (!this.usesCloudVault(campId)) return { ok: true, items: [] };
    try {
      return await this.rpc('tavolo_dm_inbox_list', { p_campaign: campId, p_password: password || '' });
    } catch (err) {
      return { ok: false, reason: 'offline' };
    }
  },

  async deleteDmInbox(campId, password, id) {
    if (!this.usesCloudVault(campId)) return { ok: false, reason: 'local' };
    try {
      return await this.rpc('tavolo_dm_inbox_delete', { p_campaign: campId, p_password: password || '', p_id: id });
    } catch (err) {
      return { ok: false, reason: 'offline' };
    }
  },

  async deleteCampaign(campId, password) {
    if (this.usesCloudVault(campId)) {
      try {
        const res = await this.rpc('tavolo_delete_campaign', { p_campaign: campId, p_password: password || '' });
        if (!res.ok) return res;
      } catch (err) {
        return { ok: false, reason: 'offline' };
      }
    } else if (Campaigns[campId]?.synced) {
      return { ok: false, reason: 'offline' };
    }
    if (this.activeId === campId) await this.closeCampaign();
    await this.forgetCampaign(campId);
    return { ok: true };
  }
};

function isMissingTableError(err) {
  const code = err?.code || '';
  const msg = String(err?.message || '');
  return code === '42P01' || code === 'PGRST205' || code === 'PGRST202' || /tavolo_entities|schema cache|does not exist/i.test(msg) && !/fetch/i.test(msg);
}

function isNetworkError(err) {
  const msg = String(err?.message || err || '');
  return err instanceof TypeError || /fetch|network|Failed to|Load failed|timeout/i.test(msg);
}

function describeSupabaseError(err) {
  if (!err) return '';
  return String(err.message || err.details || err.hint || err.code || err).slice(0, 200);
}
