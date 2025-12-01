export function init() {
    console.log('🧠 状态核心启动...');

    // 初始化全局状态对象 (挂载到 window 方便其他逻辑模块读取，但不允许 UI 直接读取)
    window.p1 = {
        myId: localStorage.getItem('p1_my_id') || ('u_' + Math.random().toString(36).substr(2, 9)),
        myName: localStorage.getItem('nickname') || ('用户' + Math.floor(Math.random() * 1000)),
        contacts: JSON.parse(localStorage.getItem('p1_contacts') || '{}'),
        activeChat: 'all',
        activeChatName: '公共频道'
    };
    
    // 持久化 ID
    localStorage.setItem('p1_my_id', window.p1.myId);

    // 监听：更新联系人
    window.addEventListener('p1:update_contact', (e) => {
        const { id, name } = e.detail;
        if (!id) return;
        window.p1.contacts[id] = { id, n: name, t: Date.now() };
        localStorage.setItem('p1_contacts', JSON.stringify(window.p1.contacts));
        // 广播：联系人列表变了，UI 请刷新
        window.dispatchEvent(new CustomEvent('p1:contacts_changed'));
    });

    // 监听：切换聊天
    window.addEventListener('p1:switch_chat', (e) => {
        const { id, name } = e.detail;
        window.p1.activeChat = id;
        window.p1.activeChatName = name;
        console.log(`切换聊天到: ${name} (${id})`);
        // 广播给 Header 和 MessageList
        window.dispatchEvent(new CustomEvent('p1:chat_switched', { detail: { id, name } }));
    });
}