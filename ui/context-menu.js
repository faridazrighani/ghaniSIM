function getContextMenu() {
    let menu = document.getElementById('canvasContextMenu');
    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'canvasContextMenu';
        menu.className = 'context-menu';
        menu.setAttribute('role', 'menu');
        menu.setAttribute('aria-hidden', 'true');
        menu.setAttribute('aria-label', 'Canvas context menu');
        menu.tabIndex = -1;
        document.body.appendChild(menu);
    }
    if (menu.dataset.keyboardInitialized !== 'true') {
        menu.addEventListener('keydown', handleContextMenuKeydown);
        menu.dataset.keyboardInitialized = 'true';
    }
    return menu;
}

function hideContextMenu() {
    const menu = document.getElementById('canvasContextMenu');
    if (menu) {
        menu.style.display = 'none';
        menu.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('context-menu-open');
}

function getContextMenuButtons(menu) {
    return Array.from(menu?.querySelectorAll('button[role="menuitem"]') || []);
}

function focusContextMenuButton(menu, nextIndex) {
    const buttons = getContextMenuButtons(menu);
    if (!buttons.length) return;
    const normalizedIndex = (nextIndex + buttons.length) % buttons.length;
    buttons[normalizedIndex].focus();
}

function handleContextMenuKeydown(e) {
    const menu = e.currentTarget;
    const buttons = getContextMenuButtons(menu);
    if (!buttons.length) return;

    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement));

    if (e.key === 'Escape') {
        e.preventDefault();
        hideContextMenu();
        return;
    }

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        focusContextMenuButton(menu, currentIndex + 1);
        return;
    }

    if (e.key === 'ArrowUp') {
        e.preventDefault();
        focusContextMenuButton(menu, currentIndex - 1);
        return;
    }

    if (e.key === 'Home') {
        e.preventDefault();
        focusContextMenuButton(menu, 0);
        return;
    }

    if (e.key === 'End') {
        e.preventDefault();
        focusContextMenuButton(menu, buttons.length - 1);
        return;
    }

    if ((e.key === 'Enter' || e.key === ' ') && document.activeElement?.matches?.('button[role="menuitem"]')) {
        e.preventDefault();
        document.activeElement.click();
    }
}

function showContextMenu(x, y, items) {
    const menu = getContextMenu();
    menu.innerHTML = '';

    items.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('role', 'menuitem');
        btn.tabIndex = -1;
        btn.className = [
            item.danger ? 'danger' : '',
            item.active ? 'active' : ''
        ].filter(Boolean).join(' ');
        if (item.active) btn.setAttribute('aria-current', 'true');
        if (item.description) {
            btn.innerHTML = `
                <span class="context-menu-label"></span>
                <span class="context-menu-description"></span>
            `;
            btn.querySelector('.context-menu-label').textContent = item.label;
            btn.querySelector('.context-menu-description').textContent = item.description;
            btn.title = `${item.label}: ${item.description}`;
        } else {
            btn.textContent = item.label;
        }
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            hideContextMenu();
            item.action();
        });
        menu.appendChild(btn);
    });

    menu.style.display = 'block';
    menu.setAttribute('aria-hidden', 'false');
    document.body.classList.add('context-menu-open');
    const rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)) + 'px';
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) + 'px';
    focusContextMenuButton(menu, 0);
}
