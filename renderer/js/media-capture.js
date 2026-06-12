/**
 * 媒体采集 — 摄像头 + 麦克风 + STT
 */
class MediaCapture {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.recognition = null;
    this.transcript = '';
    this.isListening = false;
  }

  async startCamera() {
    console.log('Camera: start');
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.style.display = 'none';
      this.video.setAttribute('playsinline', '');
      document.body.appendChild(this.video);
    }
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.canvas.width = 640;
      this.canvas.height = 480;
    }

    if (!navigator.mediaDevices) {
      console.log('Camera: no mediaDevices');
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      console.log('Camera: OK');
      return true;
    } catch (err) {
      console.log('Camera error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        stateMachine?.transition('error', { message: '摄像头权限被拒绝喵...请在Windows设置中允许' });
      } else {
        stateMachine?.transition('error', { message: '摄像头错误: ' + err.message });
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
      console.log('Camera: stopped');
    }
  }

  startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      console.log('STT: not available');
      return;
    }

    this.recognition = new SR();
    this.recognition.lang = 'zh-CN';
    this.recognition.continuous = true;
    this.recognition.interimResults = true;
    this.transcript = '';
    this._sttResolve = null;

    this.recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          this.transcript += event.results[i][0].transcript;
        }
      }
      console.log('STT interim:', this.transcript);
    };

    this.recognition.onerror = (event) => {
      console.log('STT error:', event.error);
      if (this._sttResolve) {
        this._sttResolve();
        this._sttResolve = null;
      }
    };

    this.recognition.onend = () => {
      console.log('STT ended, transcript:', this.transcript);
      this.isListening = false;
      if (this._sttResolve) {
        this._sttResolve();
        this._sttResolve = null;
      }
    };

    try {
      this.recognition.start();
      this.isListening = true;
      console.log('STT: listening');
    } catch (err) {
      console.log('STT start error:', err);
    }
  }

  /** 停止并等待识别结果（修复异步竞态） */
  async stopListening() {
    if (!this.isListening || !this.recognition) return;
    
    const promise = new Promise((resolve) => {
      this._sttResolve = resolve;
      // 兜底：2秒后强制 resolve
      setTimeout(resolve, 2000);
    });

    try {
      this.recognition.stop();
    } catch (err) {
      console.log('STT stop error:', err);
    }

    await promise;
    this.isListening = false;
    console.log('STT final transcript:', this.transcript);
  }
}

const mediaCapture = new MediaCapture();
console.log('MediaCapture ready');
