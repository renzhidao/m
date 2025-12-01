console.log('🔌 系统启动中...');

async function boot() {
    // 1. 读取注册表
    const regText = await fetch('../registry.txt').then(r => r.text());
    // 过滤空行和注释
    const modules = regText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    
    console.log(`检测到 ${modules.length} 个功能模块`);

    // 2. 逐个加载
    for (const modPath of modules) {
        await loadModule(modPath);
    }
}

async function loadModule(path) {
    const basePath = `../modules/${path}`;
    console.log(` 加载模块: ${path}`);

    // A. 尝试加载 UI (ui.html)
    try {
        const uiRes = await fetch(`${basePath}/ui.html`);
        if (uiRes.ok) {
            const html = await uiRes.text();
            // 创建一个临时容器来解析 HTML
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // 提取真正的模块根元素
            const rootEl = temp.firstElementChild;
            if (rootEl) {
                // 查找它想去哪个槽位 (data-target="#slot-main")
                const targetSelector = rootEl.getAttribute('data-target') || '#hidden-stage';
                const targetSlot = document.querySelector(targetSelector);
                if (targetSlot) {
                    targetSlot.appendChild(rootEl);
                } else {
                    console.warn(`找不到槽位 ${targetSelector}，模块 ${path} 的 UI 无法显示`);
                }
            }
        }
    } catch (e) {
        // 允许没有 UI 的纯逻辑模块
    }

    // B. 尝试加载逻辑 (logic.js)
    try {
        // 动态导入 JS
        const logic = await import(`${basePath}/logic.js`);
        // 如果模块导出了 init 函数，就执行它
        if (logic.init) logic.init();
    } catch (e) {
        // 允许没有 JS 的纯静态模块
        if(e.message.includes('Failed to fetch')) return; 
        console.error(`模块 ${path} 逻辑错误:`, e);
    }
}

boot();