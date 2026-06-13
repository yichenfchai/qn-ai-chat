const Tool = {
  /** 已知可打开的应用关键词 → 可执行命令 */
  _apps: {
    'wps': 'start wps',
    'word': 'start winword',
    'excel': 'start excel',
    'ppt': 'start powerpnt',
    'powerpoint': 'start powerpnt',
    '记事本': 'start notepad',
    'notepad': 'start notepad',
    '计算器': 'start calc',
    'calc': 'start calc',
    '浏览器': 'start chrome',
    'chrome': 'start chrome',
    'edge': 'start msedge',
    'vscode': 'code',
    'vs code': 'code',
    'cmd': 'start cmd',
    '终端': 'start cmd',
    '资源管理器': 'start explorer',
    'explorer': 'start explorer',
    '画图': 'start mspaint',
    'mspaint': 'start mspaint',
  },

  async execute(text) {
    if (!window.pixelcat) return null;

    // 打开应用: 先试反向 "xxx这就打开" / "xxx马上就来" / "xxx这就来"
    let openMatch = text.match(/([^\s，。,\.!！为已了]{1,15})\s*(?:这就|已经|正在|马上|已经帮[你我]|帮你)\s*(?:打开|启动|运行)/);
    if (!openMatch) {
      openMatch = text.match(/([^\s，。,\.!！为已了]{1,15})\s*(?:这就来|马上就来|来啦|就来|已打开|已启动)/);
    }
    if (!openMatch) {
      openMatch = text.match(/(?:打开|启动|运行|帮我开|帮我打开)\s*[：:]?\s*([^\s，。,\.!！为已了]{1,15})/);
    }
    console.log('Tool check:', text.slice(0, 60), '| match:', openMatch ? openMatch[1] : 'none');

    if (openMatch) {
      let app = openMatch[1].trim().toLowerCase();
      // 清理后缀
      app = app.replace(/[喵~！!。，,、\.]$/g, '').replace(/喵[~～]?$/, '').replace(/这就|已经|正在|马上/g, '').trim().toLowerCase();
      if (app && app.length > 1 && !/[了着过]$/.test(app)) {
        // 查映射表
        const cmd = this._apps[app];
        if (cmd) {
          console.log('Tool: opening', app, '→', cmd);
          return await window.pixelcat.openApp(cmd);
        }
        // 无映射也尝试原样打开
        console.log('Tool: opening raw', app);
        return await window.pixelcat.openApp('start ' + app);
      }
    }

    // 截图
    if (/截图|截屏|看看桌面|桌面上有|屏幕上有/.test(text)) {
      console.log('Tool: screenshot');
      return await window.pixelcat.takeScreenshot();
    }

    return null;
  },
  prompt() { return ''; },

  /** 从用户输入（非AI回复）中检测命令并直接执行 */
  async executeFromInput(text) {
    if (!window.pixelcat || !text) return null;

    let openMatch = text.match(/([^\s，。,\.!！为已了]{1,15})\s*(?:这就|已经|正在|马上|已经帮[你我]|帮你)\s*(?:打开|启动|运行)/);
    if (!openMatch) {
      openMatch = text.match(/(?:打开|启动|运行)\s*([^\s，。,\.!！喵~为已了]{1,15})/);
    }
    if (openMatch) {
      let app = openMatch[1].trim().toLowerCase();
      app = app.replace(/[喵~！!。，,、\.]$/g, '').replace(/喵[~～]?$/, '').replace(/这就|已经|正在|马上/g, '').trim().toLowerCase();
      if (app && app.length > 1 && !/[了着过]$/.test(app)) {
        const cmd = this._apps[app];
        if (cmd) {
          console.log('Tool input: opening', app, '→', cmd);
          return await window.pixelcat.openApp(cmd);
        }
        console.log('Tool input: opening raw', app);
        return await window.pixelcat.openApp('start ' + app);
      }
    }

    if (/截图|截屏/.test(text)) {
      console.log('Tool input: screenshot');
      const scr = await window.pixelcat.takeScreenshot();
      if (scr) return scr;
    }

    return null;
  },
};
