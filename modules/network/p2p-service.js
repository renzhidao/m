
// p2p-service.js - 负责 PeerJS 连接、Hub逻辑、消息收发
export class P2PService {
    constructor(core, config) {
        this.core = core;
        this.config = config;
        this.peer = null;
        this._connectingHub = false;
    }

    start() {
        if (this.peer && !this.peer.destroyed) return;
        window.util.log(`🚀 启动 P2P (ID: ${window.state.myId.slice(0,6)})...`);

        this.peer = new Peer(window.state.myId, this.config.peer);
        
        this.peer.on('open', id => {
            window.state.myId = id; window.state.peer = this.peer;
            window.util.log(`✅ P2P 就绪`);
            if (window.ui) window.ui.updateSelf();
            // 启动后立即连预设 Hub
            for(let i=0; i<this.config.hubs.count; i++) this.connectTo(this.config.hubs.prefix + i);
        });

        this.peer.on('connection', conn => this.setupConn(conn));
        
        this.peer.on('error', e => {
            if (e.type === 'peer-unavailable') return;
            window.util.log(`❌ P2P错误: ${e.type}`, 'err');
            if(['network', 'server-error', 'browser-incompatible'].includes(e.type)) {
                setTimeout(() => this.start(), 5000);
            }
        });

        this.peer.on('disconnected', () => {
            window.util.log("⚠️ P2P 断开，重连中...");
            this.peer.reconnect();
        });
    }

    connectTo(id) {
        if (!id || id === window.state.myId) return;
        if (window.state.conns[id] && window.state.conns[id].open) return;
        
        try {
            const conn = this.peer.connect(id, {reliable: true});
            conn.created = window.util.now();
            window.state.conns[id] = conn;
            this.setupConn(conn);
        } catch(e) { window.util.log(`连接异常: ${e.message}`, 'err'); }
    }

    setupConn(conn) {
        conn.on('open', () => {
            conn.lastPong = Date.now();
            conn.created = Date.now();
            window.state.conns[conn.peer] = conn;
            window.util.log(`🔗 连接建立: ${conn.peer.slice(0,6)}`);
            
            // 握手
            const list = Object.keys(window.state.conns); list.push(window.state.myId);
            conn.send({t: 'HELLO', n: window.state.myName, id: window.state.myId});
            setTimeout(() => { if(conn.open) conn.send({t: 'PEER_EX', list}); }, 100);
            
            this.core.exchange();
            this.core.retryPending();
            if (window.ui) window.ui.renderList();
        });

        conn.on('data', d => this.handleData(d, conn));
        
        const onGone = () => {
            if (window.state.conns[conn.peer]) {
                window.util.log(`🔌 连接断开: ${conn.peer.slice(0,6)}`);
                delete window.state.conns[conn.peer];
                if (window.ui) window.ui.renderList();
            }
        };
        conn.on('close', onGone);
        conn.on('error', onGone);
    }

    handleData(d, conn) {
        conn.lastPong = Date.now();
        if (!d || !d.t) return;
        
        switch(d.t) {
            case 'PING': conn.send({t: 'PONG'}); break;
            case 'PONG': break;
            case 'HELLO':
                conn.label = d.n;
                window.state.contacts[d.id] = {id: d.id, n: d.n, t: window.util.now()};
                localStorage.setItem('p1_contacts', JSON.stringify(window.state.contacts));
                if (window.ui) window.ui.renderList();
                break;
            case 'PEER_EX':
                if(Array.isArray(d.list)) {
                    d.list.forEach(id => {
                        if (id && id !== window.state.myId && !window.state.conns[id]) {
                            if(Math.random() > 0.5) this.connectTo(id);
                        }
                    });
                }
                break;
            case 'MSG':
                this.handleMsg(d, conn);
                break;
        }
    }

    handleMsg(d, conn) {
        if (!d.id || window.state.seenMsgs.has(d.id)) return;
        window.state.seenMsgs.add(d.id);
        
        // 保存消息与联系人
        window.db.saveMsg(d);
        if (d.n) {
            window.state.contacts[d.senderId] = { id: d.senderId, n: d.n, t: window.util.now() };
        }

        // UI 显示判断
        const isPublic = d.target === 'all';
        const isToMe = d.target === window.state.myId;
        if (isPublic || isToMe) {
            if (window.state.activeChat === (isPublic ? 'all' : d.senderId)) {
                if (window.ui) window.ui.appendMsg(d);
            } else {
                const key = isPublic ? 'all' : d.senderId;
                window.state.unread[key] = (window.state.unread[key]||0)+1;
                if (window.ui) window.ui.renderList();
            }
        }
        
        // 泛洪转发
        if (d.target === 'all') this.core.flood(d, conn.peer);
    }

    sendPing() {
        const now = Date.now();
        Object.values(window.state.conns).forEach(c => {
            if (c.open) {
                c.send({t: 'PING'});
                // 超时检测
                if (c.lastPong && (now - c.lastPong > this.config.timeouts.connection)) {
                    if (now - (c.created || 0) < 10000) return; // 新连接保护期
                    if (c.peer.startsWith(this.config.hubs.prefix)) return; // Hub保护

                    window.util.log(`💔 判定离线: ${c.peer.slice(0,6)}`);
                    c.close(); // 主动断开关键点！
                    delete window.state.conns[c.peer];
                    if (window.ui) window.ui.renderList();
                    
                    // 对方掉了，赶紧喊一声，万一他刚重启呢
                    this.core.mqtt.broadcastPresence();
                }
            }
        });
    }
}
  