import React, { useRef, useEffect } from 'react';

const MAX_CONCURRENT_AUDIO = 20;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function createFlapBuffer(ctx, volume = 0.2) {
  const duration = 0.03;
  const sampleRate = ctx.sampleRate;
  const buffer = ctx.createBuffer(1, duration * sampleRate, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < data.length; i++) {
    const env = Math.pow(1 - i / data.length, 2); // linear decay
    data[i] = (Math.random() * 2 - 1) * volume * env;
  }

  return buffer;
}

const flapBuffer = createFlapBuffer(audioCtx);

let flapIndex = 0;

const gainPool = Array.from({ length: MAX_CONCURRENT_AUDIO }, () => {
  const gain = audioCtx.createGain();
  gain.connect(audioCtx.destination);
  return gain;
});

const playFlip = () => {
  const gainNode = gainPool[flapIndex % MAX_CONCURRENT_AUDIO];
  flapIndex = (flapIndex + 1) % MAX_CONCURRENT_AUDIO;
  const source = audioCtx.createBufferSource();
  source.buffer = flapBuffer;
  source.connect(gainNode);
  source.start();
};

const CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ$%0123456789.+-";
const CHARS = CHARSET.split("");
const CHAR_INDEX = Object.fromEntries(CHARS.map((c, i) => [c, i]));
const BG_COLOR = "rgb(0,0,0)";
const FONT_COLOR = "rgb(240,240,240)";
const FLIP_SPEED = 15;
//adjust width and height using parent div size
const width = 96; // letter width
const height = 128; // letter height
const borderWidth = 8; // canvas border
const fontSize = Math.floor(height * 0.8);

// prerender every letter on its own canvas
const LETTER_CANVASES = CHARS.map(l => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = BG_COLOR;
  fillRoundedRect(ctx, width * 0.025, height * 0.025, width * 0.95, height * 0.95, width * 0.1);
  ctx.fillStyle = FONT_COLOR;
  ctx.font = "bold " + fontSize + "px 'Roboto Mono', monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(l, width * 0.5, height * 0.5);

  // cutout pivot
  ctx.clearRect(0, height * 0.475, width, height * 0.05);
  ctx.clearRect(0, height * 0.4, width * 0.1, height * 0.2);
  ctx.clearRect(width * 0.9, height * 0.4, width * 0.1, height * 0.2);

  return canvas;
})

function fillRoundedRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.arcTo(x + width, y, x + width, y + radius, radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
  ctx.lineTo(x + radius, y + height);
  ctx.arcTo(x, y + height, x, y + height - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
  ctx.fill();
}

const Flippy = ({ maxLen, target = "" }) => {
  const canvasRef = useRef(null);
  const lettersRef = useRef(new Array(maxLen).fill(0.0)); // whole number represents current index, decimal represents animation state
  const delayRef = useRef(new Array(maxLen).fill(0.0)); // delay before progressing towards target

  const createDelay = (i) => {
    delayRef.current[i] = Math.random() * 0.5;
  }
  for (let i = 0; i < maxLen; i++) {
    createDelay(i);
    delayRef.current[i] *= 10;
  }

  useEffect(() => {
    const letters = lettersRef.current;
    const delay = delayRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = width * maxLen + borderWidth * 2;
    canvas.height = height + borderWidth * 2;

    let animationFrameId;
    let prevTime = Date.now();

    const drawLoop = () => {
      let currTime = Date.now();
      let deltaTime = Math.min((currTime - prevTime) / 1000.0, 500.0);
      prevTime = currTime;

      ctx.fillStyle = "rgb(19, 19, 19)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "rgba(81, 81, 81, 1)";
      ctx.fillRect(borderWidth, borderWidth, width * maxLen, height);
      for (let i = 0; i < maxLen; i++) {
        // UPDATE LETTER STATE

        let t = i < target.length ? CHAR_INDEX[target[i].toUpperCase()] ?? 0 : 0;
        if (t != letters[i]) {
          let effectiveDeltaTime = deltaTime;
          if (delay[i] > 0) {
            let d = Math.min(delay[i], effectiveDeltaTime);
            effectiveDeltaTime -= d;
            delay[i] -= d;
          }
          let prevLetterIndex = Math.floor(letters[i]);
          let dist = (t + CHARS.length - letters[i]) % CHARS.length;
          letters[i] += Math.min(dist, FLIP_SPEED * effectiveDeltaTime);
          letters[i] = ((letters[i] % CHARS.length) + CHARS.length) % CHARS.length;
          if (prevLetterIndex != Math.floor(letters[i])) {
            playFlip();
          }

          // add random delay if reachest target
          if (t == letters[i]) {
            createDelay(i);
          }
        }
    
        // DRAW LETTER

        ctx.save();
        ctx.translate(borderWidth + i * width, borderWidth);

        // bg
        let letterTop = LETTER_CANVASES[Math.floor(letters[i] + 1) % CHARS.length];
        let letterBot = LETTER_CANVASES[Math.floor(letters[i])];

        // draw pivot
        ctx.fillStyle = "rgb(0,0,0)";
        ctx.fillRect(0, height * 0.49, width, height * 0.02);
        const gradient = ctx.createLinearGradient(0, height * 0.425, 0, height * 0.575);
        gradient.addColorStop(0, "rgb(64,64,64)");    // top color
        gradient.addColorStop(1, "rgb(0,0,0)");   // bottom color
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height * 0.425, width * 0.05, height * 0.15);
        ctx.fillRect(width * 0.95, height * 0.425, width * 0.05, height * 0.15);

        // top static letter
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, width, height * 0.5);
        ctx.clip();
        ctx.drawImage(letterTop, 0, 0);
        ctx.restore();

        // bottom static letter
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, height * 0.5, width, height * 0.5);
        ctx.clip();
        ctx.drawImage(letterBot, 0, 0);
        ctx.restore();

        // flipping letter
        ctx.save();
        let p = letters[i] - Math.floor(letters[i]);

        // modify p slightly to add effect of gravity
        p = Math.pow(p, 2.0);

        let scale = Math.cos(p * Math.PI);
        ctx.translate(0, height * 0.5);
        ctx.scale(1, Math.abs(scale));
        ctx.translate(0, -height * 0.5);
        if (scale > 0) {
          // draw bottom letter top half
          ctx.beginPath();
          ctx.rect(0, 0, width, height * 0.5);
          ctx.clip();
          ctx.drawImage(letterBot, 0, 0);
        } else if (scale < 0) {
          // draw top letter bottom half
          ctx.beginPath();
          ctx.rect(0, height * 0.5, width, height * 0.5);
          ctx.clip();
          ctx.drawImage(letterTop, 0, 0);
        }
        // ctx.fillRect(0, 0, width, height);
        ctx.restore();
        
        ctx.restore();
      }
      
      animationFrameId = requestAnimationFrame(drawLoop);
    }

    drawLoop();

    return () => cancelAnimationFrame(animationFrameId);
  }, [maxLen, target]);

  return (
    <div>
      <canvas ref={canvasRef} style={{ display: "block", width: "100%", height: "100%" }} />
    </div>
  );
};

export default Flippy;