const NON_SHAREABLE_RESPONDENTS = new Set(['professional', 'interview']);

const RESPONDENT_LABELS = {
  patient: 'Paciente',
  self: 'Paciente (autoaplicação)',
  parent: 'Responsável',
  caregiver: 'Cuidador/Responsável',
  teacher: 'Professor(a)',
  informant: 'Informante',
  other: 'Outro informante',
};

const IDENTITY_FIELD_IDS = new Set([
  'respondent_type',
  'respondent_name',
  'relationship',
]);

export function isShareableTestForm(form) {
  return Boolean(
    form
    && !NON_SHAREABLE_RESPONDENTS.has(form.respondentType || form.respondent_type)
    && form.metadata?.public_response_enabled === true
    && ['active', 'testing'].includes(form.status || form.implementation_status)
    && (form.available ?? true)
  );
}

export function getRespondentOptions(form) {
  const sections = form?.administration_schema?.sections || [];
  const respondentField = sections
    .flatMap(section => section.fields || [])
    .find(field => field.id === 'respondent_type');

  if (respondentField?.options?.length) {
    return respondentField.options.map(option => ({
      value: String(option.value),
      label: option.label || RESPONDENT_LABELS[option.value] || option.value,
    }));
  }

  const type = form?.respondent_type;
  if (!type || NON_SHAREABLE_RESPONDENTS.has(type)) return [];
  return [{
    value: type,
    label: RESPONDENT_LABELS[type] || 'Respondente',
  }];
}

export function respondentLabel(type) {
  return RESPONDENT_LABELS[type] || type || 'Respondente';
}

export function getPendingTestResponses(links, formCode) {
  return (links || [])
    .filter(link => link.form_code === formCode && link.status === 'submitted')
    .sort((left, right) => (
      new Date(left.responded_at || left.created_at || 0)
      - new Date(right.responded_at || right.created_at || 0)
    ));
}

export function applyRespondentIdentity(responses, link) {
  return {
    ...(responses || {}),
    respondent_type: link.respondent_type,
    respondent_name: link.respondent_name,
    relationship: link.relationship || '',
  };
}

export function createPublicTestDefinition(definition) {
  return {
    ...definition,
    sections: definition.sections
      .map(section => ({
        ...section,
        fields: section.fields.filter(field => !IDENTITY_FIELD_IDS.has(field.id)),
      }))
      .filter(section => section.fields.length > 0),
  };
}
