
// mqtt-service.js - 负责信令发现、广播、断开重连
export class MqttService {
    constructor(core, config) {
        this.core = core;
        this.config = config;
        this.client = null;
    }

    start() {
        if (typeof Paho === 'undefined') { 
            window.state.mqttStatus = '失败'; 
            setTimeout(() => this.start(), 3000); 
            return; 
        }
        if (this.client && this.client.isConnected()) return;

        // 故障切换逻辑
        let { broker, port, path } = this.config.mqtt;
        if (window.state.mqttFailCount > 0) {
            window.util.log(`🛡️ 启用 MQTT 代理通道`);
            broker = this.config.proxy.host;
            port = 443;
            path = `/https://${this.config.mqtt.broker}:${this.config.mqtt.port}${this.config.mqtt.path}`;
        }

        const cid = "mqtt_" + window.state.myId + "_" + Math.random().toString(36).slice(2,6);
        window.util.log(`📡 连接 MQTT: ${broker}...`);

        this.client = new Paho.MQTT.Client(broker, port, path, cid);
        window.state.mqttClient = this.client;

        this.client.onConnectionLost = (o) => this.onLost(o);
        this.client.onMessageArrived = (m) => this.onMessage(m);

        this.client.connect({
            onSuccess: () => this.onConnected(broker === this.config.proxy.host),
            onFailure: (ctx) => this.onFailure(ctx),
            useSSL: true,
            keepAliveInterval: 30,
            timeout: 10
        });
    }

    onConnected(isProxy) {
        window.state.mqttStatus = '在线';
        window.state.mqttFailCount = 0;
        window.util.log(`✅ MQTT 连接成功!`);
        if (window.ui) window.ui.updateSelf();
        
        this.client.subscribe(this.config.mqtt.topic);
        
        // 连上后立即广播 3 次
        this.broadcastPresence();
        setTimeout(() => this.broadcastPresence(), 2000);
        setTimeout(() => this.broadcastPresence(), 5000);
    }

    onFailure(ctx) {
        window.state.mqttStatus = '失败';
        window.state.mqttFailCount = (window.state.mqttFailCount || 0) + 1;
        window.util.log(`❌ MQTT 连接失败: ${ctx.errorMessage}`, 'err');
        if (window.ui) window.ui.updateSelf();
        setTimeout(() => this.start(), 5000);
    }

    onLost(o) {
        window.state.mqttStatus = '断开';
        window.state.mqttFailCount = (window.state.mqttFailCount || 0) + 1;
        window.util.log(`🔌 MQTT 断开: ${o.errorCode}`, 'err');
        if (window.ui) window.ui.updateSelf();
        setTimeout(() => this.start(), 3000 + Math.random() * 2000);
    }

    onMessage(msg) {
        try {
            const d = JSON.parse(msg.payloadString);
            if (Math.abs(window.util.now() - d.ts) > 120000) return; // 忽略旧消息

            // 1. Hub 心跳
            if (d.type === 'HUB_PULSE') {
                window.state.hubHeartbeats[d.hubIndex] = Date.now();
                if (!window.state.conns[d.id] && Object.keys(window.state.conns).length < 5) {
                    this.core.connectTo(d.id);
                }
                return;
            }

            // 2. 普通用户
            if (d.id === window.state.myId) return;
            
            const existing = window.state.conns[d.id];
            if (!existing || !existing.open) {
                window.util.log(`👋 MQTT 发现新用户: ${d.id.slice(0,6)}`);
                this.core.connectTo(d.id);
            } else {
                // 收到由于可能对方重启了，发个 Ping 确认一下
                existing.send({t: 'PING'});
            }
        } catch(e){}
    }

    broadcastPresence() {
        if (this.client && this.client.isConnected()) {
            const payload = JSON.stringify({ id: window.state.myId, ts: Date.now() });
            const msg = new Paho.MQTT.Message(payload);
            msg.destinationName = this.config.mqtt.topic;
            this.client.send(msg);
        }
    }

    sendHubPulse() {
        if (this.client && this.client.isConnected()) {
            const payload = JSON.stringify({ 
                type: 'HUB_PULSE', 
                id: window.state.myId, 
                hubIndex: window.state.hubIndex, 
                ts: Date.now() 
            });
            const msg = new Paho.MQTT.Message(payload);
            msg.destinationName = this.config.mqtt.topic;
            this.client.send(msg);
        }
    }
}
  