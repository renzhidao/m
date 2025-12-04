import { CHAT, UI_CONFIG } from './constants.js';

export function init() {
  console.log('📦 加载模块: UI Render');

  window.ui = window.ui || {};
  const render = {
    init() {
       this.updateSelf();
       this.renderList();
    },

    updateSelf() {
      const elId = document.getElementById('myId');
      const elNick = document.getElementById('myNick');
      const elSt = document.getElementById('statusText');
      const elDot = document.getElementById('statusDot');
      const elCount = document.getElementById('onlineCount');

      if (elId) elId.innerText = window.state.myId.slice(0, 6);
      if (elNick) elNick.innerText = window.state.myName;
      
      if (elSt) {
        let s = '在线';
        if (window.state.isHub) s = '网关';
        if (window.state.mqttStatus === '在线') s += '+MQTT';
        else if (window.state.mqttStatus === '失败') s += '(M离)';
        elSt.innerText = s;
      }
      
      if (elDot) {
         elDot.className = window.state.mqttStatus === '在线' ? 'dot online' : 'dot';
      }
      
      // 计算真实在线人数（不包括自己）
      if (elCount) {
         let count = 0;
         // 只统计 open 的连接
         Object.values(window.state.conns).forEach(c => { if(c.open) count++; });
         elCount.innerText = count;
      }
    },

    // === 修正：只显示当前连接的在线节点 ===
    renderList() {
      const list = document.getElementById('contactList');
      if (!list) return;

      const pubUnread = window.state.unread[CHAT.PUBLIC_ID] || 0;
      
      // 1. 固定显示公共频道
      let html = `
        <div class="contact-item ${window.state.activeChat === CHAT.PUBLIC_ID ? 'active' : ''}" 
             data-chat-id="${CHAT.PUBLIC_ID}" data-chat-name="${CHAT.PUBLIC_NAME}">
          <div class="avatar" style="background:${UI_CONFIG.COLOR_GROUP}">群</div>
          <div class="c-info">
            <div class="c-name">${CHAT.PUBLIC_NAME} 
              ${pubUnread > 0 ? `<span class="unread-badge">${pubUnread}</span>` : ''}
            </div>
          </div>
        </div>`;

      // 2. 遍历当前连接 (window.state.conns)
      Object.keys(window.state.conns).forEach(id => {
        const conn = window.state.conns[id];
        // 过滤条件：必须是 Open 状态，不是自己，且不是房主ID（p1-hub-...）
        if (!conn || !conn.open) return;
        if (id === window.state.myId) return;
        if (id.startsWith(window.config.hub.prefix)) return;

        const unread = window.state.unread[id] || 0;
        const safeName = window.util.escape(conn.label || id.slice(0, 6));
        // 在线统一用绿色，或者用头像哈希色
        const bg = UI_CONFIG.COLOR_ONLINE; 

        html += `
          <div class="contact-item ${window.state.activeChat === id ? 'active' : ''}" 
               data-chat-id="${id}" data-chat-name="${safeName}">
            <div class="avatar" style="background:${window.util.colorHash(id)}">${safeName[0]}</div>
            <div class="c-info">
              <div class="c-name">${safeName} ${unread > 0 ? `<span class="unread-badge">${unread}</span>` : ''}</div>
              <div class="c-time">在线</div>
            </div>
          </div>`;
      });

      list.innerHTML = html;
    },

    clearMsgs() {
      const box = document.getElementById('msgList');
      if (box) box.innerHTML = '';
    },

    appendMsg(m) {
      const box = document.getElementById('msgList');
      if (!box || !m) return;
      if (document.getElementById('msg-' + m.id)) return;

      const isMe = m.senderId === window.state.myId;
      let content = '';

      if (m.kind === CHAT.KIND_IMAGE) {
         content = `<img src="${m.txt}" class="chat-img" onclick="window.open(this.src)">`;
      } else if (m.kind === CHAT.KIND_FILE) {
         const sizeStr = m.fileSize ? (m.fileSize / 1024).toFixed(1) + 'KB' : '未知大小';
         content = `
           <div class="file-card">
             <div class="file-icon">📄</div>
             <div class="file-info">
               <div class="file-name">${window.util.escape(m.fileName || '未命名文件')}</div>
               <div class="file-size">${sizeStr}</div>
             </div>
             <a href="${m.txt}" download="${m.fileName || 'download'}" class="file-dl-btn">⬇</a>
           </div>
         `;
      } else {
         content = window.util.escape(m.txt);
      }

      const style = (m.kind === CHAT.KIND_IMAGE) ? 'background:transparent;padding:0' : '';
      
      const html = `
        <div class="msg-row ${isMe ? 'me' : 'other'}" id="msg-${m.id}">
          <div>
            <div class="msg-bubble" style="${style}">${content}</div>
            <div class="msg-meta">${isMe ? '我' : window.util.escape(m.n)} ${new Date(m.ts).toLocaleTimeString()}</div>
          </div>
        </div>`;

      box.insertAdjacentHTML('beforeend', html);
      box.scrollTop = box.scrollHeight;
      
      if (window.uiEvents && window.uiEvents.bindMsgEvents) {
         window.uiEvents.bindMsgEvents();
      }
    }
  };

  Object.assign(window.ui, render);
}