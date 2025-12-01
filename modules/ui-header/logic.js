export function init() {
    const title = document.getElementById('header-title');
    const status = document.getElementById('header-status');
    const dot = document.getElementById('status-dot');
    
    // 监听状态
    window.addEventListener('p1:status', (e) => {
        status.innerText = e.detail;
        dot.style.background = '#22c55e';
        dot.style.boxShadow = '0 0 8px #22c55e';
    });

    // 监听聊天切换
    window.addEventListener('p1:chat_switched', (e) => {
        title.innerText = e.detail.name;
    });
    
    // 触发设置
    document.getElementById('btn-settings').onclick = () => {
        window.dispatchEvent(new CustomEvent('p1:open_settings'));
    };
}