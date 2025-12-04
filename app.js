import { NET_PARAMS, CHAT } from './modules/constants.js';

export function init() {
  console.log('🚀 启动主程序: App Core');

  window.app = {
    async init() {
      // 1. 基础环境准备
      await window.util.syncTime();
      localStorage.setItem('p1_my_id', window.state.myId);
      await window.db.init();
      
      // 2. UI 初始化 (渲染 + 事件)
      if (window.ui && window.ui.init) window.ui.init();
      if (window.uiEvents && window.uiEvents.init) window.uiEvents.init();

      // 3. 加载初始历史消息
      this.loadHistory(20);

      // 4. 启动网络层
      if (window.p2p) window.p2p.start();
      if (window.mqtt) window.mqtt.start();

      // 5. 启动主循环 (Loop)
      setInterval(() => this.loop(), NET_PARAMS.LOOP_INTERVAL);

      // 初始检查
      setTimeout(() => {
        // 如果孤立无援，尝试连接房主或自己成为房主
        if (!window.state.isHub && Object.keys(window.state.conns).length < 1) {
           if (window.state.mqttStatus === '在线') {
               if (window.p2p) window.p2p.patrolHubs();
           } else {
               if (window.hub) window.hub.connectToAnyHub();
           }
        }
      }, 2000);
    },

    loop() {
      // 维护 P2P 连接 (清理超时、Gossip)
      if (window.p2p) window.p2p.maintenance();
      
      // 重试未发送消息
      if (window.protocol) window.protocol.retryPending();

      // MQTT 心跳 (由 mqtt 模块内部定时器处理，这里只做兜底或状态检查)
      if (!window.state.isHub && window.state.mqttStatus === '在线') {
         if (window.p2p) window.p2p.patrolHubs();
      } else if (!window.state.isHub && window.state.mqttStatus !== '在线') {
         if (window.hub) window.hub.connectToAnyHub();
      }
    },

    async loadHistory(limit) {
      if (window.state.loading) return;
      window.state.loading = true;
      
      const msgs = await window.db.getRecent(limit, window.state.activeChat, window.state.oldestTs);
      
      if (msgs && msgs.length > 0) {
         window.state.oldestTs = msgs[0].ts;
         msgs.forEach(m => {
            window.state.seenMsgs.add(m.id);
            if (window.ui) window.ui.appendMsg(m);
         });
      }
      window.state.loading = false;
    }
  };

  // 执行初始化
  window.app.init();
}