/**
 * PixelCat 渲染进程入口
 * 
 * 完整流程：
 *   按住空格 → 开摄像头 + 开STT → 猫变倾听 → 
 *   松手 → 抓帧 + 取转录 → 猫变思考 → IPC发送 →
 *   接收流式token → 猫变说话 → 气泡逐字显示 + TTS朗读 →
 *   流结束 → 猫变空闲
 */

(function () {
  'use strict';

  let spacePressed = false;

  // ===== 错误边界 =====
  window.addEventListener('error', (event) => {
    console.error('[PixelCat] Error:', event.error);
    stateMachine?.transition('error', { message: '出了点问题...' });
  });

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[PixelCat] Rejection:', event.reason);
    stateMachine?.transition('error', { message: '网络好像不太稳定喵...' });
  });

  // ===== 空格键 =====
  document.addEventListener('keydown', async (event) => {
    if (event.code === 'Space' && !spacePressed && !event.repeat) {
      event.preventDefault();
      spacePressed = true;
      resetIdleTimer();

      // 打开摄像头
      const cameraOk = await mediaCapture.startCamera();
      if (!cameraOk) {
        spacePressed = false;
        return;
      }

      // 开始语音识别
      mediaCapture.startListening();
      stateMachine.transition('listening');
      console.log('[PixelCat] Listening...');
    }
  });

  document.addEventListener('keyup', async (event) => {
    if (event.code === 'Space' && spacePressed) {
      event.preventDefault();
      spacePressed = false;

      if (stateMachine.state !== 'listening') return;

      // 停止语音识别
      mediaCapture.stopListening();

      // 抓取摄像头帧
      const frame = mediaCapture.captureFrame();

      // 关闭摄像头
      mediaCapture.stopCamera();

      // 获取转录文本
      let text = mediaCapture.transcript.trim();
      if (!text) {
        // 没识别到文字
        stateMachine.transition('speaking', {
          text: '喵？我没听清，再说一次吧~'
        });
        setTimeout(() => stateMachine.transition('idle'), 2500);
        return;
      }

      console.log('[PixelCat] Sending:', text, frame ? `+ image(${Math.round(frame.length/1024)}KB)` : '');

      // 猫变思考
      stateMachine.transition('thinking');

      // 调用 AI
      await sendToAI(text, frame);
    }
  });

  // ===== 发送到 AI（流式） =====
  async function sendToAI(text, imageBase64) {
    if (!window.pixelcat) {
      stateMachine.transition('speaking', {
        text: '我的大脑还没启动喵...请稍等~'
      });
      setTimeout(() => stateMachine.transition('idle'), 2500);
      return;
    }

    let fullText = '';
    let speakingStarted = false;

    // 监听流式 token
    window.pixelcat.onStreamToken((token) => {
      if (!speakingStarted) {
        stateMachine.transition('speaking', { text: token });
        speakingStarted = true;
        // 开始 TTS（等凑够一句再读）
        startTTSIfReady();
      } else {
        // 追加到气泡
        fullText += token;
        showSpeechBubble(fullText);
      }
    });

    // 监听流结束
    window.pixelcat.onStreamEnd(() => {
      // 朗读剩余文字
      speakRemaining(fullText);
      stateMachine.transition('idle');
      window.pixelcat.removeAllListeners('ai:streamToken');
      window.pixelcat.removeAllListeners('ai:streamEnd');
      window.pixelcat.removeAllListeners('ai:streamError');
    });

    // 监听错误
    window.pixelcat.onStreamError((error) => {
      const messages = {
        'AI_TIMEOUT': 'AI 想太久了喵...再试一次？',
        'AI_INVALID_KEY': 'API Key 不对喵，检查 .env 文件~',
        'AI_RATE_LIMIT': '说话太快了喵，稍等一下~',
        'NETWORK_ERROR': '网络断了喵，检查连接~',
      };
      const msg = messages[error.code] || error.message || '出错了喵...';
      stateMachine.transition('error', { message: msg });
      window.pixelcat.removeAllListeners('ai:streamToken');
      window.pixelcat.removeAllListeners('ai:streamEnd');
      window.pixelcat.removeAllListeners('ai:streamError');
    });

    // 发送
    try {
      const result = await window.pixelcat.sendMessage(text, imageBase64);
      if (result && !speakingStarted) {
        // 非流式回退（某些 API 不支持流式）
        stateMachine.transition('speaking', { text: result });
        setTimeout(() => stateMachine.transition('idle'), 5000);
      }
    } catch (err) {
      console.error('[PixelCat] sendMessage error:', err);
      stateMachine.transition('error', { message: '发送失败喵...' });
    }
  }

  // ===== TTS（简单的语音合成） =====
  let ttsBuffer = '';
  let ttsTimer = null;

  function startTTSIfReady() {
    // 每积累 20 个字读一次
    ttsTimer = setInterval(() => {
      if (ttsBuffer.length < 20) return;
      speak(ttsBuffer);
      ttsBuffer = '';
    }, 2000);
  }

  function speakRemaining(text) {
    if (ttsTimer) clearInterval(ttsTimer);
    if (text) speak(text);
  }

  function speak(text) {
    if (!window.speechSynthesis) return;
    // 停止之前的朗读
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.1;
    utterance.pitch = 1.05;
    utterance.volume = 0.8;

    // 尝试用中文女声
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;

    window.speechSynthesis.speak(utterance);
  }

  // ===== 窗口失焦时停止监听 =====
  window.addEventListener('blur', () => {
    if (spacePressed) {
      spacePressed = false;
      mediaCapture.stopListening();
      mediaCapture.stopCamera();
      if (stateMachine.state === 'listening') {
        stateMachine.transition('idle');
      }
    }
  });

  // ===== 媒体流式追加到气泡 =====
  // showSpeechBubble 只追加文字，不换动画
  const origShowBubble = showSpeechBubble;
  showSpeechBubble = function(text) {
    origShowBubble(text);
    // 追加到 TTS 缓冲
    ttsBuffer += text;
  };

  // ===== ICP 检查 =====
  async function checkIPC() {
    if (!window.pixelcat) return false;
    try {
      await window.pixelcat.ping();
      return true;
    } catch { return false; }
  }

  // ===== 启动 =====
  async function init() {
    console.log('[PixelCat] Starting...');

    // 预加载语音
    if (window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        console.log('[PixelCat] Voices loaded:', window.speechSynthesis.getVoices().length);
      };
    }

    // SpeechRecognition 检查
    const hasSTT = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    console.log('[PixelCat] Capabilities:', {
      electron: !!window.pixelcat,
      speechRecognition: hasSTT,
      speechSynthesis: !!window.speechSynthesis,
    });

    if (!hasSTT) {
      console.warn('[PixelCat] SpeechRecognition not available — will use placeholder text');
    }

    await checkIPC();
    console.log('[PixelCat] Ready');
  }

  init();
})();
