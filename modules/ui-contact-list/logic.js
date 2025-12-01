export function init() {
    const container = document.getElementById('contact-list-container');
    const dynamicList = document.getElementById('contact-list-dynamic');
    const tpl = document.getElementById('tpl-contact-item');

    // 渲染列表函数
    function render() {
        dynamicList.innerHTML = ''; // 清空重绘
        const contacts = window.p1.contacts || {};

        Object.values(contacts).forEach(c => {
            const clone = tpl.content.cloneNode(true);
            const el = clone.querySelector('.contact-item');
            
            el.dataset.id = c.id;
            el.dataset.name = c.n;
            
            clone.querySelector('.name').innerText = c.n;
            clone.querySelector('.avatar').innerText = c.n[0];
            
            // 高亮当前聊天
            if (c.id === window.p1.activeChat) el.classList.add('active');

            dynamicList.appendChild(clone);
        });
    }

    // 点击事件委托
    container.addEventListener('click', (e) => {
        const item = e.target.closest('.contact-item');
        if (!item) return;

        // 切换 UI 高亮
        container.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const id = item.dataset.id;
        const name = item.dataset.name;

        // 广播切换事件
        window.dispatchEvent(new CustomEvent('p1:switch_chat', { detail: { id, name } }));
    });

    // 监听数据变化
    window.addEventListener('p1:contacts_changed', render);

    // 初始渲染
    render();
}