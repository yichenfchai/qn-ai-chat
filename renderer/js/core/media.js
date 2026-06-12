/**
 * 媒体采集 — 摄像头 + 音频
 * 纯函数，无 DOM 依赖
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

    this._canvas = document.createElement('canvas');
    this._canvas.width = 640;
    this._canvas.height = 480;
  },

  /** 打开摄像头和麦克风 */
  async start() {
    if (!this._video) this.init();
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,
      });
      this._video.srcObject = this._stream;
      await this._video.play();
      return true;
    } catch (e) {
      return false;
    }
  },

  /** 抓取一帧 → JPEG base64 */
  captureFrame() {
    if (!this._stream || !this._canvas) return null;
    const ctx = this._canvas.getContext('2d');
    ctx.drawImage(this._video, 0, 0, 640, 480);
    return this._canvas.toDataURL('image/jpeg', 0.6);
  },

  /** 开始录音 PCM (AudioWorklet) */
  async startRecord() {
    this._pcmChunks = [];
    const track = this._stream?.getAudioTracks()[0];
    if (!track) return;

    this._audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    await this._audioCtx.audioWorklet.addModule('pcm-processor.js');

    const src = this._audioCtx.createMediaStreamSource(new MediaStream([track]));
    this._worklet = new AudioWorkletNode(this._audioCtx, 'pcm-processor');
    src.connect(this._worklet);

    this._worklet.port.onmessage = (e) => {
      this._pcmChunks.push(new Int16Array(e.data));
    };
  },

  /** 停止录音 → WAV base64 */
  async stopRecord() {
    if (this._worklet) { this._worklet.disconnect(); this._worklet = null; }
    if (this._audioCtx) { await this._audioCtx.close(); this._audioCtx = null; }
    if (!this._pcmChunks?.length) return null;

    const total = this._pcmChunks.reduce((s, c) => s + c.length, 0);
    const wav = new ArrayBuffer(44 + total * 2);
    const v = new DataView(wav);
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); v.setUint32(4, 36 + total * 2, true); ws(8, 'WAVE');
    ws(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true);
    v.setUint16(22, 1, true); v.setUint32(24, 16000, true);
    v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    ws(36, 'data'); v.setUint32(40, total * 2, true);
    let off = 44;
    for (const c of this._pcmChunks) { for (let i = 0; i < c.length; i++) { v.setInt16(off, c[i], true); off += 2; } }
    const bytes = new Uint8Array(wav);
    let b64 = '';
    for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
    return 'data:audio/wav;base64,' + btoa(b64);
  },


    /** 关闭所有设备 */
  stop() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
  },
};
