/**
 * 设置面板 — 右键菜单 + 保存到主进程
 */

document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('settings-panel');
  if (!panel) { console.error('settings-panel not found'); return; }
  const ctxMenu = document.getElementById('ctx-menu');
  const saveBtn = document.getElementById('settings-save');
  const closeBtn = document.getElementById('settings-close');
  const statusEl = document.getElementById('settings-status');

  // 右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (typeof debugLog === 'function') debugLog('ctxmenu: ' + e.clientX + ',' + e.clientY);
    ctxMenu.style.display = 'block';
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
    if (typeof debugLog === 'function') debugLog('ctxmenu shown');
  });

  document.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
  });

  document.getElementById('ctx-menu-item').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (typeof debugLog === 'function') debugLog('settings clicked');
    ctxMenu.style.display = 'none';
    panel.style.display = 'block';

    // 加载已有设置
    if (window.pixelcat) {
      try {
        const settings = await window.pixelcat.getSettings();
        document.getElementById('set-api-key').value = settings.apiKey || '';
        document.getElementById('set-api-model').value = settings.model || 'qwen-omni-turbo';
        document.getElementById('set-api-url').value = settings.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        document.getElementById('set-nls-key').value = settings.nlsAppKey || '';
      } catch(e) {}
    }
  });

  // 保存
  saveBtn.addEventListener('click', async () => {
    statusEl.textContent = '测试IPC...';
    
    if (!window.pixelcat) {
      statusEl.textContent = 'IPC未就绪';
      return;
    }

    // 先 ping 测试 IPC 通不通
    try {
      const pingResult = await window.pixelcat.ping();
      statusEl.textContent = 'Ping OK, 保存中...';
    } catch(e) {
      statusEl.textContent = 'Ping失败: ' + e.message;
      return;
    }

    const settings = {
      apiKey: document.getElementById('set-api-key').value.trim(),
    };

    try {
      const result = await window.pixelcat.saveSettings(settings);
      statusEl.textContent = '已保存！';
    } catch(e) {
      statusEl.textContent = '保存失败: ' + e.message;
    }
  });

  // 关闭
  closeBtn.addEventListener('click', () => {
    panel.style.display = 'none';
  });
});
