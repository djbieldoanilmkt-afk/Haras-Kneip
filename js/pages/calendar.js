import { renderHeader } from '../components/header.js';
import { store } from '../store.js';
import { formatDate } from '../utils/helpers.js';
import { modal } from '../components/modal.js';

export const renderCalendar = async (container) => {
  let currentDate = new Date();
  
  const eventColors = {
    'Vacinação': '#4a8c2a',
    'Vermifugação': '#4a7ec4',
    'Parto Previsto': '#D4AF37',
    'Ferração': '#e67e22',
    'Veterinário': '#c44040',
    'Cobertura': '#9b59b6',
    'Outro': '#7a6e62'
  };

  const renderCalendarGrid = async () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Header
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById('current-month-year').textContent = `${monthNames[month]} ${year}`;

    // Get events for the month
    let events = [];
    try {
      events = await store.getEventos(month + 1, year);
    } catch (e) {
      console.error(e);
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date();

    let gridHtml = '';
    
    // Blank days
    for (let i = 0; i < firstDay; i++) {
      gridHtml += `<div class="calendar-day empty"></div>`;
    }

    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.data_evento === dateStr);
      
      const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
      
      let dotsHtml = dayEvents.map(e => `<span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${eventColors[e.tipo] || eventColors['Outro']}; margin:1px;"></span>`).join('');
      
      gridHtml += `
        <div class="calendar-day cursor-pointer" data-date="${dateStr}" style="padding: 10px; border: 1px solid var(--border-color); min-height: 80px; position: relative; ${isToday ? 'border: 2px solid var(--accent-gold);' : ''}">
          <div style="font-weight: bold; margin-bottom: 5px;">${day}</div>
          <div style="display: flex; flex-wrap: wrap;">${dotsHtml}</div>
        </div>
      `;
    }

    document.getElementById('calendar-grid').innerHTML = gridHtml;

    // Attach click events to days
    document.querySelectorAll('.calendar-day[data-date]').forEach(el => {
      el.addEventListener('click', () => {
        const dateStr = el.dataset.date;
        const dayEvents = events.filter(e => e.data_evento === dateStr);
        showDayEvents(dateStr, dayEvents);
      });
    });
  };

  const showDayEvents = (dateStr, dayEvents) => {
    const panel = document.getElementById('day-events-panel');
    panel.innerHTML = `<h3>Eventos em ${formatDate(dateStr)}</h3>`;
    
    if (dayEvents.length === 0) {
      panel.innerHTML += `<p class="empty-state">Nenhum evento neste dia.</p>`;
    } else {
      panel.innerHTML += dayEvents.map(e => `
        <div class="card" style="margin-top: 10px; border-left: 4px solid ${eventColors[e.tipo] || eventColors['Outro']}">
          <strong>${e.titulo}</strong>
          <div style="font-size: 0.9em; color: var(--text-muted);">${e.tipo}</div>
          ${e.descricao ? `<p style="margin-top: 5px; font-size: 0.9em;">${e.descricao}</p>` : ''}
        </div>
      `).join('');
    }
  };

  container.innerHTML = `
    <div id="header-container"></div>
    
    <div class="card slide-up stagger-1 mb-3" style="display: flex; justify-content: space-between; align-items: center;">
      <div style="display: flex; gap: 10px; align-items: center;">
        <button id="btn-prev-month" class="btn btn-outline"><i data-lucide="chevron-left"></i></button>
        <h2 id="current-month-year" style="width: 200px; text-align: center; margin: 0;"></h2>
        <button id="btn-next-month" class="btn btn-outline"><i data-lucide="chevron-right"></i></button>
        <button id="btn-today" class="btn btn-outline">Hoje</button>
      </div>
      <button id="btn-new-event" class="btn btn-primary"><i data-lucide="plus"></i> Novo Evento</button>
    </div>

    <div class="grid-3 mb-3">
      <div class="card slide-up stagger-2" style="grid-column: span 2;">
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; font-weight: bold; margin-bottom: 10px;">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div id="calendar-grid" style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px;"></div>
        
        <div style="margin-top: 20px; display: flex; flex-wrap: wrap; gap: 15px; font-size: 0.9em;">
          ${Object.entries(eventColors).map(([type, color]) => `
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color};"></span>
              ${type}
            </div>
          `).join('')}
        </div>
      </div>
      
      <div class="card slide-up stagger-3" id="day-events-panel">
        <p class="empty-state">Selecione um dia para ver os eventos.</p>
      </div>
    </div>
  `;

  renderHeader(container.querySelector('#header-container'), 'Calendário');

  document.getElementById('btn-prev-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendarGrid();
  });
  
  document.getElementById('btn-next-month').addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendarGrid();
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    currentDate = new Date();
    renderCalendarGrid();
  });

  document.getElementById('btn-new-event').addEventListener('click', async () => {
    let animais = [];
    try {
      animais = await store.getAnimais();
    } catch (e) {
      console.error(e);
    }
    
    const body = `
      <div class="form-group">
        <label>Título</label>
        <input type="text" id="ev-titulo" required>
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select id="ev-tipo">
          ${Object.keys(eventColors).map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Data</label>
        <input type="date" id="ev-data" required value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label>Animal (opcional)</label>
        <select id="ev-animal">
          <option value="">-- Nenhum --</option>
          ${animais.map(a => `<option value="${a.id}">${a.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Descrição</label>
        <textarea id="ev-descricao" rows="3"></textarea>
      </div>
    `;
    
    const footer = `
      <button class="btn btn-outline" onclick="document.querySelector('dialog').close()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-event">Salvar</button>
    `;
    
    modal.open('Novo Evento', body, footer);
    
    document.getElementById('btn-save-event').addEventListener('click', async () => {
      const data = {
        titulo: document.getElementById('ev-titulo').value,
        tipo: document.getElementById('ev-tipo').value,
        data_evento: document.getElementById('ev-data').value,
        animal_id: document.getElementById('ev-animal').value || null,
        descricao: document.getElementById('ev-descricao').value,
        concluido: false
      };
      
      try {
        await store.createEvento(data);
        modal.close();
        renderCalendarGrid(); // Refresh
      } catch (err) {
        alert('Erro ao salvar evento.');
      }
    });
  });

  await renderCalendarGrid();
  if (window.lucide) window.lucide.createIcons();
};
