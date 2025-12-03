export function init() {
  console.log('📦 加载模块: UI');

  window.ui = {
    init() {
      const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

      // [PWA修复] 1. 默默捕获安装资格，不干扰界面
      window.addEventListener('beforeinstallprompt', (e) => {
          e.preventDefault(); // 阻止浏览器自动弹横幅，改由点击触发
          window.deferredPrompt = e;
          console.log('✅ PWA安装资格已获取');
      });

      // [PWA修复] 2. 绑定点击事件
      bind('btn-install', async () => {
          const p = window.deferredPrompt;
          if (p) {
              p.prompt(); // 触发原生弹窗
              const { outcome } = await p.userChoice;
              console.log(`安装结果: ${outcome}`);
              window.deferredPrompt = null; // 用完即焚
          } else {
              // 如果没资格（比如已经安装了，或者浏览器不支持），给个提示
              alert('⚠️ 暂未触发安装权限\n可能原因：\n1. 应用已安装\n2. 需要通过浏览器菜单"添加到主屏幕"');
          }
      });
    
      bind('btnSend', () => { const el = document.getElementById('editor'); if (el && el.innerText.trim()) { window.core.sendMsg(el.innerText.trim()); el.innerText = ''; } });
      bind('btnToggleLog', () => { const el = document.getElementById('miniLog'); if (el) el.style.display = (el.style.display === 'flex') ? 'none' : 'flex'; });
      bind('btnSettings', () => { document.getElementById('settings-panel').style.display = 'grid'; document.getElementById('iptNick').value = window.state.myName; });
      bind('btnCloseSettings', () => { document.getElementById('settings-panel').style.display = 'none'; });
      bind('btnSave', () => {
        const n = document.getElementById('iptNick').value.trim();
        if (n) { window.state.myName = n; localStorage.setItem('nickname', n); window.ui.updateSelf(); }
        document.getElementById('settings-panel').style.display = 'none';
      });

      
    
      
      
      // [修复] 捕获安装事件，但不阻止浏览器默认弹窗
      window.addEventListener('beforeinstallprompt', (e) => {
          window.deferredPrompt = e;
          console.log('📲 PWA安装事件已捕获 (未拦截)');
      });
      
      // [修复] 如果页面上还有其他 id="btn-install" 的元素，尝试绑定它
      setTimeout(() => {
          const legacyBtn = document.getElementById('btn-install');
          if(legacyBtn) {
              legacyBtn.onclick = async () => {
                  if(window.deferredPrompt) {
                      window.deferredPrompt.prompt();
                      window.deferredPrompt = null;
                  } else {
                      alert('暂未触发安装权限，请通过浏览器菜单安装');
                  }
              };
          }
      }, 1000);
    
      
      bind('btnFile', () => document.getElementById('fileInput').click());
      const fi = document.getElementById('fileInput');
      if (fi) fi.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          if (!file.type.startsWith('image/')) { alert('目前仅支持发送图片'); return; }
          window.util.log('正在处理图片...');
          const b64 = await window.util.compressImage(file);
          window.core.sendMsg(b64, 'image');
          e.target.value = '';
      };

      bind('btnBack', () => document.getElementById('sidebar').classList.remove('hidden'));
      bind('btnDlLog', () => {
        const el = document.getElementById('logContent'); if(!el) return;
        const blob = new Blob([Array.from(el.children).map(n=>n.innerText).join('\n')], {type:'text/plain'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href=url; a.download='log.txt'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      });
      const box = document.getElementById('msgList'); if (box) box.addEventListener('scroll', () => { if (box.scrollTop===0) window.core.loadHistory(20); });
      const contactListEl = document.getElementById('contactList');
      if (contactListEl) { contactListEl.addEventListener('click', e => { const item = e.target.closest('.contact-item'); if (item) window.ui.switchChat(item.getAttribute('data-chat-id'), item.getAttribute('data-chat-name')||''); }); }
      this.updateSelf(); this.renderList();
    },
    updateSelf() {
      document.getElementById('myId').innerText = window.state.myId.slice(0,6);
      document.getElementById('myNick').innerText = window.state.myName;
      const st = document.getElementById('statusText');
      if(st) { 
          let s = '在线'; 
          if(window.state.isHub) s = '👑网关'; 
          if(window.state.mqttStatus === '在线') s += '+MQTT'; 
          else if(window.state.mqttStatus === '失败') s += '(M离)';
          st.innerText = s; 
      }
      document.getElementById('statusDot').className = window.state.mqttStatus === '在线' ? 'dot online' : 'dot';
    },
    switchChat(id, name) {
      window.state.activeChat = id; window.state.activeChatName = name; window.state.unread[id]=0; localStorage.setItem('p1_unread', JSON.stringify(window.state.unread)); window.state.oldestTs = Infinity;
      document.getElementById('chatTitle').innerText = name;
      document.getElementById('chatStatus').innerText = (id==='all')?'全员':'私聊';
      if(window.innerWidth<768) document.getElementById('sidebar').classList.add('hidden');
      this.clearMsgs(); window.core.loadHistory(50); this.renderList();
    },
    renderList() {
      const list = document.getElementById('contactList'); if(!list) return;
      const pubUnread = window.state.unread['all'] || 0;
      let html = `<div class="contact-item ${window.state.activeChat==='all'?'active':''}" data-chat-id="all" data-chat-name="公共频道"><div class="avatar" style="background:#2a7cff">群</div><div class="c-info"><div class="c-name">公共频道 ${pubUnread>0?`<span class="unread-badge">${pubUnread}</span>`:''}</div></div></div>`;
      const map = new Map(); Object.values(window.state.contacts).forEach(c => map.set(c.id, c)); Object.keys(window.state.conns).forEach(k => { if(k!==window.state.myId) map.set(k, {id:k, n:window.state.conns[k].label||k.slice(0,6)}); });
      map.forEach((v, id) => {
          const HUB_PREFIX = 'p1-hub-v3-';
          if (!id || id === window.state.myId || id.startsWith(HUB_PREFIX)) return;
          const isOnline = window.state.conns[id] && window.state.conns[id].open;
          const unread = window.state.unread[id] || 0;
          const safeName = window.util.escape(v.n || id.slice(0,6));
          const bg = isOnline ? '#22c55e' : window.util.colorHash(id);
          html += `<div class="contact-item ${window.state.activeChat===id?'active':''}" data-chat-id="${id}" data-chat-name="${safeName}"><div class="avatar" style="background:${bg}">${safeName[0]}</div><div class="c-info"><div class="c-name">${safeName} ${unread>0?`<span class="unread-badge">${unread}</span>`:''}</div><div class="c-time">${isOnline?'在线':'离线'}</div></div></div>`;
      });
      list.innerHTML = html;
    },
    clearMsgs() { const b = document.getElementById('msgList'); if(b) b.innerHTML=''; },
    appendMsg(m) {
      const box = document.getElementById('msgList'); if(!box||!m) return; if(document.getElementById('msg-'+m.id)) return;
      const isMe = m.senderId === window.state.myId;
      
      let content = window.util.escape(m.txt);
      if (m.kind === 'image') {
          content = `<img src="${m.txt}" class="chat-img" onclick="window.open(this.src)">`;
      }
      
      const html = `<div class="msg-row ${isMe?'me':'other'}" id="msg-${m.id}"><div><div class="msg-bubble" style="${m.kind==='image'?'background:transparent;padding:0':''}">${content}</div><div class="msg-meta">${isMe?'我':window.util.escape(m.n)} ${new Date(m.ts).toLocaleTimeString()}</div></div></div>`;
      box.insertAdjacentHTML('beforeend', html); box.scrollTop = box.scrollHeight;
    }
  };
}