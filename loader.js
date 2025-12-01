const debugBox = document.getElementById('debug-console');
function log(msg, type='ok') {
    if(debugBox) {
        // 简单的调试输出，可选开启
        // console.log(msg);
    }
}

// 内置备用表
const FALLBACK_MODULES = ["utils", "state", "db", "network", "ui"];

async function boot() {
    let modules = [];
    try {
        const res = await fetch('./registry.txt');
        if(res.ok) {
            const text = await res.text();
            modules = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        } else {
            throw new Error('404');
        }
    } catch(e) {
        console.warn('Loader: Registry not found, using fallback.');
        modules = FALLBACK_MODULES;
    }

    // 逐个加载
    for (const mod of modules) {
        // 因为这次是纯 JS 拆分，我们只加载 logic.js
        // 并且不依赖 data-target，因为 HTML 已经在 index.html 里了
        const path = `./modules/${mod}.js`;
        try {
            const m = await import(path);
            if(m.init) m.init();
            console.log(`✅ Module loaded: ${mod}`);
        } catch(e) {
            console.error(`❌ Module failed: ${mod}`, e);
        }
    }
    
    // 所有模块加载完毕，启动核心逻辑
    setTimeout(() => {
        if(window.core && window.core.init) {
            console.log('🚀 System Booting...');
            window.core.init();
        }
    }, 500);
}

boot();