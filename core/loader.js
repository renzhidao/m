const debugBox = document.getElementById('debug-console');
function log(msg, type='ok') {
    console.log(msg);
    if(debugBox) {
        const div = document.createElement('div');
        div.className = type === 'error' ? 'log-err' : 'log-ok';
        div.innerText = (type==='error'?'❌ ':'✅ ') + msg;
        debugBox.appendChild(div);
    }
}

async function boot() {
    try {
        const regText = await fetch('./registry.txt').then(r => {
            if (!r.ok) throw new Error(`无法读取注册表 (${r.status})`);
            return r.text();
        });

        const modules = regText.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
        log(`发现 ${modules.length} 个模块`);

        for (const modPath of modules) {
            await loadModule(modPath);
        }
    } catch (e) {
        console.error(e);
        log(e.message, 'error');
        document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;top:0;left:0;background:red;color:white;padding:20px;z-index:99999">致命错误: ${e.message}<br>请检查是否使用了 HTTP Server 运行</div>`);
    }
}

async function loadModule(path) {
    // 路径修复：确保指向正确
    const uiPath = `./modules/${path}/ui.html`;
    const logicPath = `../modules/${path}/logic.js`;

    // 1. 加载 UI
    try {
        const res = await fetch(uiPath);
        if (res.ok) {
            const html = await res.text();
            const temp = document.createElement('div');
            temp.innerHTML = html;
            const el = temp.firstElementChild;
            if (el) {
                const target = el.getAttribute('data-target') || '#slot-main';
                const slot = document.querySelector(target);
                if (slot) {
                    slot.appendChild(el);
                    // 处理内联 script (有些模块可能为了方便直接写了script标签)
                    Array.from(el.querySelectorAll('script')).forEach( oldScript => {
                        const newScript = document.createElement('script');
                        Array.from(oldScript.attributes).forEach( attr => newScript.setAttribute(attr.name, attr.value) );
                        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
                        oldScript.parentNode.replaceChild(newScript, oldScript);
                    });
                } else {
                    log(`${path}: 无效槽位 ${target}`, 'error');
                }
            }
        }
    } catch (e) { /* 无UI忽略 */ }

    // 2. 加载逻辑
    try {
        const mod = await import(logicPath);
        if (mod.init) {
            mod.init();
            log(`${path}: 运行正常`);
        } else {
            log(`${path}: 已加载(无init)`);
        }
    } catch (e) {
        const m = e.message || '';
        // 忽略404，其他报错
        if (!m.includes('404') && !m.includes('Failed to fetch')) {
            log(`${path} JS错误: ${m}`, 'error');
            console.error(e);
        } else {
            log(`${path}: 纯UI模块`);
        }
    }
}

boot();