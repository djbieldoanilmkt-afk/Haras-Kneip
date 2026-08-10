import { renderSidebar } from './components/sidebar.js';
import { router } from './router.js';

// Simple toast notification system
window.showToast = (message, type = 'info') => {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    container.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 10px;';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const bgColors = {
    info: '#2c2418',
    error: 'var(--accent-red)',
    success: 'var(--accent-green)'
  };
  
  toast.style.cssText = `
    background: ${bgColors[type] || bgColors.info};
    color: #fff;
    padding: 12px 20px;
    border-radius: var(--radius-md);
    box-shadow: var(--shadow-lg);
    transform: translateX(100%);
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    display: flex;
    align-items: center;
    gap: 8px;
  `;
  toast.innerHTML = `<i data-lucide="${type === 'error' ? 'alert-triangle' : 'info'}"></i> ${message}`;
  
  container.appendChild(toast);
  if (window.lucide) window.lucide.createIcons();

  // Animate in
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  // Animate out
  setTimeout(() => {
    toast.style.transform = 'translateX(100%)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// Global error handler
window.addEventListener('error', (event) => {
  window.showToast(event.message || 'Ocorreu um erro inesperado.', 'error');
});
window.addEventListener('unhandledrejection', (event) => {
  window.showToast(event.reason?.message || 'Erro de comunicação com o servidor.', 'error');
});

const initApp = () => {
  // Splash Screen Logic (2.5 seconds total)
  const splash = document.getElementById('splash-screen');
  if (splash) {
    const emoji = splash.querySelector('.splash-emoji');
    const title = splash.querySelector('.splash-title');
    const subtitle = splash.querySelector('.splash-subtitle');
    
    if (emoji) emoji.style.animation = 'scaleInFade 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards';
    if (title) {
      title.style.opacity = '0';
      title.style.animation = 'slideInLetterSpacing 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.5s forwards';
    }
    if (subtitle) {
      subtitle.style.opacity = '0';
      subtitle.style.animation = 'fadeUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) 1s forwards';
    }

    setTimeout(() => {
      splash.style.opacity = '0';
      splash.style.transition = 'opacity 0.6s ease';
      setTimeout(() => splash.remove(), 600);
    }, 4500);
  }

  // Render App Shell
  const appContainer = document.getElementById('app');
  
  const sidebarContainer = document.createElement('div');
  sidebarContainer.id = 'sidebar-container';
  appContainer.appendChild(sidebarContainer);
  
  const mainContent = document.createElement('main');
  mainContent.id = 'main-content';
  mainContent.className = 'main-content';
  mainContent.setAttribute('role', 'main');
  appContainer.appendChild(mainContent);

  renderSidebar(sidebarContainer);
  router.init();

  // Mobile hamburger menu toggle logic
  document.addEventListener('click', (e) => {
    const mobileBtn = e.target.closest('#mobile-menu-btn');
    if (mobileBtn) {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        sidebar.classList.toggle('expanded');
        const isExpanded = sidebar.classList.contains('expanded');
        mobileBtn.setAttribute('aria-expanded', isExpanded);
      }
    }
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      const searchInput = document.getElementById('global-search');
      if (searchInput) {
        searchInput.focus();
      } else {
        window.location.hash = '#/catalogo';
        setTimeout(() => {
          const catSearch = document.getElementById('global-search');
          if (catSearch) catSearch.focus();
        }, 100);
      }
    }
  });
};

// Add necessary keyframes dynamically
const style = document.createElement('style');
style.textContent = `
  @keyframes scaleInFade {
    0% { transform: scale(0.5); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes slideInLetterSpacing {
    0% { transform: translateY(20px); opacity: 0; letter-spacing: 0px; }
    100% { transform: translateY(0); opacity: 1; letter-spacing: 4px; }
  }
  @keyframes fadeUp {
    0% { transform: translateY(10px); opacity: 0; }
    100% { transform: translateY(0); opacity: 1; }
  }
  
  @media (max-width: 768px) {
    .sidebar {
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      position: fixed;
      z-index: 1000;
      height: 100vh;
    }
    .sidebar.expanded {
      transform: translateX(0);
    }
    .sidebar .mobile-toggle {
      display: block !important;
    }
    #mobile-menu-btn {
      display: block !important;
    }
  }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', initApp);
