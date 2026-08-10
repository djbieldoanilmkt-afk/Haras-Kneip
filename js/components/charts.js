// Requires Chart.js to be loaded globally

const darkThemeColors = {
  text: '#b8a892',
  grid: 'rgba(255, 255, 255, 0.05)',
  gold: '#C8A35F',
  green: '#4a8c2a',
  red: '#c44040',
  blue: '#4a7ec4',
  brown: '#8B4513'
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { labels: { color: darkThemeColors.text } }
  }
};

const pelagemColors = {
  'Castanha': '#8B4513',
  'Tordilha': '#A9A9A9',
  'Alazã': '#d2691e',
  'Baia': '#DAA520',
  'Pampa': '#E8D5B7',
  'Rosilha': '#CD5C5C',
  'Zaina': '#2C1810',
  'Preta': '#333333',
  'Tordilha Negra': '#696969'
};

export const initPelagemChart = (containerId, data) => {
  const ctx = document.getElementById(containerId);
  if (!ctx || !window.Chart) return;
  
  const labels = data.labels || ['Castanha', 'Tordilha', 'Alazã', 'Zaina'];
  const bgColors = labels.map(l => pelagemColors[l] || '#C8A35F');
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: data.values || [30, 20, 25, 25],
        backgroundColor: bgColors,
        borderColor: '#1a1410',
        borderWidth: 2
      }]
    },
    options: { ...commonOptions, cutout: '70%' }
  });
};

export const initIdadeChart = (containerId, data) => {
  const ctx = document.getElementById(containerId);
  if (!ctx || !window.Chart) return;
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels || ['0-1', '1-3', '3-5', '5-10', '10+'],
      datasets: [{
        label: 'Quantidade',
        data: data.values || [5, 12, 18, 10, 4],
        backgroundColor: darkThemeColors.gold
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: { ticks: { color: darkThemeColors.text }, grid: { color: darkThemeColors.grid } },
        x: { ticks: { color: darkThemeColors.text }, grid: { display: false } }
      }
    }
  });
};

export const initStatusChart = (containerId, data) => {
  const ctx = document.getElementById(containerId);
  if (!ctx || !window.Chart) return;
  
  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.labels || ['Vazia', 'Prenha', 'Lactante', 'Cobertura'],
      datasets: [{
        data: data.values || [40, 30, 20, 10],
        backgroundColor: ['#7a6e62', '#D4AF37', '#4a8c2a', '#4a7ec4'],
        borderColor: '#1a1410',
        borderWidth: 2
      }]
    },
    options: { ...commonOptions, cutout: '70%' }
  });
};

export const initPesagemChart = (containerId, data) => {
  const ctx = document.getElementById(containerId);
  if (!ctx || !window.Chart) return;
  
  new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels || [],
      datasets: [{
        label: 'Peso (kg)',
        data: data.values || [],
        borderColor: darkThemeColors.gold,
        backgroundColor: 'rgba(200, 163, 95, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: { ticks: { color: darkThemeColors.text }, grid: { color: darkThemeColors.grid } },
        x: { ticks: { color: darkThemeColors.text }, grid: { display: false } }
      }
    }
  });
};

export const initNascimentosChart = (containerId, data) => {
  const ctx = document.getElementById(containerId);
  if (!ctx || !window.Chart) return;
  
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels || [],
      datasets: [{
        label: 'Nascimentos',
        data: data.values || [],
        backgroundColor: darkThemeColors.gold,
        borderRadius: 4
      }]
    },
    options: {
      ...commonOptions,
      scales: {
        y: { ticks: { color: darkThemeColors.text, stepSize: 1 }, grid: { color: darkThemeColors.grid } },
        x: { ticks: { color: darkThemeColors.text }, grid: { display: false } }
      }
    }
  });
};
