export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR');
};

export const calcularIdade = (dataNascimento) => {
  if (!dataNascimento) return 'Desconhecida';
  const nasc = new Date(dataNascimento);
  const hoje = new Date();
  
  let anos = hoje.getFullYear() - nasc.getFullYear();
  let meses = hoje.getMonth() - nasc.getMonth();
  
  if (meses < 0 || (meses === 0 && hoje.getDate() < nasc.getDate())) {
    anos--;
    meses += 12;
  }
  
  if (anos === 0) {
    return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  }
  return `${anos} ${anos === 1 ? 'ano' : 'anos'} e ${meses} ${meses === 1 ? 'mês' : 'meses'}`;
};

export const getStatusColor = (status) => {
  const map = {
    'vazia': 'var(--status-vazia)',
    'prenha': 'var(--status-prenha)',
    'lactante': 'var(--status-lactante)',
    'cobertura': 'var(--status-cobertura)'
  };
  return map[status?.toLowerCase()] || 'var(--text-muted)';
};

export const getStatusIcon = (status) => {
  const map = {
    'vazia': 'circle',
    'prenha': 'baby',
    'lactante': 'milk',
    'cobertura': 'heart'
  };
  return map[status?.toLowerCase()] || 'circle';
};

export const debounce = (fn, ms) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

export const capitalize = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export const truncate = (str, length) => {
  if (!str) return '';
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
};
