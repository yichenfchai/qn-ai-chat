/**
 * PixelCat 渲染进程入口
 */

// === 调试面板 ===
let _debugPanel = null;
function getDebugPanel() {
  if (!_debugPanel) _debugPanel = document.getElementById('debug-panel');
  return _debugPanel;
}
function debugLog(msg) {
  console.log('[PixelCat]', msg);
  const panel = getDebugPanel();
  if (panel) {
    const time = new Date().toLocaleTimeString();
    panel.innerHTML += `<div>[${time}] ${msg}</div>`;
    panel.scrollTop = panel.scrollHeight;
  }
}

// 全局错误捕获
window.addEventListener('error', (e) => {
  debugLog('ERROR: ' + (e.error?.message || e.message));
});

(function () {
  'use strict';

  debugLog('App starting...');

  let spacePressed = false;

  // ===== 空格键 =====
  document.addEventListener('keydown', async (event) => {
    if (event.code === 'Space' && !spacePressed && !event.repeat) {
      event.preventDefault();
      spacePressed = true;
      debugLog('Space pressed');
      resetIdleTimer();

      debugLog('Starting camera...');
      const cameraOk = await mediaCapture.startCamera();
      debugLog('Camera result: ' + cameraOk);
      if (!cameraOk) {
        debugLog('Camera FAILED');
        spacePressed = false;
        stateMachine.transition('error', { message: '摄像头启动失败' });
        return;
      }

      debugLog('Camera OK, starting mic...');
      mediaCapture.startListening();
      stateMachine.transition('listening');
    }
  });

  document.addEventListener('keyup', async (event) => {
    if (event.code === 'Space' && spacePressed) {
      event.preventDefault();
      spacePressed = false;

      if (stateMachine.state !== 'listening') return;

      // 停止语音识别（等待结果）
      await mediaCapture.stopListening();

      // 抓取摄像头帧
      const frame = mediaCapture.captureFrame();

      // 关闭摄像头
      mediaCapture.stopCamera();

      // 获取转录文本
      let text = mediaCapture.transcript.trim();
      if (!text) {
        // STT 没识别到（可能被墙），提示文字输入
        stateMachine.transition('speaking', {
          text: '喵？没听清...双击我打字吧~'
        });
        setTimeout(() => stateMachine.transition('idle'), 2500);
        return;
      }

      debugLog('STT transcript: ' + text + (frame ? ' + image' : ''));
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
      stateMachine.transition('error', {
        message: '大脑还没启动喵...重启一下？'
      });
      setTimeout(() => stateMachine.transition('idle'), 3000);
      return;
    }

    // TTS buffer
    ttsBuffer = '';

    let fullText = '';
    let speakingStarted = false;

    // 监听流式 token
    window.pixelcat.onStreamToken((token) => {
      fullText += token;
      if (!speakingStarted) {
        stateMachine.transition('speaking', { text: token });
        speakingStarted = true;
        startTTSIfReady();
      } else {
        showSpeechBubble(fullText);
      }
      ttsBuffer += token;
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

  // ===== 追加到 TTS 缓冲 =====
  // 在 sendToAI 的 onStreamToken 回调里直接追加

  // ===== ICP 检查 =====
  async function checkIPC() {
    if (!window.pixelcat) return false;
    try {
      await window.pixelcat.ping();
      return true;
    } catch { return false; }
  }

  // ===== 双击文字输入（STT不可用时的兜底） =====
  document.getElementById('pet').addEventListener('dblclick', async () => {
    const textInputArea = document.getElementById('text-input-area');
    const textInput = document.getElementById('text-input');
    if (!textInputArea || !textInput) return;

    textInputArea.style.display = 'block';
    textInput.value = '';
    textInput.focus();

    // 打开摄像头抓帧
    await mediaCapture.startCamera();

    const handleSubmit = async () => {
      const text = textInput.value.trim();
      if (!text) return;
      textInputArea.style.display = 'none';
      textInput.removeEventListener('keydown', onKey);
      resetIdleTimer();
      stateMachine.transition('thinking');
      const frame = mediaCapture.captureFrame();
      mediaCapture.stopCamera();
      sendToAI(text, frame);
    };

    const onKey = (e) => {
      if (e.key === 'Enter') handleSubmit();
      if (e.key === 'Escape') {
        textInputArea.style.display = 'none';
        textInput.removeEventListener('keydown', onKey);
        mediaCapture.stopCamera();
      }
    };

    textInput.addEventListener('keydown', onKey);
  });

  // ===== 启动 =====
  async function init() {
    debugLog('Init...');
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

    const ipcOk = await checkIPC();
    debugLog('IPC: ' + ipcOk);
    debugLog('STT available: ' + !!(window.SpeechRecognition || window.webkitSpeechRecognition));
    debugLog('Ready! Press SPACE to talk');
    console.log('[PixelCat] Ready');
  }

  init();
})();
