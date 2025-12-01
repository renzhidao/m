export function init() {
    const title = document.getElementById('header-title');
    const status = document.getElementById('header-status');
    const btnMenu = document.getElementById('btn-mobile-menu');
    const sidebar = document.getElementById('slot-sidebar');

    window.addEventListener('p1:chat_switched', (e) => {
        title.innerText = e.detail.name;
        status.innerText = e.detail.id === 'all' ? '全员广播' : '私密连接';
    });

    // 手机端点击菜单键 -> 显示侧边栏
    if(btnMenu) {
        btnMenu.onclick = () => {
            sidebar.classList.add('show');
        };
    }
    
    // 点击遮罩层关闭侧边栏 (简单模拟)
    sidebar.onclick = (e) => {
        if(window.innerWidth < 768 && e.target === sidebar) {
            sidebar.classList.remove('show');
        }
    };
}