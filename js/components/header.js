import { voiceAssistant } from './voiceAssistant.js';

export const renderHeader = (container, title) => {
  container.innerHTML = `
    <header class="header slide-up" style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <button id="mobile-menu-btn" class="btn btn-ghost" aria-label="Abrir menu" aria-expanded="false" style="display: none;">
          <i data-lucide="menu"></i>
        </button>
        <h1 class="page-title">${title}</h1>
      </div>
      <div class="flex items-center" style="gap: 8px;">
        <div class="search-input-wrapper" role="search" aria-label="Pesquisa global" style="position: relative;">
          <i data-lucide="search" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%);"></i>
          <input type="text" id="global-search" class="input" placeholder="Buscar animais..." style="padding-left: 35px; padding-right: 60px;" aria-keyshortcuts="Control+K">
          <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 0.7rem; color: var(--text-muted); border: 1px solid var(--border-color); padding: 1px 4px; border-radius: 4px;">Ctrl+K</span>
        </div>
        <button id="header-btn-voice" class="btn" style="background: var(--accent-gold); color: #fff; display: flex; align-items: center; gap: 5px; font-weight: 600; font-size: 0.8rem;" title="Novo Animal por Voz">
          🎙️ Voz
        </button>
        <button class="btn btn-primary" onclick="window.location.hash='#/novo-animal'" aria-label="Adicionar Novo Animal" title="Adicionar Novo Animal">
          <i data-lucide="plus"></i> Novo Animal
        </button>
      </div>
    </header>
  `;
  if (window.lucide) window.lucide.createIcons();

  // Voice header button listener
  const voiceBtn = container.querySelector('#header-btn-voice');
  if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
      window.location.hash = '#/novo-animal';
      setTimeout(() => {
        voiceAssistant.startWizard((voiceData) => {
          if (voiceData.nome) {
            const el = document.getElementById('form-nome');
            if (el) el.value = voiceData.nome;
          }
          if (voiceData.apelido) {
            const el = document.getElementById('form-apelido');
            if (el) el.value = voiceData.apelido;
          }
          if (voiceData.registro_abccmm) {
            const el = document.getElementById('form-registro_abccmm');
            if (el) el.value = voiceData.registro_abccmm;
          }
          if (voiceData.pelagem) {
            const el = document.getElementById('form-pelagem');
            if (el) el.value = voiceData.pelagem;
          }
          if (voiceData.tipo_marcha) {
            const el = document.getElementById('form-tipo_marcha');
            if (el) el.value = voiceData.tipo_marcha;
          }
          if (voiceData.sexo) {
            const el = document.getElementById('form-sexo');
            if (el) el.value = voiceData.sexo;
          }
          if (voiceData.data_nascimento) {
            const el = document.getElementById('form-data_nascimento');
            if (el) el.value = voiceData.data_nascimento;
          }
          if (voiceData.peso) {
            const el = document.getElementById('form-peso');
            if (el) el.value = voiceData.peso;
          }
          if (voiceData.altura) {
            const el = document.getElementById('form-altura');
            if (el) el.value = voiceData.altura;
          }
          if (voiceData.baia_piquete) {
            const el = document.getElementById('form-baia');
            if (el) el.value = voiceData.baia_piquete;
          }
          if (voiceData.status_reprodutivo) {
            const el = document.getElementById('form-status_reprodutivo');
            if (el) el.value = voiceData.status_reprodutivo;
          }
          if (voiceData.status_saude) {
            const el = document.getElementById('form-status_saude');
            if (el) el.value = voiceData.status_saude;
          }
          if (voiceData.premiacao) {
            const el = document.getElementById('form-premiacao');
            if (el) el.value = voiceData.premiacao;
          }
        });
      }, 150);
    });
  }

  // Search logic setup
  const searchInput = container.querySelector('#global-search');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase();
      const searchEvent = new CustomEvent('globalSearch', { detail: { term } });
      document.dispatchEvent(searchEvent);
    });
  }
};
