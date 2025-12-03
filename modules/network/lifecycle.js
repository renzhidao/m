
// lifecycle.js - 负责 App 生命周搏、心跳循环、死锁打破
export class LifecycleManager {
    constructor(core, config) {
        this.core = core;
        this.config = config;
        this._checkInterval = null;
        this._presenceInterval = null;
        this._lastVisibleTime = Date.now();
    }

    start() {
        // 1. 监听前后台切换
        document.addEventListener('visibilitychange', () => this.handleVisibilityChange());

        // 2. 启动高频心跳 (每3秒)
        this._checkInterval = setInterval(() => this.heartbeatLoop(), this.config.PING_INTERVAL);

        // 3. 启动低频强制广播 (每30秒) - 打破死锁的最后防线
        this._presenceInterval = setInterval(() => {
            if (document.visibilityState === 'visible') {
                this.core.mqtt.broadcastPresence();
            }
        }, this.config.PRESENCE_INTERVAL);

        console.log('✅ Lifecycle: 监控已启动');
    }

    handleVisibilityChange() {
        const isVisible = document.visibilityState === 'visible';
        const now = Date.now();

        if (isVisible) {
            const timeAway = now - this._lastVisibleTime;
            window.util.log(`⚡ 应用切回前台 (后台停留: ${(timeAway/1000).toFixed(1)}s)`);
            this.core.revive(); // 触发核心复苏
        } else {
            window.util.log(`💤 应用进入后台`);
            this._lastVisibleTime = now;
        }
    }

    heartbeatLoop() {
        this.core.cleanup();      // 清理僵尸
        this.core.p2p.sendPing(); // 发送 P2P 心跳
        this.core.retryPending(); // 重发积压消息
        this.core.exchange();     // 交换路由表
        
        // Hub 专用逻辑
        if (window.state.isHub) {
            this.core.mqtt.sendHubPulse();
        } else {
            // 普通节点巡逻
            if (window.state.mqttStatus === '在线') this.core.patrolHubs();
            else if (Object.keys(window.state.conns).length === 0) this.core.connectToAnyHub();
        }
    }
}
  