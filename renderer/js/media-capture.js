class MediaCapture {
  constructor() {
    this.video = null;
    this.canvas = null;
    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.audioBlob = null;
    this.isListening = false;
    this._resolveAudio = null;
  }

  async startCamera() {
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.style.display = 'none';
      this.video.setAttribute('playsinline', '');
      this.video.muted = true;
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
        audio: true,
      });
      this.video.srcObject = this.stream;
      await this.video.play();
      return true;
    } catch (err) {
      console.log('Camera error:', err.name);
      stateMachine?.transition('error', { message: '设备权限被拒绝喵...' });
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

  /** 开始录音 */
  startListening() {
    this.audioChunks = [];
    this.audioBlob = null;

    const audioTrack = this.stream?.getAudioTracks()[0];
    if (!audioTrack) {
      console.log('No audio track');
      return;
    }

    const audioStream = new MediaStream([audioTrack]);
    this.mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm',
    });

    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      this.audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
      console.log('Audio recorded:', this.audioBlob.size, 'bytes');
      if (this._resolveAudio) {
        this._resolveAudio(this.audioBlob);
        this._resolveAudio = null;
      }
    };

    this.mediaRecorder.start(100);
    this.isListening = true;
    if (typeof debugLog === 'function') debugLog('Audio: recording');
  }

  /** 停止录音，返回 base64 音频 */
  async stopListening() {
    if (!this.isListening) return '';

    const promise = new Promise((resolve) => {
      this._resolveAudio = resolve;
      setTimeout(() => resolve(null), 5000);
    });

    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }

    const blob = await promise;
    this.isListening = false;

    if (!blob) return '';

    // Blob → base64
    const buffer = await blob.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    if (typeof debugLog === 'function') debugLog('Audio: ' + base64.length + ' chars');
    return 'data:audio/webm;base64,' + base64;
  }
}

const mediaCapture = new MediaCapture();
