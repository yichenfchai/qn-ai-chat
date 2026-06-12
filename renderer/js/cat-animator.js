const CatAnimator={_blinkTimer:null,_yawnTimer:null,_earTwitchTimer:null,
initIdleAnimations(){this._startBlinks();this._startYawns();this._startEarTwitch()},
cleanup(){clearTimeout(this._blinkTimer);clearTimeout(this._yawnTimer);clearTimeout(this._earTwitchTimer)},
_startBlinks(){const s=()=>{this._blinkTimer=setTimeout(()=>{document.querySelectorAll(".cat-eye").forEach(e=>{e.style.animation="none";e.offsetHeight;e.style.animation=""});s()},3000+Math.random()*5000)};s()},
_startYawns(){const s=()=>{this._yawnTimer=setTimeout(()=>{if(typeof stateMachine!=="undefined"&&!stateMachine.is(CatStates.IDLE)){s();return}const m=document.getElementById("cat-mouth");const ml=m?.querySelector(".mouth-line");if(!ml)return;ml.style.animation="yawn-mouth .8s ease-in-out";m.classList.add("sleepy");setTimeout(()=>{ml.style.animation="";m.classList.remove("sleepy");s()},800)},180000+Math.random()*300000)};s()},
_startEarTwitch(){const s=()=>{this._earTwitchTimer=setTimeout(()=>{if(typeof stateMachine!=="undefined"&&stateMachine.is(CatStates.LISTENING)){s();return}const el=document.querySelector(".ear-left"),er=document.querySelector(".ear-right");el?.classList.add("twitching");er?.classList.add("twitching");setTimeout(()=>{el?.classList.remove("twitching");er?.classList.remove("twitching");s()},2000)},8000+Math.random()*15000)};s()},
applyStateExpression(state){const m={IDLE:"idle",LISTENING:"listening",THINKING:"thinking",SPEAKING:"speaking",EXECUTING:"thinking",ERROR:"sad"};CatRenderer.setExpression(m[state]||"idle")},
doHappyJump(){CatRenderer.setExpression("happy");setTimeout(()=>{if(typeof stateMachine!=="undefined"&&stateMachine.is(CatStates.IDLE))CatRenderer.setExpression("idle")},1200)}
};
