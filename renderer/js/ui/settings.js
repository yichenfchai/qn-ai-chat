/**
 * 设置面板 + 右键菜单
 */
const Settings = {
  _panel: null,
  _menu: null,

  init() {
    this._panel = document.getElementById('settings-panel');
    this._menu = document.getElementById('ctx-menu');

    // 右键菜单
    document.addEventListener('contextmenu', e => {
      e.preventDefault();
      this._menu.style.display = 'block';
      this._menu.style.left = e.clientX + 'px';
      this._menu.style.top = e.clientY + 'px';
    });
    document.addEventListener('click', () => {
      this._menu.style.display = 'none';
    });

    // 设置按钮
    document.getElementById('ctx-menu-item').addEventListener('click', async (e) => {
      e.stopPropagation();
      this._menu.style.display = 'none';
      this._panel.style.display = 'block';

      // 加载已有 key
      if (window.pixelcat) {
        try {
          const s = await window.pixelcat.getSettings();
          document.getElementById('set-api-key').value = s.apiKey || '';
        } catch {}
      }
    });

    // 保存
    document.getElementById('settings-save').addEventListener('click', async () => {
      const key = document.getElementById('set-api-key').value.trim();
      const status = document.getElementById('settings-status');

      if (window.pixelcat) {
        await window.pixelcat.saveSettings({ apiKey: key });
        AI.setKey(key);
        status.textContent = '已保存';
      } else {
        status.textContent = '保存失败';
      }
    });

    // 关闭
    document.getElementById('ctx-menu-close').addEventListener('click', () => {
      this._menu.style.display = 'none';
      window.close();
    });

    document.getElementById('settings-close').addEventListener('click', () => {
      this._panel.style.display = 'none';
    });

    // 退出应用
    document.getElementById('ctx-menu-close').addEventListener('click', () => {
      window.close();
    });
  },
};
