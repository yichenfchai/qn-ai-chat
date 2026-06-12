/**
 * 媒体采集 — 摄像头 + 阿里云NLS语音识别
 */
class MediaCapture {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.transcript = '';
    this.isListening = false;

    // NLS
    this.nlsWs = null;
    this.nlsAppKey = '';
    this.nlsUrl = '';
    this.audioContext = null;
    this.processor = null;
    this._sttResolve = null;
  }

  // ===== 摄像头 =====
  async startCamera() {
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.style.display = 'none';
      this.video.setAttribute('playsinline', '');
      document.body.appendChild(this.video);
    }
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640; this.canvas.height = 480;
    }
    if (!navigator.mediaDevices) return false;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: true,  // 同时获取音频
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (err) {
      console.log('Camera error:', err.name);
      if (err.name === 'NotAllowedError') {
        stateMachine?.transition('error', { message: '摄像头/麦克风权限被拒绝喵...' });
      } else {
        stateMachine?.transition('error', { message: '设备错误: ' + err.message });
      }
      return false;
    }
  }

  captureFrame() {
    if (!this.video || !this.canvas || !this.stream) return null;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(this.video, 0, 0, 640, 480);
    return this.canvas.toDataURL('image/jpeg', 0.6);
  }

  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
    }
  }

  // ===== NLS 语音识别 =====
  async startListening() {
    if (!this.stream) {
      console.log('STT: no audio stream');
      return;
    }

    this.transcript = '';

    // 获取 NLS 配置
    try {
      const cfg = await window.pixelcat.getNLSToken();
      this.nlsAppKey = cfg.appKey;
      this.nlsUrl = cfg.url;
      if (!this.nlsAppKey) {
        console.log('STT: no NLS_APP_KEY configured');
        if (typeof debugLog === 'function') debugLog('NLS: no AppKey');
        return;
      }
    } catch (e) {
      console.log('STT: getNLSToken failed', e);
      return;
    }

    if (typeof debugLog === 'function') debugLog('NLS: connecting...');

    // 创建 AudioContext（48kHz → 16kHz 重采样）
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
    const source = this.audioContext.createMediaStreamSource(this.stream);

    // ScriptProcessor 做重采样到 16kHz
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);

    // 打开 NLS WebSocket
    this.nlsWs = new WebSocket(this.nlsUrl);
    this.nlsWs.binaryType = 'arraybuffer';

    this.nlsWs.onopen = () => {
      if (typeof debugLog === 'function') debugLog('NLS: connected');
      // 发送 start 命令
      const startCmd = JSON.stringify({
        header: {
          name: 'StartRecognition',
          appkey: this.nlsAppKey,
          namespace: 'SpeechRecognizer',
        },
        payload: {
          format: 'pcm',
          sample_rate: 16000,
          enable_intermediate_result: true,
          enable_punctuation_prediction: true,
          enable_inverse_text_normalization: true,
        },
      });
      this.nlsWs.send(startCmd);
    };

    this.nlsWs.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          const result = msg.payload?.result;
          if (result) {
            this.transcript = result;
            if (typeof debugLog === 'function') debugLog('NLS: ' + result);
          }
        } catch (e) {}
      }
    };

    this.nlsWs.onerror = (e) => {
      console.log('NLS ws error');
      if (typeof debugLog === 'function') debugLog('NLS: ws error');
    };

    this.nlsWs.onclose = () => {
      console.log('NLS ws closed');
    };

    // 推送音频数据
    this.processor.onaudioprocess = (event) => {
      if (!this.nlsWs || this.nlsWs.readyState !== WebSocket.OPEN) return;
      const input = event.inputBuffer.getChannelData(0);
      // Float32 → Int16 PCM
      const pcm = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32767));
      }
      this.nlsWs.send(pcm.buffer);
    };

    this.isListening = true;
  }

  async stopListening() {
    if (!this.isListening) return;

    const promise = new Promise((resolve) => {
      this._sttResolve = resolve;
      setTimeout(resolve, 3000); // 兜底3秒
    });

    // 停止音频处理
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    // 发送 NLS stop
    if (this.nlsWs && this.nlsWs.readyState === WebSocket.OPEN) {
      const stopCmd = JSON.stringify({
        header: { name: 'StopRecognition', appkey: this.nlsAppKey, namespace: 'SpeechRecognizer' },
        payload: {},
      });
      this.nlsWs.send(stopCmd);

      // 等待识别结果
      this.nlsWs.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.header?.name === 'RecognitionCompleted') {
              this.transcript = msg.payload?.result || this.transcript;
              if (typeof debugLog === 'function') debugLog('NLS final: ' + this.transcript);
              this.nlsWs.close();
              if (this._sttResolve) { this._sttResolve(); this._sttResolve = null; }
            }
          } catch (e) {}
        }
      };

      // 3秒后强制结束
      setTimeout(() => {
        if (this.nlsWs?.readyState === WebSocket.OPEN) {
          this.nlsWs.close();
        }
      }, 3000);
    } else {
      if (this._sttResolve) { this._sttResolve(); this._sttResolve = null; }
    }

    await promise;
    this.isListening = false;
    console.log('STT final:', this.transcript);
  }
}

const mediaCapture = new MediaCapture();
