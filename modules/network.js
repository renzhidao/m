export function init() {
  console.log('📦 加载模块: Network (Configurable & Optimized)');

  const CFG = window.config;
  const HUB_PREFIX = CFG.hub.prefix;
  const HUB_COUNT = CFG.hub.count;

  window.core = {
    _searchLogShown: false,

    async init() {
      await window.util.syncTime();
      if (typeof Peer === 'undefined') { window.util.log("❌ PeerJS 未加载"); return; }
      localStorage.setItem('p1_my_id', window.state.myId);
      await window.db.init();
      if (window.ui) window.ui.init();
      this.loadHistory(20);
      
      this.startMainPeer();
      this.startMqtt();

      setTimeout(() => {
          if (!window.state.isHub && Object.keys(window.state.conns).length < 1) {
               if (window.state.mqttStatus === '在线') this.patrolHubs();
               else this.connectToAnyHub();
          }
      }, 2000); // 启动检查从5s缩短到2s

      setInterval(() => {
        this.cleanup();
        this.sendPing();
        this.retryPending();
        this.exchange();
        
        const now = Date.now();
        if (window.state.isHub) {
            if (window.state.mqttClient && window.state.mqttClient.isConnected()) {
                const payload = JSON.stringify({ type: 'HUB_PULSE', id: window.state.myId, hubIndex: window.state.hubIndex, ts: now });
                const msg = new Paho.MQTT.Message(payload);
                msg.destinationName = CFG.mqtt.topic;
                window.state.mqttClient.send(msg);
            }
        }
        if (!window.state.isHub) {
            if (window.state.mqttClient && window.state.mqttClient.isConnected()) {
                const payload = JSON.stringify({ id: window.state.myId, ts: now });
                const msg = new Paho.MQTT.Message(payload);
                msg.destinationName = CFG.mqtt.topic;
                window.state.mqttClient.send(msg);
            }
            if (window.state.mqttStatus === '在线') {
                this.patrolHubs();
            } else {
                this.connectToAnyHub();
            }
        }
      }, CFG.params.loop_interval);
    },

    startMainPeer() {
      if (window.state.peer && !window.state.peer.destroyed) return;
      window.util.log(`启动 P2P...`);
      const p = new Peer(window.state.myId, CFG.peer);
      p.on('open', id => {
        window.state.myId = id; window.state.peer = p;
        this._searchLogShown = false;
        window.util.log(`✅ 就绪: ${id.slice(0,6)}`);
        if (window.ui) window.ui.updateSelf();
        for(let i=0; i<HUB_COUNT; i++) this.connectTo(HUB_PREFIX + i);
      });
      p.on('connection', conn => this.setupConn(conn));
      p.on('error', e => { 
          if (e.type === 'peer-unavailable') return; 
          if (e.type === 'disconnected') {
              if (!this._searchLogShown) {
                  window.util.log(' 寻找节点中...');
                  this._searchLogShown = true;
              }
              return;
          }
          window.util.log(`PeerErr: ${e.type}`); 
          if(e.type === 'network' || e.type === 'server-error') setTimeout(() => this.startMainPeer(), 5000);
      });
    },

    startMqtt() {
      if (typeof Paho === 'undefined') { window.state.mqttStatus = '失败'; window.util.log('❌ MQTT库未加载'); setTimeout(() => this.startMqtt(), 3000); return; }
      
      let host = CFG.mqtt.broker;
      let port = Number(CFG.mqtt.port);
      let path = CFG.mqtt.path;
      
      if (window.state.mqttFailCount > 0) {
          window.util.log(`🛡️ 直连失败，切换代理`);
          host = CFG.mqtt.proxy_host;
          port = 443;
          path = `/https://${CFG.mqtt.broker}:${CFG.mqtt.port}${CFG.mqtt.path}`;
      }

      const cid = "mqtt_" + window.state.myId + "_" + Math.random().toString(36).slice(2,6);
      window.util.log(`连接MQTT: ${host}...`);
      const client = new Paho.MQTT.Client(host, port, path, cid);
      window.state.mqttClient = client;

      client.onConnectionLost = (o) => {
        window.state.mqttStatus = '断开';
        window.state.mqttFailCount = (window.state.mqttFailCount || 0) + 1;
        if (window.ui) window.ui.updateSelf();
        setTimeout(() => this.startMqtt(), 5000);
      };

      client.onMessageArrived = (msg) => {
        try {
          const d = JSON.parse(msg.payloadString);
          if (Math.abs(window.util.now() - d.ts) > 120000) return;

          if (d.type === 'HUB_PULSE') {
              window.state.hubHeartbeats[d.hubIndex] = Date.now();
              if (!window.state.conns[d.id] && Object.keys(window.state.conns).length < 5) {
                  this.connectTo(d.id);
              }
              return;
          }
          if (d.id === window.state.myId) return;
          const count = Object.keys(window.state.conns).filter(k => window.state.conns[k].open).length;
          if (!window.state.conns[d.id] && count < 6) this.connectTo(d.id);
        } catch(e){}
      };

      const opts = {
        onSuccess: () => {
          window.state.mqttStatus = '在线';
          window.state.mqttFailCount = 0;
          window.util.log(`✅ MQTT连通!`);
          if (window.ui) window.ui.updateSelf();
          client.subscribe(CFG.mqtt.topic);
          const sendPresence = () => {
              const payload = JSON.stringify({ id: window.state.myId, ts: Date.now() });
              const msg = new Paho.MQTT.Message(payload);
              msg.destinationName = CFG.mqtt.topic;
              client.send(msg);
          };
          sendPresence();
          setTimeout(sendPresence, 1500);
          setTimeout(sendPresence, 4000);
          if (host === CFG.mqtt.proxy_host) setInterval(sendPresence, 10000);
        },
        onFailure: (ctx) => {
          window.state.mqttStatus = '失败';
          window.state.mqttFailCount = (window.state.mqttFailCount || 0) + 1;
          window.util.log(`❌ MQTT失败: ${ctx.errorMessage}`);
          if (window.ui) window.ui.updateSelf();
          setTimeout(() => this.startMqtt(), 5000);
        },
        useSSL: true, 
        timeout: (window.state.mqttFailCount > 0 ? 10 : 3)
      };
      client.connect(opts);
    },

    patrolHubs() {
      for(let i=0; i<HUB_COUNT; i++) {
          const targetId = HUB_PREFIX + i;
          if (!window.state.conns[targetId] || !window.state.conns[targetId].open) {
              this.connectTo(targetId);
          }
      }
    },

    connectToAnyHub() {
      if (window.state.isHub || window.state.hubPeer) return;
      if (this._connectingHub) return;
      for(let i=0; i<HUB_COUNT; i++) {
          if (window.state.conns[HUB_PREFIX + i] && window.state.conns[HUB_PREFIX + i].open) return;
      }

      this._connectingHub = true;
      const idx = Math.floor(Math.random() * HUB_COUNT);
      const targetId = HUB_PREFIX + idx;
      
      window.util.log(`🔍 寻找房主 #${idx}...`);
      this.connectTo(targetId);
      setTimeout(() => {
           this._connectingHub = false;
           if (window.state.isHub) return;
           const conn = window.state.conns[targetId];
           if (!conn || !conn.open) {
               window.util.log(`⚓ 建立据点 #${idx}`);
               this.becomeHub(idx);
           }
      }, 2500);
    },

    becomeHub(index) {
      if (window.state.hubPeer || window.state.isHub) return;
      const id = HUB_PREFIX + index;
      const p = new Peer(id, CFG.peer);
      p.on('open', () => {
          window.state.hubPeer = p; window.state.isHub = true; window.state.hubIndex = index; window.state.hubStatus = '房主';
          window.state.hubHeartbeats[index] = Date.now(); 
          if (window.ui) window.ui.updateSelf();
          window.util.log(`👑 据点建立成功 #${index}`);
      });
      p.on('connection', conn => {
          conn.on('open', () => {
              const list = Object.keys(window.state.conns); list.push(window.state.myId);
              conn.send({t: 'PEER_EX', list: list});
              const newPeer = conn.peer;
              Object.values(window.state.conns).forEach(c => {
                  if (c.open && c.peer !== newPeer) c.send({t: 'PEER_EX', list: [newPeer]});
              });
          });
          conn.on('data', d => { if (d.t === 'HELLO') this.connectTo(d.id); });
      });
      p.on('error', (e) => { 
          window.state.isHub = false; window.state.hubPeer = null; 
          if (e.type === 'unavailable-id') this.connectTo(id);
      });
    },

    connectTo(id) {
      if (!id || id === window.state.myId) return;
      if (window.state.conns[id] && window.state.conns[id].open) return;
      try {
        const conn = window.state.peer.connect(id, {reliable: true});
        conn.created = window.util.now();
        window.state.conns[id] = conn;
        this.setupConn(conn);
      } catch(e) { }
    },

    setupConn(conn) {
      const max = window.state.isHub ? CFG.hub.max_peers_hub : CFG.hub.max_peers_normal;
      if (Object.keys(window.state.conns).length >= max) {
          conn.on('open', () => {
               conn.send({t: 'PEER_EX', list: Object.keys(window.state.conns).slice(0,10)});
               setTimeout(() => conn.close(), 500);
          });
          return;
      }
      conn.on('open', () => {
        conn.lastPong = Date.now();
        conn.created = Date.now(); 
        window.state.conns[conn.peer] = conn;
        window.util.log(`🔗 连接成功: ${conn.peer.slice(0,6)}`);
        const list = Object.keys(window.state.conns); list.push(window.state.myId);
        conn.send({t: 'HELLO', n: window.state.myName, id: window.state.myId});
        
        // 新增：连接建立后，请求最近缺失的公共消息
        window.db.getRecent(1, 'all').then(m => {
            const lastTs = (m && m.length) ? m[0].ts : 0;
            // 延时一下，确保对方准备好
            setTimeout(() => {
                if(conn.open) conn.send({t: 'ASK_PUB', ts: lastTs});
            }, 500);
        });

        setTimeout(() => { if(conn.open) conn.send({t: 'PEER_EX', list: list}); }, 100);
        this.exchange(); this.retryPending();
        if (window.ui) window.ui.renderList();
      });
      conn.on('data', d => this.handleData(d, conn));
      const onGone = () => { 
        const peerId = conn.peer;
        delete window.state.conns[peerId]; 
        if (window.ui) window.ui.renderList();
        if (!peerId.startsWith(CFG.hub.prefix)) {
            // 极速模式：200毫秒后重连
            setTimeout(() => this.connectTo(peerId), 200);
        }
      };
      conn.on('close', onGone); conn.on('error', onGone);
    },

    async handleData(d, conn) {
      conn.lastPong = Date.now();
      if (!d || !d.t) return;
      if (d.t === 'PING') { conn.send({t: 'PONG'}); return; }
      if (d.t === 'PONG') return;
      if (d.t === 'HELLO') {
        conn.label = d.n;
        window.state.contacts[d.id] = {id: d.id, n: d.n, t: window.util.now()};
        localStorage.setItem('p1_contacts', JSON.stringify(window.state.contacts));
        if (window.ui) window.ui.renderList();
        return;
      }
      if (d.t === 'PEER_EX' && Array.isArray(d.list)) {
          d.list.forEach(id => {
              if (id && id !== window.state.myId && !window.state.conns[id]) {
                  this.connectTo(id);
              }
          });
          return;
      }
      
      // 新增：处理历史记录请求
      if (d.t === 'ASK_PUB') {
          // 对方请求 d.ts 之后的公共消息
          const list = await window.db.getPublicAfter(d.ts || 0);
          if (list.length > 0) conn.send({t: 'REP_PUB', list: list});
          return;
      }
      // 新增：接收历史记录回复
      if (d.t === 'REP_PUB' && Array.isArray(d.list)) {
          d.list.forEach(m => {
              if (!window.state.seenMsgs.has(m.id)) {
                  window.state.seenMsgs.add(m.id);
                  window.db.saveMsg(m);
                  if (window.state.activeChat === 'all') window.ui.appendMsg(m);
                  else window.state.unread['all'] = (window.state.unread['all']||0)+1;
              }
          });
          if (window.ui) window.ui.renderList();
          return;
      }

      if (d.t === 'MSG') {
        if (!d.id || window.state.seenMsgs.has(d.id)) return;
        window.state.seenMsgs.add(d.id);
        d.ts = d.ts || (window.state.latestTs + 1);
        window.state.latestTs = Math.max(window.state.latestTs, d.ts);
        if (d.n) {
          window.state.contacts[d.senderId] = { id: d.senderId, n: d.n, t: window.util.now() };
          localStorage.setItem('p1_contacts', JSON.stringify(window.state.contacts));
        }
        const isPublic = d.target === 'all';
        const isToMe = d.target === window.state.myId;
        if (isPublic || isToMe) {
          const chatKey = isPublic ? 'all' : d.senderId;
          if (window.state.activeChat === chatKey) { if (window.ui) window.ui.appendMsg(d); }
          else { window.state.unread[chatKey] = (window.state.unread[chatKey]||0)+1; if (window.ui) window.ui.renderList(); }
        }
        window.db.saveMsg(d);
        if (d.target === 'all') this.flood(d, conn.peer);
      }
    },

    flood(pkt, excludePeerId) {
      if (typeof pkt.ttl === 'number') { if (pkt.ttl <= 1) return; pkt = Object.assign({}, pkt, { ttl: pkt.ttl - 1 }); }
      Object.values(window.state.conns).forEach(c => { if (c.open && c.peer !== excludePeerId) c.send(pkt); });
    },

    async sendMsg(txt, kind='text') {
      const now = window.util.now();
      if (now - window.state.lastMsgTime < 1000) { window.state.msgCount++; if (window.state.msgCount > 5) { window.util.log('⚠️ 发送太快'); return; } } else { window.state.msgCount = 0; window.state.lastMsgTime = now; }
      const pkt = { t: 'MSG', id: window.util.uuid(), n: window.state.myName, senderId: window.state.myId, target: window.state.activeChat, txt: txt, kind: kind, ts: now, ttl: CFG.params.ttl };
      window.state.seenMsgs.add(pkt.id); window.state.latestTs = Math.max(window.state.latestTs, pkt.ts);
      if (window.ui) window.ui.appendMsg(pkt);
      window.db.saveMsg(pkt); window.db.addPending(pkt); this.retryPending();
    },

    async retryPending() {
      const list = await window.db.getPending(); if (!list || list.length === 0) return;
      for (let i = 0; i < list.length; i++) {
        const pkt = list[i];
        if (pkt.target === 'all') { this.flood(pkt, null); await window.db.removePending(pkt.id); } else {
          const direct = window.state.conns[pkt.target];
          if (direct && direct.open) { direct.send(pkt); await window.db.removePending(pkt.id); } else { this.connectTo(pkt.target); }
        }
      }
    },
    
    sendPing() { 
      const now = Date.now();
      Object.values(window.state.conns).forEach(c => { 
          if (c.open) {
              c.send({t: 'PING'});
              // 极速模式：5秒无响应判定离线
              if (c.lastPong && (now - c.lastPong > 5000)) {
                  if (now - (c.created || 0) < CFG.params.conn_timeout) return; 
                  if (c.peer.startsWith(CFG.hub.prefix)) return;    
                  
                  window.util.log(`💔 判定离线: ${c.peer.slice(0,6)}`);
                  c.close();
                  delete window.state.conns[c.peer];
                  if (window.ui) window.ui.renderList();
              }
          }
      }); 
    },
    
    cleanup() {
      const now = window.util.now();
      Object.keys(window.state.conns).forEach(pid => { 
          const c = window.state.conns[pid]; 
          if (!c.open && now - (c.created || 0) > CFG.params.conn_timeout) {
              delete window.state.conns[pid];
          }
          if (c.open && c.lastPong && (now - c.lastPong > CFG.params.ping_timeout) && !pid.startsWith(CFG.hub.prefix)) {
              c.close();
              delete window.state.conns[pid];
          }
      });
      if (window.ui) window.ui.renderList();
    },
    
    exchange() {
      const all = Object.keys(window.state.conns); if (all.length===0) return;
      for (let i=all.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [all[i], all[j]] = [all[j], all[i]]; }
      const pkt = {t: 'PEER_EX', list: all.slice(0, CFG.params.gossip_size)};
      Object.values(window.state.conns).forEach(c => { if (c.open) c.send(pkt); });
    },
    async loadHistory(limit) {
      if (window.state.loading) return; window.state.loading = true;
      const msgs = await window.db.getRecent(limit, window.state.activeChat, window.state.oldestTs);
      if (msgs && msgs.length > 0) { window.state.oldestTs = msgs[0].ts; msgs.forEach(m => { window.state.seenMsgs.add(m.id); if (window.ui) window.ui.appendMsg(m); }); }
      window.state.loading = false;
    }
  };
}