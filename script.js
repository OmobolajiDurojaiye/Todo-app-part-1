"use strict";

document.addEventListener("DOMContentLoaded", () => {
  // DOM Elements
  const taskInput = document.getElementById("taskInput");
  const taskDate = document.getElementById("taskDate");
  const taskPriority = document.getElementById("taskPriority");
  const addTaskButton = document.getElementById("addTaskButton");
  const taskList = document.getElementById("taskList");
  const emptyState = document.getElementById("emptyState");
  const searchInput = document.getElementById("searchInput");
  const filterOptions = document.querySelectorAll("nav ul li");
  const totalTasksCounter = document.getElementById("totalTasks");
  const completedTasksCounter = document.getElementById("completedTasks");
  const currentFilterText = document.getElementById("currentFilter");
  const themeToggle = document.getElementById("themeToggle");
  const installButton = document.getElementById("installButton");
  const modal = document.getElementById("taskModal");
  const closeModal = document.querySelector(".close-modal");
  const modalTaskTitle = document.getElementById("modalTaskTitle");
  const modalTaskDate = document.getElementById("modalTaskDate");
  const modalTaskPriority = document.getElementById("modalTaskPriority");
  const modalTaskNotes = document.getElementById("modalTaskNotes");
  const saveTaskBtn = document.getElementById("saveTaskBtn");
  const deleteTaskBtn = document.getElementById("deleteTaskBtn");
  const toast = document.getElementById("toast");

  // App State
  let tasks = [];
  let currentFilter = "all";
  let editingTaskId = null;
  let deferredPrompt = null;

  // Set today's date as default and store for reference
  const today = new Date().toISOString().split("T")[0];
  taskDate.value = today;

  // Initially hide the install button
  installButton.style.display = "none";

  // Check if the app is already installed
  function isAppInstalled() {
    // Check if the app is in standalone mode or display-mode is standalone
    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone ||
      document.referrer.includes("android-app://")
    ) {
      return true;
    }
    return false;
  }

  // PWA Installation Handling
  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent Chrome 67 and earlier from automatically showing the prompt
    e.preventDefault();

    // Don't show install button if already installed
    if (isAppInstalled()) {
      return;
    }

    // Stash the event so it can be triggered later
    deferredPrompt = e;

    // Show the install button
    installButton.style.display = "flex";
  });

  // Check if app was installed via the browser control rather than our button
  window.addEventListener("appinstalled", () => {
    // Hide the install button
    installButton.style.display = "none";

    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;

    // Show success message
    showToast("App installed successfully!", "success");
  });

  // Install button click handler
  installButton.addEventListener("click", async () => {
    if (isAppInstalled()) {
      showToast("App is already installed", "info");
      installButton.style.display = "none";
      return;
    }

    if (!deferredPrompt) {
      showToast("Installation not available right now", "warning");
      return;
    }

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      showToast("App installation successful!", "success");
    } else {
      showToast("App installation cancelled", "warning");
    }

    // We no longer need the prompt
    deferredPrompt = null;
    installButton.style.display = "none";
  });

  // Load tasks from localStorage
  const loadTasks = () => {
    const savedTasks = localStorage.getItem("tasks");
    if (savedTasks) {
      tasks = JSON.parse(savedTasks);
      updateTasksUI();
      updateCounters();
    }
  };

  // Event Listeners
  addTaskButton.addEventListener("click", addTask);

  taskInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      addTask();
    }
  });

  searchInput.addEventListener("input", updateTasksUI);

  filterOptions.forEach((option) => {
    option.addEventListener("click", () => {
      // Update active filter
      filterOptions.forEach((opt) => opt.classList.remove("active"));
      option.classList.add("active");

      // Update current filter
      currentFilter = option.getAttribute("data-filter");
      currentFilterText.textContent = option.textContent.trim();

      // Update UI
      updateTasksUI();
    });
  });

  themeToggle.addEventListener("click", toggleTheme);

  // Modal event listeners
  closeModal.addEventListener("click", closeEditModal);

  window.addEventListener("click", (e) => {
    if (e.target === modal) {
      closeEditModal();
    }
  });

  saveTaskBtn.addEventListener("click", saveEditedTask);

  deleteTaskBtn.addEventListener("click", () => {
    if (editingTaskId) {
      deleteTask(editingTaskId);
      closeEditModal();
    }
  });

  // Drag and Drop Functionality
  let draggedItem = null;

  taskList.addEventListener("dragstart", (e) => {
    if (e.target.classList.contains("task-item")) {
      draggedItem = e.target;
      setTimeout(() => {
        e.target.style.opacity = "0.5";
      }, 0);
    }
  });

  taskList.addEventListener("dragend", (e) => {
    if (e.target.classList.contains("task-item")) {
      e.target.style.opacity = "";
    }
  });

  taskList.addEventListener("dragover", (e) => {
    e.preventDefault();
    if (e.target.classList.contains("task-item") && draggedItem !== e.target) {
      const boundingRect = e.target.getBoundingClientRect();
      const offset = boundingRect.y + boundingRect.height / 2;

      if (e.clientY - offset > 0) {
        e.target.style.borderBottom = "2px solid var(--accent-color)";
        e.target.style.borderTop = "";
      } else {
        e.target.style.borderTop = "2px solid var(--accent-color)";
        e.target.style.borderBottom = "";
      }
    }
  });

  taskList.addEventListener("dragleave", (e) => {
    if (e.target.classList.contains("task-item")) {
      e.target.style.borderTop = "";
      e.target.style.borderBottom = "";
    }
  });

  taskList.addEventListener("drop", (e) => {
    e.preventDefault();
    if (e.target.classList.contains("task-item") && draggedItem !== e.target) {
      e.target.style.borderTop = "";
      e.target.style.borderBottom = "";

      const draggedTaskId = draggedItem.getAttribute("data-id");
      const targetTaskId = e.target.getAttribute("data-id");

      // Rearrange tasks in the array
      const draggedTaskIndex = tasks.findIndex(
        (task) => task.id === draggedTaskId
      );
      const targetTaskIndex = tasks.findIndex(
        (task) => task.id === targetTaskId
      );

      if (draggedTaskIndex !== -1 && targetTaskIndex !== -1) {
        const draggedTask = tasks[draggedTaskIndex];

        // Remove the dragged task
        tasks.splice(draggedTaskIndex, 1);

        // Determine insert position
        const boundingRect = e.target.getBoundingClientRect();
        const offset = boundingRect.y + boundingRect.height / 2;
        const insertIndex =
          e.clientY - offset > 0
            ? targetTaskIndex
            : targetTaskIndex - (draggedTaskIndex < targetTaskIndex ? 0 : 1);

        // Insert the dragged task at the new position
        tasks.splice(insertIndex, 0, draggedTask);

        // Update UI and save
        saveTasks();
        updateTasksUI();
      }
    }
  });

  // Keyboard Shortcuts
  document.addEventListener("keydown", (e) => {
    // Alt+N for new task
    if (e.altKey && e.key === "n") {
      e.preventDefault();
      taskInput.focus();
    }

    // Alt+S for search
    if (e.altKey && e.key === "s") {
      e.preventDefault();
      searchInput.focus();
    }

    // Escape to close modal
    if (e.key === "Escape" && modal.style.display === "flex") {
      closeEditModal();
    }
  });

  // Open task edit modal
  const openEditModal = (task) => {
    editingTaskId = task.id;

    modalTaskTitle.value = task.title;
    modalTaskDate.value = task.date;
    modalTaskPriority.value = task.priority;
    modalTaskNotes.value = task.notes || "";

    modal.style.display = "flex";
  };

  // Close task edit modal
  const closeEditModal = () => {
    modal.style.display = "none";
    editingTaskId = null;
  };

  // Save edited task
  const saveEditedTask = () => {
    if (!editingTaskId) return;

    const title = modalTaskTitle.value.trim();
    if (!title) {
      showToast("Task title cannot be empty", "warning");
      return;
    }

    const updates = {
      title: title,
      date: modalTaskDate.value,
      priority: modalTaskPriority.value,
      notes: modalTaskNotes.value.trim(),
    };

    updateTask(editingTaskId, updates);
    closeEditModal();
  };

  // Show toast notification
  const showToast = (message, type = "info") => {
    // Clear any existing timeout
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }

    // Set content based on type
    let icon = "fa-info-circle";
    if (type === "success") icon = "fa-check-circle";
    if (type === "warning") icon = "fa-exclamation-circle";
    if (type === "error") icon = "fa-times-circle";

    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icon}"></i> ${message}`;

    // Show the toast
    toast.classList.add("show");

    // Hide after 3 seconds
    toast.timeoutId = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  };

  // Toggle dark/light theme
  const toggleTheme = () => {
    const body = document.body;
    const isDarkTheme = body.classList.toggle("dark-theme");

    // Update theme icon
    themeToggle.innerHTML = isDarkTheme
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';

    // Save theme preference
    localStorage.setItem("darkTheme", isDarkTheme);

    showToast(`${isDarkTheme ? "Dark" : "Light"} theme activated`, "success");
  };

  // Load saved theme preference
  const loadThemePreference = () => {
    const darkTheme = localStorage.getItem("darkTheme") === "true";
    if (darkTheme) {
      document.body.classList.add("dark-theme");
      themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }
  };

  // Save tasks to localStorage
  const saveTasks = () => {
    localStorage.setItem("tasks", JSON.stringify(tasks));
    updateCounters();
  };

  // Add task to the list
  const addTask = () => {
    const taskText = taskInput.value.trim();
    if (!taskText) {
      showToast("Please enter a task", "warning");
      return;
    }

    const newTask = {
      id: Date.now().toString(),
      title: taskText,
      completed: false,
      date: taskDate.value,
      priority: taskPriority.value,
      notes: "",
      createdAt: new Date().toISOString(),
    };

    tasks.push(newTask);
    saveTasks();
    updateTasksUI();

    // Reset input fields
    taskInput.value = "";
    taskDate.value = today;
    taskPriority.value = "medium";

    showToast("Task added successfully!", "success");
  };

  // Update task in the list
  const updateTask = (taskId, updates) => {
    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, ...updates };
      }
      return task;
    });

    saveTasks();
    updateTasksUI();

    showToast("Task updated successfully!", "success");
  };

  // Delete task from the list
  const deleteTask = (taskId) => {
    tasks = tasks.filter((task) => task.id !== taskId);
    saveTasks();
    updateTasksUI();

    showToast("Task deleted successfully!", "success");
  };

  // Toggle task completion status
  const toggleTaskCompletion = (taskId) => {
    tasks = tasks.map((task) => {
      if (task.id === taskId) {
        return { ...task, completed: !task.completed };
      }
      return task;
    });

    saveTasks();
    updateTasksUI();
  };

  // Filter tasks based on current filter and search query
  const filterTasks = () => {
    const searchQuery = searchInput.value.toLowerCase();
    const filteredTasks = tasks.filter((task) => {
      const matchesSearch = task.title.toLowerCase().includes(searchQuery);

      switch (currentFilter) {
        case "today":
          return matchesSearch && task.date === today;
        case "upcoming":
          return matchesSearch && task.date > today;
        case "completed":
          return matchesSearch && task.completed;
        default:
          return matchesSearch;
      }
    });

    return filteredTasks;
  };

  // Update task list UI
  const updateTasksUI = () => {
    const filteredTasks = filterTasks();

    // Clear the task list
    taskList.innerHTML = "";

    if (filteredTasks.length === 0) {
      emptyState.style.display = "flex";
    } else {
      emptyState.style.display = "none";

      // Sort tasks by date and priority
      filteredTasks
        .sort((a, b) => {
          // First sort by completed status
          if (a.completed !== b.completed) {
            return a.completed ? 1 : -1;
          }

          // Then sort by date
          if (a.date !== b.date) {
            return a.date > b.date ? 1 : -1;
          }

          // Then sort by priority
          const priorityOrder = { high: 0, medium: 1, low: 2 };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        })
        .forEach((task) => {
          // Create task item
          const li = document.createElement("li");
          li.className = `task-item priority-${task.priority} ${
            task.completed ? "completed" : ""
          }`;
          li.setAttribute("data-id", task.id);
          li.setAttribute("draggable", "true");

          // Create task checkbox
          const checkbox = document.createElement("div");
          checkbox.className = `task-checkbox ${
            task.completed ? "checked" : ""
          }`;
          checkbox.addEventListener("click", () => {
            toggleTaskCompletion(task.id);
          });

          if (task.completed) {
            const checkIcon = document.createElement("i");
            checkIcon.className = "fas fa-check";
            checkbox.appendChild(checkIcon);
          }

          // Create task content
          const taskContent = document.createElement("div");
          taskContent.className = "task-content";

          const taskTitle = document.createElement("div");
          taskTitle.className = "task-title";
          taskTitle.textContent = task.title;

          if (task.priority === "high") {
            const priorityBadge = document.createElement("span");
            priorityBadge.className = "priority-badge";
            priorityBadge.textContent = "!";
            priorityBadge.style.color = "var(--high-priority)";
            taskTitle.appendChild(priorityBadge);
          }

          const taskDetails = document.createElement("div");
          taskDetails.className = "task-details";

          const dateSpan = document.createElement("span");
          dateSpan.innerHTML = `<i class="fas fa-calendar"></i> ${formatDate(
            task.date
          )}`;

          taskDetails.appendChild(dateSpan);

          if (task.notes) {
            const notesIndicator = document.createElement("span");
            notesIndicator.innerHTML = `<i class="fas fa-sticky-note"></i>`;
            taskDetails.appendChild(notesIndicator);
          }

          taskContent.appendChild(taskTitle);
          taskContent.appendChild(taskDetails);

          // Create task actions
          const taskActions = document.createElement("div");
          taskActions.className = "task-actions";

          const editButton = document.createElement("button");
          editButton.className = "task-action-btn";
          editButton.innerHTML = '<i class="fas fa-edit"></i>';
          editButton.addEventListener("click", () => {
            openEditModal(task);
          });

          taskActions.appendChild(editButton);

          // Append all elements to the task item
          li.appendChild(checkbox);
          li.appendChild(taskContent);
          li.appendChild(taskActions);

          taskList.appendChild(li);
        });
    }
  };

  // Update task counters
  const updateCounters = () => {
    totalTasksCounter.textContent = tasks.length;
    completedTasksCounter.textContent = tasks.filter(
      (task) => task.completed
    ).length;
  };

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "No date";

    const taskDate = new Date(dateString);
    const currentDate = new Date();

    // Reset time part for accurate date comparison
    currentDate.setHours(0, 0, 0, 0);
    const taskDateNoTime = new Date(taskDate);
    taskDateNoTime.setHours(0, 0, 0, 0);

    // Calculate difference in days
    const diffTime = taskDateNoTime - currentDate;
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Tomorrow";
    } else if (diffDays === -1) {
      return "Yesterday";
    } else if (diffDays < 0) {
      return `${Math.abs(diffDays)} days ago`;
    } else if (diffDays < 7) {
      return `In ${diffDays} days`;
    } else {
      const options = { month: "short", day: "numeric" };
      if (taskDate.getFullYear() !== currentDate.getFullYear()) {
        options.year = "numeric";
      }
      return taskDate.toLocaleDateString(undefined, options);
    }
  };

  // Init
  loadTasks();
  loadThemePreference();
  updateTasksUI();

  // Set focus on task input
  taskInput.focus();
});
