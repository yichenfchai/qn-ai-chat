/**
 * 媒体采集 — 摄像头 + 音频
 *
 * 工程化改进：
 * - 流复用：start() 检测已活跃的流直接复用
 * - stop() 只停录音不断流，shutdown() 彻底关闭
 * - _chunks 用 [] 而非 null，避免 push 报错
 * - captureFrame 降分辨率到 320×240 节省 token
 * - start() 返回错误信息
 */
const Media = {
  _video: null,
  _canvas: null,
  _stream: null,
  _recorder: null,
  _chunks: [],

  /** 初始化（创建隐藏的 video/canvas） */
  init() {
    this._video = document.createElement('video');
    this._video.style.display = 'none';
    this._video.muted = true;
    this._video.setAttribute('playsinline', '');
    document.body.appendChild(this._video);

    // 降分辨率：视觉模型 320×240 足够，节省 60%+ 图片 token
    this._canvas = document.createElement('canvas');
    this._canvas.width = 320;
    this._canvas.height = 240;
  },

  /**
   * 打开摄像头和麦克风（如果已打开则复用）
   * @returns {true | { error: string }} 成功返回 true，失败返回错误对象
   */
  async start() {
    if (!this._video) this.init();
    // 流已活跃，直接复用
    if (this._stream && this._stream.active) {
      if (this._video.paused) await this._video.play().catch(() => {});
      return true;
    }
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      });
      this._video.srcObject = this._stream;
      await this._video.play();
      return true;
    } catch (e) {
      // 返回有意义的错误信息
      const name = e?.name || '';
      if (name === 'NotAllowedError') return { error: '摄像头/麦克风权限被拒绝' };
      if (name === 'NotFoundError') return { error: '未找到摄像头或麦克风设备' };
      if (name === 'NotReadableError') return { error: '设备被其他应用占用' };
      return { error: '媒体设备打开失败: ' + (e?.message || name || '未知错误') };
    }
  },

  /** 抓取一帧 → JPEG base64（降分辨率到 320×240） */
  captureFrame() {
    if (!this._stream || !this._canvas) return null;
    const ctx = this._canvas.getContext('2d');
    ctx.drawImage(this._video, 0, 0, this._canvas.width, this._canvas.height);
    return this._canvas.toDataURL('image/jpeg', 0.6);
  },

  startRecord() {
    this._chunks = [];
    const track = this._stream?.getAudioTracks()[0];
    if (!track) return;
    try {
      this._recorder = new MediaRecorder(new MediaStream([track]), { mimeType: 'audio/webm' });
    } catch {
      this._recorder = new MediaRecorder(new MediaStream([track]));
    }
    this._recorder.ondataavailable = e => { if (e.data.size && this._chunks) this._chunks.push(e.data); };
    this._recorder.start(100);
  },

  async stopRecord() {
    if (!this._recorder || this._recorder.state === 'inactive') return null;
    const recorder = this._recorder;
    const chunks = this._chunks;
    this._recorder = null;
    this._chunks = [];

    return new Promise(resolve => {
      let resolved = false;
      const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };
      const timer = setTimeout(() => done(null), 3000);
      recorder.onstop = async () => {
        clearTimeout(timer);
        try {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          const b64 = await new Promise(res => {
            const r = new FileReader();
            r.onloadend = () => {
              const dataUrl = r.result;
              res(dataUrl ? dataUrl.split(',')[1] : '');
            };
            r.onerror = () => res('');
            r.readAsDataURL(blob);
          });
          done(b64 ? 'data:audio/webm;base64,' + b64 : null);
        } catch(e) { done(null); }
      };
      try { recorder.stop(); } catch(e) { done(null); }
    });
  },

  /** 对话结束：停录音，但保留摄像头/麦克风流供下次复用 */
  stop() {
    if (this._recorder) {
      try {
        if (this._recorder.state === 'recording') this._recorder.stop();
        this._recorder.ondataavailable = null;
        this._recorder.onstop = null;
      } catch(e) {}
      this._recorder = null;
    }
    this._chunks = [];

    if (this._audioCtx) {
      this._audioCtx.close().catch(() => {});
      this._audioCtx = null;
    }
    this._node = null;
    this._worklet = null;
    this._pcmChunks = null;
  },

  /** 彻底关闭所有设备（仅在窗口关闭/失焦/出错时调用） */
  shutdown() {
    this.stop();
    if (this._stream) {
      this._stream.getTracks().forEach(t => { try { t.stop(); } catch(e) {} });
      this._stream = null;
    }
    if (this._video) {
      this._video.srcObject = null;
      this._video.pause();
    }
  },
};
