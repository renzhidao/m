export function init() {
    // 🟥 显式打印版本号，确保用户能看见
    const ver = '[v162 单文件修复版]';
    console.log(`📦 加载模块: Network ${ver}`);
    if(window.util) window.util.log(`📦 网络核心已加载 ${ver}`);

    const CONFIG = {
        peer: {
            host: 'peerjs.92k.de', port: 443, secure: true, path: '/',
            config: { iceServers: [
                {urls:'stun:stun.l.google.com:19302'},
                {urls:'stun:stun.qq.com:3478'}
            ]}
        },
        mqtt: {
            broker: "broker.emqx.io", port: 8084, path: "/mqtt",
            topic: "p1-chat/lobby/heartbeat-v3"
        },
        proxy: { host: "1od.dpdns.org" },
        hubs: { prefix: 'p1-hub-v3-', count: 5 },
        PING_INTERVAL: 3000,
        PRESENCE_INTERVAL: 30000,
        timeouts: { connection: 15000, zombie: 15000 }
    };

    // ==========================================
    // Class 1: Lifecycle (生命周期管理)
    // ==========================================
    class LifecycleManager {
        constructor(core) {
            this.core = core;
            this._lastVisibleTime = Date.now();
        }
        start() {
            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'visible') {
                    const timeAway = Date.now() - this._lastVisibleTime;
                    window.util.log(`⚡ 应用切回前台 (后台停留: ${(timeAway/1000).toFixed(1)}s)`);
                    this.core.revive();
                } else {
                    window.util.log(`💤 应用进入后台`);
                    this._lastVisibleTime = Date.now();
                }
            });
            // 心跳循环
            setInterval(() => this.core.heartbeatLoop(), CONFIG.PING_INTERVAL);
            // 强制广播循环
            setInterval(() => {
                if (document.visibilityState === 'visible') this.core.mqtt.broadcastPresence();
            }, CONFIG.PRESENCE_INTERVAL);
        }
    }

    // ==========================================
    // Class 2: MQTT Service (信令服务)
    // ==========================================
    class MqttService {
        constructor(core) {
            this.core = core;
            this.client = null;
        }
        start() {
            if (typeof Paho === 'undefined') { window.state.mqttStatus = '失败'; setTimeout(()=>this.start(), 3000); return; }
            if (this.client && this.client.isConnected()) return;

            let { broker, port, path } = CONFIG.mqtt;
            if (window.state.mqttFailCount > 0) {
                window.util.log(`🛡️ 启用 MQTT 代理`);
                broker = CONFIG.proxy.host; port = 443; path = `/https://${CONFIG.mqtt.broker}:${CONFIG.mqtt.port}${CONFIG.mqtt.path}`;
            }

            const cid = "mqtt_" + window.state.myId + "_" + Math.random().toString(36).slice(2,6);
            window.util.log(`📡 连接 MQTT...`);
            
            this.client = new Paho.MQTT.Client(broker, port, path, cid);
            window.state.mqttClient = this.client;

            this.client.onConnectionLost = (o) => {
                window.state.mqttStatus = '断开';
                window.state.mqttFailCount = (window.state.mqttFailCount || 0) + 1;
                window.util.log(`🔌 MQTT 断开: ${o.errorCode}`, 'err');
                if (window.ui) window.ui.updateSelf();
                setTimeout(() => this.start(), 3000 + Math.random()*2000);
            };

            this.client.onMessageArrived = (msg) => {
                try {
                    const d = JSON.parse(msg.payloadString);
                    if (Math.abs(window.util.now() - d.ts) > 120000) return;
                    if (d.type === 'HUB_PULSE') {
                        window.state.hubHeartbeats[d.hubIndex] = Date.now();
                        if (!window.state.conns[d.id] && Object.keys(window.state.conns).length < 5) this.core.connectTo(d.id);
                        return;
                    }
                    if (d.id === window.state.myId) return;
                    
                    const existing = window.state.conns[d.id];
                    if (!existing || !existing.open) {
                        window.util.log(`👋 MQTT 发现: ${d.id.slice(0,6)}`);
                        this.core.connectTo(d.id);
                    } else {
                        existing.send({t: 'PING'});
                    }
                } catch(e){}
            };

            this.client.connect({
                onSuccess: () => {
                    window.state.mqttStatus = '在线'; window.state.mqttFailCount = 0;
                    window.util.log(`✅ MQTT 连接成功!`);
                    if (window.ui) window.ui.updateSelf();
                    this.client.subscribe(CONFIG.mqtt.topic);
                    this.broadcastPresence();
                    setTimeout(()=>this.broadcastPresence(), 2000);
                },
                onFailure: (ctx) => {
                    window.state.mqttStatus = '失败';
                    window.state.mqttFailCount = (window.state.mqttFailCount || 0)+1;
                    window.util.log(`❌ MQTT 失败: ${ctx.errorMessage}`, 'err');
                    setTimeout(()=>this.start(), 5000);
                },
                useSSL: true, keepAliveInterval: 30, timeout: 10
            });
        }
        broadcastPresence() {
            if (this.client && this.client.isConnected()) {
                const msg = new Paho.MQTT.Message(JSON.stringify({ id: window.state.myId, ts: Date.now() }));
                msg.destinationName = CONFIG.mqtt.topic;
                this.client.send(msg);
            }
        }
        sendHubPulse() {
            if (this.client && this.client.isConnected()) {
                const msg = new Paho.MQTT.Message(JSON.stringify({ type: 'HUB_PULSE', id: window.state.myId, hubIndex: window.state.hubIndex, ts: Date.now() }));
                msg.destinationName = CONFIG.mqtt.topic;
                this.client.send(msg);
            }
        }
    }

    // ==========================================
    // Class 3: P2P Service (连接管理)
    // ==========================================
    class P2PService {
        constructor(core) {
            this.core = core;
            this.peer = null;
        }
        start() {
            if (this.peer && !this.peer.destroyed) return;
            window.util.log(` 启动 P2P...`);
            this.peer = new Peer(window.state.myId, CONFIG.peer);
            
            this.peer.on('open', id => {
                window.state.myId = id; window.state.peer = this.peer;
                window.util.log(`✅ P2P 就绪`);
                if (window.ui) window.ui.updateSelf();
                for(let i=0; i<CONFIG.hubs.count; i++) this.core.connectTo(CONFIG.hubs.prefix + i);
            });
            this.peer.on('connection', conn => this.setupConn(conn));
            this.peer.on('error', e => {
                if (e.type === 'peer-unavailable') return;
                window.util.log(`❌ P2P错误: ${e.type}`, 'err');
                if(['network', 'server-error', 'browser-incompatible'].includes(e.type)) setTimeout(()=>this.start(), 5000);
            });
            this.peer.on('disconnected', () => { window.util.log("⚠️ P2P 重连中..."); this.peer.reconnect(); });
        }
        setupConn(conn) {
            conn.on('open', () => {
                conn.lastPong = Date.now(); conn.created = Date.now();
                window.state.conns[conn.peer] = conn;
                window.util.log(`🔗 连接建立: ${conn.peer.slice(0,6)}`);
                
                const list = Object.keys(window.state.conns); list.push(window.state.myId);
                conn.send({t: 'HELLO', n: window.state.myName, id: window.state.myId});
                setTimeout(() => { if(conn.open) conn.send({t: 'PEER_EX', list}); }, 100);
                
                this.core.exchange(); this.core.retryPending();
                if (window.ui) window.ui.renderList();
            });
            conn.on('data', d => this.handleData(d, conn));
            const onGone = () => { 
                if(window.state.conns[conn.peer]) {
                    window.util.log(`🔌 连接断开: ${conn.peer.slice(0,6)}`);
                    delete window.state.conns[conn.peer];
                    if(window.ui) window.ui.renderList();
                }
            };
            conn.on('close', onGone); conn.on('error', onGone);
        }
        handleData(d, conn) {
            conn.lastPong = Date.now();
            if (!d || !d.t) return;
            if (d.t === 'PING') { conn.send({t: 'PONG'}); return; }
            if (d.t === 'PONG') return;
            if (d.t === 'HELLO') {
                conn.label = d.n;
                window.state.contacts[d.id] = {id: d.id, n: d.n, t: window.util.now()};
                localStorage.setItem('p1_contacts', JSON.stringify(window.state.contacts));
                if (window.ui) window.ui.renderList();
            }
            if (d.t === 'PEER_EX' && Array.isArray(d.list)) {
                d.list.forEach(id => {
                    if (id && id !== window.state.myId && !window.state.conns[id] && Math.random()>0.5) this.core.connectTo(id);
                });
            }
            if (d.t === 'MSG') this.core.handleMsg(d, conn);
        }
    }

    // ==========================================
    // Core Facade (核心总线)
    // ==========================================
    window.core = {
        init() {
            window.util.syncTime();
            this.mqtt = new MqttService(this);
            this.p2p = new P2PService(this);
            this.lifecycle = new LifecycleManager(this);
            
            this.p2p.start();
            this.mqtt.start();
            this.lifecycle.start();
            this.loadHistory(20);
        },
        revive() { 
            if(!this.mqtt.client || !this.mqtt.client.isConnected()) this.mqtt.start();
            else this.mqtt.broadcastPresence();
            this.sendPing();
        },
        connectTo(id) { 
            if (!id || id === window.state.myId || (window.state.conns[id] && window.state.conns[id].open)) return;
            try {
                const conn = this.p2p.peer.connect(id, {reliable: true});
                conn.created = window.util.now();
                window.state.conns[id] = conn;
                this.p2p.setupConn(conn);
            } catch(e) { window.util.log(`连接异常: ${e.message}`, 'err'); }
        },
        cleanup() {
            const now = window.util.now();
            Object.keys(window.state.conns).forEach(pid => { 
                const c = window.state.conns[pid]; 
                if (!c.open && now - (c.created || 0) > CONFIG.timeouts.zombie) delete window.state.conns[pid];
            });
        },
        sendPing() {
            const now = Date.now();
            Object.values(window.state.conns).forEach(c => {
                if (c.open) {
                    c.send({t: 'PING'});
                    if (c.lastPong && (now - c.lastPong > CONFIG.timeouts.connection)) {
                        if (now - (c.created || 0) < 10000) return; 
                        if (c.peer.startsWith(CONFIG.hubs.prefix)) return;
                        window.util.log(`💔 判定离线: ${c.peer.slice(0,6)}`);
                        c.close(); delete window.state.conns[c.peer]; if (window.ui) window.ui.renderList();
                        this.mqtt.broadcastPresence(); // 对方掉线，广播召唤
                    }
                }
            });
        },
        handleMsg(d, conn) {
            if (!d.id || window.state.seenMsgs.has(d.id)) return;
            window.state.seenMsgs.add(d.id);
            window.db.saveMsg(d);
            if (d.n) window.state.contacts[d.senderId] = { id: d.senderId, n: d.n, t: window.util.now() };
            
            const isPublic = d.target === 'all';
            if (isPublic || d.target === window.state.myId) {
                if (window.state.activeChat === (isPublic ? 'all' : d.senderId)) {
                    if (window.ui) window.ui.appendMsg(d);
                } else {
                    const key = isPublic ? 'all' : d.senderId;
                    window.state.unread[key] = (window.state.unread[key]||0)+1;
                    if (window.ui) window.ui.renderList();
                }
            }
            if (d.target === 'all') this.flood(d, conn.peer);
        },
        async sendMsg(txt, kind='text') {
            const now = window.util.now();
            const pkt = { t: 'MSG', id: window.util.uuid(), n: window.state.myName, senderId: window.state.myId, target: window.state.activeChat, txt, kind, ts: now, ttl: 16 };
            window.state.seenMsgs.add(pkt.id);
            if (window.ui) window.ui.appendMsg(pkt);
            window.db.saveMsg(pkt); window.db.addPending(pkt); this.retryPending();
        },
        async retryPending() {
            const list = await window.db.getPending(); if (!list || list.length === 0) return;
            for (const pkt of list) {
                if (pkt.target === 'all') { this.flood(pkt, null); await window.db.removePending(pkt.id); }
                else {
                    const direct = window.state.conns[pkt.target];
                    if (direct && direct.open) { direct.send(pkt); await window.db.removePending(pkt.id); }
                    else { this.connectTo(pkt.target); }
                }
            }
        },
        flood(pkt, excludeId) {
            if (pkt.ttl <= 1) return; pkt.ttl -= 1;
            Object.values(window.state.conns).forEach(c => { if (c.open && c.peer !== excludeId) c.send(pkt); });
        },
        exchange() {
            const all = Object.keys(window.state.conns); if (all.length <= 1) return;
            const pkt = {t: 'PEER_EX', list: all.slice(0, 20)};
            Object.values(window.state.conns).forEach(c => { if (c.open) c.send(pkt); });
        },
        async loadHistory(limit) {
            if (window.state.loading) return; window.state.loading = true;
            const msgs = await window.db.getRecent(limit, window.state.activeChat);
            if (msgs && msgs.length > 0) msgs.forEach(m => { window.state.seenMsgs.add(m.id); if (window.ui) window.ui.appendMsg(m); });
            window.state.loading = false;
        },
        // Hub logic (简化)
        patrolHubs() { for(let i=0; i<CONFIG.hubs.count; i++) { const id = CONFIG.hubs.prefix + i; if (!window.state.conns[id] || !window.state.conns[id].open) this.connectTo(id); } },
        connectToAnyHub() { const idx = Math.floor(Math.random() * CONFIG.hubs.count); this.connectTo(CONFIG.hubs.prefix + idx); },
        // 核心循环
        heartbeatLoop() {
            this.cleanup(); this.sendPing(); this.retryPending(); this.exchange();
            if (window.state.isHub) this.mqtt.sendHubPulse();
            else {
                if (window.state.mqttStatus === '在线') this.patrolHubs();
                else if (Object.keys(window.state.conns).length === 0) this.connectToAnyHub();
            }
        }
    };

    // 自动启动
    setTimeout(() => { if(window.core && window.core.init) window.core.init(); }, 100);
}