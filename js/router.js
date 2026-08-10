import { renderDashboard } from './pages/dashboard.js';
import { renderCatalog } from './pages/catalog.js';
import { renderProfile } from './pages/profile.js';
import { renderCalendar } from './pages/calendar.js';
import { renderReports } from './pages/reports.js';
import { renderSettings } from './pages/settings.js';
import { renderAnimalForm } from './pages/animalForm.js';
import { renderPlantelPublico } from './pages/plantelPublico.js';
import { renderSidebar, updateActiveLink } from './components/sidebar.js';

export const router = {
  routes: {
    '/': renderDashboard,
    '/catalogo': renderCatalog,
    '/calendario': renderCalendar,
    '/relatorios': renderReports,
    '/configuracoes': renderSettings,
    '/novo-animal': renderAnimalForm,
    '/plantel': renderPlantelPublico
  },
  
  async handleRoute() {
    const appContainer = document.getElementById('app');
    const hash = window.location.hash || '#/';
    let path = hash.slice(1);
    
    // Handle standalone public route without sidebar shell
    if (path === '/plantel') {
      await renderPlantelPublico(appContainer);
      return;
    }

    // Re-render Shell if returning from public route
    if (!document.getElementById('sidebar-container')) {
      appContainer.innerHTML = '';
      const sidebarContainer = document.createElement('div');
      sidebarContainer.id = 'sidebar-container';
      appContainer.appendChild(sidebarContainer);

      const mainContent = document.createElement('main');
      mainContent.id = 'main-content';
      mainContent.className = 'main-content';
      mainContent.setAttribute('role', 'main');
      appContainer.appendChild(mainContent);

      renderSidebar(sidebarContainer);
    }

    const mainContent = document.getElementById('main-content');
    let routeMatch = this.routes[path];
    let params = null;

    if (path.startsWith('/animal/')) {
      routeMatch = renderProfile;
      params = path.split('/')[2];
      path = '/catalogo';
    } else if (path.startsWith('/editar-animal/')) {
      routeMatch = renderAnimalForm;
      params = path.split('/')[2];
      path = '/catalogo';
    }
    
    if (!routeMatch) {
      mainContent.innerHTML = '<div class="empty-state">Página não encontrada</div>';
      return;
    }
    
    updateActiveLink(path);
    mainContent.innerHTML = '<div class="skeleton" style="width:100%; height:80vh; border-radius: var(--radius-lg);"></div>';
    
    try {
      if (params) {
        await routeMatch(mainContent, params);
      } else {
        await routeMatch(mainContent);
      }
    } catch (e) {
      console.error('Route error:', e);
      mainContent.innerHTML = '<div class="empty-state" style="color:var(--accent-red);">Erro ao carregar página</div>';
    }
  },
  
  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }
};
