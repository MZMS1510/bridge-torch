(() => {
  const GOAL_TIME = 17;
  const ANIMATION_MS = 820;
  const layout = {
    positions: { left: 40, right: 640 },
    torch: { left: 160, right: 520 }
  };

  const characters = [
    { id: "ava", label: "Ava", time: 1, color: "#f7b801" },
    { id: "ben", label: "Ben", time: 2, color: "#55c1ff" },
    { id: "cara", label: "Cara", time: 5, color: "#ef476f" },
    { id: "dax", label: "Dax", time: 10, color: "#06d6a0" }
  ];
  const charById = new Map();

  const state = {
    positions: {},
    torchSide: "left",
    timeElapsed: 0,
    selections: new Set(),
    moves: [],
    isAnimating: false,
    isAutoPlaying: false
  };

  const solutionSequence = [
    ["ava", "ben"],
    ["ava"],
    ["cara", "dax"],
    ["ben"],
    ["ava", "ben"]
  ];

  const elements = {
    scene: document.getElementById("scene"),
    characterLayer: document.getElementById("character-layer"),
    torch: document.getElementById("torch"),
    crossButton: document.getElementById("crossButton"),
    undoButton: document.getElementById("undoButton"),
    resetButton: document.getElementById("resetButton"),
    solutionButton: document.getElementById("solutionButton"),
    torchSide: document.getElementById("torchSide"),
    timeElapsed: document.getElementById("timeElapsed"),
    selectionText: document.getElementById("selectionText"),
    statusMessage: document.getElementById("statusMessage"),
    historyList: document.getElementById("historyList"),
    progressFill: document.getElementById("progressFill"),
    modal: document.getElementById("modal"),
    modalText: document.getElementById("modalText"),
    closeModal: document.getElementById("closeModal")
  };

  let baseStatus =
    "Escolha uma ou duas pessoas no lado da tocha para se mover.";
  let statusTimer = null;

  // Build the character buttons and initial layout.
  characters.forEach((char, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "character";
    btn.dataset.id = char.id;
    btn.style.setProperty("--row", index);
    btn.style.setProperty("--tone", char.color);
    btn.innerHTML = `
      <span class="avatar">${char.label.charAt(0)}</span>
      <span class="tag">
        <strong>${char.label}</strong>
        <small>${char.time} min</small>
      </span>
    `;
    btn.addEventListener("click", () => handleCharacterClick(char));
    elements.characterLayer.appendChild(btn);
    char.element = btn;
    charById.set(char.id, char);
    state.positions[char.id] = "left";
  });
  recalcLayout(true);
  updateHistory();
  updateButtons();
  setStatus(baseStatus);

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => recalcLayout(true), 180);
  });

  elements.crossButton.addEventListener("click", () => {
    if (state.isAnimating || state.isAutoPlaying) return;
    const selection = Array.from(state.selections);
    if (isSelectionValid(selection)) {
      executeMove(selection);
    }
  });

  elements.undoButton.addEventListener("click", handleUndo);
  elements.resetButton.addEventListener("click", () => resetState());
  elements.solutionButton.addEventListener("click", playSolution);
  elements.closeModal.addEventListener("click", hideModal);
  elements.modal.addEventListener("click", (event) => {
    if (event.target === elements.modal) hideModal();
  });

  function handleCharacterClick(char) {
    if (state.isAnimating || state.isAutoPlaying) return;
    const currentSide = state.positions[char.id];
    if (currentSide !== state.torchSide) {
  flashStatus(
    `A tocha está no lado ${describeSide(state.torchSide)}. ${
      char.label
    } ainda não pode se mover.`
  );
      jiggle(char.element);
      return;
    }

    const limit = state.torchSide === "left" ? 2 : 1;
    if (state.selections.has(char.id)) {
      state.selections.delete(char.id);
    } else {
      if (state.selections.size >= limit) {
        flashStatus(
          state.torchSide === "left"
            ? "Escolha no máximo duas pessoas para atravessar."
            : "Apenas uma pessoa pode trazer a tocha de volta."
        );
        jiggle(elements.crossButton);
        return;
      }
      state.selections.add(char.id);
    }

    updateScene();
    updateButtons();
  }

  function isSelectionValid(selection = Array.from(state.selections)) {
    if (state.torchSide === "left") {
      return selection.length >= 1 && selection.length <= 2;
    }
    return selection.length === 1;
  }

  function updateScene(skipAnimation = false) {
    characters.forEach((char) => {
      applyCharacterPosition(char, state.positions[char.id], skipAnimation);
      const isSelected = state.selections.has(char.id);
      char.element.classList.toggle("selected", isSelected);
    });
    updateTorch(skipAnimation);
    updateHud();
  }

  function applyCharacterPosition(char, side, skipAnimation) {
    const x = layout.positions[side];
    if (skipAnimation) {
      char.element.classList.add("no-transition");
    }
    char.element.style.setProperty("--x", `${x}px`);
    if (skipAnimation) {
      requestAnimationFrame(() => char.element.classList.remove("no-transition"));
    }
  }

  function updateTorch(skipAnimation = false) {
    const x = layout.torch[state.torchSide];
    if (skipAnimation) {
      elements.torch.classList.add("no-transition");
    }
    elements.torch.style.setProperty("--x", `${x}px`);
    if (skipAnimation) {
      requestAnimationFrame(() => elements.torch.classList.remove("no-transition"));
    }
  }

  function recalcLayout(skipAnimation = false) {
    const width = elements.scene?.clientWidth || 760;
    layout.positions.left = Math.max(30, width * 0.12);
    layout.positions.right = Math.min(width - 110, width * 0.82);
    layout.torch.left = Math.max(90, width * 0.34);
    layout.torch.right = Math.min(width - 160, width * 0.66);
    updateScene(skipAnimation);
  }

  function updateHud() {
  elements.torchSide.textContent =
    state.torchSide === "left" ? "Esquerda (acampamento)" : "Direita (seguro)";
    elements.timeElapsed.textContent = `${state.timeElapsed} min`;
    elements.selectionText.textContent = state.selections.size
      ? describeSelection(Array.from(state.selections))
      : "nenhuma";
    const ratio = Math.min(1, state.timeElapsed / GOAL_TIME);
    elements.progressFill.style.width = `${ratio * 100}%`;
  }

  function describeSelection(selection) {
    return selection.map((id) => charById.get(id)?.label || id).join(" e ");
  }

  function describeSide(side) {
    return side === "left" ? "esquerdo" : "direito";
  }

  function describeMove(move) {
    const names = move.ids
      .map((id) => charById.get(id)?.label || id)
      .join(" & ");
    const moverCount = move.ids.length;
    const direction =
      move.from === "left"
        ? moverCount > 1
          ? "atravessaram a ponte"
          : "atravessou a ponte"
        : moverCount > 1
        ? "trouxeram a tocha de volta"
        : "trouxe a tocha de volta";
    return `${names} ${direction} (+${move.duration} min).`;
  }

  async function executeMove(selection, options = {}) {
    if (!selection.length) return;
    const fromSide = state.torchSide;
    const toSide = fromSide === "left" ? "right" : "left";
    const movers = selection.map((id) => charById.get(id));
    const duration = movers.reduce((max, person) => Math.max(max, person.time), 0);

    movers.forEach((person) => person.element.classList.add("traveling"));

    state.moves.push({ ids: selection.slice(), from: fromSide, duration, to: toSide });
    state.selections.clear();
    selection.forEach((id) => {
      state.positions[id] = toSide;
    });
    state.torchSide = toSide;
    state.timeElapsed += duration;

    updateScene();
    updateHistory();
    updateButtons();

    state.isAnimating = true;
    await wait(ANIMATION_MS);
    state.isAnimating = false;

    movers.forEach((person) => person.element.classList.remove("traveling"));

    if (options.announce !== false) {
      setStatus(describeMove({ ids: selection, from: fromSide, duration }));
    }

    updateButtons();
    checkForCompletion();
  }

  function updateHistory() {
    if (!state.moves.length) {
  elements.historyList.innerHTML =
    '<li class="placeholder">Nenhum movimento ainda - comece escolhendo quem atravessa primeiro.</li>';
      return;
    }
    let runningTotal = 0;
    elements.historyList.innerHTML = state.moves
      .map((move) => {
        runningTotal += move.duration;
  return `<li><strong>${describeMove(
    move
  )}</strong> Tempo acumulado: ${runningTotal} min</li>`;
      })
      .join("");
  }

  function updateButtons() {
    const validSelection = isSelectionValid();
    elements.crossButton.disabled = !validSelection || state.isAnimating || state.isAutoPlaying;
    elements.undoButton.disabled = !state.moves.length || state.isAnimating || state.isAutoPlaying;
    elements.resetButton.disabled = state.isAnimating && !state.isAutoPlaying;
    elements.solutionButton.disabled = state.isAutoPlaying || state.isAnimating;
  }

  function handleUndo() {
    if (!state.moves.length || state.isAnimating || state.isAutoPlaying) return;
    const lastMove = state.moves.pop();
    const fromSide = lastMove.from;
    const toSide = lastMove.to;

    lastMove.ids.forEach((id) => {
      state.positions[id] = fromSide;
    });
    state.torchSide = fromSide;
    state.timeElapsed = Math.max(0, state.timeElapsed - lastMove.duration);
    state.selections.clear();

    updateScene();
    updateHistory();
    updateButtons();
    setStatus("Movimento desfeito. Tente outra combinação.");
    hideModal();
  }

  function resetState(options = {}) {
    state.moves = [];
    state.timeElapsed = 0;
    state.torchSide = "left";
    state.selections.clear();
    state.isAnimating = false;
    state.isAutoPlaying = false;
    characters.forEach((char) => {
      state.positions[char.id] = "left";
      char.element.classList.remove("traveling");
    });

    hideModal();
    updateScene(true);
    updateHistory();
    updateButtons();

    baseStatus =
      options.message ||
      "Escolha uma ou duas pessoas no lado da tocha para se mover.";
    setStatus(baseStatus);
  }

  async function playSolution() {
    if (state.isAnimating || state.isAutoPlaying) return;
    resetState({ message: "Reprodução automática em andamento..." });
    state.isAutoPlaying = true;
    updateButtons();

    for (const step of solutionSequence) {
      if (!state.isAutoPlaying) break;
      await wait(260);
      await executeMove(step, { announce: true });
    }

    state.isAutoPlaying = false;
    updateButtons();
    setStatus("Todos atravessaram nos 17 minutos ideais!");
    checkForCompletion();
  }

  function checkForCompletion() {
    const allRight = characters.every(
      (char) => state.positions[char.id] === "right"
    );
    if (!allRight) return;

    const success = state.timeElapsed <= GOAL_TIME;
    const message = success
      ? `Sucesso! Você igualou o tempo ideal de ${GOAL_TIME} minutos.`
      : `Todos atravessaram em ${state.timeElapsed} minutos. Dá para chegar em ${GOAL_TIME}?`;

    elements.modalText.textContent = message;
    elements.modal.hidden = false;
  }

  function hideModal() {
    elements.modal.hidden = true;
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function setStatus(text) {
    baseStatus = text;
    elements.statusMessage.textContent = text;
  }

  function flashStatus(text) {
    clearTimeout(statusTimer);
    elements.statusMessage.textContent = text;
    statusTimer = setTimeout(() => {
      elements.statusMessage.textContent = baseStatus;
    }, 1800);
  }

  function jiggle(element) {
    if (element?.classList?.contains("character") && element.animate) {
      element.animate(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-6px)" },
          { transform: "translateX(6px)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(0)" }
        ],
        { duration: 360, easing: "ease", iterations: 1, composite: "add" }
      );
      return;
    }

    element.classList.remove("shake");
    void element.offsetWidth; // trigger reflow
    element.classList.add("shake");
    setTimeout(() => element.classList.remove("shake"), 420);
  }
})();
