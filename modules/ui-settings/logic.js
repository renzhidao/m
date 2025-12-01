export function init() {
    const modal = document.getElementById('settings-modal');
    const iptNick = document.getElementById('st-nick');
    const txtId = document.getElementById('st-id');
    
    // 监听打开事件 (由 Header 触发)
    window.addEventListener('p1:open_settings', () => {
        modal.style.display = 'grid';
        iptNick.value = window.p1.myName;
        txtId.innerText = window.p1.myId;
    });
    
    // 关闭
    document.getElementById('st-close').onclick = () => {
        modal.style.display = 'none';
    };
    
    // 保存
    document.getElementById('st-save').onclick = () => {
        const newName = iptNick.value.trim();
        if (newName) {
            window.p1.myName = newName;
            localStorage.setItem('nickname', newName);
            // 广播状态变更
            window.dispatchEvent(new CustomEvent('p1:status', { detail: '昵称已更新' }));
        }
        modal.style.display = 'none';
    };
}