/**
 * 媒体采集模块 — 摄像头 + 麦克风 + STT
 * 
 * 数据流:
 *   摄像头: <video>静默播放 → Canvas抓帧 → JPEG base64
 *   麦克风: Web Speech API → 转录文本
 */

class MediaCapture {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.recognition = null;
    this.transcript = '';
    this.isListening = false;
    this.onTranscriptReady = null;
  }

  /** 初始化摄像头（创建隐藏的video+canvas） */
  async initCamera() {
    this.video = document.createElement('video');
    this.video.style.display = 'none';
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('autoplay', '');
    document.body.appendChild(this.video);

    this.canvas = document.createElement('canvas');
    this.canvas.width = 640;
    this.canvas.height = 480;
  }

  /** 打开摄像头 */
  async startCamera() {
    if (!this.video) await this.initCamera();

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user',
        },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      console.log('[Media] Camera started');
      return true;
    } catch (err) {
      console.error('[Media] Camera error:', err);
      if (err.name === 'NotAllowedError') {
        stateMachine?.transition('error', { message: '摄像头权限被拒绝喵...' });
      } else if (err.name === 'NotFoundError') {
        stateMachine?.transition('error', { message: '没有找到摄像头喵...' });
      }
      return false;
    }
  }

  /** 抓取当前帧 → JPEG base64 */
  captureFrame() {
    if (!this.video || !this.canvas || !this.stream) return null;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(this.video, 0, 0, 640, 480);
    return this.canvas.toDataURL('image/jpeg', 0.6);
  }

  /** 关闭摄像头 */
  stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => t.stop());
      this.stream = null;
      console.log('[Media] Camera stopped');
    }
  }

  /** 初始化语音识别 */
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('[Media] SpeechRecognition not available');
      return false;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;    // 持续识别
    this.recognition.interimResults = true; // 显示临时结果

    this.recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      if (final) this.transcript = final;
    };

    this.recognition.onerror = (event) => {
      console.error('[Media] STT error:', event.error);
      if (event.error === 'not-allowed') {
        stateMachine?.transition('error', { message: '麦克风权限被拒绝喵...' });
      }
    };

    this.recognition.onend = () => {
      console.log('[Media] STT ended, transcript:', this.transcript);
      if (this.onTranscriptReady && this.transcript) {
        this.onTranscriptReady(this.transcript);
      }
      this.isListening = false;
    };

    return true;
  }

  /** 开始听（按住空格时调用） */
  startListening() {
    if (!this.recognition) {
      if (!this.initSpeechRecognition()) {
        // 无 STT 能力，退回手动输入
        console.warn('[Media] No STT, using placeholder');
        return;
      }
    }

    this.transcript = '';
    this.isListening = true;
    try {
      this.recognition.start();
      console.log('[Media] Listening...');
    } catch (err) {
      console.warn('[Media] STT start error:', err);
    }
  }

  /** 停止听（松开空格时调用） */
  stopListening() {
    if (!this.isListening) return;
    try {
      this.recognition.stop();
    } catch (err) {
      console.warn('[Media] STT stop error:', err);
    }
    this.isListening = false;
  }

  /** 手动设置文字（STT不可用时） */
  setManualText(text) {
    this.transcript = text;
    if (this.onTranscriptReady) {
      this.onTranscriptReady(text);
    }
  }
}

// 全局实例
const mediaCapture = new MediaCapture();
