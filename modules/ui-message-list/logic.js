export function init() {
    const container = document.getElementById('msg-area');
    const tpl = document.getElementById('tpl-msg-bubble');
    const emptyTip = document.getElementById('empty-tip');

    // 切换聊天时清屏
    window.addEventListener('p1:switch_chat', () => {
        container.innerHTML = '';
        container.appendChild(emptyTip); // 保留提示
    });

    window.addEventListener('p1:new_msg', (e) => {
        const msg = e.detail;
        
        // 简单判断：只显示属于当前窗口的消息
        // (注：实际生产中应该在 core-state 里筛选，这里为了演示 UI 逻辑简化处理)
        const currentChat = window.p1.activeChat;
        const isPublic = msg.target === 'all';
        const belongs = (currentChat === 'all' && isPublic) || 
                        (msg.senderId === currentChat) || 
                        (msg.target === currentChat);
                        
        if (!belongs) return;

        const clone = tpl.content.cloneNode(true);
        const row = clone.querySelector('.msg-row');
        const bubble = clone.querySelector('.bubble');
        const meta = clone.querySelector('.meta');
        
        clone.querySelector('.txt').innerText = msg.txt;
        
        const time = new Date(msg.ts).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        if (msg.isMe) {
            row.style.alignSelf = 'flex-end';
            clone.querySelector('.bubble-wrap').style.flexDirection = 'row-reverse';
            bubble.style.background = 'var(--bubble-me)';
            bubble.style.color = '#fff';
            bubble.style.borderBottomRightRadius = '4px';
            meta.style.textAlign = 'right';
            meta.style.marginRight = '4px';
            meta.innerText = `我 ${time}`;
        } else {
            row.style.alignSelf = 'flex-start';
            bubble.style.borderBottomLeftRadius = '4px';
            meta.innerText = `${msg.n || '未知'} ${time}`;
        }

        container.appendChild(clone);
        
        // 自动滚动
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    });
}