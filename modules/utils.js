export function init() {
  console.log('📦 加载模块: Utils (增强版 v2)');

  window.logSystem = {
    add(text) {
      const ts = window.util ? window.util.now() : Date.now();
      const date = new Date(ts);
      const timeStr = `${date.toLocaleTimeString()}.${date.getMilliseconds().toString().padStart(3, '0')}`;
      const msg = `[${timeStr}] ${text}`;
      
      console.log(msg);
      
      const el = document.getElementById('logContent'); if (!el) return;
      
      const div = document.createElement('div'); 
      div.innerText = msg; 
      div.style.borderBottom = '1px solid #333';
      div.style.padding = '2px 0';
      div.style.fontSize = '11px';
      div.style.fontFamily = 'monospace';
      
      // 错误标红
      if (text.includes('❌') || text.includes('💔') || text.includes('err') || text.includes('失败')) {
          div.style.color = '#ff4444';
      } else if (text.includes('✅') || text.includes('🔗')) {
          div.style.color = '#44ff44';
      } else if (text.includes('⚡')) {
          div.style.color = '#ffff44';
      }

      el.prepend(div); // 改为 appendChild，符合阅读习惯
      
      // 容量扩充到 500 条
      if (el.children.length > 500) el.removeChild(el.firstChild);
      
      // 自动滚动到底部
      el.scrollTop = 0;
    }
  };

  window.util = {
    log: (s) => window.logSystem.add(s),
    now() { return Date.now() + (window.state ? window.state.timeOffset : 0); },
    async syncTime() {
      try {
        const start = Date.now();
        const url = location.href.split('?')[0] + '?t=' + Math.random();
        const res = await fetch(url, { method: 'HEAD', cache: 'no-cache' });
        const dateStr = res.headers.get('date');
        if (dateStr) {
          window.state.timeOffset = (new Date(dateStr).getTime() + (Date.now() - start) / 2) - Date.now();
          window.util.log(`🕒 时间已校准`);
        }
      } catch (e) { window.util.log('⚠️ 时间校准失败'); }
    },
    uuid: () => Math.random().toString(36).substr(2, 9) + window.util.now().toString(36),
    escape(s) { return String(s||'').replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>'); },
    colorHash(str) {
      let hash = 0; for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
      const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
      return '#' + '000000'.substring(0, 6 - c.length) + c;
    },
    compressImage(file) {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (e) => {
          const img = new Image();
          img.src = e.target.result;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            const max = 800; 
            if (w > h && w > max) { h *= max/w; w = max; }
            else if (h > max) { w *= max/h; h = max; }
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, w, h);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
          };
        };
      });
    }
  };
}