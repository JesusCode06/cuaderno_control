
"use strict";

/* =========================================================
   CUADERNOCONTROL v1.0.0
   Gestión de tareas, proyectos y bitácora personal
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEYS = {
        tasks: "cuadernoControl.tasks.v1",
        notes: "cuadernoControl.notes.v1"
    };

    const VALID_STATUSES = ["pending", "in-progress", "completed"];
    const VALID_PRIORITIES = ["low", "medium", "high"];

    const STATUS_LABELS = {
        pending: "Pendiente",
        "in-progress": "En proceso",
        completed: "Culminada"
    };

    const PRIORITY_LABELS = {
        low: "Baja",
        medium: "Media",
        high: "Alta"
    };

    const STAGE_LABELS = [
        "Preparación",
        "Diseño",
        "Desarrollo",
        "Pruebas",
        "Publicación",
        "Mantenimiento",
        "General"
    ];

    const MAX_TASKS = 1000;
    const MAX_NOTES = 1000;

    /* -----------------------------------------------------
       1. REFERENCIAS AL DOM
       ----------------------------------------------------- */

    const $ = (selector, root = document) =>
        root.querySelector(selector);

    const $$ = (selector, root = document) =>
        Array.from(root.querySelectorAll(selector));

    const elements = {
        sidebar: $("#sidebar"),
        menuToggle: $("#menu-toggle"),
        mainContent: $("#main-content"),
        navLinks: $$(".nav-link"),
        breadcrumb: $("#breadcrumb-current"),

        totalTasks: $("#total-tasks"),
        pendingTasks: $("#pending-tasks"),
        inProgressTasks: $("#in-progress-tasks"),
        completedTasks: $("#completed-tasks"),
        sidebarTaskCount: $("#sidebar-task-count"),

        overallProgressText: $("#overall-progress-text"),
        overallProgressTrack: $("#overall-progress-track"),
        overallProgressFill: $("#overall-progress-fill"),
        completedSummary: $("#completed-summary"),
        remainingSummary: $("#remaining-summary"),

        sidebarProgressFill: $("#sidebar-progress-fill"),
        sidebarProgressText: $("#sidebar-progress-text"),
        projectProgressFill: $("#project-progress-fill"),
        projectCompletion: $("#project-completion"),

        currentDate: $("#current-date"),

        taskSearch: $("#task-search"),
        taskFilter: $("#task-filter"),
        taskList: $("#task-list"),
        emptyState: $("#empty-state"),

        allTaskSearch: $("#all-task-search"),
        allTaskFilter: $("#all-task-filter"),
        allTaskList: $("#all-task-list"),
        allEmptyState: $("#all-empty-state"),

        addTaskButton: $("#add-task-button"),
        emptyAddTask: $("#empty-add-task"),

        taskModal: $("#task-modal"),
        taskModalTitle: $("#task-modal-title"),
        closeTaskModal: $("#close-task-modal"),
        cancelTask: $("#cancel-task"),
        taskForm: $("#task-form"),
        taskId: $("#task-id"),
        taskTitle: $("#task-title"),
        taskDescription: $("#task-description"),
        taskStatus: $("#task-status"),
        taskPriority: $("#task-priority"),
        taskStage: $("#task-stage"),
        taskDueDate: $("#task-due-date"),
        saveTaskButton: $("#save-task-button"),

        noteForm: $("#note-form"),
        noteTitle: $("#note-title"),
        noteContent: $("#note-content"),
        notesList: $("#notes-list"),
        notesEmptyState: $("#notes-empty-state"),

        toastContainer: $("#toast-container")
    };

    /* -----------------------------------------------------
       2. ESTADO DE LA APLICACIÓN
       ----------------------------------------------------- */

    let tasks = [];
    let notes = [];
    let currentView = "dashboard";
    let lastFocusedElement = null;
    let toastSequence = 0;
    let storageAvailable = true;

    /* -----------------------------------------------------
       3. UTILIDADES
       ----------------------------------------------------- */

    function createId() {
        if (typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function") {
            return crypto.randomUUID();
        }

        return (
            Date.now().toString(36) +
            Math.random().toString(36).slice(2)
        );
    }

    function normalizeText(value, maxLength) {
        if (typeof value !== "string") {
            return "";
        }

        return value.trim().slice(0, maxLength);
    }

    function isValidDate(value) {
        if (value === "") {
            return true;
        }

        if (typeof value !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year, month - 1, day);

        return (
            date.getFullYear() === year &&
            date.getMonth() === month - 1 &&
            date.getDate() === day
        );
    }

    function todayString() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, "0");
        const day = String(now.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    function formatDate(value) {
        if (!isValidDate(value) || !value) {
            return "";
        }

        const [year, month, day] = value.split("-").map(Number);

        return new Intl.DateTimeFormat("es-PE", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }).format(new Date(year, month - 1, day));
    }

    function formatDateTime(value) {
        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "Fecha desconocida";
        }

        return new Intl.DateTimeFormat("es-PE", {
            dateStyle: "medium",
            timeStyle: "short"
        }).format(date);
    }

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }

    function createButton(text, className, action, label) {
        const button = createElement("button", className, text);

        button.type = "button";
        button.dataset.action = action;

        if (label) {
            button.setAttribute("aria-label", label);
        }

        return button;
    }

    function showToast(message, type = "success") {
        const toast = createElement("div", `toast ${type}`);
        const text = createElement("div", "toast-message", message);

        const closeButton = createElement("button", "toast-close", "×");
        closeButton.type = "button";
        closeButton.setAttribute("aria-label", "Cerrar notificación");

        toast.append(text, closeButton);
        elements.toastContainer.append(toast);

        const timeoutId = window.setTimeout(removeToast, 4500);

        function removeToast() {
            window.clearTimeout(timeoutId);
            toast.remove();
        }

        closeButton.addEventListener("click", removeToast);
    }

    function loadCollection(key, validator) {
        try {
            const raw = localStorage.getItem(key);

            if (raw === null) {
                return [];
            }

            const parsed = JSON.parse(raw);

            if (!Array.isArray(parsed)) {
                return [];
            }

            const seenIds = new Set();

            return parsed
                .filter(record => {
                    if (!validator(record) || seenIds.has(record.id)) {
                        return false;
                    }

                    seenIds.add(record.id);
                    return true;
                })
                .slice(0, key === STORAGE_KEYS.tasks
                    ? MAX_TASKS
                    : MAX_NOTES);
        } catch (error) {
            storageAvailable = false;

            console.error("No se pudieron cargar los datos:", error);

            return [];
        }
    }

    function saveCollection(key, collection) {
        try {
            localStorage.setItem(key, JSON.stringify(collection));
            storageAvailable = true;
            updateStorageIndicator();
            return true;
        } catch (error) {
            storageAvailable = false;

            console.error("No se pudieron guardar los datos:", error);

            showToast(
                "No se pudo guardar. Revisa el almacenamiento disponible del navegador.",
                "error"
            );

            updateStorageIndicator();

            return false;
        }
    }

    function updateStorageIndicator() {
        const status = $(".local-status");

        if (!status) {
            return;
        }

        status.replaceChildren();

        const dot = createElement("span", "status-dot");

        if (storageAvailable) {
            status.append(
                dot,
                document.createTextNode(" Guardado local")
            );
        } else {
            dot.style.background = "var(--red)";

            status.append(
                dot,
                document.createTextNode(" Error de almacenamiento")
            );
        }
    }

    /* -----------------------------------------------------
       4. VALIDACIÓN Y NORMALIZACIÓN DE DATOS
       ----------------------------------------------------- */

    function isValidTaskRecord(record) {
        return Boolean(
            record &&
            typeof record === "object" &&
            !Array.isArray(record) &&
            typeof record.id === "string" &&
            record.id.trim().length > 0 &&
            record.id.length <= 100 &&
            typeof record.title === "string" &&
            record.title.trim().length > 0 &&
            record.title.length <= 120 &&
            typeof record.description === "string" &&
            record.description.length <= 2000 &&
            VALID_STATUSES.includes(record.status) &&
            VALID_PRIORITIES.includes(record.priority) &&
            typeof record.stage === "string" &&
            STAGE_LABELS.includes(record.stage) &&
            typeof record.dueDate === "string" &&
            isValidDate(record.dueDate) &&
            typeof record.createdAt === "string" &&
            record.createdAt.length <= 40 &&
            !Number.isNaN(Date.parse(record.createdAt)) &&
            typeof record.updatedAt === "string" &&
            record.updatedAt.length <= 40 &&
            !Number.isNaN(Date.parse(record.updatedAt))
        );
    }

    function isValidNoteRecord(record) {
        return Boolean(
            record &&
            typeof record === "object" &&
            !Array.isArray(record) &&
            typeof record.id === "string" &&
            record.id.trim().length > 0 &&
            record.id.length <= 100 &&
            typeof record.title === "string" &&
            record.title.trim().length > 0 &&
            record.title.length <= 100 &&
            typeof record.content === "string" &&
            record.content.trim().length > 0 &&
            record.content.length <= 5000 &&
            typeof record.createdAt === "string" &&
            record.createdAt.length <= 40 &&
            !Number.isNaN(Date.parse(record.createdAt))
        );
    }

    function validateTaskForm(data) {
        const title = normalizeText(data.title, 120);
        const description = normalizeText(data.description, 2000);
        const status = data.status;
        const priority = data.priority;
        const stage = data.stage;
        const dueDate = data.dueDate;

        if (!title) {
            return {
                valid: false,
                message: "El nombre de la tarea es obligatorio."
            };
        }

        if (!VALID_STATUSES.includes(status)) {
            return {
                valid: false,
                message: "Selecciona un estado válido."
            };
        }

        if (!VALID_PRIORITIES.includes(priority)) {
            return {
                valid: false,
                message: "Selecciona una prioridad válida."
            };
        }

        if (!STAGE_LABELS.includes(stage)) {
            return {
                valid: false,
                message: "Selecciona una etapa válida."
            };
        }

        if (!isValidDate(dueDate)) {
            return {
                valid: false,
                message: "La fecha límite no es válida."
            };
        }

        return {
            valid: true,
            value: {
                title,
                description,
                status,
                priority,
                stage,
                dueDate
            }
        };
    }

    /* -----------------------------------------------------
       5. CÁLCULOS DEL PANEL
       ----------------------------------------------------- */

    function getStatistics() {
        const total = tasks.length;

        const pending = tasks.filter(
            task => task.status === "pending"
        ).length;

        const inProgress = tasks.filter(
            task => task.status === "in-progress"
        ).length;

        const completed = tasks.filter(
            task => task.status === "completed"
        ).length;

        const percentage = total === 0
            ? 0
            : Math.round((completed / total) * 100);

        return {
            total,
            pending,
            inProgress,
            completed,
            percentage,
            remaining: total - completed
        };
    }

    function renderStatistics() {
        const stats = getStatistics();

        elements.totalTasks.textContent = stats.total;
        elements.pendingTasks.textContent = stats.pending;
        elements.inProgressTasks.textContent = stats.inProgress;
        elements.completedTasks.textContent = stats.completed;
        elements.sidebarTaskCount.textContent = stats.total;

        elements.overallProgressText.textContent =
            `${stats.percentage}%`;

        elements.overallProgressFill.style.width =
            `${stats.percentage}%`;

        elements.overallProgressTrack.setAttribute(
            "aria-valuenow",
            String(stats.percentage)
        );

        elements.completedSummary.textContent =
            `${stats.completed} de ${stats.total} tareas culminadas`;

        elements.remainingSummary.textContent =
            stats.remaining === 0
                ? stats.total === 0
                    ? "Sin tareas registradas"
                    : "Todas las tareas culminadas"
                : `${stats.remaining} por culminar`;

        elements.sidebarProgressFill.style.width =
            `${stats.percentage}%`;

        elements.sidebarProgressText.textContent =
            `${stats.percentage}%`;

        elements.projectProgressFill.style.width =
            `${stats.percentage}%`;

        elements.projectCompletion.textContent =
            `${stats.percentage}% completado`;
    }

    /* -----------------------------------------------------
       6. RENDERIZADO SEGURO DE TAREAS
       ----------------------------------------------------- */

    function createTaskCard(task) {
        const article = createElement(
            "article",
            `task-item${task.status === "completed" ? " is-completed" : ""}`
        );

        article.dataset.taskId = task.id;

        const checkbox = createElement("input", "task-checkbox");

        checkbox.type = "checkbox";
        checkbox.checked = task.status === "completed";
        checkbox.dataset.action = "toggle-completed";
        checkbox.dataset.id = task.id;
        checkbox.setAttribute(
            "aria-label",
            task.status === "completed"
                ? `Marcar ${task.title} como no culminada`
                : `Marcar ${task.title} como culminada`
        );

        const content = createElement("div", "task-item-content");
        const title = createElement("div", "task-item-title", task.title);

        content.append(title);

        if (task.description) {
            content.append(
                createElement(
                    "p",
                    "task-item-description",
                    task.description
                )
            );
        }

        const meta = createElement("div", "task-item-meta");

        const status = createElement(
            "span",
            `task-status ${task.status}`,
            STATUS_LABELS[task.status]
        );

        const priority = createElement(
            "span",
            `task-priority ${task.priority}`,
            `Prioridad ${PRIORITY_LABELS[task.priority].toLowerCase()}`
        );

        const stage = createElement(
            "span",
            "task-stage",
            task.stage
        );

        meta.append(status, priority, stage);

        if (task.dueDate) {
            const dueDate = createElement(
                "time",
                "task-due-date",
                `Límite: ${formatDate(task.dueDate)}`
            );

            dueDate.dateTime = task.dueDate;

            if (
                task.status !== "completed" &&
                task.dueDate < todayString()
            ) {
                dueDate.classList.add("overdue");
                dueDate.textContent += " · Vencida";
            }

            meta.append(dueDate);
        }

        content.append(meta);

        const actions = createElement("div", "task-item-actions");

        actions.append(
            createButton("Editar", "task-action", "edit", `Editar ${task.title}`),
            createButton("Eliminar", "task-action delete", "delete", `Eliminar ${task.title}`)
        );

        article.append(checkbox, content, actions);

        return article;
    }

    function getFilteredTasks(searchValue, statusValue) {
        const query = normalizeText(searchValue, 200).toLocaleLowerCase("es");

        return tasks
            .filter(task => {
                const searchable = [
                    task.title,
                    task.description,
                    task.stage
                ].join(" ").toLocaleLowerCase("es");

                const matchesSearch = searchable.includes(query);
                const matchesStatus =
                    statusValue === "all" ||
                    task.status === statusValue;

                return matchesSearch && matchesStatus;
            })
            .sort((a, b) => {
                const priorityRank = {
                    high: 0,
                    medium: 1,
                    low: 2
                };

                if (
                    a.status === "completed" &&
                    b.status !== "completed"
                ) {
                    return 1;
                }

                if (
                    b.status === "completed" &&
                    a.status !== "completed"
                ) {
                    return -1;
                }

                const priorityDifference =
                    priorityRank[a.priority] - priorityRank[b.priority];

                if (priorityDifference !== 0) {
                    return priorityDifference;
                }

                return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
            });
    }

    function renderTaskList(container, emptyState, filteredTasks) {
        container.replaceChildren();

        const fragment = document.createDocumentFragment();

        filteredTasks.forEach(task => {
            fragment.append(createTaskCard(task));
        });

        container.append(fragment);

        emptyState.hidden = filteredTasks.length > 0;
    }

    function renderTasks() {
        const dashboardTasks = getFilteredTasks(
            elements.taskSearch.value,
            elements.taskFilter.value
        );

        const allTasks = getFilteredTasks(
            elements.allTaskSearch.value,
            elements.allTaskFilter.value
        );

        renderTaskList(
            elements.taskList,
            elements.emptyState,
            dashboardTasks.slice(0, 5)
        );

        renderTaskList(
            elements.allTaskList,
            elements.allEmptyState,
            allTasks
        );

        renderStatistics();
        updateStorageIndicator();
    }

    /* -----------------------------------------------------
       7. CREAR, EDITAR Y ELIMINAR TAREAS
       ----------------------------------------------------- */

    function openTaskModal(task = null) {
        lastFocusedElement = document.activeElement;

        elements.taskForm.reset();
        elements.taskId.value = "";

        if (task) {
            elements.taskModalTitle.textContent = "Editar tarea";
            elements.saveTaskButton.textContent = "Guardar cambios";

            elements.taskId.value = task.id;
            elements.taskTitle.value = task.title;
            elements.taskDescription.value = task.description;
            elements.taskStatus.value = task.status;
            elements.taskPriority.value = task.priority;
            elements.taskStage.value = task.stage;
            elements.taskDueDate.value = task.dueDate;
        } else {
            elements.taskModalTitle.textContent = "Nueva tarea";
            elements.saveTaskButton.textContent = "Guardar tarea";

            elements.taskStatus.value = "pending";
            elements.taskPriority.value = "medium";
            elements.taskStage.value = "Preparación";
        }

        elements.taskModal.hidden = false;
        document.body.style.overflow = "hidden";

        window.requestAnimationFrame(() => {
            elements.taskTitle.focus();
        });
    }

    function closeTaskModal() {
        if (elements.taskModal.hidden) {
            return;
        }

        elements.taskModal.hidden = true;
        document.body.style.overflow = "";

        if (lastFocusedElement &&
            typeof lastFocusedElement.focus === "function" &&
            document.contains(lastFocusedElement)) {
            lastFocusedElement.focus();
        }
    }

    function handleTaskSubmit(event) {
        event.preventDefault();

        const validation = validateTaskForm({
            title: elements.taskTitle.value,
            description: elements.taskDescription.value,
            status: elements.taskStatus.value,
            priority: elements.taskPriority.value,
            stage: elements.taskStage.value,
            dueDate: elements.taskDueDate.value
        });

        if (!validation.valid) {
            showToast(validation.message, "error");
            return;
        }

        const existingId = elements.taskId.value;
        const now = new Date().toISOString();

        if (existingId) {
            const index = tasks.findIndex(task => task.id === existingId);

            if (index === -1) {
                showToast("No se encontró la tarea que intentas editar.", "error");
                closeTaskModal();
                return;
            }

            const updatedTask = {
                ...tasks[index],
                ...validation.value,
                updatedAt: now
            };

            const previous = tasks[index];
            tasks[index] = updatedTask;

            if (!saveCollection(STORAGE_KEYS.tasks, tasks)) {
                tasks[index] = previous;
                return;
            }

            closeTaskModal();
            renderTasks();
            showToast("Tarea actualizada correctamente.");
        } else {
            if (tasks.length >= MAX_TASKS) {
                showToast(
                    `Has alcanzado el límite de ${MAX_TASKS} tareas.`,
                    "error"
                );
                return;
            }

            const task = {
                id: createId(),
                ...validation.value,
                createdAt: now,
                updatedAt: now
            };

            tasks.unshift(task);

            if (!saveCollection(STORAGE_KEYS.tasks, tasks)) {
                tasks.shift();
                return;
            }

            closeTaskModal();
            renderTasks();
            showToast("Tarea creada correctamente.");
        }
    }

    function changeTaskStatus(taskId, status) {
        if (!VALID_STATUSES.includes(status)) {
            return;
        }

        const index = tasks.findIndex(task => task.id === taskId);

        if (index === -1) {
            showToast("La tarea ya no existe.", "error");
            renderTasks();
            return;
        }

        const previous = tasks[index];

        tasks[index] = {
            ...previous,
            status,
            updatedAt: new Date().toISOString()
        };

        if (!saveCollection(STORAGE_KEYS.tasks, tasks)) {
            tasks[index] = previous;
            renderTasks();
            return;
        }

        renderTasks();

        showToast(
            status === "completed"
                ? "Tarea marcada como culminada."
                : `Estado actualizado: ${STATUS_LABELS[status]}.`
        );
    }

    function deleteTask(taskId) {
        const task = tasks.find(item => item.id === taskId);

        if (!task) {
            showToast("No se encontró la tarea.", "error");
            renderTasks();
            return;
        }

        const confirmed = window.confirm(
            `¿Seguro que deseas eliminar la tarea "${task.title}"?\n\nEsta acción no se puede deshacer.`
        );

        if (!confirmed) {
            return;
        }

        const previousTasks = tasks;
        tasks = tasks.filter(item => item.id !== taskId);

        if (!saveCollection(STORAGE_KEYS.tasks, tasks)) {
            tasks = previousTasks;
            renderTasks();
            return;
        }

        renderTasks();
        showToast("Tarea eliminada.");
    }

    /* -----------------------------------------------------
       8. NAVEGACIÓN ENTRE VISTAS
       ----------------------------------------------------- */

    const VIEW_LABELS = {
        dashboard: "Panel general",
        tasks: "Todas las tareas",
        projects: "Proyectos",
        notes: "Bitácora"
    };

    function normalizeView(value) {
        return Object.hasOwn(VIEW_LABELS, value)
            ? value
            : "dashboard";
    }

    function navigateTo(view, updateHash = true) {
        currentView = normalizeView(view);

        $$("[data-view-panel]").forEach(panel => {
            panel.classList.toggle(
                "active",
                panel.dataset.viewPanel === currentView
            );
        });

        elements.navLinks.forEach(link => {
            const active = link.dataset.view === currentView;

            link.classList.toggle("active", active);

            if (active) {
                link.setAttribute("aria-current", "page");
            } else {
                link.removeAttribute("aria-current");
            }
        });

        elements.breadcrumb.textContent = VIEW_LABELS[currentView];

        if (updateHash &&
            window.location.hash !== `#${currentView}`) {
            window.history.replaceState(
                null,
                "",
                `#${currentView}`
            );
        }

        closeSidebar();

        if (currentView === "dashboard") {
            elements.taskSearch.focus({ preventScroll: true });
        }
    }

    function closeSidebar() {
        elements.sidebar.classList.remove("is-open");
        elements.menuToggle.setAttribute("aria-expanded", "false");
        elements.menuToggle.setAttribute("aria-label", "Abrir menú");
    }

    function toggleSidebar() {
        const isOpen = elements.sidebar.classList.toggle("is-open");

        elements.menuToggle.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

        elements.menuToggle.setAttribute(
            "aria-label",
            isOpen ? "Cerrar menú" : "Abrir menú"
        );
    }

    /* -----------------------------------------------------
       9. BITÁCORA
       ----------------------------------------------------- */

    function renderNotes() {
        elements.notesList.replaceChildren();

        const fragment = document.createDocumentFragment();

        notes
            .slice()
            .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
            .forEach(note => {
                const article = createElement("article", "note-card");

                const heading = createElement("h3", "", note.title);
                const content = createElement("p", "", note.content);
                const date = createElement(
                    "time",
                    "",
                    formatDateTime(note.createdAt)
                );

                date.dateTime = note.createdAt;

                const deleteButton = createButton(
                    "Eliminar nota",
                    "task-action delete",
                    "delete-note",
                    `Eliminar nota: ${note.title}`
                );

                deleteButton.style.marginTop = "12px";

                article.append(heading, content, date, deleteButton);
                article.dataset.noteId = note.id;

                fragment.append(article);
            });

        elements.notesList.append(fragment);
        elements.notesEmptyState.hidden = notes.length > 0;
    }

    function handleNoteSubmit(event) {
        event.preventDefault();

        const title = normalizeText(elements.noteTitle.value, 100);
        const content = normalizeText(elements.noteContent.value, 5000);

        if (!title || !content) {
            showToast("Completa el título y la descripción de la nota.", "error");
            return;
        }

        if (notes.length >= MAX_NOTES) {
            showToast(
                `Has alcanzado el límite de ${MAX_NOTES} notas.`,
                "error"
            );
            return;
        }

        const note = {
            id: createId(),
            title,
            content,
            createdAt: new Date().toISOString()
        };

        notes.unshift(note);

        if (!saveCollection(STORAGE_KEYS.notes, notes)) {
            notes.shift();
            return;
        }

        elements.noteForm.reset();
        renderNotes();
        showToast("Nota guardada correctamente.");
    }

    function deleteNote(noteId) {
        const note = notes.find(item => item.id === noteId);

        if (!note) {
            return;
        }

        if (!window.confirm(`¿Eliminar la nota "${note.title}"?`)) {
            return;
        }

        const previousNotes = notes;
        notes = notes.filter(item => item.id !== noteId);

        if (!saveCollection(STORAGE_KEYS.notes, notes)) {
            notes = previousNotes;
            renderNotes();
            return;
        }

        renderNotes();
        showToast("Nota eliminada.");
    }

    /* -----------------------------------------------------
       10. EVENTOS
       ----------------------------------------------------- */

    elements.addTaskButton.addEventListener("click", () => {
        openTaskModal();
    });

    elements.emptyAddTask.addEventListener("click", () => {
        openTaskModal();
    });

    $$("[data-open-task]").forEach(button => {
        button.addEventListener("click", () => {
            openTaskModal();
        });
    });

    elements.closeTaskModal.addEventListener("click", closeTaskModal);
    elements.cancelTask.addEventListener("click", closeTaskModal);

    elements.taskModal.addEventListener("click", event => {
        if (event.target === elements.taskModal) {
            closeTaskModal();
        }
    });

    elements.taskForm.addEventListener("submit", handleTaskSubmit);

    elements.taskSearch.addEventListener("input", renderTasks);
    elements.taskFilter.addEventListener("change", renderTasks);

    elements.allTaskSearch.addEventListener("input", renderTasks);
    elements.allTaskFilter.addEventListener("change", renderTasks);

    elements.menuToggle.addEventListener("click", toggleSidebar);

    elements.navLinks.forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();
            navigateTo(link.dataset.view);
        });
    });

    $$("[data-view]").forEach(link => {
        if (link.classList.contains("nav-link")) {
            return;
        }

        link.addEventListener("click", event => {
            event.preventDefault();
            navigateTo(link.dataset.view);
        });
    });

    window.addEventListener("hashchange", () => {
        navigateTo(window.location.hash.slice(1), false);
    });

    document.addEventListener("click", event => {
        const actionElement = event.target.closest("[data-action]");

        if (!actionElement) {
            return;
        }

        const action = actionElement.dataset.action;
        const taskId = actionElement.dataset.id ||
            actionElement.closest("[data-task-id]")?.dataset.taskId;

        if (action === "edit") {
            const task = tasks.find(item => item.id === taskId);

            if (task) {
                openTaskModal(task);
            }
        }

        if (action === "delete") {
            deleteTask(taskId);
        }

        if (action === "toggle-completed") {
            const task = tasks.find(item => item.id === taskId);

            if (task) {
                changeTaskStatus(
                    taskId,
                    task.status === "completed"
                        ? "pending"
                        : "completed"
                );
            }
        }

        if (action === "delete-note") {
            const noteId = actionElement.closest("[data-note-id]")?.dataset.noteId;

            if (noteId) {
                deleteNote(noteId);
            }
        }
    });

    elements.noteForm.addEventListener("submit", handleNoteSubmit);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (!elements.taskModal.hidden) {
                closeTaskModal();
            } else {
                closeSidebar();
            }
        }

        /* Mantener el foco dentro del modal mientras esté abierto. */
        if (
            event.key === "Tab" &&
            !elements.taskModal.hidden
        ) {
            const focusable = $$(
                'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
                elements.taskModal
            ).filter(element => element.getClientRects().length > 0);

            if (focusable.length === 0) {
                event.preventDefault();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];

            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                document.activeElement === last
            ) {
                event.preventDefault();
                first.focus();
            }
        }
    });

    document.addEventListener("click", event => {
        if (
            window.innerWidth <= 760 &&
            elements.sidebar.classList.contains("is-open") &&
            !elements.sidebar.contains(event.target) &&
            !elements.menuToggle.contains(event.target)
        ) {
            closeSidebar();
        }
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 760) {
            closeSidebar();
        }
    });

    /* -----------------------------------------------------
       11. INICIALIZACIÓN
       ----------------------------------------------------- */

    function renderCurrentDate() {
        elements.currentDate.textContent =
            new Intl.DateTimeFormat("es-PE", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric"
            }).format(new Date());
    }

    function initialize() {
        tasks = loadCollection(
            STORAGE_KEYS.tasks,
            isValidTaskRecord
        );

        notes = loadCollection(
            STORAGE_KEYS.notes,
            isValidNoteRecord
        );

        renderCurrentDate();
        renderTasks();
        renderNotes();

        const initialView = window.location.hash.slice(1);

        navigateTo(initialView || "dashboard", false);

        updateStorageIndicator();

        console.info("CuadernoControl iniciado correctamente.");
        console.info(`Tareas cargadas: ${tasks.length}`);
        console.info(`Notas cargadas: ${notes.length}`);

        if (!storageAvailable) {
            showToast(
                "Algunos datos no pudieron cargarse. Revisa la consola del navegador.",
                "error"
            );
        }
    }

    initialize();
});
