import { CHAT, UI_CONFIG } from './constants.js';

export function init() {
  console.log('📦 加载模块: UI Events');

  window.uiEvents = {
    init() {
      this.bindClicks();
      this.bindMsgEvents(); // 初始绑定一次
      
      // 添加文件卡片的 CSS
      this.injectStyles();
    },

    injectStyles() {
      const css = `
        .file-card { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 8px; min-width: 200px; }
        .file-icon { font-size: 24px; }
        .file-info { flex: 1; min-width: 0; }
        .file-name { font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .file-size { font-size: 11px; opacity: 0.7; }
        .file-dl-btn { text-decoration: none; color: white; font-weight: bold; padding: 4px 8px; background: #2a7cff; border-radius: 4px; font-size: 12px; }
      `;
      const style = document.createElement('style');
      style.textContent = css;
      document.head.appendChild(style);
    },

    bindClicks() {
      const bind = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };

      // 发送按钮
      bind('btnSend', () => {
        const el = document.getElementById('editor');
        if (el && el.innerText.trim()) {
          window.protocol.sendMsg(el.innerText.trim());
          el.innerText = '';
        }
      });

      // 开关日志
      bind('btnToggleLog', () => {
        const el = document.getElementById('miniLog');
        if (el) el.style.display = (el.style.display === 'flex') ? 'none' : 'flex';
      });

      // 设置面板
      bind('btnSettings', () => {
        document.getElementById('settings-panel').style.display = 'grid';
        document.getElementById('iptNick').value = window.state.myName;
      });
      bind('btnCloseSettings', () => document.getElementById('settings-panel').style.display = 'none');
      bind('btnSave', () => {
        const n = document.getElementById('iptNick').value.trim();
        if (n) {
          window.state.myName = n;
          localStorage.setItem('nickname', n);
          if (window.ui) window.ui.updateSelf();
        }
        document.getElementById('settings-panel').style.display = 'none';
      });

      // 文件上传 (修改后支持所有文件)
      bind('btnFile', () => document.getElementById('fileInput').click());
      const fi = document.getElementById('fileInput');
      if (fi) {
        fi.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;

          // 如果是图片，走压缩逻辑
          if (file.type.startsWith('image/')) {
            window.util.log('处理图片...');
            const b64 = await window.util.compressImage(file);
            window.protocol.sendMsg(b64, CHAT.KIND_IMAGE);
          } else {
            // === 全新：处理通用文件 ===
            window.util.log(`准备发送文件: ${file.name} (${(file.size/1024).toFixed(1)}KB)`);
            
            // 限制大小 (例如 5MB)
            if (file.size > 5 * 1024 * 1024) {
               alert('文件过大，建议小于 5MB');
               return;
            }

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
               const b64 = reader.result;
               // 发送带有元数据的消息
               window.protocol.sendMsg(b64, CHAT.KIND_FILE, {
                 name: file.name,
                 size: file.size,
                 type: file.type
               });
               window.util.log('文件已发送');
            };
          }
          e.target.value = '';
        };
      }

      // 返回按钮 (移动端)
      bind('btnBack', () => document.getElementById('sidebar').classList.remove('hidden'));

      // 聊天切换
      const contactListEl = document.getElementById('contactList');
      if (contactListEl) {
        contactListEl.addEventListener('click', e => {
          const item = e.target.closest('.contact-item');
          if (item && window.ui) {
             const id = item.getAttribute('data-chat-id');
             const name = item.getAttribute('data-chat-name');
             
             window.state.activeChat = id;
             window.state.activeChatName = name;
             window.state.unread[id] = 0;
             localStorage.setItem('p1_unread', JSON.stringify(window.state.unread));
             window.state.oldestTs = Infinity; // 重置历史记录指针

             document.getElementById('chatTitle').innerText = name;
             document.getElementById('chatStatus').innerText = (id === CHAT.PUBLIC_ID) ? '全员' : '私聊';
             
             if (window.innerWidth < 768) document.getElementById('sidebar').classList.add('hidden');
             
             window.ui.clearMsgs();
             // 加载历史
             window.state.loading = false; 
             if(window.app) window.app.loadHistory(50); // 调用 app.js 里的加载历史
             window.ui.renderList();
          }
        });
      }
    },

    // === 新增：消息气泡长按全选 ===
    bindMsgEvents() {
      // 为了性能，我们使用事件委托，或者只对新加入的元素绑定
      // 这里简单起见，直接对 .msg-bubble 绑定 contextmenu (长按/右键)
      
      document.querySelectorAll('.msg-bubble').forEach(el => {
         if (el.dataset.bound) return; // 避免重复绑定
         el.dataset.bound = 'true';

         el.addEventListener('contextmenu', (e) => {
            e.preventDefault(); // 阻止默认菜单
            // 选中文本
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(el);
            selection.removeAllRanges();
            selection.addRange(range);
            
            window.util.log('已全选文本');
         });
      });
    }
  };
  
  // 立即初始化
  window.uiEvents.init();
}