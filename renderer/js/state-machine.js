/**
 * 像素猫状态机
 * 
 * 状态转换：
 *   IDLE → LISTENING → THINKING → SPEAKING/EXECUTING/ERROR → IDLE
 * 
 * 精灵动画由 sprite-animator.js 处理
 * 状态通过 CSS class 控制视觉效果
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

  transition(newState, data) {
    const oldState = this.current;
    if (oldState === newState) return;

    console.debug('[StateMachine] ' + oldState + ' -> ' + newState);
    this._exitState(oldState);
    this.current = newState;
    this._enterState(newState, data);
    this.listeners.forEach(fn => fn(newState, oldState, data));
  }

  onChange(fn) {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(f => f !== fn); };
  }

  get state() { return this.current; }

  _exitState(state) {
    switch (state) {
      case CatStates.SPEAKING:
        // TTS stop 由 tts.js 处理
        break;
      default: break;
    }
  }

  _enterState(state, data) {
    switch (state) {
      case CatStates.IDLE:
        updateCatExpression('idle');
        updateStatusIndicator('idle');
        hideSpeechBubble();
        break;
      case CatStates.LISTENING:
        updateCatExpression('idle'); // 精灵图只有一套，用idle
        updateStatusIndicator('listening');
        showSpeechBubble('...');
        break;
      case CatStates.THINKING:
        updateCatExpression('thinking');
        updateStatusIndicator('thinking');
        break;
      case CatStates.SPEAKING:
        updateCatExpression('speaking');
        updateStatusIndicator('speaking');
        if (data && data.text) showSpeechBubble(data.text);
        break;
      case CatStates.EXECUTING:
        updateCatExpression('thinking');
        updateStatusIndicator('speaking');
        if (data && data.message) showSpeechBubble(data.message);
        break;
      case CatStates.ERROR:
        updateCatExpression('error');
        updateStatusIndicator('error');
        showSpeechBubble((data && data.message) || '出错了喵...');
        setTimeout(() => {
          if (this.current === CatStates.ERROR) {
            this.transition(CatStates.IDLE);
          }
        }, 3000);
        break;
      case CatStates.SLEEPING:
        updateCatExpression('sleeping');
        updateStatusIndicator('idle');
        hideSpeechBubble();
        break;
      default: break;
    }
  }
}

// 全局实例
const stateMachine = new CatStateMachine();

// 空闲计时（15分钟无交互 → 睡觉）
let lastInteraction = Date.now();

function resetIdleTimer() {
  lastInteraction = Date.now();
  if (stateMachine.state === CatStates.SLEEPING) {
    showZZZ(false);
    stateMachine.transition(CatStates.IDLE);
  }
}

setInterval(() => {
  const idleTime = Date.now() - lastInteraction;
  if (idleTime > 15 * 60 * 1000 && stateMachine.state === CatStates.IDLE) {
    stateMachine.transition(CatStates.SLEEPING);
  }
}, 30000);
