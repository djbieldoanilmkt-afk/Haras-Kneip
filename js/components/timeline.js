import { formatDate } from '../utils/helpers.js';

export const renderTimeline = (items) => {
  if (!items || items.length === 0) return '<div class="empty-state">Sem registros na linha do tempo</div>';
  
  let html = '<div class="timeline" style="border-left: 2px solid var(--bg-card-hover); padding-left: var(--spacing-md); margin-left: var(--spacing-md);">';
  
  items.forEach((item, index) => {
    html += `
      <div class="timeline-item stagger-${(index % 5) + 1} slide-up" style="position: relative; margin-bottom: var(--spacing-lg);">
        <div class="timeline-dot" style="position: absolute; left: calc(var(--spacing-md) * -1 - 9px); top: 5px; width: 16px; height: 16px; border-radius: 50%; background: var(--accent-gold); border: 4px solid var(--bg-primary);"></div>
        <div class="timeline-content card" style="padding: var(--spacing-md);">
          <div class="flex justify-between items-center mb-1">
            <h4 style="margin:0; color: var(--accent-gold);">${item.title}</h4>
            <span style="font-size: 0.75rem; color: var(--text-muted);">${formatDate(item.date)}</span>
          </div>
          <p style="margin:0; font-size: 0.875rem; color: var(--text-secondary);">${item.description}</p>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
};
