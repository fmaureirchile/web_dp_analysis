const statusLabels = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done"
};

const appState = {
  board: null,
  filters: {
    stage: "all",
    priority: "all",
    search: ""
  }
};

const elements = {
  kanban: document.getElementById("kanban"),
  stageFilter: document.getElementById("filter-stage"),
  priorityFilter: document.getElementById("filter-priority"),
  searchFilter: document.getElementById("filter-search"),
  saveButton: document.getElementById("save-board"),
  heroStats: document.getElementById("hero-stats")
};

async function fetchBoard() {
  const response = await fetch("/api/board");
  if (!response.ok) {
    throw new Error("No se pudo cargar el tablero");
  }
  return response.json();
}

async function saveBoard() {
  if (!appState.board) {
    return;
  }

  elements.saveButton.disabled = true;
  elements.saveButton.textContent = "Guardando...";

  const response = await fetch("/api/board", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(appState.board)
  });

  if (!response.ok) {
    elements.saveButton.disabled = false;
    elements.saveButton.textContent = "Guardar cambios";
    throw new Error("No se pudo persistir el tablero");
  }

  appState.board = await response.json();
  elements.saveButton.disabled = false;
  elements.saveButton.textContent = "Guardado";
  setTimeout(() => {
    elements.saveButton.textContent = "Guardar cambios";
  }, 1000);
  renderAll();
}

function normalize(text) {
  return text.toLowerCase().trim();
}

function getFilteredCards() {
  if (!appState.board) {
    return [];
  }

  return appState.board.cards.filter((card) => {
    const stageOk = appState.filters.stage === "all" || card.stage === appState.filters.stage;
    const priorityOk = appState.filters.priority === "all" || card.priority === appState.filters.priority;
    const query = normalize(appState.filters.search);
    const searchable = `${card.title} ${card.description}`.toLowerCase();
    const textOk = query.length === 0 || searchable.includes(query);

    return stageOk && priorityOk && textOk;
  });
}

function computeStats(cards) {
  const total = cards.length;
  const byStatus = {
    todo: cards.filter((c) => c.status === "todo").length,
    in_progress: cards.filter((c) => c.status === "in_progress").length,
    done: cards.filter((c) => c.status === "done").length
  };

  return { total, byStatus };
}

function createStatusSelector(card) {
  const select = document.createElement("select");
  ["todo", "in_progress", "done"].forEach((status) => {
    const option = document.createElement("option");
    option.value = status;
    option.textContent = statusLabels[status];
    option.selected = card.status === status;
    select.appendChild(option);
  });

  select.addEventListener("change", (event) => {
    card.status = event.target.value;
    renderAll();
  });

  return select;
}

function renderStats(cards) {
  const stats = computeStats(cards);
  elements.heroStats.innerHTML = "";

  const items = [
    ["Cards visibles", stats.total],
    ["To Do", stats.byStatus.todo],
    ["In Progress", stats.byStatus.in_progress],
    ["Done", stats.byStatus.done]
  ];

  items.forEach(([label, value]) => {
    const box = document.createElement("div");
    box.className = "stat";
    box.innerHTML = `<small>${label}</small><strong>${value}</strong>`;
    elements.heroStats.appendChild(box);
  });
}

function renderFilters() {
  const cards = appState.board.cards;
  const stages = ["all", ...new Set(cards.map((card) => card.stage))];
  const priorities = ["all", ...new Set(cards.map((card) => card.priority))];

  elements.stageFilter.innerHTML = "";
  stages.forEach((stage) => {
    const option = document.createElement("option");
    option.value = stage;
    option.textContent = stage === "all" ? "Todas" : `Etapa ${stage}`;
    option.selected = appState.filters.stage === stage;
    elements.stageFilter.appendChild(option);
  });

  elements.priorityFilter.innerHTML = "";
  priorities.forEach((priority) => {
    const option = document.createElement("option");
    option.value = priority;
    option.textContent = priority === "all" ? "Todas" : priority;
    option.selected = appState.filters.priority === priority;
    elements.priorityFilter.appendChild(option);
  });
}

function renderKanban() {
  const cards = getFilteredCards();
  renderStats(cards);

  elements.kanban.innerHTML = "";

  appState.board.columns.forEach((column) => {
    const container = document.createElement("article");
    container.className = `column ${column.id}`;

    const cardsInColumn = cards.filter((card) => card.status === column.id);

    const title = document.createElement("h2");
    title.innerHTML = `${column.name} <span>${cardsInColumn.length}</span>`;
    container.appendChild(title);

    const list = document.createElement("ul");
    list.className = "card-list";

    cardsInColumn.forEach((card, index) => {
      const item = document.createElement("li");
      item.className = "card";
      item.style.animationDelay = `${index * 35}ms`;
      item.innerHTML = `
        <h3>${card.title}</h3>
        <p>${card.description}</p>
        <div class="meta">
          <span class="chip stage">E${card.stage}</span>
          <span class="chip priority ${card.priority}">${card.priority}</span>
          <span class="chip">${card.id}</span>
        </div>
      `;

      const statusSelect = createStatusSelector(card);
      item.appendChild(statusSelect);
      list.appendChild(item);
    });

    if (cardsInColumn.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Sin tarjetas con los filtros actuales";
      container.appendChild(empty);
    } else {
      container.appendChild(list);
    }

    elements.kanban.appendChild(container);
  });
}

function renderAll() {
  if (!appState.board) {
    return;
  }
  renderFilters();
  renderKanban();
}

function attachEvents() {
  elements.stageFilter.addEventListener("change", (event) => {
    appState.filters.stage = event.target.value;
    renderKanban();
  });

  elements.priorityFilter.addEventListener("change", (event) => {
    appState.filters.priority = event.target.value;
    renderKanban();
  });

  elements.searchFilter.addEventListener("input", (event) => {
    appState.filters.search = event.target.value;
    renderKanban();
  });

  elements.saveButton.addEventListener("click", async () => {
    try {
      await saveBoard();
    } catch (error) {
      console.error(error);
      elements.saveButton.textContent = "Error al guardar";
      setTimeout(() => {
        elements.saveButton.textContent = "Guardar cambios";
      }, 1400);
    }
  });
}

async function bootstrap() {
  attachEvents();
  appState.board = await fetchBoard();
  renderAll();
}

bootstrap().catch((error) => {
  console.error(error);
  elements.kanban.innerHTML = `<p class="empty">No se pudo cargar el tablero local.</p>`;
});
