const debugBox = document.getElementById('debug-console');
function log(msg, type='ok') {
    if(debugBox) {
        // console.log(msg);
    }
}

// 新的模块列表 (Fallback)
const FALLBACK_MODULES = ["constants", "utils", "state", "db", "protocol", "p2p", "mqtt", "hub", "ui-render", "ui-events"];

async function boot() {
    // 1. 优先加载配置
    try {
        const cfg = await fetch('./config.json').then(r => r.json());
        window.config = cfg;
        console.log('✅ 配置文件已加载');
    } catch(e) {
        console.error('❌ 无法加载 config.json', e);
        alert('致命错误: 配置文件丢失');
        return;
    }

    // 2. 获取模块列表
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

    // 3. 逐个加载模块
    for (const mod of modules) {
        const path = `./modules/${mod}.js`;
        try {
            await import(path);
            // 大部分新模块不导出 init，而是在 import 时直接挂载到 window 或由 app.js 统一调用
            // 但为了兼容性，如果有 init 还是执行一下
            // 注意：我们的设计是 app.js 统筹，所以这里主要负责把代码 load 进来
            console.log(`✅ Module loaded: ${mod}`);
        } catch(e) {
            console.error(`❌ Module failed: ${mod}`, e);
        }
    }
    
    // 4. 启动新核心 (app.js)
    setTimeout(async () => {
        try {
            const main = await import('./app.js');
            if(main.init) main.init();
            console.log('🚀 System Booting (Refactored)...');
        } catch(e) {
            console.error('Failed to load app.js', e);
        }
    }, 500);
}

boot();