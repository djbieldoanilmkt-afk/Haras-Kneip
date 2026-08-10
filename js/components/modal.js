export const modal = {
  previousFocus: null,
  
  init() {
    this.dialog = document.createElement('dialog');
    this.dialog.className = 'modal-dialog';
    this.dialog.setAttribute('aria-labelledby', 'modal-title');
    this.dialog.style.padding = '0';
    this.dialog.style.border = 'none';
    this.dialog.style.background = 'transparent';
    this.dialog.style.backdropFilter = 'blur(4px)';
    
    // Spring easing animation
    this.dialog.style.transition = 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    this.dialog.style.opacity = '0';
    this.dialog.style.transform = 'scale(0.9)';
    
    this.dialog.innerHTML = `
      <div class="modal-content" style="background: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: var(--radius-lg); padding: var(--spacing-lg); max-width: 500px; width: 100%; box-shadow: var(--shadow-lg);">
        <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--spacing-md);">
          <h3 class="modal-title" id="modal-title"></h3>
          <button class="btn btn-ghost modal-close" aria-label="Fechar modal"><i data-lucide="x"></i></button>
        </div>
        <div class="modal-body" style="margin-bottom: var(--spacing-lg);"></div>
        <div class="modal-footer" style="display: flex; justify-content: flex-end; gap: var(--spacing-sm);"></div>
      </div>
    `;
    document.body.appendChild(this.dialog);
    
    this.dialog.querySelector('.modal-close').addEventListener('click', () => this.close());
    
    // Close on backdrop click
    this.dialog.addEventListener('click', (e) => {
      if (e.target === this.dialog) {
        this.close();
      }
    });

    // Close on escape is natively handled by <dialog>, but we ensure focus is restored and animation plays
    this.dialog.addEventListener('close', () => this.onClose());
    
    // Focus trap
    this.dialog.addEventListener('keydown', (e) => this.trapFocus(e));
  },
  
  open(title, contentHtml, footerHtml = '') {
    if(!this.dialog) this.init();
    
    this.previousFocus = document.activeElement;
    
    this.dialog.querySelector('.modal-title').textContent = title;
    this.dialog.querySelector('.modal-body').innerHTML = contentHtml;
    this.dialog.querySelector('.modal-footer').innerHTML = footerHtml;
    
    this.dialog.showModal();
    
    // Trigger animation
    requestAnimationFrame(() => {
      this.dialog.style.opacity = '1';
      this.dialog.style.transform = 'scale(1)';
    });
    
    if (window.lucide) window.lucide.createIcons();
    
    // Focus first element
    const focusableElements = this.getFocusableElements();
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }
  },
  
  close() {
    if(this.dialog) {
      this.dialog.style.opacity = '0';
      this.dialog.style.transform = 'scale(0.9)';
      setTimeout(() => {
        this.dialog.close();
      }, 400); // Wait for transition
    }
  },
  
  onClose() {
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
  },

  getFocusableElements() {
    return Array.from(this.dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ));
  },

  trapFocus(e) {
    if (e.key !== 'Tab') return;

    const focusableElements = this.getFocusableElements();
    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (e.shiftKey) { // Shift + Tab
      if (document.activeElement === firstElement) {
        lastElement.focus();
        e.preventDefault();
      }
    } else { // Tab
      if (document.activeElement === lastElement) {
        firstElement.focus();
        e.preventDefault();
      }
    }
  },
  
  confirm(title, message, onConfirm) {
    const footer = `
      <button class="btn btn-secondary modal-cancel">Cancelar</button>
      <button class="btn btn-primary modal-confirm">Confirmar</button>
    `;
    this.open(title, `<p>${message}</p>`, footer);
    
    this.dialog.querySelector('.modal-cancel').addEventListener('click', () => this.close(), { once: true });
    this.dialog.querySelector('.modal-confirm').addEventListener('click', () => {
      onConfirm();
      this.close();
    }, { once: true });
  }
};
