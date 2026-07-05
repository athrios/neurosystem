export function canEditTestApplication({ evaluation, profile, form }) {
  if (!evaluation || !profile || !form) return false;

  const ownsEvaluation = profile.role === 'master'
    || evaluation.psicologo_id === profile.id;
  if (!ownsEvaluation) return false;

  return evaluation.status !== 'concluida'
    || form.implementation_status === 'testing';
}
