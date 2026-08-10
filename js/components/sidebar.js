export const renderSidebar = (container) => {
  container.innerHTML = `
    <aside class="sidebar" id="sidebar" role="navigation" aria-label="Menu principal">
      <div class="sidebar-header" style="display: flex; align-items: center; justify-content: space-between;">
        <h2 style="display: flex; align-items: center; gap: 6px; font-size: 0.9rem;">
          <span style="font-size: 1.1rem;">🐴</span> 
          Haras Kneip
        </h2>
        <button class="mobile-toggle btn btn-ghost" aria-label="Fechar menu" style="display: none;">
          <i data-lucide="x"></i>
        </button>
      </div>
      <nav class="sidebar-nav" role="menubar">
        <a href="#/" class="nav-link" data-path="/" role="menuitem" tabindex="0">
          <i data-lucide="layout-dashboard"></i> Dashboard
        </a>
        <a href="#/catalogo" class="nav-link" data-path="/catalogo" role="menuitem" tabindex="-1">
          <i data-lucide="book-open"></i> Catálogo
        </a>
        <a href="#/calendario" class="nav-link" data-path="/calendario" role="menuitem" tabindex="-1" style="display: flex; justify-content: space-between; align-items: center;">
          <span><i data-lucide="calendar"></i> Calendário</span>
          <span class="badge" style="background: var(--accent-gold); color: #fff; font-size: 0.75rem;" id="calendar-badge">3</span>
        </a>
        <a href="#/relatorios" class="nav-link" data-path="/relatorios" role="menuitem" tabindex="-1">
          <i data-lucide="bar-chart-3"></i> Relatórios
        </a>
        <a href="#/configuracoes" class="nav-link" data-path="/configuracoes" role="menuitem" tabindex="-1">
          <i data-lucide="settings"></i> Configurações
        </a>
      </nav>
      <div class="sidebar-footer">
        Mangalarga Marchador
      </div>
    </aside>
  `;
  
  if (window.lucide) {
    window.lucide.createIcons();
  }

  // Keyboard navigation support
  const links = container.querySelectorAll('.nav-link');
  links.forEach((link, index) => {
    // Hover micro-animation via inline style for safety
    link.style.transition = 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.2s';
    link.addEventListener('mouseenter', () => {
      if(!link.classList.contains('active')) link.style.transform = 'translateX(5px)';
    });
    link.addEventListener('mouseleave', () => {
      link.style.transform = 'translateX(0)';
    });

    // Keyboard handling
    link.addEventListener('keydown', (e) => {
      let nextIndex = index;
      if (e.key === 'ArrowDown') {
        nextIndex = (index + 1) % links.length;
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        nextIndex = (index - 1 + links.length) % links.length;
        e.preventDefault();
      }
      if (nextIndex !== index) {
        links[index].setAttribute('tabindex', '-1');
        links[nextIndex].setAttribute('tabindex', '0');
        links[nextIndex].focus();
      }
    });
  });

  // Mobile toggle logic inside sidebar
  const toggleBtn = container.querySelector('.mobile-toggle');
  toggleBtn.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.remove('expanded');
  });
};

export const updateActiveLink = (path) => {
  const links = document.querySelectorAll('.sidebar .nav-link');
  links.forEach(link => {
    link.classList.remove('active');
    link.removeAttribute('aria-current');
    link.style.borderLeft = 'none'; // reset
    if (link.getAttribute('href') === `#${path}`) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
      link.style.borderLeft = '4px solid var(--accent-gold)';
    }
  });
};
