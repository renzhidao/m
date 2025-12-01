console.log('🔌 系统启动中...');

async function boot() {
    try {
        // 【路径修复 1】相对于 index.html 读取注册表
        const regText = await fetch('./registry.txt').then(r => {
            if (!r.ok) throw new Error(`Registry 404 (Status: ${r.status})`);
            return r.text();
        });

        // 解析注册表
        const modules = regText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        console.log(`检测到 ${modules.length} 个模块`);

        // 逐个加载
        for (const modPath of modules) {
            await loadModule(modPath);
        }
    } catch (e) {
        console.error('Boot Failed:', e);
        document.body.innerHTML = `<div style="padding:20px;color:red;font-family:monospace">
            <h3>启动错误</h3>
            <p>${e.message}</p>
            <hr>
            <small>提示：请使用 GitHub Pages 或本地 HTTP Server (如 Live Server) 运行，不要直接双击打开。</small>
        </div>`;
    }
}

async function loadModule(path) {
    console.log(`📦 加载模块: ${path}`);

    // 【路径修复 2】UI 路径相对于 index.html
    const uiPath = `./modules/${path}/ui.html`;
    
    // 【路径修复 3】JS 路径相对于 core/loader.js
    const logicPath = `../modules/${path}/logic.js`;

    // A. 加载 UI (HTML)
    try {
        const uiRes = await fetch(uiPath);
        if (uiRes.ok) {
            const html = await uiRes.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // 提取第一个元素作为模块根
            const rootEl = temp.firstElementChild;
            if (rootEl) {
                const targetSelector = rootEl.getAttribute('data-target') || '#hidden-stage';
                const targetSlot = document.querySelector(targetSelector);
                if (targetSlot) {
                    targetSlot.appendChild(rootEl);
                } else {
                    console.warn(`[${path}] UI 无法挂载: 找不到槽位 ${targetSelector}`);
                }
            }
        }
    } catch (e) {
        // 允许模块没有 UI
    }

    // B. 加载逻辑 (JS)
    try {
        const logic = await import(logicPath);
        if (logic.init) logic.init();
    } catch (e) {
        // 忽略无逻辑文件的错误，但打印其他脚本错误
        const m = e.message || '';
        if (!m.includes('Failed to fetch') && !m.includes('404') && !m.includes('Module not found')) {
            console.error(`[${path}] 逻辑执行错误:`, e);
        }
    }
}

boot();