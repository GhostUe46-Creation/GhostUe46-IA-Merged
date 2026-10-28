/* Motor de Illusion Lab integrado en GhostUe46. Usa identificadores únicos y no interfiere con la app. */
(() => {
  const canvas = document.getElementById('illusionCanvas');
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;

  const wrap = document.getElementById('illusionPreviewWrap');
  const patternSelect = document.getElementById('illusionPatternSelect');
  const intensityRange = document.getElementById('illusionIntensityRange');
  const speedRange = document.getElementById('illusionSpeedRange');
  const colorSelect = document.getElementById('illusionColorSelect');
  const intensityOutput = document.getElementById('illusionIntensityOutput');
  const speedOutput = document.getElementById('illusionSpeedOutput');
  const pauseButton = document.getElementById('illusionPauseButton');
  const resetButton = document.getElementById('illusionResetButton');
  const modeValue = document.getElementById('illusionModeValue');
  const fpsValue = document.getElementById('illusionFpsValue');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let w = 900, h = 700, t = 0, paused = false, last = 0, frames = 0, fpsStamp = 0;
  let pointer = {x: .5, y: .5}, raf = 0, idleTimer = 0;
  const palette = {
    amber: ['#e78b5d','#ffd0a6','#743f2c','#f3a779'],
    aqua: ['#37e5e4','#a9fff8','#0a7185','#62c8ff'],
    violet: ['#c18aff','#ffd2ff','#613ab0','#8edcff'],
    mono: ['#ffffff','#c7c7c7','#505050','#eeeeee']
  };
  const getColors = () => palette[colorSelect.value] || palette.aqua;

  function sizeCanvas() {
    const r = wrap.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = Math.max(320, r.width); h = Math.max(300, r.height);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function drawBackground() {
    const c = getColors();
    const grad = ctx.createRadialGradient(w*.5, h*.48, 5, w*.5, h*.48, Math.max(w,h)*.7);
    grad.addColorStop(0, c[2]+'66'); grad.addColorStop(.55, '#0a102b'); grad.addColorStop(1, '#050816');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    ctx.save(); ctx.globalAlpha = .16; ctx.strokeStyle = c[0]; ctx.lineWidth = .6;
    const spacing = 28;
    for (let x=0; x<w; x+=spacing) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    for (let y=0; y<h; y+=spacing) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    ctx.restore();
  }
  function drawRings(cx,cy,amp,speed,colors) {
    const maxR = Math.min(w,h)*.48, count = Math.round(12+amp*28);
    for (let i=count; i>0; i--) {
      const r=maxR*i/count, wave=Math.sin(i*.45-t*speed*.8)*amp*9;
      ctx.beginPath(); ctx.ellipse(cx,cy,r+wave,(r+wave)*(.72+Math.sin(t*.25)*.03),t*.1,0,Math.PI*2);
      ctx.strokeStyle=colors[i%2===0?0:1]; ctx.lineWidth=.7+amp*1.1; ctx.globalAlpha=.16+(.6*i/count)*amp; ctx.stroke();
    }
    ctx.globalAlpha=1;
  }
  function drawVortex(cx,cy,amp,speed,colors) {
    const arms=5, steps=Math.round(520*amp); ctx.lineCap='round';
    for (let a=0; a<arms; a++) {
      ctx.beginPath();
      for (let i=0; i<steps; i++) {
        const p=i/steps, ang=p*Math.PI*9+a*Math.PI*2/arms+t*speed*(a%2?-.7:1), r=9+p*Math.min(w,h)*.45;
        const x=cx+Math.cos(ang)*r*(.3+.7*p)+Math.cos(t*.4+p*10)*amp*4;
        const y=cy+Math.sin(ang)*r*(.3+.7*p)*.74+Math.sin(t*.35+p*8)*amp*4;
        if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle=colors[a%colors.length]; ctx.lineWidth=.4+amp*1.9; ctx.globalAlpha=.25+amp*.48; ctx.stroke();
    }
    ctx.globalAlpha=1;
    for(let i=0;i<24;i++){const a=i*Math.PI*2/24+t*speed*.5,r=Math.min(w,h)*(.15+((i%5)/5)*.28);ctx.beginPath();ctx.arc(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.72,1+amp*2,0,Math.PI*2);ctx.fillStyle=colors[i%colors.length];ctx.globalAlpha=.65;ctx.fill();}
    ctx.globalAlpha=1;
  }
  function drawRays(cx,cy,amp,speed,colors) {
    const n=Math.round(70+amp*190), maxR=Math.max(w,h)*.7;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(t*speed*.18);
    for(let i=0;i<n;i++){const a=i*Math.PI*2/n;ctx.beginPath();ctx.moveTo(Math.cos(a)*Math.min(w,h)*.08,Math.sin(a)*Math.min(w,h)*.08);ctx.lineTo(Math.cos(a)*maxR,Math.sin(a)*maxR);ctx.strokeStyle=colors[i%2];ctx.lineWidth=i%2?1:.45;ctx.globalAlpha=i%2?.38:.15;ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;drawRings(cx,cy,amp*.35,speed,colors);
  }
  function drawSpiral(cx,cy,amp,speed,colors) {
    for(let a=0;a<2;a++){ctx.beginPath();const steps=650;for(let i=0;i<steps;i++){const p=i/steps,ang=p*Math.PI*16+t*speed*(a===0?1:-1)+a*Math.PI,r=p*Math.min(w,h)*.48,x=cx+Math.cos(ang)*r,y=cy+Math.sin(ang)*r*.72;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.strokeStyle=colors[a];ctx.lineWidth=.7+amp*2.2;ctx.globalAlpha=.45;ctx.stroke();}
    ctx.globalAlpha=1;
  }
  function drawMoire(cx,cy,amp,speed,colors) {
    const spacing=Math.max(5,11-amp*5), extent=Math.max(w,h)*1.2;
    ctx.save();ctx.translate(cx,cy);ctx.lineWidth=.7+amp*.8;
    for(let layer=0;layer<2;layer++){
      ctx.save();ctx.rotate((layer?-.14:.14)+Math.sin(t*.28)*.035*(layer?1:-1));
      ctx.strokeStyle=colors[layer?1:0];ctx.globalAlpha=layer?.48:.62;
      for(let x=-extent;x<=extent;x+=spacing){ctx.beginPath();for(let y=-extent;y<=extent;y+=8){const shift=Math.sin(y*.022+t*speed*(layer?-.8:1)+x*.006)*amp*9;const px=x+shift;if(y===-extent)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();}
      ctx.restore();
    }
    ctx.restore();ctx.globalAlpha=1;
  }
  function drawChecker(cx,cy,amp,speed,colors) {
    const tile=Math.max(20,42-amp*18);ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(t*speed*.22)*.08);ctx.globalAlpha=.9;
    const cols=Math.ceil(w/tile)+5,rows=Math.ceil(h/tile)+5;
    for(let ix=-cols;ix<=cols;ix++)for(let iy=-rows;iy<=rows;iy++){
      const x=ix*tile-w*.5,y=iy*tile-h*.5,warp=Math.sin(iy*.55+t*speed)*amp*tile*.18;
      ctx.fillStyle=((ix+iy)&1)?colors[2]:colors[0];ctx.globalAlpha=((ix+iy)&1)?.64:.22;
      ctx.fillRect(x+warp,y,tile+.5,tile+.5);
    }
    ctx.globalAlpha=1;ctx.restore();
    // A luminous, gently breathing diamond adds the classic distortion cue.
    ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/4+Math.sin(t*.25)*.07);ctx.strokeStyle=colors[1];ctx.globalAlpha=.8;ctx.lineWidth=1+amp;
    for(let i=0;i<5;i++){const s=(i+1)*Math.min(w,h)*.045;ctx.strokeRect(-s,-s,s*2,s*2);}ctx.restore();ctx.globalAlpha=1;
  }
  function drawTunnel(cx,cy,amp,speed,colors) {
    const count=28,maxR=Math.max(w,h)*.72,phase=(t*speed*34)%(maxR/count);
    ctx.save();ctx.lineCap='round';
    for(let i=count;i>=1;i--){const r=((i/count)*maxR+phase)%(maxR+maxR/count);ctx.beginPath();ctx.ellipse(cx+Math.sin(t*.33+i*.12)*amp*7,cy+Math.cos(t*.27+i*.09)*amp*5,r,r*.62,Math.sin(t*.14)*.08,0,Math.PI*2);ctx.strokeStyle=colors[i%colors.length];ctx.lineWidth=.65+amp*1.5;ctx.globalAlpha=.2+.55*(i/count);ctx.stroke();}
    const spokes=24;for(let i=0;i<spokes;i++){const a=i*Math.PI*2/spokes+t*speed*.08;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*Math.min(w,h)*.09,cy+Math.sin(a)*Math.min(w,h)*.055);ctx.lineTo(cx+Math.cos(a)*maxR,cy+Math.sin(a)*maxR*.62);ctx.strokeStyle=colors[i%colors.length];ctx.globalAlpha=.18+amp*.22;ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;
  }
  function drawKaleido(cx,cy,amp,speed,colors) {
    ctx.save();ctx.translate(cx,cy);ctx.rotate(t*speed*.10);const sectors=12, maxR=Math.min(w,h)*.48;
    for(let s=0;s<sectors;s++){
      ctx.save();ctx.rotate(s*Math.PI*2/sectors);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(maxR,0);ctx.lineTo(maxR*Math.cos(Math.PI*2/sectors),maxR*Math.sin(Math.PI*2/sectors));ctx.closePath();ctx.clip();
      for(let j=1;j<=9;j++){const r=maxR*j/9;ctx.beginPath();ctx.moveTo(r*.12,0);ctx.quadraticCurveTo(r*.62,Math.sin(t*speed+j)*amp*r*.18,r*Math.cos(Math.PI*2/sectors),r*Math.sin(Math.PI*2/sectors));ctx.strokeStyle=colors[(s+j)%colors.length];ctx.lineWidth=.6+amp*1.3;ctx.globalAlpha=.45;ctx.stroke();ctx.beginPath();ctx.arc(r*.35,Math.sin(t*speed+j*.4)*r*.12,r*.075,0,Math.PI*2);ctx.stroke();}
      ctx.restore();
    }
    ctx.globalAlpha=1;ctx.restore();
    ctx.beginPath();ctx.arc(cx,cy,Math.min(w,h)*(.07+amp*.025),0,Math.PI*2);ctx.strokeStyle=colors[1];ctx.lineWidth=2;ctx.globalAlpha=.8;ctx.stroke();ctx.globalAlpha=1;
  }
  function drawWaveGrid(cx,cy,amp,speed,colors) {
    const gap=Math.max(12,25-amp*8),extent=Math.max(w,h)*1.2;
    ctx.save();ctx.lineWidth=.8;ctx.globalAlpha=.58;
    for(let x=-extent;x<=w+extent;x+=gap){ctx.beginPath();for(let y=0;y<=h;y+=5){const px=x+Math.sin(y*.018+t*speed+x*.004)*amp*22+Math.sin(y*.043-t*.6)*amp*4;if(y===0)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.strokeStyle=colors[Math.round(Math.abs(x/gap))%colors.length];ctx.stroke();}
    for(let y=0;y<=h;y+=gap){ctx.beginPath();for(let x=0;x<=w;x+=5){const py=y+Math.sin(x*.017-t*speed+y*.006)*amp*20+Math.sin(x*.04+t*.5)*amp*4;if(x===0)ctx.moveTo(x,py);else ctx.lineTo(x,py);}ctx.strokeStyle=colors[Math.round(Math.abs(y/gap))%colors.length];ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;
    const pulse=1+Math.sin(t*speed)*amp*.16;ctx.beginPath();ctx.arc(cx,cy,Math.min(w,h)*.1*pulse,0,Math.PI*2);ctx.strokeStyle=colors[1];ctx.lineWidth=1.4;ctx.stroke();
  }
  function drawImpossible(cx,cy,amp,speed,colors) {
    const size=Math.min(w,h)*(.26+amp*.08);ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.sin(t*speed*.18)*.045);ctx.lineJoin='round';
    // Three interlocked impossible triangular frames create a Penrose-like depth trick.
    for(let k=0;k<3;k++){
      ctx.save();ctx.rotate(k*Math.PI*2/3);const r=size;
      ctx.beginPath();ctx.moveTo(0,-r);ctx.lineTo(r*.88,r*.52);ctx.lineTo(-r*.88,r*.52);ctx.closePath();
      ctx.strokeStyle=colors[k%colors.length];ctx.lineWidth=8+amp*7;ctx.globalAlpha=.2;ctx.stroke();
      ctx.strokeStyle=colors[k%colors.length];ctx.lineWidth=2+amp*1.3;ctx.globalAlpha=.95;ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,-r*.74);ctx.lineTo(r*.63,r*.37);ctx.lineTo(-r*.63,r*.37);ctx.closePath();ctx.strokeStyle=colors[(k+1)%colors.length];ctx.lineWidth=1;ctx.globalAlpha=.8;ctx.stroke();ctx.restore();
    }
    ctx.restore();ctx.globalAlpha=1;
    // Moving perspective lines make the shape seem to tilt despite being flat.
    ctx.save();ctx.strokeStyle=colors[1];ctx.globalAlpha=.26;ctx.lineWidth=.8;
    for(let i=0;i<18;i++){const x=(i/17)*w;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(cx+(x-cx)*.18,h);ctx.stroke();}
    ctx.restore();ctx.globalAlpha=1;
  }
  function draw(now=0) {
    const dt=last?Math.min(40,now-last):16;last=now;
    if(!paused && !reducedMotion)t+=dt*.001*(Number(speedRange.value)/50);
    const amp=Number(intensityRange.value)/100, speed=Number(speedRange.value)/50, colors=getColors();
    drawBackground();
    const cx=w*(.5+(pointer.x-.5)*.08),cy=h*(.49+(pointer.y-.5)*.08);
    const mode=patternSelect.value;
    if(mode==='rings')drawRings(cx,cy,amp,speed,colors);
    else if(mode==='rays')drawRays(cx,cy,amp,speed,colors);
    else if(mode==='spiral')drawSpiral(cx,cy,amp,speed,colors);
    else if(mode==='moire')drawMoire(cx,cy,amp,speed,colors);
    else if(mode==='checker')drawChecker(cx,cy,amp,speed,colors);
    else if(mode==='tunnel')drawTunnel(cx,cy,amp,speed,colors);
    else if(mode==='kaleido')drawKaleido(cx,cy,amp,speed,colors);
    else if(mode==='wavegrid')drawWaveGrid(cx,cy,amp,speed,colors);
    else if(mode==='impossible')drawImpossible(cx,cy,amp,speed,colors);
    else drawVortex(cx,cy,amp,speed,colors);
    const r=Math.min(w,h)*(.075+amp*.045),g=ctx.createRadialGradient(cx,cy,1,cx,cy,r*2.4);
    g.addColorStop(0,colors[1]+'aa');g.addColorStop(.35,colors[0]+'30');g.addColorStop(1,colors[0]+'00');ctx.fillStyle=g;ctx.beginPath();ctx.arc(cx,cy,r*2.4,0,Math.PI*2);ctx.fill();
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.strokeStyle=colors[1];ctx.globalAlpha=.65;ctx.lineWidth=1;ctx.stroke();ctx.globalAlpha=1;
    ctx.strokeStyle=colors[0];ctx.globalAlpha=.5;ctx.lineWidth=1;const m=18,L=12;
    [[m,m,1,1],[w-m,m,-1,1],[m,h-m,1,-1],[w-m,h-m,-1,-1]].forEach(([x,y,sx,sy])=>{ctx.beginPath();ctx.moveTo(x+sx*L,y);ctx.lineTo(x,y);ctx.lineTo(x,y+sy*L);ctx.stroke();});ctx.globalAlpha=1;
    frames++;if(now-fpsStamp>1000){fpsValue.textContent=String(Math.min(60,Math.round(frames*1000/(now-fpsStamp||1))));frames=0;fpsStamp=now;}
  }
  function tick(now) {
    if (!wrap.getClientRects().length) {
      idleTimer = window.setTimeout(() => { raf = requestAnimationFrame(tick); }, 220);
      return;
    }
    draw(now); raf = requestAnimationFrame(tick);
  }
  function updateLabels() {
    intensityOutput.textContent=`${intensityRange.value}%`;speedOutput.textContent=`${speedRange.value}%`;
    modeValue.textContent=({vortex:'VÓRTICE',rings:'ONDAS',rays:'RAYOS',spiral:'ESPIRAL',moire:'MOIRÉ',checker:'TABLERO',tunnel:'TÚNEL',kaleido:'CALEIDOSCOPIO',wavegrid:'REJILLA',impossible:'IMPOSIBLES'})[patternSelect.value]||'VÓRTICE';
  }
  [patternSelect,intensityRange,speedRange,colorSelect].forEach(el=>el.addEventListener('input',updateLabels));
  pauseButton.addEventListener('click',()=>{paused=!paused;pauseButton.querySelector('.is-button-label').textContent=paused?'REANUDAR ANIMACIÓN':'PAUSAR ANIMACIÓN';pauseButton.querySelector('.is-button-arrow').textContent=paused?'▶':'Ⅱ';});
  resetButton.addEventListener('click',()=>{patternSelect.value='vortex';intensityRange.value='65';speedRange.value='42';colorSelect.value='aqua';paused=false;pauseButton.querySelector('.is-button-label').textContent='PAUSAR ANIMACIÓN';pauseButton.querySelector('.is-button-arrow').textContent='Ⅱ';updateLabels();sizeCanvas();});
  canvas.addEventListener('pointermove',e=>{const r=canvas.getBoundingClientRect();if(r.width&&r.height)pointer={x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};});
  canvas.addEventListener('pointerleave',()=>{pointer={x:.5,y:.5};});
  window.addEventListener('resize',sizeCanvas,{passive:true});
  window.addEventListener('illusion-studio:activate',()=>{sizeCanvas();if(!raf)raf=requestAnimationFrame(tick);});
  if ('ResizeObserver' in window) new ResizeObserver(sizeCanvas).observe(wrap);
  sizeCanvas();updateLabels();raf=requestAnimationFrame(tick);
})();
