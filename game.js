(() => {
  const WIDTH = 7;
  const HEIGHT = 6;
  const LEVELS = [
    {
      name: '初次接觸',
      title: '星球失去光了。<br /><em>交給你和小芽。</em>',
      lead: '導航門的光種散落在地表。寫下行動指令，帶領探測機小芽找回它們，重新點亮返航路線。',
      area: '沉睡星球 · 著陸區',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 2, y: 2 }],
      gate: { x: 6, y: 2 },
      walls: new Set(['3,4', '4,4', '3,3', '4,1', '5,1', '1,1', '1,2', '5,4', '5,5']),
      starter: '// 從這裡開始，安排小芽的行動\nmoveForward();\nmoveForward();\ncollectLight();\n\n// 還有一顆光種和導航門等著你',
      hint: '<code>moveForward();</code> 會依照小芽面向移動一格。先找出光種在哪一格，再安排方向和步數。',
      instruction: '一行一個指令。試著補上轉向、前進，再取回光種。',
    },
    {
      name: '重複的路徑',
      title: '又是這段路。<br /><em>能不能少寫幾次？</em>',
      lead: '第二條訊號線沿著筆直山谷延伸。把同一個行動重複幾次，讓小芽少走幾行程式，找回沿路的光種。',
      area: '沉睡星球 · 回音山谷',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 4, y: 4 }],
      gate: { x: 6, y: 4 },
      walls: new Set(['0,1', '1,1', '3,1', '5,1', '6,1', '1,2', '5,2', '0,5', '2,5', '4,5', '6,5']),
      starter: '// repeat 會把一個行動重複執行指定次數\nrepeat(2, moveForward);\ncollectLight();\n\n// 小芽再走同樣遠，就會遇見下一顆光種\ncollectLight();',
      hint: '<code>repeat(2, moveForward);</code> 會把 <code>moveForward</code> 重複執行兩次。括號裡放次數和行動；小芽每走一步，地圖都會回應。',
      instruction: '試著用 repeat 把重複的移動行動縮成一行。',
    },
  ];
  const level = () => LEVELS[levelIndex];
  const DIRECTIONS = [
    { x: 0, y: -1, name: '北' },
    { x: 1, y: 0, name: '東' },
    { x: 0, y: 1, name: '南' },
    { x: -1, y: 0, name: '西' },
  ];
  const ARROWS = ['▲', '▲', '▲', '▲'];
  const COMMANDS = new Map([
    ['moveForward', moveForward],
    ['turnLeft', turnLeft],
    ['turnRight', turnRight],
    ['collectLight', collectLight],
    ['openGate', openGate],
  ]);

  const world = document.querySelector('#world');
  const code = document.querySelector('#code');
  const runButton = document.querySelector('#run');
  const stepButton = document.querySelector('#step');
  const resetButton = document.querySelector('#reset');
  const status = document.querySelector('#status');
  const coordinates = document.querySelector('#coordinates');
  const goalCount = document.querySelector('#goal-count');
  const gutter = document.querySelector('#line-gutter');
  const help = document.querySelector('#editor-help');
  const toast = document.querySelector('#toast');
  const winCard = document.querySelector('#win-card');
  const nextMissionButton = document.querySelector('#next-mission');
  const topNote = document.querySelector('#top-note');
  const fieldLog = document.querySelector('#field-log');
  const missionTitle = document.querySelector('#mission-title');
  const missionLead = document.querySelector('#mission-lead');
  const worldTitle = document.querySelector('#world-title');
  const hintCopy = document.querySelector('#hint-copy');
  const repeatCommand = document.querySelector('#repeat-command');
  const runLabel = runButton.innerHTML;

  let levelIndex = 0;
  let rover = { ...level().start };
  let collected = new Set();
  let gateOpen = false;
  let program = null;
  let nextInstruction = 0;
  let busy = false;
  let hasActionError = false;
  let runId = 0;
  let toastTimer;

  function initMap() {
    world.replaceChildren();
    for (let y = 0; y < HEIGHT; y += 1) {
      for (let x = 0; x < WIDTH; x += 1) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('role', 'gridcell');
        tile.dataset.x = String(x);
        tile.dataset.y = String(y);
        const key = `${x},${y}`;
        const isWall = level().walls.has(key);
        const isSeed = level().seeds.some((seed) => seed.x === x && seed.y === y);
        const isGate = level().gate.x === x && level().gate.y === y;
        const position = `X ${x + 1}，Y ${y + 1}`;
        if (isWall) {
          tile.classList.add('wall');
          tile.setAttribute('aria-label', `${position}，岩壁`);
        } else {
          tile.classList.add('path');
          const landmark = [isSeed && '光種', isGate && '導航門'].filter(Boolean).join('，');
          tile.setAttribute('aria-label', `${position}${landmark ? `，${landmark}` : '，可通行'}`);
          if (isSeed) tile.classList.add('seed');
          if (isGate) tile.classList.add('gate');
        }
        world.append(tile);
      }
    }
    drawWorld();
  }

  function drawWorld() {
    world.querySelectorAll('.rover-tile').forEach((tile) => tile.classList.remove('rover-tile'));
    world.querySelectorAll('.rover').forEach((sprite) => sprite.remove());
    world.querySelectorAll('.seed').forEach((tile) => {
      const seed = level().seeds.findIndex((item) => item.x === Number(tile.dataset.x) && item.y === Number(tile.dataset.y));
      tile.classList.toggle('collected', collected.has(seed));
      tile.setAttribute('aria-label', `X ${Number(tile.dataset.x) + 1}，Y ${Number(tile.dataset.y) + 1}，光種${collected.has(seed) ? '，已收集' : ''}`);
    });
    const gateTile = world.querySelector(`[data-x="${level().gate.x}"][data-y="${level().gate.y}"]`);
    if (gateTile) {
      gateTile.classList.toggle('open', gateOpen);
      gateTile.setAttribute('aria-label', `X ${level().gate.x + 1}，Y ${level().gate.y + 1}，導航門${gateOpen ? '，已啟動' : ''}`);
    }

    const roverTile = world.querySelector(`[data-x="${rover.x}"][data-y="${rover.y}"]`);
    if (roverTile) {
      roverTile.classList.add('rover-tile');
      roverTile.setAttribute('aria-label', `小芽，面向${DIRECTIONS[rover.direction].name}方，X ${rover.x + 1}，Y ${rover.y + 1}`);
      const sprite = document.createElement('span');
      sprite.className = `rover dir-${rover.direction}`;
      sprite.textContent = ARROWS[rover.direction];
      sprite.setAttribute('aria-hidden', 'true');
      roverTile.append(sprite);
    }
    coordinates.textContent = `X ${String(rover.x + 1).padStart(2, '0')} · Y ${String(rover.y + 1).padStart(2, '0')}`;
    goalCount.textContent = `${collected.size} / ${level().seeds.length}`;
  }

  function setStatus(message, type = 'normal') {
    status.textContent = message;
    status.parentElement.classList.toggle('is-error', type === 'error');
  }

  function showToast(message, type = 'normal') {
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.toggle('error', type === 'error');
    toast.classList.add('show');
    toastTimer = window.setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function tileAt(x, y) {
    return world.querySelector(`[data-x="${x}"][data-y="${y}"]`);
  }

  function moveForward() {
    const vector = DIRECTIONS[rover.direction];
    const x = rover.x + vector.x;
    const y = rover.y + vector.y;
    const nextTile = tileAt(x, y);
    if (!nextTile || level().walls.has(`${x},${y}`)) {
      return { ok: false, message: '岩壁擋住了去路。改變方向，或看看地圖上的空隙。' };
    }
    rover.x = x;
    rover.y = y;
    drawWorld();
    setStatus(`小芽前進一步，現在面向${DIRECTIONS[rover.direction].name}方。`);
    return { ok: true };
  }

  function turnLeft() {
    rover.direction = (rover.direction + 3) % 4;
    drawWorld();
    setStatus(`小芽左轉，現在面向${DIRECTIONS[rover.direction].name}方。`);
    return { ok: true };
  }

  function turnRight() {
    rover.direction = (rover.direction + 1) % 4;
    drawWorld();
    setStatus(`小芽右轉，現在面向${DIRECTIONS[rover.direction].name}方。`);
    return { ok: true };
  }

  function collectLight() {
    const seed = level().seeds.findIndex((item) => item.x === rover.x && item.y === rover.y);
    if (seed === -1) {
      return { ok: false, message: '掃描不到光種。先把小芽帶到發光的位置再拾取。' };
    }
    if (collected.has(seed)) {
      return { ok: false, message: '這顆光種已經收好了，繼續尋找下一顆吧。' };
    }
    collected.add(seed);
    drawWorld();
    setStatus(`光種收進背包。還有 ${level().seeds.length - collected.size} 顆等著你。`);
    showToast('光種已收集 ✦');
    return { ok: true };
  }

  function openGate() {
    if (rover.x !== level().gate.x || rover.y !== level().gate.y) {
      return { ok: false, message: '小芽還沒抵達導航門。把座標帶到地圖右側的入口。' };
    }
    if (collected.size < level().seeds.length) {
      return { ok: false, message: '導航門還沒有足夠能量。先找回所有光種。' };
    }
    gateOpen = true;
    drawWorld();
    winCard.hidden = false;
    nextMissionButton.hidden = levelIndex !== 0;
    setStatus('導航門亮起來了！你幫小芽接通返航訊號。');
    showToast('訊號已恢復！');
    return { ok: true, won: true };
  }

  function parseProgram() {
    const lines = code.value.split(/\r?\n/);
    const actions = [];
    for (let index = 0; index < lines.length; index += 1) {
      const source = lines[index].trim();
      if (!source || source.startsWith('//')) continue;
      const repeat = source.match(/^repeat\s*\(\s*(\d+)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*;?$/);
      if (repeat) {
        if (levelIndex === 0) throw new Error(`第 ${index + 1} 行：小芽還沒學會 repeat。先完成初次接觸任務，之後再試這種簡寫。`);
        const count = Number(repeat[1]);
        const repeatedAction = COMMANDS.get(repeat[2]);
        if (!repeatedAction) throw new Error(`第 ${index + 1} 行：repeat 只能重複已解鎖的單一步驟行動。`);
        if (count < 1 || count > 10) throw new Error(`第 ${index + 1} 行：repeat 次數請設在 1 到 10 之間。`);
        for (let iteration = 0; iteration < count; iteration += 1) {
          actions.push({ action: repeatedAction, name: `repeat → ${repeat[2]}`, line: index + 1 });
        }
        if (actions.length > 50) throw new Error('這次行動太長了，先試試 50 步以內。');
        continue;
      }
      const match = source.match(/^([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?$/);
      if (!match) {
        throw new Error(`第 ${index + 1} 行看不懂。每行寫一個行動，例如 moveForward();`);
      }
      const action = COMMANDS.get(match[1]);
      if (!action) {
        throw new Error(`第 ${index + 1} 行的「${match[1]}」還沒學過。可以用下方已解鎖的行動。`);
      }
      actions.push({ action, name: match[1], line: index + 1 });
      if (actions.length > 50) throw new Error('這次行動太長了，先試試 50 行以內。');
    }
    if (actions.length === 0) throw new Error('先寫下一個行動指令，再出發吧。');
    return actions;
  }

  function freshAttempt() {
    rover = { ...level().start };
    collected = new Set();
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    drawWorld();
    setStatus('小芽準備好了，正在執行你的程式。');
  }

  function prepareProgram() {
    try {
      program = parseProgram();
      nextInstruction = 0;
      hasActionError = false;
      freshAttempt();
      help.textContent = `${program.length} 個行動已排好。小芽出發！`;
      return true;
    } catch (error) {
      setStatus(error.message, 'error');
      help.textContent = error.message;
      help.classList.add('error-text');
      showToast(error.message, 'error');
      return false;
    }
  }

  function finishProgram() {
    if (gateOpen || hasActionError) return;
    if (collected.size < level().seeds.length) {
      setStatus(`程式跑完了，背包有 ${collected.size} 顆光種。看看小芽還漏了哪些行動。`);
    } else if (rover.x !== level().gate.x || rover.y !== level().gate.y) {
      setStatus('光種都找齊了。導航門在右側，安排小芽走完最後一段路吧。');
    }
  }

  function executeNext() {
    if (!program || nextInstruction >= program.length) return { done: true };
    const instruction = program[nextInstruction];
    nextInstruction += 1;
    help.classList.remove('error-text');
    help.textContent = `第 ${instruction.line} 行 · ${instruction.name}()`;
    const result = instruction.action();
    if (!result.ok) {
      setStatus(`第 ${instruction.line} 行：${result.message}`, 'error');
      showToast(result.message, 'error');
      hasActionError = true;
      nextInstruction = program.length;
      return { done: true, error: true };
    }
    if (result.won) return { done: true, won: true };
    return { done: nextInstruction >= program.length };
  }

  function delay(ms, id) {
    return new Promise((resolve) => window.setTimeout(() => resolve(id === runId), ms));
  }

  function setBusy(value) {
    busy = value;
    code.readOnly = value;
    runButton.disabled = value;
    stepButton.disabled = value;
    document.querySelectorAll('.command').forEach((button) => { button.disabled = value; });
    runButton.innerHTML = value ? '<span aria-hidden="true">◌</span> 小芽行動中…' : runLabel;
  }

  async function runProgram() {
    if (busy) return;
    runId += 1;
    if (!program || nextInstruction >= program.length) {
      if (!prepareProgram()) return;
    }
    setBusy(true);
    const thisRun = runId;
    while (nextInstruction < program.length && thisRun === runId) {
      const result = executeNext();
      if (result.done) break;
      if (!(await delay(440, thisRun))) return;
    }
    if (thisRun === runId) {
      finishProgram();
      setBusy(false);
    }
  }

  function singleStep() {
    if (busy) return;
    if (!program || nextInstruction >= program.length) {
      if (!prepareProgram()) return;
    }
    const result = executeNext();
    if (result.done) finishProgram();
  }

  function resetMission() {
    runId += 1;
    setBusy(false);
    program = null;
    nextInstruction = 0;
    rover = { ...level().start };
    collected = new Set();
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    toast.classList.remove('show');
    help.classList.remove('error-text');
    help.textContent = level().instruction;
    drawWorld();
    setStatus('任務已重設。改好行動程式後，再陪小芽出發。');
  }

  function insertCommand(command) {
    const start = code.selectionStart;
    const end = code.selectionEnd;
    const before = code.value.slice(0, start);
    const after = code.value.slice(end);
    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
    const needsTrailingBreak = after.length > 0 && !after.startsWith('\n');
    const call = command === 'repeat' ? 'repeat(2, moveForward);' : `${command}();`;
    const insertion = `${needsLeadingBreak ? '\n' : ''}${call}${needsTrailingBreak ? '\n' : ''}`;
    code.setRangeText(insertion, start, end, 'end');
    code.focus();
    updateGutter();
  }

  function enterNextMission() {
    if (levelIndex !== 0) return;
    levelIndex = 1;
    program = null;
    nextInstruction = 0;
    rover = { ...level().start };
    collected = new Set();
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    code.value = level().starter;
    topNote.innerHTML = `<i></i> 任務 02 · 重複的路徑`;
    fieldLog.textContent = 'SILENT PLANET / FIELD LOG 002';
    missionTitle.innerHTML = level().title;
    missionLead.textContent = level().lead;
    worldTitle.textContent = level().area;
    hintCopy.innerHTML = level().hint;
    repeatCommand.hidden = false;
    help.textContent = '這一段有重複路徑。試著讓 repeat 替你少寫幾次移動。';
    updateGutter();
    initMap();
    setStatus('新訊號已定位。這次試試把重複的移動收進一行程式。');
    document.querySelector('#mission-title').focus({ preventScroll: true });
  }

  function updateGutter() {
    const count = code.value.split('\n').length;
    gutter.innerHTML = Array.from({ length: count }, (_, index) => String(index + 1)).join('<br>');
  }

  runButton.addEventListener('click', runProgram);
  stepButton.addEventListener('click', singleStep);
  resetButton.addEventListener('click', resetMission);
  document.querySelector('#replay-win').addEventListener('click', resetMission);
  nextMissionButton.addEventListener('click', enterNextMission);
  document.querySelectorAll('.command').forEach((button) => {
    button.addEventListener('click', () => insertCommand(button.dataset.command));
  });
  code.addEventListener('input', () => {
    updateGutter();
    help.classList.remove('error-text');
    help.textContent = level().instruction;
  });
  code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
  code.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      updateGutter();
    }
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runProgram();
    }
  });

  initMap();
  updateGutter();
})();
