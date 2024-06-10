"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const taskInput = document.getElementById("taskInput");
  const addTaskButton = document.getElementById("addTaskButton");
  const taskList = document.getElementById("taskList");
  const warningText = document.querySelector(".warning");

  addTaskButton.addEventListener("click", () => {
    const taskText = taskInput.value.trim();
    if (!taskText) {
      warningText.textContent = "Please enter a task todo!";
      warningText.style.color = "red";
    } else {
      addTaskToDOM(taskText);
      taskInput.value = "";
      warningText.textContent = "";
      warningText.style.color = "";
    }
  });

  function addTaskToDOM(taskText) {
    const li = document.createElement("li");
    li.textContent = taskText;

    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
      li.remove();
    });

    li.appendChild(deleteButton);
    taskList.appendChild(li);
  }
});
