export function init() {
    const btn = document.getElementById('btn-send');
    const input = document.getElementById('msg-input');

    const send = () => {
        const txt = input.value.trim();
        if(!txt) return;
        
        console.log('JS捕获到发送动作:', txt);
        
        // 发送全局事件，逻辑层去处理，这里不写网络代码
        window.dispatchEvent(new CustomEvent('p1:send_msg', { detail: { txt } }));
        
        input.value = '';
    };

    btn.onclick = send;
    input.onkeypress = (e) => { if(e.key === 'Enter') send(); };
}