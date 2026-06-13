import { contextBridge, ipcRenderer } from 'electron';

const pixelcatAPI = {
  ping: (): Promise<{ pong: boolean; ts: number }> =>
    new Promise((resolve) => {
      const ch = 'ping-' + Date.now();
      ipcRenderer.once(ch, (_e, r) => { console.log('>>> preload received reply:', JSON.stringify(r)?.slice(0, 80)); resolve(r); });
      ipcRenderer.send('ping', ch);
    }),

  moveWindow: (dx: number, dy: number): void => {
    ipcRenderer.send('window:move', dx, dy);
  },

  getSettings: (): Promise<any> =>
    new Promise((resolve) => {
      const ch = 'sg-' + Date.now();
      ipcRenderer.once(ch, (_e, r) => { console.log('>>> preload received reply:', JSON.stringify(r)?.slice(0, 80)); resolve(r); });
      ipcRenderer.send('settings:get', ch);
    }),

  saveSettings: (settings: any): Promise<any> =>
    new Promise((resolve) => {
      const ch = 'ss-' + Date.now();
      ipcRenderer.once(ch, (_e, r) => { console.log('>>> preload received reply:', JSON.stringify(r)?.slice(0, 80)); resolve(r); });
      ipcRenderer.send('settings:save', ch, settings);
    }),

  sendMessage: (text: string, imageBase64?: string): Promise<string> =>
    new Promise((resolve) => {
      const result = ipcRenderer.sendSync('ai-chat', { text, imageBase64 });
      resolve(result || '');
    }),

  onStreamToken: (cb: (token: string) => void): void => {
    ipcRenderer.on('ai:streamToken', (_e, t) => cb(t));
  },
  onStreamEnd: (cb: () => void): void => {
    ipcRenderer.on('ai:streamEnd', () => cb());
  },
  onStreamError: (cb: (err: any) => void): void => {
    ipcRenderer.on('ai:streamError', (_e, err) => cb(err));
  },

  removeAllListeners: (ch: string): void => {
    ipcRenderer.removeAllListeners(ch);
  },
};

contextBridge.exposeInMainWorld('pixelcat', pixelcatAPI);
