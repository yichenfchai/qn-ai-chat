/**
 * 像素猫状态机
 * 
 * 状态转换：
 *   IDLE → LISTENING → THINKING → SPEAKING/EXECUTING/ERROR → IDLE
 * 
 * 每个状态有 enter/exit 回调，驱动猫的动画切换
 */

const CatStates = {
  IDLE: 'idle',
  LISTENING: 'listening',
  THINKING: 'thinking',
  SPEAKING: 'speaking',
  EXECUTING: 'executing',
  ERROR: 'error',
  SLEEPING: 'sleeping',
};

class CatStateMachine {
  constructor() {
    this.current = CatStates.IDLE;
    this.listeners = [];
  }

  /** 状态转换 */
  transition(newState, data) {
    const oldState = this.current;
    if (oldState === newState) return;

    console.debug(`[StateMachine] ${oldState} → ${newState}`);

    // exit 旧状态
    this._exitState(oldState);

    // 切换
    this.current = newState;

    // enter 新状态
    this._enterState(newState, data);

    // 通知监听者
    this.listeners.forEach(fn => fn(newState, oldState, data));
  }

  /** 监听状态变化 */
  onChange(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(f => f !== fn);
    };
  }

  /** 获取当前状态 */
  get state() {
    return this.current;
  }

  // ---- 私有方法 ----

  _exitState(state) {
    switch (state) {
      case CatStates.LISTENING:
        this._stopListening();
        break;
      case CatStates.SPEAKING:
        this._stopSpeaking();
        break;
      case CatStates.THINKING:
        this._stopThinking();
        break;
      default:
        break;
    }
  }

  _enterState(state, data) {
    switch (state) {
      case CatStates.IDLE:
        this._startIdle();
        break;
      case CatStates.LISTENING:
        this._startListening();
        break;
      case CatStates.THINKING:
        this._startThinking();
        break;
      case CatStates.SPEAKING:
        this._startSpeaking(data);
        break;
      case CatStates.EXECUTING:
        this._startExecuting(data);
        break;
      case CatStates.ERROR:
        this._handleError(data);
        break;
      case CatStates.SLEEPING:
        this._startSleeping();
        break;
      default:
        break;
    }
  }

  // ---- 状态行为 ----

  _startIdle() {
    updateCatExpression('idle');
    updateStatusIndicator('idle');
    hideSpeechBubble();
  }

  _startListening() {
    updateCatExpression('listening');
    updateStatusIndicator('listening');
  }

  _stopListening() {
    // 由 media-capture 模块处理
  }

  _startThinking() {
    updateCatExpression('thinking');
    updateStatusIndicator('thinking');
    showSpeechBubble('...');
  }

  _stopThinking() {
    // cleanup
  }

  _startSpeaking(data) {
    updateCatExpression('speaking');
    updateStatusIndicator('speaking');
    if (data && data.text) {
      showSpeechBubble(data.text);
    }
  }

  _stopSpeaking() {
    // TTS 由 tts.js 控制
  }

  _startExecuting(data) {
    updateCatExpression('executing');
    updateStatusIndicator('speaking');
    if (data && data.message) {
      showSpeechBubble(data.message);
    }
  }

  _handleError(data) {
    updateCatExpression('sad');
    updateStatusIndicator('error');
    const msg = (data && data.message) || '出错了喵...';
    showSpeechBubble(msg);

    // 3 秒后自动恢复
    setTimeout(() => {
      if (this.current === CatStates.ERROR) {
        this.transition(CatStates.IDLE);
      }
    }, 3000);
  }

  _startSleeping() {
    updateCatExpression('sleeping');
    updateStatusIndicator('idle');
    hideSpeechBubble();
    showZZZ(true);
  }
}

// ---- 全局实例 ----
const stateMachine = new CatStateMachine();

// ---- UI 更新函数（由 cat-renderer.js 和 app.js 实现） ----

function updateStatusIndicator(state) {
  const indicator = document.getElementById('status-indicator');
  if (!indicator) return;
  indicator.className = state;
}

function updateCatExpression(expression) {
  const cat = document.getElementById('cat');
  if (!cat) return;

  // 移除所有表情类
  const exprs = ['idle', 'listening', 'thinking', 'speaking', 'executing',
                 'excited', 'surprised', 'sleeping', 'blinking', 'error-state',
                 'typing', 'sad'];
  cat.classList.remove(...exprs);

  // 映射到 CSS 类
  const classMap = {
    'idle': 'idle',
    'listening': 'listening',
    'thinking': 'thinking',
    'speaking': 'speaking',
    'executing': 'executing',
    'excited': 'excited',
    'surprised': 'surprised',
    'sleeping': 'sleeping',
    'sad': 'error-state',
  };

  const cssClass = classMap[expression];
  if (cssClass) {
    cat.classList.add(cssClass);
  }

  // 更新嘴巴形状
  updateMouth(expression);
}

function updateMouth(expression) {
  const mouth = document.querySelector('.cat-mouth');
  if (!mouth) return;

  mouth.className = 'cat-mouth';
  const mouthMap = {
    'idle': 'happy',
    'happy': 'happy',
    'excited': 'happy',
    'listening': 'curious',
    'thinking': 'curious',
    'speaking': 'speaking',
    'executing': 'curious',
    'sleeping': 'sleepy',
    'sad': 'bored',
    'surprised': 'curious',
  };

  const mouthClass = mouthMap[expression] || 'happy';
  mouth.classList.add(mouthClass);
}

function showSpeechBubble(text) {
  const bubble = document.getElementById('speech-bubble');
  if (!bubble) return;
  bubble.textContent = text;
  bubble.classList.add('visible');
}

function hideSpeechBubble() {
  const bubble = document.getElementById('speech-bubble');
  if (!bubble) return;
  bubble.classList.remove('visible');
}

function showZZZ(show) {
  const cat = document.getElementById('cat');
  if (!cat) return;

  if (show) {
    if (!cat.querySelector('.zzz')) {
      for (let i = 1; i <= 3; i++) {
        const zzz = document.createElement('div');
        zzz.className = 'zzz';
        zzz.textContent = 'Z';
        zzz.style.position = 'absolute';
        zzz.style.top = (10 + (i - 1) * 15) + 'px';
        zzz.style.right = (30 - (i - 1) * 10) + 'px';
        zzz.style.fontSize = (16 - (i - 1) * 3) + 'px';
        cat.appendChild(zzz);
      }
    }
  } else {
    cat.querySelectorAll('.zzz').forEach(el => el.remove());
  }
}
