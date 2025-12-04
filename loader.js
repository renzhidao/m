const debugBox = document.getElementById('debug-console');
function log(msg, type='ok') {
    if(debugBox) {
        // console.log(msg);
    }
}

const FALLBACK_MODULES = ["utils", "state", "db", "network", "ui"];

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
            const m = await import(path);
            if(m.init) m.init();
            console.log(`✅ Module loaded: ${mod}`);
        } catch(e) {
            console.error(`❌ Module failed: ${mod}`, e);
        }
    }
    
    // 4. 启动核心
    setTimeout(() => {
        if(window.core && window.core.init) {
            console.log('🚀 System Booting...');
            window.core.init();
        }
    }, 500);
}

boot();