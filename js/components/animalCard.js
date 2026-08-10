import { calcularIdade, getStatusColor } from '../utils/helpers.js';

export const renderAnimalCard = (animal, genealogia = null) => {
  const statusColor = getStatusColor(animal.status_reprodutivo);
  const initials = animal.nome ? animal.nome.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() : 'HK';
  const sexIcon = animal.sexo === 'Fêmea' ? '♀' : '♂';

  let lineageHtml = '';
  if (genealogia && (genealogia.pai_nome || genealogia.mae_nome)) {
    const parts = [];
    if (genealogia.pai_nome) parts.push(`<span>Pai: ${genealogia.pai_nome}</span>`);
    if (genealogia.mae_nome) parts.push(`<span>Mãe: ${genealogia.mae_nome}</span>`);
    lineageHtml = `<div class="ac-lineage">${parts.join('')}</div>`;
  }

  const photoHtml = animal.foto_url 
    ? `<img src="${animal.foto_url}" alt="${animal.nome}" class="ac-photo">`
    : `<div class="ac-avatar">
        <span class="ac-initials">${initials}</span>
       </div>`;

  return `
    <article class="ac" tabindex="0" data-id="${animal.id}">
      <div class="ac-media">
        ${photoHtml}
        <span class="ac-sex">${sexIcon}</span>
      </div>
      <div class="ac-body">
        <div class="ac-header">
          <h4 class="ac-name">${animal.nome}</h4>
          ${animal.status_reprodutivo ? `<span class="ac-badge" style="background:${statusColor};">${animal.status_reprodutivo}</span>` : ''}
        </div>
        <div class="ac-details">
          <span>${animal.pelagem || ''}${animal.tipo_marcha ? ' • ' + animal.tipo_marcha : ''}</span>
          <span>${calcularIdade(animal.data_nascimento)}</span>
        </div>
        ${lineageHtml}
      </div>
    </article>
  `;
};

// Global click listener for redirection
document.addEventListener('click', (e) => {
  const card = e.target.closest('.ac');
  if (card) {
    const id = card.getAttribute('data-id');
    if (id) window.location.hash = `#/animal/${id}`;
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    const card = document.activeElement.closest('.ac');
    if (card) {
      const id = card.getAttribute('data-id');
      if (id) window.location.hash = `#/animal/${id}`;
    }
  }
});

// Direct inline clean styles to completely isolate card styling
const style = document.createElement('style');
style.textContent = `
  .ac {
    background: #ffffff !important;
    border: 1px solid rgba(0, 0, 0, 0.08) !important;
    border-radius: 8px !important;
    overflow: hidden !important;
    cursor: pointer !important;
    display: flex !important;
    flex-direction: column !important;
    box-shadow: 0 2px 5px rgba(0,0,0,0.03) !important;
    position: relative !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  .ac * {
    box-sizing: border-box !important;
  }

  .ac:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
    transform: translateY(-2px) !important;
    transition: all 0.2s ease !important;
  }

  .ac-media {
    position: relative !important;
    height: 120px !important;
    width: 100% !important;
    background: #f4f1ea !important;
    overflow: hidden !important;
  }

  .ac-photo {
    width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
  }

  .ac-avatar {
    width: 100% !important;
    height: 100% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: #eae5d9 !important;
  }

  .ac-initials {
    font-family: 'Playfair Display', serif !important;
    font-size: 1.8rem !important;
    font-weight: 700 !important;
    color: #a07c3a !important;
  }

  .ac-sex {
    position: absolute !important;
    top: 6px !important;
    right: 6px !important;
    background: #ffffff !important;
    width: 22px !important;
    height: 22px !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    font-size: 0.75rem !important;
    font-weight: bold !important;
    color: #555555 !important;
    box-shadow: 0 1px 3px rgba(0,0,0,0.15) !important;
  }

  .ac-body {
    padding: 10px 12px !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 4px !important;
    background: #ffffff !important;
  }

  .ac-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    gap: 6px !important;
  }

  .ac-name {
    margin: 0 !important;
    font-size: 0.9rem !important;
    font-weight: 600 !important;
    color: #2c2418 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    font-family: 'Inter', sans-serif !important;
  }

  .ac-badge {
    font-size: 0.6rem !important;
    font-weight: 700 !important;
    padding: 2px 6px !important;
    border-radius: 10px !important;
    color: #ffffff !important;
    text-transform: uppercase !important;
    white-space: nowrap !important;
    flex-shrink: 0 !important;
  }

  .ac-details {
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
    font-size: 0.75rem !important;
    color: #6b5e50 !important;
  }

  .ac-lineage {
    margin-top: 4px !important;
    padding-top: 4px !important;
    border-top: 1px solid #eeeeee !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
    font-size: 0.7rem !important;
    color: #888888 !important;
  }
`;
document.head.appendChild(style);
