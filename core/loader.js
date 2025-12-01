console.log(' 系统启动中...');

async function boot() {
    try {
        // 【修复1】fetch 相对路径基于 index.html，所以是 ./registry.txt
        const regText = await fetch('./registry.txt').then(r => {
            if (!r.ok) throw new Error(`无法读取注册表 (Status: ${r.status})`);
            return r.text();
        });

        // 过滤空行和注释
        const modules = regText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        
        console.log(`检测到 ${modules.length} 个功能模块`);

        // 逐个加载
        for (const modPath of modules) {
            await loadModule(modPath);
        }
    } catch (e) {
        console.error('启动失败:', e);
        // 在屏幕上显示错误，避免黑屏
        document.body.innerHTML = `<div style="padding:20px;color:#ff4444;font-family:monospace;background:#222">
            <h3>⚠️ 启动错误</h3>
            <pre>${e.message}</pre>
            <hr style="border-color:#444"/>
            <p>提示：如果是本地直接打开 (file://)，浏览器可能会拦截文件读取。<br>请尝试使用 GitHub Pages 或本地 HTTP Server。</p>
        </div>`;
    }
}

async function loadModule(path) {
    console.log(`📦 加载模块: ${path}`);

    // 【修复2】fetch UI 相对路径基于 index.html -> ./modules/...
    const uiPath = `./modules/${path}/ui.html`;
    
    // 【修复3】import JS 相对路径基于 loader.js (在 core 目录) -> ../modules/...
    const logicPath = `../modules/${path}/logic.js`;

    // A. 尝试加载 UI (ui.html)
    try {
        const uiRes = await fetch(uiPath);
        if (uiRes.ok) {
            const html = await uiRes.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            const rootEl = temp.firstElementChild;
            if (rootEl) {
                // 获取目标槽位
                const targetSelector = rootEl.getAttribute('data-target') || '#hidden-stage';
                const targetSlot = document.querySelector(targetSelector);
                if (targetSlot) {
                    targetSlot.appendChild(rootEl);
                } else {
                    console.warn(`[${path}] 找不到槽位 ${targetSelector}`);
                }
            }
        }
    } catch (e) {
        // 允许没有 UI 的纯逻辑模块
    }

    // B. 尝试加载逻辑 (logic.js)
    try {
        // 动态导入 JS
        const logic = await import(logicPath);
        if (logic.init) logic.init();
    } catch (e) {
        // 忽略 404 (无逻辑文件)，但打印其他脚本错误
        const msg = e.message || '';
        if(!msg.includes('Failed to fetch') && !msg.includes('404') && !msg.includes('Module not found')) {
            console.error(`[${path}] 逻辑错误:`, e);
        }
    }
}

boot();