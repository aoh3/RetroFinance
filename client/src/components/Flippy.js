import React, { useRef, useEffect } from 'react';

const width = 96; // letter width
const height = 128; // letter height
const borderWidth = 8; // canvas border
const fontSize = Math.floor(height * 0.8);

const BG_COLOR = "rgb(0,0,0)";
const BG_COLOR_LIGHT = "rgb(32,32,32)";
const FONT_COLOR = "rgb(240,240,240)";
const FLIP_SPEED = 15;
const HUE_FADE_SPEED = 0.5;

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

function genCharCanvas(l, bg_color = BG_COLOR, bg_color_light = BG_COLOR_LIGHT, font_color = FONT_COLOR) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, width, height);
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, bg_color);
  gradient.addColorStop(0.4, bg_color_light);
  gradient.addColorStop(0.6, bg_color_light);
  gradient.addColorStop(1, bg_color);
  ctx.fillStyle = gradient;
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
}

const CHAR_GROUPS = [];
const CHAR_GROUP_MAP = {};
const CHAR_CANVAS = {};
CHAR_CANVAS[''] = genCharCanvas('');
function genCharGroup(s) {
  const chars = s.split("");
  let group = {
    chars: chars,
    set: new Set(chars),
    charIndex: Object.fromEntries(chars.map((c, i) => [c, i]))
  };
  for (let i = 0; i < chars.length; i++) {
    CHAR_GROUP_MAP[chars[i]] = CHAR_GROUPS.length;
    CHAR_CANVAS[chars[i]] = genCharCanvas(chars[i]);
  }
  CHAR_GROUPS.push(group);
};

genCharGroup("?");
genCharGroup(" ABCDEFGHIJKLMNOPQRSTUVWXYZ");
genCharGroup("0123456789");
genCharGroup("%$.");
genCharGroup("-+");
genCharGroup("#");

// make white char
CHAR_CANVAS["#"] = genCharCanvas(" ", "rgb(240,240,240)", "rgb(255,255,255)");

function findGroup(char) {
  return CHAR_GROUP_MAP[char] ?? -1;
}

function nextChar(currChar, targetChar) {
  let currSet = findGroup(currChar);
  let targetSet = findGroup(targetChar);
  if (targetSet == -1) {
    targetSet = findGroup('?');
    targetChar = '?';
  }
  if (currChar == targetChar) return '';
  if (currSet != targetSet) {
    return CHAR_GROUPS[targetSet].chars[0];
  } else {
    return CHAR_GROUPS[currSet].chars[(CHAR_GROUPS[currSet].charIndex[currChar] + 1) % CHAR_GROUPS[currSet].chars.length];
  }
}

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

const Flippy = ({ maxLen, target = "" , percent = 0.0}) => {
  const canvasRef = useRef(null);
  const lettersRef = useRef(
    Array.from({ length: maxLen }, () => [' ', '', 0.0]) // current letter, next letter, transition progress
  );
  const delayRef = useRef(
    Array.from({ length: maxLen }, () => Math.random() * 0.1) // delay before progressing towards target
  );
  const hueRef = useRef(0.0);

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
      if (percent < 0.0) {
        hueRef.current = Math.max(-1.0, hueRef.current - deltaTime * HUE_FADE_SPEED);
      } else if (percent > 0.0) {
        hueRef.current = Math.min(1.0, hueRef.current + deltaTime * HUE_FADE_SPEED);
      }
      let hueStrength = Math.abs(hueRef.current);
      ctx.fillStyle = (hueRef.current > 0 ? "rgba(0, 255, 0, " : "rgba(255, 0, 0, ") + hueStrength * 0.5 + ")";
      ctx.fillRect(borderWidth, borderWidth, width * maxLen, height);

      for (let i = 0; i < maxLen; i++) {
        // UPDATE LETTER STATE

        let t = target[i] ?? ' ';
        if (letters[i][0] != t) {
          // account for delay
          let effectiveDeltaTime = deltaTime;
          if (delay[i] > 0) {
            let d = Math.min(delay[i], effectiveDeltaTime);
            effectiveDeltaTime -= d;
            delay[i] -= d;
          }

          // begin routing
          if (letters[i][1] == '') {
            letters[i][1] = nextChar(letters[i][0], t);
          }

          // step towards target
          letters[i][2] += FLIP_SPEED * effectiveDeltaTime;
          let flipped = false;
          while (letters[i][1] != '' && letters[i][2] >= 1.0) {
            letters[i][0] = letters[i][1];
            letters[i][1] = nextChar(letters[i][0], t);
            letters[i][2] -= 1.0;
            flipped = true;
          }

          // reached target
          if (letters[i][1] == '') {
            letters[i][2] = 0.0;
            delay[i] = Math.random() * 0.1; // create delay on reaching target
          }

          // play flip sound
          if (flipped) {
            playFlip();
          }
        } else {
          letters[i][1] = '';
          letters[i][2] = 0.0;
        }
    
        // DRAW LETTER

        ctx.save();
        ctx.translate(borderWidth + i * width, borderWidth);

        // bg
        let letterBot = CHAR_CANVAS[letters[i][0]];
        let letterTop = letters[i][1] == '' ? letterBot : CHAR_CANVAS[letters[i][1]];
        if (letterTop == undefined) {
          console.log(letters[i][0] + " not found");
          continue;
        }
        if (letterBot == undefined) {
          console.log(letters[i][1] + " not found");
          continue;
        }

        // draw pivot
        ctx.fillStyle = "rgb(0,0,0)";
        ctx.fillRect(0, height * 0.49, width, height * 0.02);
        const gradient = ctx.createLinearGradient(0, height * 0.425, 0, height * 0.575);
        gradient.addColorStop(0, "rgb(64,64,64)");
        gradient.addColorStop(1, "rgb(0,0,0)");
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
        let p = letters[i][2];

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