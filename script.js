(() => {
  const LEVEL_DEFINITIONS = [
    {
      name: "Уровень 1",
      intro:
        "Уровень 1 из 2: собери все сердечки. Клетки с ✖ отправляют тебя назад на старт.",
      map: [
        "###########",
        "#P...#...H#",
        "#.#.#.#.#.#",
        "#.#...#...#",
        "#.###.#.#T#",
        "#...#..H#.#",
        "###.#.###.#",
        "#H..#..H#.#",
        "#.#.###.#.#",
        "#T...H..E##",
        "###########",
      ],
    },
    {
      name: "Уровень 2",
      intro:
        "Уровень 2 из 2: логическая задачка. Активируй рычаги A и B, чтобы открыть ворота X и Y.",
      map: [
        "###########",
        "#P.A.#...E#",
        "#.#.#.#.#.#",
        "#....X..H.#",
        "###.#.#.#.#",
        "#.H.#.#...#",
        "#.#.#.#.B.#",
        "#...#.#.#.#",
        "#H###.#.###",
        "#....#.YH##",
        "###########",
      ],
    },
  ];

  const KEY_TO_DIRECTION = {
    arrowup: { dx: 0, dy: -1 },
    arrowdown: { dx: 0, dy: 1 },
    arrowleft: { dx: -1, dy: 0 },
    arrowright: { dx: 1, dy: 0 },
    w: { dx: 0, dy: -1 },
    a: { dx: -1, dy: 0 },
    s: { dx: 0, dy: 1 },
    d: { dx: 1, dy: 0 },
    ц: { dx: 0, dy: -1 },
    ф: { dx: -1, dy: 0 },
    ы: { dx: 0, dy: 1 },
    в: { dx: 1, dy: 0 },
  };

  const screens = {
    start: document.getElementById("start-screen"),
    game: document.getElementById("game-screen"),
    final: document.getElementById("final-screen"),
  };

  const elements = {
    startBtn: document.getElementById("start-btn"),
    restartBtn: document.getElementById("restart-btn"),
    backBtn: document.getElementById("back-btn"),
    playAgainBtn: document.getElementById("play-again-btn"),
    levelCount: document.getElementById("level-count"),
    progressCount: document.getElementById("progress-count"),
    moveCount: document.getElementById("move-count"),
    goalText: document.getElementById("goal-text"),
    statusText: document.getElementById("status-text"),
    finalStats: document.getElementById("final-stats"),
    gameGrid: document.getElementById("game-grid"),
    dirButtons: document.querySelectorAll(".dir-btn"),
  };

  if (
    !screens.start ||
    !screens.game ||
    !screens.final ||
    !elements.startBtn ||
    !elements.restartBtn ||
    !elements.backBtn ||
    !elements.playAgainBtn ||
    !elements.levelCount ||
    !elements.progressCount ||
    !elements.moveCount ||
    !elements.goalText ||
    !elements.statusText ||
    !elements.finalStats ||
    !elements.gameGrid
  ) {
    return;
  }

  function posKey(x, y) {
    return `${x},${y}`;
  }

  function parseLevel(layout) {
    const rows = layout.length;
    const cols = layout[0].length;
    const board = [];
    const hearts = [];
    const traps = [];
    const switchesA = [];
    const switchesB = [];
    const gatesA = [];
    const gatesB = [];
    let start = null;
    let exit = null;

    for (let y = 0; y < rows; y += 1) {
      const row = layout[y];

      if (row.length !== cols) {
        throw new Error("Все строки карты должны быть одной длины.");
      }

      board[y] = [];

      for (let x = 0; x < cols; x += 1) {
        const char = row[x];

        if (char === "#") {
          board[y][x] = "#";
          continue;
        }

        board[y][x] = ".";

        if (char === "P") {
          start = { x, y };
        } else if (char === "H") {
          hearts.push({ x, y });
        } else if (char === "T") {
          traps.push({ x, y });
        } else if (char === "A") {
          switchesA.push({ x, y });
        } else if (char === "B") {
          switchesB.push({ x, y });
        } else if (char === "X") {
          gatesA.push({ x, y });
        } else if (char === "Y") {
          gatesB.push({ x, y });
        } else if (char === "E") {
          exit = { x, y };
        }
      }
    }

    if (!start || !exit || hearts.length === 0) {
      throw new Error("Карта должна содержать старт, выход и хотя бы одно сердечко.");
    }

    return {
      rows,
      cols,
      board,
      hearts,
      traps,
      switchesA,
      switchesB,
      gatesA,
      gatesB,
      start,
      exit,
    };
  }

  const levels = LEVEL_DEFINITIONS.map((definition) => {
    const parsed = parseLevel(definition.map);

    return {
      ...definition,
      ...parsed,
      heartKeys: new Set(parsed.hearts.map((point) => posKey(point.x, point.y))),
      trapKeys: new Set(parsed.traps.map((point) => posKey(point.x, point.y))),
      switchAKeys: new Set(parsed.switchesA.map((point) => posKey(point.x, point.y))),
      switchBKeys: new Set(parsed.switchesB.map((point) => posKey(point.x, point.y))),
      gateAKeys: new Set(parsed.gatesA.map((point) => posKey(point.x, point.y))),
      gateBKeys: new Set(parsed.gatesB.map((point) => posKey(point.x, point.y))),
    };
  });

  const totalHeartsInCampaign = levels.reduce((sum, level) => sum + level.hearts.length, 0);
  let currentScreen = "start";
  let currentLevelIndex = 0;
  let currentLevel = levels[currentLevelIndex];
  let chompTimeout = null;

  const campaign = {
    startedAt: Date.now(),
    completedMoves: 0,
  };

  let state = createLevelState(currentLevel);

  function createLevelState(level) {
    return {
      player: { ...level.start },
      collectedHearts: new Set(),
      moves: 0,
      gateAOpen: level.gateAKeys.size === 0,
      gateBOpen: level.gateBKeys.size === 0,
      finished: false,
      chompActive: false,
    };
  }

  function clearChompTimer() {
    if (chompTimeout) {
      clearTimeout(chompTimeout);
      chompTimeout = null;
    }
  }

  function showScreen(screenName) {
    Object.values(screens).forEach((screen) => screen.classList.remove("active"));
    screens[screenName].classList.add("active");
    currentScreen = screenName;
  }

  function setStatus(message, tone = "normal") {
    elements.statusText.textContent = message;

    if (tone === "warning" || tone === "success") {
      elements.statusText.dataset.tone = tone;
    } else {
      delete elements.statusText.dataset.tone;
    }
  }

  function formatHeartWord(count) {
    const mod10 = count % 10;
    const mod100 = count % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return "сердечко";
    }

    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
      return "сердечка";
    }

    return "сердечек";
  }

  function getMissingLevers() {
    const missing = [];

    if (currentLevel.gateAKeys.size > 0 && !state.gateAOpen) {
      missing.push("A");
    }

    if (currentLevel.gateBKeys.size > 0 && !state.gateBOpen) {
      missing.push("B");
    }

    return missing;
  }

  function areGatesReady() {
    return getMissingLevers().length === 0;
  }

  function buildGoalText() {
    const remainingHearts = currentLevel.hearts.length - state.collectedHearts.size;
    const missingLevers = getMissingLevers();

    if (remainingHearts > 0) {
      if (missingLevers.length > 0) {
        return `Осталось сердечек: ${remainingHearts}. Ещё нужны рычаги: ${missingLevers.join(" и ")}.`;
      }

      return `Осталось сердечек до финиша: ${remainingHearts}.`;
    }

    if (missingLevers.length > 0) {
      return `Сердечки собраны! Теперь активируй рычаги: ${missingLevers.join(" и ")}.`;
    }

    return "Финиш открыт! Иди к сияющей клетке ✨";
  }

  function updateHud() {
    elements.levelCount.textContent = `${currentLevelIndex + 1}/${levels.length}`;
    elements.progressCount.textContent = `${state.collectedHearts.size}/${currentLevel.hearts.length}`;
    elements.moveCount.textContent = String(state.moves);
    elements.goalText.textContent = buildGoalText();
  }

  function renderBoard() {
    elements.gameGrid.style.setProperty("--cols", String(currentLevel.cols));
    elements.gameGrid.style.setProperty("--rows", String(currentLevel.rows));
    elements.gameGrid.innerHTML = "";

    for (let y = 0; y < currentLevel.rows; y += 1) {
      for (let x = 0; x < currentLevel.cols; x += 1) {
        const tile = document.createElement("div");
        tile.classList.add("tile");

        if (currentLevel.board[y][x] === "#") {
          tile.classList.add("tile-wall");
        } else {
          tile.classList.add("tile-floor");
        }

        const key = posKey(x, y);
        const isPlayer = state.player.x === x && state.player.y === y;
        const isHeart = currentLevel.heartKeys.has(key) && !state.collectedHearts.has(key);
        const isTrap = currentLevel.trapKeys.has(key);
        const isSwitchA = currentLevel.switchAKeys.has(key);
        const isSwitchB = currentLevel.switchBKeys.has(key);
        const isGateA = currentLevel.gateAKeys.has(key);
        const isGateB = currentLevel.gateBKeys.has(key);
        const isExit = currentLevel.exit.x === x && currentLevel.exit.y === y;

        if (isHeart) {
          tile.classList.add("tile-heart");
        }

        if (isTrap) {
          tile.classList.add("tile-trap");
        }

        if (isSwitchA) {
          tile.classList.add("tile-switch-a");
          if (state.gateAOpen) {
            tile.classList.add("active");
          }
        }

        if (isSwitchB) {
          tile.classList.add("tile-switch-b");
          if (state.gateBOpen) {
            tile.classList.add("active");
          }
        }

        if (isGateA) {
          tile.classList.add("tile-gate-a");
          tile.classList.add(state.gateAOpen ? "open" : "closed");
        }

        if (isGateB) {
          tile.classList.add("tile-gate-b");
          tile.classList.add(state.gateBOpen ? "open" : "closed");
        }

        if (isExit) {
          tile.classList.add("tile-exit");
          tile.classList.add(
            state.collectedHearts.size === currentLevel.hearts.length && areGatesReady()
              ? "unlocked"
              : "locked",
          );
        }

        if (isPlayer) {
          tile.classList.add("tile-player");

          if (state.chompActive) {
            tile.classList.add("chomping");
          }
        }

        elements.gameGrid.append(tile);
      }
    }
  }

  function triggerChomp() {
    state.chompActive = true;
    clearChompTimer();

    chompTimeout = setTimeout(() => {
      state.chompActive = false;
      if (currentScreen === "game") {
        renderBoard();
      }
    }, 190);
  }

  function startCampaign() {
    clearChompTimer();
    currentLevelIndex = 0;
    currentLevel = levels[currentLevelIndex];
    campaign.startedAt = Date.now();
    campaign.completedMoves = 0;
    state = createLevelState(currentLevel);
  }

  function resetCurrentLevel(customMessage) {
    clearChompTimer();
    state = createLevelState(currentLevel);
    setStatus(customMessage || currentLevel.intro);
    updateHud();
    renderBoard();
  }

  function startGame() {
    startCampaign();
    showScreen("game");
    resetCurrentLevel();
  }

  function goToNextLevelOrFinish() {
    campaign.completedMoves += state.moves;

    if (currentLevelIndex < levels.length - 1) {
      currentLevelIndex += 1;
      currentLevel = levels[currentLevelIndex];
      resetCurrentLevel(
        `Нежность! ${levels[currentLevelIndex - 1].name} пройден. ${currentLevel.name}: теперь нужна логика и внимательность.`,
      );
      return;
    }

    finishGame();
  }

  function finishGame() {
    state.finished = true;
    const spentSeconds = Math.max(1, Math.round((Date.now() - campaign.startedAt) / 1000));
    const heartsWord = formatHeartWord(totalHeartsInCampaign);

    elements.finalStats.textContent = `Ты прошла ${levels.length} уровня, собрала ${totalHeartsInCampaign} ${heartsWord} и дошла до финиша за ${campaign.completedMoves} шагов (примерно ${spentSeconds} сек). Ты невероятная 💕`;
    showScreen("final");
  }

  function isBlockedByClosedGate(x, y) {
    const key = posKey(x, y);

    if (currentLevel.gateAKeys.has(key) && !state.gateAOpen) {
      return "A";
    }

    if (currentLevel.gateBKeys.has(key) && !state.gateBOpen) {
      return "B";
    }

    return "";
  }

  function movePlayer(dx, dy) {
    if (currentScreen !== "game" || state.finished) {
      return;
    }

    const nextX = state.player.x + dx;
    const nextY = state.player.y + dy;

    if (nextX < 0 || nextY < 0 || nextX >= currentLevel.cols || nextY >= currentLevel.rows) {
      return;
    }

    if (currentLevel.board[nextY][nextX] === "#") {
      setStatus("Ой, тут стенка. Попробуй другой путь.", "warning");
      return;
    }

    const closedGate = isBlockedByClosedGate(nextX, nextY);
    if (closedGate) {
      setStatus(`Ворота ${closedGate} закрыты. Найди рычаг ${closedGate}.`, "warning");
      return;
    }

    const triesToEnterExit = nextX === currentLevel.exit.x && nextY === currentLevel.exit.y;
    const remainingHearts = currentLevel.hearts.length - state.collectedHearts.size;
    const missingLevers = getMissingLevers();

    if (triesToEnterExit && (remainingHearts > 0 || missingLevers.length > 0)) {
      if (remainingHearts > 0 && missingLevers.length > 0) {
        setStatus(
          `Финиш пока закрыт: осталось сердечек ${remainingHearts} и нужны рычаги ${missingLevers.join(" и ")}.`,
          "warning",
        );
      } else if (remainingHearts > 0) {
        setStatus(`Финиш пока закрыт: осталось сердечек ${remainingHearts}.`, "warning");
      } else {
        setStatus(`Почти! Для финиша активируй рычаги: ${missingLevers.join(" и ")}.`, "warning");
      }
      return;
    }

    state.player = { x: nextX, y: nextY };
    state.moves += 1;
    triggerChomp();

    const key = posKey(nextX, nextY);
    let statusMessage = "аааййй киса моя молодец 💗";
    let statusTone = "normal";

    if (currentLevel.trapKeys.has(key)) {
      state.player = { ...currentLevel.start };
      statusMessage = "Ай! Ловушка. Ты возвращаешься на старт уровня, но прогресс сердечек сохранён.";
      statusTone = "warning";
      updateHud();
      renderBoard();
      setStatus(statusMessage, statusTone);
      return;
    }

    if (currentLevel.heartKeys.has(key) && !state.collectedHearts.has(key)) {
      state.collectedHearts.add(key);
      statusMessage = `Как мило! Сердечко ${state.collectedHearts.size}/${currentLevel.hearts.length} собрано.`;
      statusTone = "success";
    }

    if (currentLevel.switchAKeys.has(key) && !state.gateAOpen) {
      state.gateAOpen = true;
      statusMessage = "Щёлк! Рычаг A активирован, ворота X открыты.";
      statusTone = "success";
    }

    if (currentLevel.switchBKeys.has(key) && !state.gateBOpen) {
      state.gateBOpen = true;
      statusMessage = "Щёлк! Рычаг B активирован, ворота Y открыты.";
      statusTone = "success";
    }

    if (triesToEnterExit) {
      setStatus("Уровень пройден! ✨", "success");
      goToNextLevelOrFinish();
      return;
    }

    updateHud();
    renderBoard();
    setStatus(statusMessage, statusTone);
  }

  function moveByDirectionName(directionName) {
    const directionMap = {
      up: { dx: 0, dy: -1 },
      down: { dx: 0, dy: 1 },
      left: { dx: -1, dy: 0 },
      right: { dx: 1, dy: 0 },
    };

    const direction = directionMap[directionName];

    if (direction) {
      movePlayer(direction.dx, direction.dy);
    }
  }

  elements.startBtn.addEventListener("click", startGame);
  elements.restartBtn.addEventListener("click", () =>
    resetCurrentLevel("Начинаем уровень заново. Ты точно справишься 💞"),
  );
  elements.backBtn.addEventListener("click", () => {
    clearChompTimer();
    showScreen("start");
  });
  elements.playAgainBtn.addEventListener("click", startGame);

  elements.dirButtons.forEach((button) => {
    button.addEventListener("click", () => {
      moveByDirectionName(button.dataset.dir || "");
    });
  });

  window.addEventListener("keydown", (event) => {
    if (currentScreen !== "game") {
      return;
    }

    const direction = KEY_TO_DIRECTION[event.key.toLowerCase()];

    if (!direction) {
      return;
    }

    event.preventDefault();
    movePlayer(direction.dx, direction.dy);
  });
})();
