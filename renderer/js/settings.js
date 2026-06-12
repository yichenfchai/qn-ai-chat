/**
 * 设置面板 — 右键菜单 + 保存到主进程
 */

(function() {
  const panel = document.getElementById('settings-panel');
  const ctxMenu = document.getElementById('context-menu');
  const saveBtn = document.getElementById('settings-save');
  const closeBtn = document.getElementById('settings-close');
  const statusEl = document.getElementById('settings-status');

  // 右键菜单
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    ctxMenu.style.display = 'block';
    ctxMenu.style.left = e.clientX + 'px';
    ctxMenu.style.top = e.clientY + 'px';
  });

  document.addEventListener('click', () => {
    ctxMenu.style.display = 'none';
  });

  document.getElementById('ctx-settings').addEventListener('click', async (e) => {
    e.stopPropagation();
    ctxMenu.style.display = 'none';
    panel.classList.add('show');

    // 加载已有设置
    if (window.pixelcat) {
      try {
        const settings = await window.pixelcat.getSettings();
        document.getElementById('set-api-key').value = settings.apiKey || '';
        document.getElementById('set-api-model').value = settings.model || 'qwen-vl-max';
        document.getElementById('set-api-url').value = settings.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode/v1';
        document.getElementById('set-nls-key').value = settings.nlsAppKey || '';
      } catch(e) {}
    }
  });

  // 保存
  saveBtn.addEventListener('click', async () => {
    const settings = {
      apiKey: document.getElementById('set-api-key').value.trim(),
      model: document.getElementById('set-api-model').value.trim(),
      baseUrl: document.getElementById('set-api-url').value.trim(),
      nlsAppKey: document.getElementById('set-nls-key').value.trim(),
    };

    if (window.pixelcat) {
      try {
        await window.pixelcat.saveSettings(settings);
        statusEl.textContent = '已保存！重启后生效';
      } catch(e) {
        statusEl.textContent = '保存失败: ' + e.message;
      }
    } else {
      statusEl.textContent = 'IPC 未就绪';
    }
  });

  // 关闭
  closeBtn.addEventListener('click', () => {
    panel.classList.remove('show');
  });
})();
