import { contextBridge, ipcRenderer } from 'electron';

// === window:move 节流 ===
let _movePending = false;
let _moveDx = 0;
let _moveDy = 0;

const pixelcatAPI = {
  // invoke/handle 模式（自带 Promise + 错误传播）
  ping: (): Promise<{ pong: boolean; ts: number }> =>
    ipcRenderer.invoke('ping'),

  moveWindow: (dx: number, dy: number): void => {
    // 累加位移，一帧内只发一次 IPC
    _moveDx += dx;
    _moveDy += dy;
    if (!_movePending) {
      _movePending = true;
      requestAnimationFrame(() => {
        ipcRenderer.send('window:move', _moveDx, _moveDy);
        _moveDx = 0;
        _moveDy = 0;
        _movePending = false;
      });
    }
  },

  getSettings: (): Promise<any> =>
    ipcRenderer.invoke('settings:get'),

  saveSettings: (settings: any): Promise<any> =>
    ipcRenderer.invoke('settings:save', settings),

  takeScreenshot: (): Promise<string> =>
    ipcRenderer.invoke('tool:screenshot'),

  openApp: (name: string): Promise<string> =>
    ipcRenderer.invoke('tool:openApp', name),

  // ── Agent 工具执行桥接 ──
  getTools: (): Promise<Array<unknown>> =>
    new Promise((resolve) => {
      const ch = 'ag-' + Date.now();
      ipcRenderer.once(ch, (_e, r) => { resolve(r.tools || []); });
      ipcRenderer.send('agent:getTools', ch);
    }),

  executeTool: (callId: string, name: string, args: Record<string, unknown>): Promise<{
    status: 'success' | 'error';
    output?: string;
    error?: string;
    code?: string;
  }> =>
    new Promise((resolve) => {
      const replyChannel = 'agent:result:' + callId;
      ipcRenderer.once(replyChannel, (_e, r) => { resolve(r); });
      ipcRenderer.send('agent:execute', replyChannel, {
        callId,
        name,
        arguments: args,
      });
    }),
};

contextBridge.exposeInMainWorld('pixelcat', pixelcatAPI);
