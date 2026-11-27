(() => {
  const WIDTH = 7;
  const HEIGHT = 6;
  const LEVELS = [
    {
      name: '初次接觸',
      scene: 'landing',
      title: '星球失去光了。<br /><em>交給你和小芽。</em>',
      lead: '導航門的光種散落在地表。寫下行動指令，帶領探測機小芽找回它們，重新點亮返航路線。',
      area: '沉睡星球 · 著陸區',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 2, y: 2 }],
      gate: { x: 6, y: 2 },
      echo: { x: 1, y: 3, story: '這裡曾有一座小花園，光種照顧著沉睡的植物。' },
      walls: new Set(['3,4', '4,4', '3,3', '4,1', '5,1', '1,1', '1,2', '5,4', '5,5']),
      starter: '// 從這裡開始，安排小芽的行動\nmoveForward();\nmoveForward();\ncollectLight();\n\n// 還有一顆光種和導航門等著你',
      hint: '<code>moveForward();</code> 會依照小芽面向移動一格。先找出光種在哪一格，再安排方向和步數。',
      instruction: '一行一個指令。試著補上轉向、前進，再取回光種。',
    },
    {
      name: '重複的路徑',
      scene: 'valley',
      title: '又是這段路。<br /><em>能不能少寫幾次？</em>',
      lead: '第二條訊號線沿著筆直山谷延伸。把同一個行動重複幾次，讓小芽少走幾行程式，找回沿路的光種。',
      area: '沉睡星球 · 回音山谷',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 4, y: 4 }],
      gate: { x: 6, y: 4 },
      echo: { x: 3, y: 3, story: '山谷曾把旅人的歌聲傳得很遠，直到最後一盞燈熄滅。' },
      walls: new Set(['0,1', '1,1', '3,1', '5,1', '6,1', '1,2', '5,2', '0,5', '2,5', '4,5', '6,5']),
      starter: '// repeat 會把一個行動重複執行指定次數\nrepeat(2, moveForward);\ncollectLight();\n\n// 小芽再走同樣遠，就會遇見下一顆光種\ncollectLight();',
      hint: '<code>repeat(2, moveForward);</code> 會把 <code>moveForward</code> 重複執行兩次。括號裡放次數和行動；小芽每走一步，地圖都會回應。',
      instruction: '試著用 repeat 把重複的移動行動縮成一行。',
    },
    {
      name: '感應與選擇',
      scene: 'signal',
      title: '不必每次都照做。<br /><em>先看看發生什麼事。</em>',
      lead: '小芽裝上光種和岩壁感測器。用 if 檢查眼前的狀況，只有條件成立時才執行行動。',
      area: '沉睡星球 · 訊號岔路',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 2, y: 2 }],
      gate: { x: 6, y: 2 },
      echo: { x: 0, y: 2, story: '小芽找到一則舊訊息：「只要還有光，就有回家的路。」' },
      walls: new Set(['3,4', '4,4', '3,3', '4,1', '5,1', '1,1', '1,2', '5,4', '5,5']),
      starter: '// 起點沒有光種：這行條件不成立時會被略過\nif (lightIsPresent()) collectLight();\nmoveForward();\nmoveForward();\nif (lightIsPresent()) collectLight();\n\n// 偵測到前方岩壁時，才需要左轉\nmoveForward();\nmoveForward();\nif (lightIsPresent()) collectLight();\nturnRight();\nrepeat(4, moveForward);\nopenGate();',
      hint: '<code>if (lightIsPresent()) collectLight();</code> 會先檢查小芽所在格有沒有光種；沒有時略過拾取，有時才執行。前方有岩壁時也可以用感測器決定要不要轉彎。',
      instruction: '先檢查條件，再決定要不要執行後面的行動。',
    },
    {
      name: '喚醒光閘',
      scene: 'ruins',
      title: '路被封住了。<br /><em>讓星球替你開路。</em>',
      lead: '踩上 ◉ 開關，打開紫色光閘，再找光種與導航門。',
      area: '沉睡星球 · 星光遺跡',
      start: { x: 0, y: 4, direction: 1 },
      seeds: [{ x: 2, y: 4 }, { x: 4, y: 2 }],
      gate: { x: 6, y: 2 },
      echo: { x: 1, y: 3, story: '光閘曾守護星球的花園，等待有人重新點亮道路。' },
      switchTile: { x: 2, y: 3 },
      barrier: { x: 3, y: 2 },
      walls: new Set(['3,0', '3,1', '3,3', '3,4', '3,5', '1,1', '4,4', '5,4', '5,1']),
      starter: '// 踏上 ◉ 能量開關，就能打開光閘\nrepeat(2, moveForward);\ncollectLight();\n\n// 找到開關，再帶小芽前往導航門',
      hint: '光閘會擋住小芽。先走到 ◉ 開關所在的格子，光閘就會打開；<code>pathAheadIsBlocked()</code> 也能感測關閉的光閘。',
      instruction: '找出開關和光閘，安排一條能取回光種的路。',
    },
  ];
  const PROGRESS_KEY = 'light-seed-game-unlocked-mission';
  const ECHO_KEY = 'light-seed-game-discovered-echoes';
  let storageAvailable = null;
  let echoStorageAvailable = null;
  function loadUnlockedMission() {
    try {
      const saved = Number(window.localStorage.getItem(PROGRESS_KEY));
      return Number.isInteger(saved) && saved >= 0 ? Math.min(saved, LEVELS.length - 1) : 0;
    } catch {
      storageAvailable = false;
      return 0;
    }
  }
  function readSavedEchoes() {
    const raw = window.localStorage.getItem(ECHO_KEY);
    let entries;
    try { entries = JSON.parse(raw || '[]'); } catch { entries = []; }
    return new Set(Array.isArray(entries)
      ? entries.filter((index) => Number.isInteger(index) && index >= 0 && index < LEVELS.length)
      : []);
  }
  function loadEchoes() {
    try { return readSavedEchoes(); } catch {
      echoStorageAvailable = false;
      return new Set();
    }
  }
  const level = () => LEVELS[levelIndex];
  const DIRECTIONS = [
    { x: 0, y: -1, name: '北' },
    { x: 1, y: 0, name: '東' },
    { x: 0, y: 1, name: '南' },
    { x: -1, y: 0, name: '西' },
  ];
  const COMMANDS = new Map([
    ['moveForward', moveForward],
    ['turnLeft', turnLeft],
    ['turnRight', turnRight],
    ['collectLight', collectLight],
    ['openGate', openGate],
  ]);
  const CONDITIONS = new Map([
    ['lightIsPresent', lightIsPresent],
    ['pathAheadIsBlocked', pathAheadIsBlocked],
  ]);

  const world = document.querySelector('#world');
  const code = document.querySelector('#code');
  const runButton = document.querySelector('#run');
  const stepButton = document.querySelector('#step');
  const resetButton = document.querySelector('#reset');
  const status = document.querySelector('#status');
  const coordinates = document.querySelector('#coordinates');
  const goalCount = document.querySelector('#goal-count');
  const seedOrbs = document.querySelector('#seed-orbs');
  const gutter = document.querySelector('#line-gutter');
  const help = document.querySelector('#editor-help');
  const toast = document.querySelector('#toast');
  const winCard = document.querySelector('#win-card');
  const winStory = document.querySelector('#win-story');
  const echoLog = document.querySelector('#echo-log');
  const journalCount = document.querySelector('#journal-count');
  const journalEntries = document.querySelector('#journal-entries');
  const journalNote = document.querySelector('#journal-note');
  const nextMissionButton = document.querySelector('#next-mission');
  const previousMissionButton = document.querySelector('#previous-mission');
  const nextUnlockedButton = document.querySelector('#next-unlocked');
  const missionPosition = document.querySelector('#mission-position');
  const progressNote = document.querySelector('#progress-note');
  const topNote = document.querySelector('#top-note');
  const fieldLog = document.querySelector('#field-log');
  const missionTitle = document.querySelector('#mission-title');
  const missionLead = document.querySelector('#mission-lead');
  const worldTitle = document.querySelector('#world-title');
  const hintCopy = document.querySelector('#hint-copy');
  const repeatCommand = document.querySelector('#repeat-command');
  const lightCondition = document.querySelector('#light-condition');
  const wallCondition = document.querySelector('#wall-condition');
  const runLabel = runButton.innerHTML;

  let highestUnlocked = loadUnlockedMission();
  const knownEchoes = loadEchoes();
  let levelIndex = highestUnlocked;
  const missionDrafts = LEVELS.map((mission) => mission.starter);
  let rover = { ...level().start };
  let visited = new Set([`${rover.x},${rover.y}`]);
  let collected = new Set();
  let echoFound = false;
  let switchActive = false;
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
      const row = document.createElement('div');
      row.className = 'world-row';
      row.setAttribute('role', 'row');
      for (let x = 0; x < WIDTH; x += 1) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.setAttribute('role', 'gridcell');
        tile.tabIndex = -1;
        tile.dataset.x = String(x);
        tile.dataset.y = String(y);
        const key = `${x},${y}`;
        const isWall = level().walls.has(key);
        const isSeed = level().seeds.some((seed) => seed.x === x && seed.y === y);
        const isGate = level().gate.x === x && level().gate.y === y;
        const isEcho = level().echo.x === x && level().echo.y === y;
        const isSwitch = level().switchTile?.x === x && level().switchTile?.y === y;
        const isBarrier = level().barrier?.x === x && level().barrier?.y === y;
        if (isWall) {
          tile.classList.add('wall');
        } else {
          tile.classList.add('path');
          if (isSeed) tile.classList.add('seed');
          if (isGate) tile.classList.add('gate');
          if (isEcho) tile.classList.add('echo');
          if (isSwitch) tile.classList.add('switch-tile');
          if (isBarrier) tile.classList.add('barrier');
        }
        row.append(tile);
      }
      world.append(row);
    }
    drawWorld();
  }

  function drawWorld(previousPosition = null) {
    const focusedTile = world.contains(document.activeElement) ? document.activeElement : null;
    const keepRoverFocus = focusedTile?.classList.contains('rover-tile') ?? false;
    world.querySelectorAll('.tile').forEach((tile) => {
      tile.tabIndex = -1;
      const x = Number(tile.dataset.x);
      const y = Number(tile.dataset.y);
      const wasVisited = visited.has(`${x},${y}`);
      const seedIndex = level().seeds.findIndex((seed) => seed.x === x && seed.y === y);
      const landmarks = [];
      if (tile.classList.contains('wall')) landmarks.push('岩壁');
      if (seedIndex !== -1) landmarks.push(`光種${collected.has(seedIndex) ? '，已收集' : ''}`);
      if (x === level().gate.x && y === level().gate.y) landmarks.push(`導航門${gateOpen ? '，已啟動' : ''}`);
      if (x === level().echo.x && y === level().echo.y) landmarks.push(`星球回聲${echoFound ? '，已發現' : '，走過可發現'}`);
      if (x === level().switchTile?.x && y === level().switchTile?.y) landmarks.push(`能量開關${switchActive ? '，已啟動' : '，走上可啟動'}`);
      if (x === level().barrier?.x && y === level().barrier?.y) landmarks.push(`光閘${switchActive ? '，已打開' : '，關閉中'}`);
      if (x === rover.x && y === rover.y) landmarks.unshift(`小芽，面向${DIRECTIONS[rover.direction].name}方`);
      if (landmarks.length === 0) landmarks.push('可通行');
      if (wasVisited) landmarks.push('這次走過');
      tile.setAttribute('aria-label', `X ${x + 1}，Y ${y + 1}，${landmarks.join('，')}`);
      tile.classList.toggle('visited', wasVisited);
    });
    world.querySelectorAll('.rover-tile').forEach((tile) => tile.classList.remove('rover-tile'));
    world.querySelectorAll('.rover').forEach((sprite) => sprite.remove());
    world.querySelectorAll('.seed').forEach((tile) => {
      const seed = level().seeds.findIndex((item) => item.x === Number(tile.dataset.x) && item.y === Number(tile.dataset.y));
      tile.classList.toggle('collected', collected.has(seed));
    });
    world.querySelector('.echo')?.classList.toggle('found', echoFound);
    world.querySelector('.switch-tile')?.classList.toggle('active', switchActive);
    world.querySelector('.barrier')?.classList.toggle('open', switchActive);
    echoLog.hidden = !echoFound;
    echoLog.textContent = echoFound ? `◇ 這次發現的星球回聲：${level().echo.story}` : '';
    const gateTile = world.querySelector(`[data-x="${level().gate.x}"][data-y="${level().gate.y}"]`);
    if (gateTile) {
      gateTile.classList.toggle('open', gateOpen);
    }

    const roverTile = world.querySelector(`[data-x="${rover.x}"][data-y="${rover.y}"]`);
    if (roverTile) {
      roverTile.classList.add('rover-tile');
      (focusedTile && !keepRoverFocus ? focusedTile : roverTile).tabIndex = 0;
      const sprite = document.createElement('span');
      sprite.className = `rover dir-${rover.direction}`;
      sprite.setAttribute('aria-hidden', 'true');
      roverTile.append(sprite);
      if (previousPosition) {
        const previousTile = tileAt(previousPosition.x, previousPosition.y);
        if (previousTile) {
          const from = previousTile.getBoundingClientRect();
          const to = roverTile.getBoundingClientRect();
          sprite.style.setProperty('--travel-x', `${from.left - to.left}px`);
          sprite.style.setProperty('--travel-y', `${from.top - to.top}px`);
          sprite.classList.add('travelling');
        }
      }
      if (keepRoverFocus) roverTile.focus({ preventScroll: true });
    }
    seedOrbs.replaceChildren(...level().seeds.map((_, index) => {
      const orb = document.createElement('span');
      orb.className = collected.has(index) ? 'seed-orb filled' : 'seed-orb';
      orb.textContent = '✦';
      return orb;
    }));
    world.parentElement.classList.toggle('energized', collected.size === level().seeds.length);
    coordinates.textContent = `X ${String(rover.x + 1).padStart(2, '0')} · Y ${String(rover.y + 1).padStart(2, '0')}`;
    goalCount.textContent = `${collected.size} / ${level().seeds.length}`;
  }

  function setStatus(message, type = 'normal') {
    status.textContent = message;
    status.parentElement.classList.toggle('is-error', type === 'error');
  }

  function saveEchoes() {
    try {
      const saved = readSavedEchoes();
      saved.forEach((index) => knownEchoes.add(index));
      const combined = JSON.stringify([...knownEchoes].sort((a, b) => a - b));
      if (window.localStorage.getItem(ECHO_KEY) !== combined) window.localStorage.setItem(ECHO_KEY, combined);
      echoStorageAvailable = true;
    } catch {
      echoStorageAvailable = false;
    }
    renderJournal();
    updateProgressNote();
  }

  function renderJournal() {
    journalCount.textContent = `${knownEchoes.size} / ${LEVELS.length}`;
    journalEntries.replaceChildren(...LEVELS.map((mission, index) => {
      const entry = document.createElement('li');
      entry.textContent = knownEchoes.has(index)
        ? `${mission.name}：${mission.echo.story}`
        : `任務 ${index + 1}：尚未發現回聲`;
      return entry;
    }));
    journalNote.textContent = echoStorageAvailable === false
      ? '無法保存回聲；目前只保留在此頁面。'
      : echoStorageAvailable === true ? '回聲保存在此瀏覽器；重設行動不會清除。'
        : '發現時會嘗試保存在此瀏覽器；重設行動不會清除。';
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

  function closedBarrierAt(x, y) {
    return !switchActive && level().barrier?.x === x && level().barrier?.y === y;
  }

  function moveForward() {
    const vector = DIRECTIONS[rover.direction];
    const x = rover.x + vector.x;
    const y = rover.y + vector.y;
    const nextTile = tileAt(x, y);
    if (!nextTile) {
      return { ok: false, message: '小芽走到地圖邊界了。看看地圖，換個方向再試。' };
    }
    if (level().walls.has(`${x},${y}`)) {
      return { ok: false, message: '岩壁擋住了去路。改變方向，或看看地圖上的空隙。' };
    }
    if (closedBarrierAt(x, y)) {
      return { ok: false, message: '光閘擋住了去路。先走上能量開關，讓光閘打開。' };
    }
    const previousPosition = { x: rover.x, y: rover.y };
    rover.x = x;
    rover.y = y;
    visited.add(`${x},${y}`);
    const discoveredEcho = !echoFound && rover.x === level().echo.x && rover.y === level().echo.y;
    if (discoveredEcho) {
      echoFound = true;
      knownEchoes.add(levelIndex);
      saveEchoes();
    }
    const activatedSwitch = !switchActive && rover.x === level().switchTile?.x && rover.y === level().switchTile?.y;
    if (activatedSwitch) switchActive = true;
    drawWorld(previousPosition);
    const movement = discoveredEcho
      ? `小芽抵達 X ${rover.x + 1}、Y ${rover.y + 1}，發現星球回聲。`
      : `小芽前進一步，到達 X ${rover.x + 1}、Y ${rover.y + 1}，面向${DIRECTIONS[rover.direction].name}方。`;
    setStatus(`${movement}${activatedSwitch ? ' 踩上能量開關，光閘打開了！' : ''}`);
    if (discoveredEcho) showToast('發現星球回聲 ◇');
    if (activatedSwitch) showToast('光閘已打開 ◉');
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
    highestUnlocked = Math.max(highestUnlocked, loadUnlockedMission(), Math.min(levelIndex + 1, LEVELS.length - 1));
    try {
      window.localStorage.setItem(PROGRESS_KEY, String(highestUnlocked));
      storageAvailable = true;
    } catch {
      // Progress still unlocks for the current session when storage is unavailable.
      storageAvailable = false;
    }
    updateProgressNote();
    updateMissionNavigation();
    gateOpen = true;
    drawWorld();
    world.hidden = true;
    winCard.hidden = false;
    winStory.textContent = echoFound ? `你還發現了星球回聲：${level().echo.story}`
      : knownEchoes.has(levelIndex) ? '這次沒有走到回聲；先前的故事仍在回聲日誌中。'
        : '地圖上還藏著星球回聲，也許下次可以繞路探索。';
    nextMissionButton.hidden = levelIndex >= LEVELS.length - 1;
    setStatus('導航門亮起來了！你幫小芽接通返航訊號。');
    toast.classList.remove('show');
    (nextMissionButton.hidden ? document.querySelector('#replay-win') : nextMissionButton).focus();
    return { ok: true, won: true };
  }

  function lightIsPresent() {
    const seedIndex = level().seeds.findIndex((seed) => seed.x === rover.x && seed.y === rover.y);
    return seedIndex !== -1 && !collected.has(seedIndex);
  }

  function pathAheadIsBlocked() {
    const vector = DIRECTIONS[rover.direction];
    const x = rover.x + vector.x;
    const y = rover.y + vector.y;
    return !tileAt(x, y) || level().walls.has(`${x},${y}`) || closedBarrierAt(x, y);
  }

  function updateMissionNavigation() {
    const current = String(levelIndex + 1).padStart(2, '0');
    const total = String(LEVELS.length).padStart(2, '0');
    missionPosition.textContent = `${current} / ${total}`;
    previousMissionButton.disabled = levelIndex <= 0;
    nextUnlockedButton.disabled = levelIndex >= highestUnlocked;
  }

  function updateProgressNote() {
    progressNote.textContent = storageAvailable === false
      ? '無法保存進度；關閉頁面後可能需要重來'
      : storageAvailable === true
        ? '已解鎖任務保存在此瀏覽器'
        : '通關時會嘗試在此瀏覽器保存進度';
  }

  function parseProgram() {
    const lines = code.value.split(/\r?\n/);
    const actions = [];
    for (let index = 0; index < lines.length; index += 1) {
      const source = lines[index].split('//', 1)[0].trim();
      if (!source) continue;
      const conditional = source.match(/^if\s*\(\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*\)\s*([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;?$/);
      if (conditional) {
        if (levelIndex < 2) throw new Error(`第 ${index + 1} 行：小芽還沒學會 if 判斷。先完成感應與選擇任務，再試這種寫法。`);
        const condition = CONDITIONS.get(conditional[1]);
        const action = COMMANDS.get(conditional[2]);
        if (!condition) throw new Error(`第 ${index + 1} 行：還沒有「${conditional[1]}」這個感測器。`);
        if (!action) throw new Error(`第 ${index + 1} 行：if 後面請放一個已解鎖的行動。`);
        actions.push({ action, condition, conditionName: conditional[1], name: `if (${conditional[1]}()) ${conditional[2]}()`, line: index + 1 });
        if (actions.length > 50) throw new Error('這次行動太長了，先試試 50 步以內。');
        continue;
      }
      const repeat = source.match(/^repeat\s*\(\s*(\d+)\s*,\s*([A-Za-z_$][\w$]*)\s*\)\s*;?$/);
      if (repeat) {
        if (levelIndex === 0) throw new Error(`第 ${index + 1} 行：小芽還沒學會 repeat。先完成初次接觸任務，之後再試這種簡寫。`);
        const count = Number(repeat[1]);
        const repeatedAction = COMMANDS.get(repeat[2]);
        if (!repeatedAction) throw new Error(`第 ${index + 1} 行：repeat 只能重複已解鎖的單一步驟行動。`);
        if (count < 1 || count > 10) throw new Error(`第 ${index + 1} 行：repeat 次數請設在 1 到 10 之間。`);
        for (let iteration = 0; iteration < count; iteration += 1) {
          actions.push({ action: repeatedAction, name: `repeat → ${repeat[2]}`, line: index + 1, repetition: { current: iteration + 1, total: count } });
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
    visited = new Set([`${rover.x},${rover.y}`]);
    collected = new Set();
    echoFound = false;
    switchActive = false;
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    world.hidden = false;
    highlightLine(null);
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
    let nextHint;
    if (collected.size < level().seeds.length) {
      nextHint = '程式跑完了，繼續找光種。';
    } else if (rover.x !== level().gate.x || rover.y !== level().gate.y) {
      nextHint = '光種都找齊了。導航門在右側，安排小芽走完最後一段路吧。';
    } else {
      nextHint = '小芽已抵達導航門。加上 openGate();，讓導航門亮起來。';
    }
    setStatus(`${status.textContent} ${nextHint}`);
  }

  function executeNext() {
    if (!program || nextInstruction >= program.length) return { done: true };
    const instruction = program[nextInstruction];
    nextInstruction += 1;
    highlightLine(instruction.line);
    help.classList.remove('error-text');
    const actionName = instruction.name.startsWith('if (') ? instruction.name : `${instruction.name}()`;
    const repetition = instruction.repetition ? `（第 ${instruction.repetition.current} / ${instruction.repetition.total} 次）` : '';
    const location = `第 ${instruction.line} 行${repetition}`;
    help.textContent = `${location} · ${actionName}`;
    if (instruction.condition && !instruction.condition()) {
      setStatus(`${location}：條件不成立（${instruction.conditionName}()），小芽略過了這個行動。`);
      return { done: nextInstruction >= program.length, skipped: true };
    }
    const conditionFeedback = instruction.condition ? `條件成立（${instruction.conditionName}()）。` : '';
    const result = instruction.action();
    if (!result.ok) {
      setStatus(`${location}：${conditionFeedback}${result.message}`, 'error');
      showToast(result.message, 'error');
      hasActionError = true;
      nextInstruction = program.length;
      return { done: true, error: true };
    }
    setStatus(`${location}：${conditionFeedback}${status.textContent}`);
    if (result.won) {
      // A successful gate ends the attempt even if source lines remain.
      nextInstruction = program.length;
      return { done: true, won: true };
    }
    return { done: nextInstruction >= program.length };
  }

  function delay(ms, id) {
    return new Promise((resolve) => window.setTimeout(() => resolve(id === runId), ms));
  }

  function setBusy(value) {
    busy = value;
    code.readOnly = value;
    stepButton.disabled = value;
    document.querySelectorAll('.command').forEach((button) => { button.disabled = value; });
    updateRunButton();
  }

  function updateRunButton() {
    const canResume = program && nextInstruction > 0 && nextInstruction < program.length;
    runButton.classList.toggle('is-pausing', busy);
    runButton.innerHTML = busy
      ? '<span aria-hidden="true">Ⅱ</span> 暫停行動'
      : canResume ? '<span aria-hidden="true">▶</span> 繼續執行' : runLabel;
  }

  function pauseProgram() {
    runId += 1;
    setBusy(false);
    setStatus(`${status.textContent} 已暫停；可以單步或繼續執行。`);
  }

  async function runProgram() {
    if (busy) {
      pauseProgram();
      return;
    }
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
    updateRunButton();
  }

  function resetMission() {
    runId += 1;
    setBusy(false);
    program = null;
    nextInstruction = 0;
    updateRunButton();
    rover = { ...level().start };
    visited = new Set([`${rover.x},${rover.y}`]);
    collected = new Set();
    echoFound = false;
    switchActive = false;
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    world.hidden = false;
    toast.classList.remove('show');
    help.classList.remove('error-text');
    help.textContent = level().instruction;
    highlightLine(null);
    drawWorld();
    setStatus('任務已重設。改好行動程式後，再陪小芽出發。');
  }

  function insertCommand(command) {
    let start = code.selectionStart;
    let end = code.selectionEnd;
    if (start === end) {
      const lineStart = code.value.lastIndexOf('\n', start - 1) + 1;
      const nextBreak = code.value.indexOf('\n', start);
      const lineEnd = nextBreak === -1 ? code.value.length : nextBreak;
      // A collapsed cursor inside a line inserts after it, without splitting the instruction.
      if (start > lineStart && start < lineEnd) start = end = lineEnd;
    }
    const before = code.value.slice(0, start);
    const after = code.value.slice(end);
    const needsLeadingBreak = before.length > 0 && !before.endsWith('\n');
    const needsTrailingBreak = after.length > 0 && !after.startsWith('\n');
    const snippets = {
      repeat: 'repeat(2, moveForward);',
      ifLight: 'if (lightIsPresent()) collectLight();',
      ifBlocked: 'if (pathAheadIsBlocked()) turnLeft();',
    };
    const call = snippets[command] ?? `${command}();`;
    const insertion = `${needsLeadingBreak ? '\n' : ''}${call}${needsTrailingBreak ? '\n' : ''}`;
    if (code.maxLength >= 0 && before.length + insertion.length + after.length > code.maxLength) {
      const message = `程式最多 ${code.maxLength} 個字，先刪減一些內容再插入。`;
      setStatus(message, 'error');
      help.textContent = message;
      help.classList.add('error-text');
      showToast(message, 'error');
      code.focus();
      return;
    }
    code.setRangeText(insertion, start, end, 'end');
    code.focus();
    onCodeChanged();
  }

  function onCodeChanged() {
    const wasInProgress = program && nextInstruction > 0 && nextInstruction < program.length;
    missionDrafts[levelIndex] = code.value;
    program = null;
    nextInstruction = 0;
    updateRunButton();
    updateGutter();
    help.classList.remove('error-text');
    help.textContent = level().instruction;
    if (wasInProgress) setStatus('程式已修改，下次執行或單步會從起點重新開始。');
  }

  function showMissionDetails() {
    const ordinal = String(levelIndex + 1).padStart(2, '0');
    world.closest('.world-panel').dataset.scene = level().scene;
    topNote.innerHTML = `<i></i> 任務 ${ordinal} · ${level().name}`;
    fieldLog.textContent = `SILENT PLANET / FIELD LOG ${ordinal}`;
    missionTitle.innerHTML = level().title;
    missionLead.textContent = level().lead;
    worldTitle.textContent = level().area;
    hintCopy.innerHTML = level().hint;
    code.value = missionDrafts[levelIndex];
    repeatCommand.hidden = levelIndex < 1;
    lightCondition.hidden = levelIndex < 2;
    wallCondition.hidden = levelIndex < 2;
    help.textContent = level().instruction;
    updateGutter();
  }

  function enterMission(index) {
    if (index < 0 || index > highestUnlocked || index >= LEVELS.length) return;
    runId += 1;
    setBusy(false);
    levelIndex = index;
    program = null;
    nextInstruction = 0;
    updateRunButton();
    rover = { ...level().start };
    visited = new Set([`${rover.x},${rover.y}`]);
    collected = new Set();
    echoFound = false;
    switchActive = false;
    gateOpen = false;
    hasActionError = false;
    winCard.hidden = true;
    world.hidden = false;
    toast.classList.remove('show');
    help.classList.remove('error-text');
    showMissionDetails();
    initMap();
    updateMissionNavigation();
    setStatus('新訊號已定位。讀讀任務筆記，再安排小芽的行動。');
    missionTitle.focus({ preventScroll: true });
  }

  function enterNextMission() {
    enterMission(levelIndex + 1);
  }

  function enterPreviousMission() {
    enterMission(levelIndex - 1);
  }

  function updateGutter() {
    const count = code.value.split('\n').length;
    const lines = Array.from({ length: count }, (_, index) => {
      const line = document.createElement('span');
      line.textContent = String(index + 1);
      return line;
    });
    gutter.replaceChildren(...lines);
    gutter.scrollTop = code.scrollTop;
  }

  function highlightLine(number) {
    gutter.querySelector('.active-line')?.classList.remove('active-line');
    if (number === null) return;
    const line = gutter.children[number - 1];
    if (!line) return;
    line.classList.add('active-line');
    const style = window.getComputedStyle(code);
    const lineHeight = parseFloat(style.lineHeight);
    const padding = parseFloat(style.paddingTop);
    const top = padding + (number - 1) * lineHeight;
    const bottom = top + lineHeight;
    if (top < code.scrollTop + padding) code.scrollTop = top - padding;
    else if (bottom > code.scrollTop + code.clientHeight - padding) code.scrollTop = bottom - code.clientHeight + padding;
    gutter.scrollTop = code.scrollTop;
  }

  function moveMapFocus(event) {
    const offsets = {
      ArrowUp: [0, -1],
      ArrowRight: [1, 0],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
    };
    const offset = offsets[event.key];
    const current = event.target.closest('.tile');
    if (!offset || !current) return;
    event.preventDefault();
    const next = tileAt(Number(current.dataset.x) + offset[0], Number(current.dataset.y) + offset[1]);
    if (next) {
      current.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  }

  runButton.addEventListener('click', runProgram);
  window.addEventListener('storage', (event) => {
    if (event.key === PROGRESS_KEY) {
      highestUnlocked = Math.max(highestUnlocked, loadUnlockedMission());
      updateMissionNavigation();
      updateProgressNote();
    } else if (event.key === ECHO_KEY && event.newValue !== null) {
      // Merge discoveries from other tabs, including any local discoveries not in that write.
      saveEchoes();
    }
  });
  world.addEventListener('keydown', moveMapFocus);
  stepButton.addEventListener('click', singleStep);
  resetButton.addEventListener('click', resetMission);
  document.querySelector('#replay-win').addEventListener('click', () => {
    resetMission();
    code.focus();
  });
  nextMissionButton.addEventListener('click', enterNextMission);
  previousMissionButton.addEventListener('click', enterPreviousMission);
  nextUnlockedButton.addEventListener('click', enterNextMission);
  document.querySelectorAll('.command').forEach((button) => {
    button.addEventListener('click', () => insertCommand(button.dataset.command));
  });
  code.addEventListener('input', onCodeChanged);
  code.addEventListener('scroll', () => { gutter.scrollTop = code.scrollTop; });
  code.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      runProgram();
    }
  });

  showMissionDetails();
  renderJournal();
  updateProgressNote();
  updateMissionNavigation();
  initMap();
  updateGutter();
})();
