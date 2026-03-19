// 黒体放射スペクトル（Planck分布）
// p5.js / 両対数グラフ
// 温度: 1 K ～ 10000 K
// 横軸: 波長 [μm]
// 縦軸: 分光放射輝度 B_λ [W sr^-1 m^-3]
// 改良版：
// 1) 縦軸目盛りを常時およそ10個
// 2) 可視光領域に虹色帯
// 3) 縦軸固定/自動 切替ボタン
// 4) 複数温度同時表示 切替ボタン

let tempSlider, tempInput;
let tempLabel;
let yScaleButton, multiButton;

const T_MIN = 1;
const T_MAX = 10000;

// スライダーは log10(T) を操作
const LOG_T_MIN = 0;
const LOG_T_MAX = 4;

// 横軸範囲 [μm]
const X_MIN_UM = 0.1;
const X_MAX_UM = 10000;

// 固定縦軸範囲
const FIXED_Y_MIN = 1e-20;
const FIXED_Y_MAX = 1e14;

// 複数表示用の温度
const multiTemps = [2.7, 10, 100, 300, 1000, 3000, 5800, 10000];

// 物理定数
const h = 6.62607015e-34;
const c = 2.99792458e8;
const kB = 1.380649e-23;

const margin = { left: 95, right: 40, top: 45, bottom: 90 };

let useFixedY = false;
let showMulti = false;

function setup() {
  createCanvas(1040, 720);
  textFont('sans-serif');

  createP('黒体放射スペクトル（両対数表示）')
    .style('font-size', '20px')
    .style('margin', '6px 0 4px 0');

  const uiRow = createDiv();
  uiRow.style('display', 'flex');
  uiRow.style('align-items', 'center');
  uiRow.style('gap', '12px');
  uiRow.style('margin-bottom', '8px');
  uiRow.style('flex-wrap', 'wrap');

  createSpan('温度 T [K]').parent(uiRow);

  tempSlider = createSlider(LOG_T_MIN, LOG_T_MAX, 3, 0.001);
  tempSlider.parent(uiRow);
  tempSlider.style('width', '320px');

  tempInput = createInput('1000', 'number');
  tempInput.parent(uiRow);
  tempInput.attribute('min', T_MIN);
  tempInput.attribute('max', T_MAX);
  tempInput.attribute('step', '0.1');
  tempInput.style('width', '110px');

  yScaleButton = createButton('');
  yScaleButton.parent(uiRow);
  yScaleButton.mousePressed(() => {
    useFixedY = !useFixedY;
    updateButtonLabels();
  });

  multiButton = createButton('');
  multiButton.parent(uiRow);
  multiButton.mousePressed(() => {
    showMulti = !showMulti;
    updateButtonLabels();
  });

  tempLabel = createSpan('');
  tempLabel.parent(uiRow);
  tempLabel.style('font-weight', 'bold');

  tempSlider.input(syncFromSlider);
  tempInput.input(syncFromInput);

  syncFromInput();
  updateButtonLabels();
}

function draw() {
  background(255);

  const T = getCurrentTemperature();
  tempLabel.html(`現在の温度: ${formatTemperature(T)}`);

  const plotX = margin.left;
  const plotY = margin.top;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  let tempsToDraw = showMulti ? multiTemps.slice() : [T];

  // 単独表示のときの自動スケーリング用スペクトル
  let allSpectra = [];
  let autoMinY = Infinity;
  let autoMaxY = -Infinity;

  for (const temp of tempsToDraw) {
    const spec = calcSpectrum(temp, 900);
    allSpectra.push({ T: temp, data: spec });

    for (const p of spec) {
      if (isFinite(p.B) && p.B > 0) {
        autoMinY = min(autoMinY, p.B);
        autoMaxY = max(autoMaxY, p.B);
      }
    }
  }

  if (!isFinite(autoMinY) || autoMinY <= 0) autoMinY = 1e-20;
  if (!isFinite(autoMaxY) || autoMaxY <= autoMinY) autoMaxY = autoMinY * 1e6;

  autoMinY *= 0.5;
  autoMaxY *= 2.0;

  let yMin = useFixedY ? FIXED_Y_MIN : autoMinY;
  let yMax = useFixedY ? FIXED_Y_MAX : autoMaxY;

  drawVisibleBand(plotX, plotY, plotW, plotH);
  drawAxes(plotX, plotY, plotW, plotH, yMin, yMax);

  if (showMulti) {
    drawMultiSpectra(allSpectra, plotX, plotY, plotW, plotH, yMin, yMax);
  } else {
    drawSpectrum(allSpectra[0].data, plotX, plotY, plotW, plotH, yMin, yMax, color(30, 90, 220));
    drawPeakLine(T, plotX, plotY, plotW, plotH);
  }

  drawLegend(tempsToDraw, plotX, plotY, plotW);

  noStroke();
  fill(20);
  textAlign(LEFT, TOP);
  textSize(13);
  text(`横軸：波長 λ [μm]（対数）`, margin.left, height - 58);
  text(`縦軸：分光放射輝度 Bλ [W sr⁻¹ m⁻³]（対数）`, margin.left, height - 38);
}

function updateButtonLabels() {
  yScaleButton.html(useFixedY ? '縦軸: 固定' : '縦軸: 自動');
  multiButton.html(showMulti ? '複数温度: ON' : '複数温度: OFF');
}

function syncFromSlider() {
  const T = Math.pow(10, tempSlider.value());
  tempInput.value(nf(T, 1, 3).replace(/\.?0+$/, ''));
}

function syncFromInput() {
  let T = parseFloat(tempInput.value());
  if (!isFinite(T)) T = 1000;
  T = constrain(T, T_MIN, T_MAX);
  tempInput.value(T);
  tempSlider.value(Math.log10(T));
}

function getCurrentTemperature() {
  let T = parseFloat(tempInput.value());
  if (!isFinite(T)) T = 1000;
  return constrain(T, T_MIN, T_MAX);
}

function calcSpectrum(T, n) {
  const spectrum = [];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    const logX = lerp(Math.log10(X_MIN_UM), Math.log10(X_MAX_UM), f);
    const lambdaUm = Math.pow(10, logX);
    const lambdaM = lambdaUm * 1e-6;
    const B = planckLambda(lambdaM, T);
    spectrum.push({ lambdaUm, B });
  }
  return spectrum;
}

// Planck law
function planckLambda(lambda, T) {
  const a = 2 * h * c * c / Math.pow(lambda, 5);
  const x = (h * c) / (lambda * kB * T);

  if (x > 700) return 0;

  const denom = Math.exp(x) - 1;
  if (denom <= 0) return 0;

  return a / denom;
}

function drawSpectrum(spectrum, px, py, pw, ph, yMin, yMax, col) {
  noFill();
  stroke(col);
  strokeWeight(2.4);
  beginShape();
  for (const p of spectrum) {
    if (p.B <= 0 || !isFinite(p.B)) continue;
    const x = mapLog(p.lambdaUm, X_MIN_UM, X_MAX_UM, px, px + pw);
    const y = mapLog(p.B, yMin, yMax, py + ph, py);
    vertex(x, y);
  }
  endShape();
}

function drawMultiSpectra(allSpectra, px, py, pw, ph, yMin, yMax) {
  for (let i = 0; i < allSpectra.length; i++) {
    const specObj = allSpectra[i];
    const col = getCurveColor(i, allSpectra.length);
    drawSpectrum(specObj.data, px, py, pw, ph, yMin, yMax, col);
  }
}

function drawPeakLine(T, px, py, pw, ph) {
  const lambdaPeakUm = 2897.771955 / T;
  if (lambdaPeakUm >= X_MIN_UM && lambdaPeakUm <= X_MAX_UM) {
    const xPeak = mapLog(lambdaPeakUm, X_MIN_UM, X_MAX_UM, px, px + pw);
    stroke(220, 0, 0);
    strokeWeight(1.4);
    drawingContext.setLineDash([6, 5]);
    line(xPeak, py, xPeak, py + ph);
    drawingContext.setLineDash([]);

    noStroke();
    fill(220, 0, 0);
    textAlign(LEFT, TOP);
    textSize(13);
    text(`ピーク λ ≈ ${formatWavelength(lambdaPeakUm)}`, xPeak + 6, py + 6);
  }
}

function drawAxes(px, py, pw, ph, yMin, yMax) {
  stroke(0);
  strokeWeight(1);
  noFill();
  rect(px, py, pw, ph);

  // x目盛り
  const xTicks = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
  for (const xt of xTicks) {
    if (xt < X_MIN_UM || xt > X_MAX_UM) continue;
    const x = mapLog(xt, X_MIN_UM, X_MAX_UM, px, px + pw);

    stroke(235);
    line(x, py, x, py + ph);

    stroke(0);
    line(x, py + ph, x, py + ph + 6);

    noStroke();
    fill(0);
    textAlign(CENTER, TOP);
    textSize(12);
    text(formatTick(xt), x, py + ph + 8);
  }

  // y目盛り：常時およそ10個
  const yTicks = generateAboutTenLogTicks(yMin, yMax);
  for (const yt of yTicks) {
    const y = mapLog(yt, yMin, yMax, py + ph, py);

    stroke(235);
    line(px, y, px + pw, y);

    stroke(0);
    line(px - 6, y, px, y);

    noStroke();
    fill(0);
    textAlign(RIGHT, CENTER);
    textSize(12);
    text(formatScientific(yt), px - 10, y);
  }

  // 軸ラベル
  push();
  noStroke();
  fill(0);
  textSize(15);
  textAlign(CENTER, TOP);
  text('波長 λ [μm]', px + pw / 2, py + ph + 42);

  translate(px - 62, py + ph / 2);
  rotate(-HALF_PI);
  textAlign(CENTER, TOP);
  text('分光放射輝度 Bλ [W sr⁻¹ m⁻³]', 0, 0);
  pop();

  noStroke();
  fill(0);
  textAlign(LEFT, BOTTOM);
  textSize(16);
  text('Planckスペクトル（log-log）', px, py - 12);
}

function generateAboutTenLogTicks(minVal, maxVal) {
  const ticks = [];
  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);
  const decades = logMax - logMin;

  // decade数に応じて、1桁あたりの目盛り本数を変える
  // 目安として全体で8〜12本程度
  let multipliers;
  if (decades <= 1.2) {
    multipliers = [1, 1.5, 2, 3, 5, 7];
  } else if (decades <= 2.5) {
    multipliers = [1, 2, 5];
  } else if (decades <= 5) {
    multipliers = [1, 3];
  } else {
    multipliers = [1];
  }

  const minPow = Math.floor(logMin) - 1;
  const maxPow = Math.ceil(logMax) + 1;

  for (let p = minPow; p <= maxPow; p++) {
    for (const m of multipliers) {
      const v = m * Math.pow(10, p);
      if (v >= minVal && v <= maxVal) ticks.push(v);
    }
  }

  // 多すぎる場合は間引く
  if (ticks.length > 12) {
    const reduced = [];
    const step = Math.ceil(ticks.length / 10);
    for (let i = 0; i < ticks.length; i += step) reduced.push(ticks[i]);
    if (reduced[reduced.length - 1] !== ticks[ticks.length - 1]) {
      reduced.push(ticks[ticks.length - 1]);
    }
    return reduced;
  }

  return ticks;
}

function drawVisibleBand(px, py, pw, ph) {
  const visMin = 0.38;
  const visMax = 0.78;

  const left = mapLog(visMin, X_MIN_UM, X_MAX_UM, px, px + pw);
  const right = mapLog(visMax, X_MIN_UM, X_MAX_UM, px, px + pw);

  noStroke();

  for (let x = floor(left); x <= ceil(right); x++) {
    const t = map(x, left, right, 380, 780);
    const col = wavelengthToRGB(t);
    fill(red(col), green(col), blue(col), 90);
    rect(x, py, 1, ph);
  }

  fill(0);
  textAlign(CENTER, TOP);
  textSize(12);
  text('可視光', (left + right) / 2, py + 6);
}

function wavelengthToRGB(wavelengthNm) {
  let r = 0, g = 0, b = 0;

  if (wavelengthNm >= 380 && wavelengthNm < 440) {
    r = -(wavelengthNm - 440) / (440 - 380);
    g = 0;
    b = 1;
  } else if (wavelengthNm >= 440 && wavelengthNm < 490) {
    r = 0;
    g = (wavelengthNm - 440) / (490 - 440);
    b = 1;
  } else if (wavelengthNm >= 490 && wavelengthNm < 510) {
    r = 0;
    g = 1;
    b = -(wavelengthNm - 510) / (510 - 490);
  } else if (wavelengthNm >= 510 && wavelengthNm < 580) {
    r = (wavelengthNm - 510) / (580 - 510);
    g = 1;
    b = 0;
  } else if (wavelengthNm >= 580 && wavelengthNm < 645) {
    r = 1;
    g = -(wavelengthNm - 645) / (645 - 580);
    b = 0;
  } else if (wavelengthNm >= 645 && wavelengthNm <= 780) {
    r = 1;
    g = 0;
    b = 0;
  }

  let factor = 1.0;
  if (wavelengthNm >= 380 && wavelengthNm < 420) {
    factor = 0.3 + 0.7 * (wavelengthNm - 380) / (420 - 380);
  } else if (wavelengthNm > 700 && wavelengthNm <= 780) {
    factor = 0.3 + 0.7 * (780 - wavelengthNm) / (780 - 700);
  }

  return color(
    255 * Math.pow(r * factor, 0.8),
    255 * Math.pow(g * factor, 0.8),
    255 * Math.pow(b * factor, 0.8)
  );
}

function drawLegend(temps, px, py, pw) {
  const legendX = px + pw - 170;
  const legendY = py + 12;
  const lineH = 18;

  fill(255, 250);
  stroke(180);
  rect(legendX - 10, legendY + 32, 160, max(36, temps.length * lineH + 16));

  noStroke();
  fill(0);
  textAlign(LEFT, TOP);
  textSize(12);

  if (showMulti) {
    for (let i = 0; i < temps.length; i++) {
      const y = legendY + i * lineH;
      const col = getCurveColor(i, temps.length);
      stroke(col);
      strokeWeight(3);
      line(legendX, y + 48, legendX + 18, y + 48);

      noStroke();
      fill(0);
      text(`T = ${formatTemperature(temps[i])}`, legendX + 26, y+40);
    }
  } else {
    stroke(30, 90, 220);
    strokeWeight(3);
    line(legendX, legendY + 48, legendX + 18, legendY + 48);

    noStroke();
    fill(0);
    text(`T = ${formatTemperature(temps[0])}`, legendX + 26, legendY+40);
  }
}

function getCurveColor(i, total) {
  const hue = map(i, 0, max(1, total - 1), 20, 300);
  colorMode(HSB, 360, 100, 100, 255);
  const col = color(hue, 85, 85);
  colorMode(RGB, 255, 255, 255, 255);
  return col;
}

function mapLog(value, minVal, maxVal, outMin, outMax) {
  const logMin = Math.log10(minVal);
  const logMax = Math.log10(maxVal);
  const logVal = Math.log10(value);
  return map(logVal, logMin, logMax, outMin, outMax);
}

function formatScientific(v) {
  const p = Math.floor(Math.log10(v));
  const m = v / Math.pow(10, p);

  if (abs(m - 1) < 1e-10) return `10^${p}`;
  if (abs(m - 2) < 1e-10) return `2×10^${p}`;
  if (abs(m - 3) < 1e-10) return `3×10^${p}`;
  if (abs(m - 5) < 1e-10) return `5×10^${p}`;

  return v.toExponential(1);
}

function formatTick(v) {
  if (v >= 1000) return nf(v, 1, 0);
  if (v >= 1) return `${v}`;
  return `${v}`;
}

function formatTemperature(T) {
  if (T >= 1000) return nf(T, 1, 0) + ' K';
  if (T >= 10) return nf(T, 1, 1) + ' K';
  return nf(T, 1, 3).replace(/\.?0+$/, '') + ' K';
}

function formatWavelength(um) {
  if (um < 1) return nf(um * 1000, 1, 1) + ' nm';
  if (um < 1000) return nf(um, 1, 3).replace(/\.?0+$/, '') + ' μm';
  return nf(um / 1000, 1, 3).replace(/\.?0+$/, '') + ' mm';
}
