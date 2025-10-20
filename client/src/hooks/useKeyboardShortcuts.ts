/**
 * Keyboard Shortcuts Hook
 * 
 * Global keyboard shortcuts for power users
 */

import { useEffect } from "react";
import { useLocation } from "wouter";

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: () => void;
  description: string;
}

const shortcuts: ShortcutConfig[] = [
  {
    key: "n",
    ctrl: true,
    description: "New Quote",
    action: () => {
      window.location.href = "/quotes/new";
    },
  },
  {
    key: "i",
    ctrl: true,
    description: "New Invoice",
    action: () => {
      window.location.href = "/invoices/new";
    },
  },
  {
    key: "c",
    ctrl: true,
    shift: true,
    description: "New Customer",
    action: () => {
      window.location.href = "/customers/new";
    },
  },
  {
    key: "d",
    ctrl: true,
    description: "Go to Dashboard",
    action: () => {
      window.location.href = "/";
    },
  },
  {
    key: "q",
    ctrl: true,
    description: "Go to Quotes",
    action: () => {
      window.location.href = "/quotes";
    },
  },
  {
    key: "f",
    ctrl: true,
    description: "Search (focus search bar)",
    action: () => {
      const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
      if (searchInput) {
        searchInput.focus();
      }
    },
  },
  {
    key: "/",
    description: "Show keyboard shortcuts",
    action: () => {
      showShortcutsModal();
    },
  },
];

function showShortcutsModal() {
  // Create a simple modal showing all shortcuts
  const existingModal = document.getElementById("shortcuts-modal");
  if (existingModal) {
    existingModal.remove();
    return;
  }

  const modal = document.createElement("div");
  modal.id = "shortcuts-modal";
  modal.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: hsl(var(--background));
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    padding: 2rem;
    z-index: 9999;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
  `;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9998;
  `;

  const title = document.createElement("h2");
  title.textContent = "Keyboard Shortcuts";
  title.style.cssText = `
    font-size: 1.5rem;
    font-weight: bold;
    margin-bottom: 1rem;
    color: hsl(var(--foreground));
  `;

  const list = document.createElement("div");
  list.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  `;

  shortcuts.forEach((shortcut) => {
    const item = document.createElement("div");
    item.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.5rem 0;
      border-bottom: 1px solid hsl(var(--border));
    `;

    const description = document.createElement("span");
    description.textContent = shortcut.description;
    description.style.color = "hsl(var(--foreground))";

    const keys = document.createElement("div");
    keys.style.cssText = `
      display: flex;
      gap: 0.25rem;
    `;

    const keyParts: string[] = [];
    if (shortcut.ctrl) keyParts.push("Ctrl");
    if (shortcut.shift) keyParts.push("Shift");
    if (shortcut.alt) keyParts.push("Alt");
    keyParts.push(shortcut.key.toUpperCase());

    keyParts.forEach((part) => {
      const kbd = document.createElement("kbd");
      kbd.textContent = part;
      kbd.style.cssText = `
        background: hsl(var(--muted));
        color: hsl(var(--foreground));
        padding: 0.25rem 0.5rem;
        border-radius: 0.25rem;
        font-size: 0.875rem;
        font-family: monospace;
        border: 1px solid hsl(var(--border));
      `;
      keys.appendChild(kbd);
    });

    item.appendChild(description);
    item.appendChild(keys);
    list.appendChild(item);
  });

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close (Esc)";
  closeButton.style.cssText = `
    margin-top: 1.5rem;
    width: 100%;
    padding: 0.5rem;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 1rem;
  `;
  closeButton.onclick = () => {
    modal.remove();
    overlay.remove();
  };

  modal.appendChild(title);
  modal.appendChild(list);
  modal.appendChild(closeButton);

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  overlay.onclick = () => {
    modal.remove();
    overlay.remove();
  };
}

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Don't trigger shortcuts when typing in inputs
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow "/" to show shortcuts even in inputs
        if (event.key !== "/") {
          return;
        }
      }

      for (const shortcut of shortcuts) {
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();

        if (ctrlMatch && shiftMatch && altMatch && keyMatch) {
          event.preventDefault();
          shortcut.action();
          break;
        }
      }

      // ESC to close shortcuts modal
      if (event.key === "Escape") {
        const modal = document.getElementById("shortcuts-modal");
        if (modal) {
          modal.remove();
          const overlay = document.querySelector('[style*="z-index: 9998"]');
          overlay?.remove();
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);
}

export { shortcuts };

