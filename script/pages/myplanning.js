document.addEventListener('DOMContentLoaded', () => {
    const todoList = document.getElementById('todo-list');
    const newInput = document.getElementById('new-todo-input');
    const addBtn = document.getElementById('add-todo-btn');

    if (!todoList || !newInput || !addBtn) return;

    function createTodoItem(text) {
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="delete-btn" data-task="${text}">🗑</button>
            <span>${text}</span>
            <label class="switch">
                <input type="checkbox">
                <span class="slider"></span>
            </label>
        `;
        return li;
    }

    function addTodoFromInput() {
        const text = newInput.value.trim();
        if (!text) return;
        todoList.appendChild(createTodoItem(text));
        newInput.value = '';
    }

    addBtn.addEventListener('click', addTodoFromInput);

    todoList.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (!target.classList.contains('delete-btn')) return;

        const taskText = target.getAttribute('data-task') || '';
        const liToDelete = target.parentElement;
        if (!liToDelete) return;

        const popupTaskText = document.getElementById('popup-task-text');
        const deletePopup = document.getElementById('delete-popup');
        const popupYes = document.getElementById('popup-yes');
        const popupNo = document.getElementById('popup-no');

        if (!popupTaskText || !deletePopup || !popupYes || !popupNo) return;

        popupTaskText.textContent = `"${taskText}"?`;
        deletePopup.style.display = 'flex';

        popupYes.onclick = () => {
            liToDelete.remove();
            deletePopup.style.display = 'none';
        };

        popupNo.onclick = () => {
            deletePopup.style.display = 'none';
        };
    });

    function loadExampleTasks() {
        const examples = [
            'Build fence around garden',
            'Change oil in Tesla Model Y',
            'Inspect boat hull before summer'
        ];

        examples.forEach((text) => {
            todoList.appendChild(createTodoItem(text));
        });
    }

    loadExampleTasks();
});
