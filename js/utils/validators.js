export const validateAnimal = (data) => {
  const errors = {};
  if (!data.nome) errors.nome = 'Nome é obrigatório';
  if (!data.raca) errors.raca = 'Raça é obrigatória';
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const validateSaude = (data) => {
  const errors = {};
  if (!data.tipo) errors.tipo = 'Tipo é obrigatório';
  if (!data.data_registro) errors.data_registro = 'Data é obrigatória';
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateReproducao = (data) => {
  const errors = {};
  if (!data.tipo) errors.tipo = 'Tipo é obrigatório';
  if (!data.data_evento) errors.data_evento = 'Data é obrigatória';
  return { isValid: Object.keys(errors).length === 0, errors };
};

export const validateEvento = (data) => {
  const errors = {};
  if (!data.titulo) errors.titulo = 'Título é obrigatório';
  if (!data.data_evento) errors.data_evento = 'Data é obrigatória';
  return { isValid: Object.keys(errors).length === 0, errors };
};
