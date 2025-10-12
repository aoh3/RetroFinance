import React, { useState, useRef, useEffect } from 'react';

function flipAmountCalc(dist) {
  return Math.min(dist, 1.0); // TODO: make flip faster when further
}

const Flippy = ({ maxLen }) => {
//   const [target, setTarget] = useState("kms");
//   const canvasRef = useRef(null);
//   const lettersRef = useRef(new Array(maxLen).fill(0.0)); // whole number represents current index, decimal represents animation state

//   useEffect(() => {
//     const letters = lettersRef.current;
//     const canvas = canvasRef.current;
//     const ctx = canvas.getContext('2d');
//     const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
//     const CHARS = CHARSET.split("");
//     const CHAR_INDEX = Object.fromEntries(CHARS.map((c, i) => [c, i]));

//     ctx.font = "32px monospace";
//     ctx.textBaseline = "middle";
//     ctx.textAlign = "center";

//     const width = 30; // letter width
//     const height = 60; // letter height
//     canvas.width = width * maxLen;
//     canvas.height = height;

//     const interval = setInterval(() => {
//       for (let i = 0; i < maxLen; i++) {
//         // UPDATE LETTER STATE

//         let t = i < target.length ? CHAR_INDEX[target[i]] ?? 0 : 0;
//         if (t == letters[i]) continue;

//         let distUp = (t + CHARS.length - letters[i]) % CHARS.length;
//         let distDown = (letters[i] + CHARS.length - t) % CHARS.length;
//         letters[i] += (distUp < distDown ? flipAmountCalc(distUp) : -flipAmountCalc(distDown));
//         letters[i] = ((letters[i] % CHARS.length) + CHARS.length) % CHARS.length;
    
//         // DRAW LETTER

//         ctx.save();
//         ctx.translate(i * width, 0);

//         // bg
//         ctx.fillStyle = "#111";
//         ctx.fillRect(0, 0, width, height);

//         let letterTop = CHARS[Math.floor(letters[i] + 1) % CHARS.length];
//         let letterBot = CHARS[Math.floor(letters[i])];

//         // top static letter
//         ctx.save();
//         ctx.beginPath();
//         ctx.rect(0, 0, width, height * 0.5);
//         ctx.clip();
//         ctx.fillText(letterTop, width * 0.5, height * 0.5);
//         ctx.restore();

//         // bottom static letter
//         ctx.save();
//         ctx.beginPath();
//         ctx.rect(0, height * 0.5, width, height * 0.5);
//         ctx.clip();
//         ctx.fillText(letterBot, width * 0.5, height * 0.5);
//         ctx.restore();
        
//         ctx.restore();
//       }
//     }, 33);

//     return () => clearInterval(interval);
//   }, [maxLen, target]);

//   return (
//     <div>
//       <canvas ref={canvasRef}/>
//     </div>
//   );

  return (
    <div>
    </div>
  )
};

export default Flippy;