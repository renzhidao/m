export function init() {
    const scrollBox = document.getElementById('contact-list-scroll');
    const dynamicList = document.getElementById('contact-list-dynamic');
    const tpl = document.getElementById('tpl-contact-item');
    
    // 个人卡片元素
    const myNameEl = document.getElementById('my-name');
    const myIdEl = document.getElementById('my-id');
    const statusText = document.getElementById('my-status-text');
    const statusDot = document.getElementById('my-status-dot');

    // 1. 初始化个人信息
    function updateMyCard() {
        if(window.p1) {
            myNameEl.innerText = window.p1.myName;
            myIdEl.innerText = window.p1.myId.slice(0, 6);
        }
    }
    updateMyCard(); // 启动时先填一次

    // 2. 监听状态变化 (更新左上角的红绿点)
    window.addEventListener('p1:status', (e) => {
        const status = e.detail;
        statusText.innerText = status;
        if(status.includes('在线') || status.includes('就绪')) {
            statusDot.style.background = '#22c55e';
            statusDot.style.boxShadow = '0 0 8px #22c55e';
        } else {
            statusDot.style.background = '#666';
            statusDot.style.boxShadow = 'none';
        }
        // 如果改了名字，这里顺便刷新下
        updateMyCard();
    });

    // 3. 绑定设置按钮 (原版是在侧边栏点击齿轮)
    document.getElementById('btn-sidebar-settings').onclick = () => {
        window.dispatchEvent(new CustomEvent('p1:open_settings'));
    };

    // 4. 列表渲染逻辑 (保持不变)
    function render() {
        dynamicList.innerHTML = '';
        const contacts = window.p1.contacts || {};
        Object.values(contacts).forEach(c => {
            const clone = tpl.content.cloneNode(true);
            const el = clone.querySelector('.contact-item');
            
            el.dataset.id = c.id;
            el.dataset.name = c.n;
            
            clone.querySelector('.name').innerText = c.n;
            clone.querySelector('.avatar').innerText = c.n[0];
            
            // 随机背景色模拟
            const hash = c.id.charCodeAt(0) + c.id.charCodeAt(1);
            const hue = hash % 360;
            clone.querySelector('.avatar').style.background = `hsl(${hue}, 60%, 40%)`;

            if (c.id === window.p1.activeChat) el.classList.add('active');
            dynamicList.appendChild(clone);
        });
    }

    scrollBox.addEventListener('click', (e) => {
        const item = e.target.closest('.contact-item');
        if (!item) return;
        scrollBox.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        window.dispatchEvent(new CustomEvent('p1:switch_chat', { 
            detail: { id: item.dataset.id, name: item.dataset.name } 
        }));
        
        // 移动端点击后自动收起侧边栏
        if(window.innerWidth < 768) {
            document.getElementById('slot-sidebar').classList.remove('show');
        }
    });

    window.addEventListener('p1:contacts_changed', render);
    render();
}