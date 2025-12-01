export function init() {
    const CONFIG = {
        host: 'peerjs.92k.de', port: 443, secure: true, path: '/',
        config: { iceServers: [{urls:'stun:stun.l.google.com:19302'}] }
    };
    const MQTT_BROKER = "broker.emqx.io";
    const MQTT_TOPIC = "p1-chat/lobby/heartbeat-v3";

    let peer = null;
    let mqtt = null;
    let conns = {};

    // --- P2P 部分 ---
    function startP2P() {
        const id = window.p1.myId;
        peer = new Peer(id, CONFIG);
        
        peer.on('open', (id) => {
            window.dispatchEvent(new CustomEvent('p1:status', { detail: 'P2P就绪' }));
            startMqtt(); // P2P好了再连MQTT
        });

        peer.on('connection', conn => setupConn(conn));
        
        peer.on('error', err => {
            console.warn('PeerErr:', err.type);
            if(err.type === 'network' || err.type === 'server-error') setTimeout(startP2P, 5000);
        });
    }

    function setupConn(conn) {
        conn.on('open', () => {
            conns[conn.peer] = conn;
            // 发送握手
            conn.send({ t: 'HELLO', n: window.p1.myName, id: window.p1.myId });
        });
        
        conn.on('data', d => {
            if(d.t === 'HELLO') {
                // 收到握手，通知状态核心更新联系人
                window.dispatchEvent(new CustomEvent('p1:update_contact', { detail: { id: d.id, name: d.n } }));
            }
            if(d.t === 'MSG') {
                // 收到消息，通知 UI 显示
                const isMe = d.senderId === window.p1.myId;
                // 简单过滤：如果是全员，或者发给我的，或者是当前私聊对象的
                window.dispatchEvent(new CustomEvent('p1:new_msg', { detail: { ...d, isMe } }));
            }
        });
        
        conn.on('close', () => delete conns[conn.peer]);
    }

    function connectTo(id) {
        if(!id || id === window.p1.myId || conns[id]) return;
        try {
            const conn = peer.connect(id, { reliable: true });
            setupConn(conn);
        } catch(e) {}
    }

    // --- MQTT 部分 (信令发现) ---
    function startMqtt() {
        const cid = "mqtt_" + window.p1.myId + "_" + Math.random().toString(36).slice(2,5);
        mqtt = new Paho.MQTT.Client(MQTT_BROKER, 8084, "/mqtt", cid);
        
        mqtt.onMessageArrived = (msg) => {
            try {
                const d = JSON.parse(msg.payloadString);
                if(d.id !== window.p1.myId && Math.abs(Date.now() - d.ts) < 60000) {
                    connectTo(d.id); // 发现别人，去连他
                }
            } catch(e){}
        };

        mqtt.connect({
            useSSL: true,
            onSuccess: () => {
                window.dispatchEvent(new CustomEvent('p1:status', { detail: '在线 (P2P+MQTT)' }));
                mqtt.subscribe(MQTT_TOPIC);
                setInterval(sendHeartbeat, 10000);
                sendHeartbeat();
            }
        });
    }

    function sendHeartbeat() {
        if(mqtt && mqtt.isConnected()) {
            const msg = new Paho.MQTT.Message(JSON.stringify({ id: window.p1.myId, ts: Date.now() }));
            msg.destinationName = MQTT_TOPIC;
            mqtt.send(msg);
        }
    }

    // --- 对外接口：监听发送指令 ---
    window.addEventListener('p1:send_msg', (e) => {
        const { txt } = e.detail;
        const msg = {
            t: 'MSG',
            id: Math.random().toString(36),
            senderId: window.p1.myId,
            n: window.p1.myName,
            target: window.p1.activeChat,
            txt: txt,
            ts: Date.now()
        };

        // 1. 自己显示
        window.dispatchEvent(new CustomEvent('p1:new_msg', { detail: { ...msg, isMe: true } }));

        // 2. 发送
        if(msg.target === 'all') {
            // 广播给所有连接
            Object.values(conns).forEach(c => c.open && c.send(msg));
        } else {
            // 私聊
            const conn = conns[msg.target];
            if(conn && conn.open) conn.send(msg);
            else connectTo(msg.target); // 尝试重连
        }
    });

    // 启动
    startP2P();
}