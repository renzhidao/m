
import { LifecycleManager } from './lifecycle.js';
import { MqttService } from './mqtt-service.js';
import { P2PService } from './p2p-service.js';

export function init() {
    console.log('📦 加载模块: Network (Modular v1 - 离线自愈/模块化)');

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

    // 核心控制器 (Facade)
    window.core = {
        lifecycle: null,
        mqtt: null,
        p2p: null,

        async init() {
            await window.util.syncTime();
            localStorage.setItem('p1_my_id', window.state.myId);
            await window.db.init();
            if (window.ui) window.ui.init();
            
            // 初始化子模块
            this.mqtt = new MqttService(this, CONFIG);
            this.p2p = new P2PService(this, CONFIG);
            this.lifecycle = new LifecycleManager(this, CONFIG);

            // 启动服务
            this.p2p.start();
            this.mqtt.start();
            this.lifecycle.start();

            this.loadHistory(20);
        },

        // --- 委托给子模块的方法 ---
        revive() { 
            if(!this.mqtt.client || !this.mqtt.client.isConnected()) this.mqtt.start();
            else this.mqtt.broadcastPresence();
            this.p2p.sendPing();
        },
        
        connectTo(id) { this.p2p.connectTo(id); },
        
        cleanup() { 
            const now = window.util.now();
            Object.keys(window.state.conns).forEach(pid => { 
                const c = window.state.conns[pid]; 
                if (!c.open && now - (c.created || 0) > CONFIG.timeouts.zombie) {
                    delete window.state.conns[pid];
                }
            });
        },

        // 消息发送
        async sendMsg(txt, kind='text') {
            const now = window.util.now();
            const pkt = { 
                t: 'MSG', id: window.util.uuid(), 
                n: window.state.myName, senderId: window.state.myId, 
                target: window.state.activeChat, txt, kind, ts: now, ttl: 16 
            };
            window.state.seenMsgs.add(pkt.id);
            if (window.ui) window.ui.appendMsg(pkt);
            window.db.saveMsg(pkt); 
            window.db.addPending(pkt); 
            this.retryPending();
        },

        async retryPending() {
            const list = await window.db.getPending(); 
            if (!list || list.length === 0) return;
            for (const pkt of list) {
                if (pkt.target === 'all') { 
                    this.flood(pkt, null); await window.db.removePending(pkt.id); 
                } else {
                    const direct = window.state.conns[pkt.target];
                    if (direct && direct.open) { 
                        direct.send(pkt); await window.db.removePending(pkt.id); 
                    } else { 
                        this.connectTo(pkt.target); 
                    }
                }
            }
        },

        flood(pkt, excludeId) {
            if (pkt.ttl <= 1) return; 
            pkt.ttl -= 1;
            Object.values(window.state.conns).forEach(c => { 
                if (c.open && c.peer !== excludeId) c.send(pkt); 
            });
        },

        exchange() {
            const all = Object.keys(window.state.conns); 
            if (all.length <= 1) return;
            const pkt = {t: 'PEER_EX', list: all.slice(0, 20)};
            Object.values(window.state.conns).forEach(c => { if (c.open) c.send(pkt); });
        },

        async loadHistory(limit) {
            if (window.state.loading) return; window.state.loading = true;
            const msgs = await window.db.getRecent(limit, window.state.activeChat);
            if (msgs && msgs.length > 0) { 
                msgs.forEach(m => { window.state.seenMsgs.add(m.id); if (window.ui) window.ui.appendMsg(m); }); 
            }
            window.state.loading = false;
        },
        
        // Hub 相关逻辑暂时保留在 Core 中，或后续拆分
        patrolHubs() {
            for(let i=0; i<CONFIG.hubs.count; i++) {
                const id = CONFIG.hubs.prefix + i;
                if (!window.state.conns[id] || !window.state.conns[id].open) this.connectTo(id);
            }
        },
        connectToAnyHub() {
           // (简化版实现，避免代码过长)
           const idx = Math.floor(Math.random() * CONFIG.hubs.count);
           this.connectTo(CONFIG.hubs.prefix + idx);
        }
    };
}
  