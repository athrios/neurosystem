const NON_SHAREABLE_RESPONDENTS = new Set(['professional', 'interview']);
const THIRD_PARTY_RESPONDENTS = new Set([
  'patient',
  'self',
  'parent',
  'caregiver',
  'teacher',
  'informant',
  'other',
]);

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

export function isRespondentIdentityField(fieldOrId) {
  const id = typeof fieldOrId === 'string' ? fieldOrId : fieldOrId?.id;
  return IDENTITY_FIELD_IDS.has(id);
}

export function isPatientRespondentType(type) {
  return ['self', 'patient'].includes(type);
}

export function isShareableTestForm(form) {
  return Boolean(
    form
    && isThirdPartyTestForm(form)
    && !NON_SHAREABLE_RESPONDENTS.has(form.respondentType || form.respondent_type)
    && ['active', 'testing'].includes(form.status || form.implementation_status)
    && (form.available ?? true)
  );
}

export function isThirdPartyTestForm(form) {
  return THIRD_PARTY_RESPONDENTS.has(
    form?.respondentType || form?.respondent_type
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

export function getRespondentIdentitySection(definition) {
  return definition?.sections?.find(section => (
    section.id === 'respondent'
    || section.fields?.some(field => isRespondentIdentityField(field))
  )) || null;
}

export function visibleTestDefinitionForContext(definition, {
  shareableByThirdParty = false,
  sharedResponseReview = false,
} = {}) {
  if (!definition?.sections) return definition;

  if (shareableByThirdParty || sharedResponseReview) return definition;

  return {
    ...definition,
    sections: definition.sections
      .map(section => ({
        ...section,
        fields: section.fields.filter(field => !isRespondentIdentityField(field)),
      }))
      .filter(section => section.fields.length > 0),
  };
}

export function respondentLabel(type) {
  return RESPONDENT_LABELS[type] || type || 'Respondente';
}

export function effectiveTestResponseStatus(link, now = new Date()) {
  if (
    ['shared', 'in_progress', 'submitted'].includes(link?.status)
    && link?.expires_at
    && new Date(link.expires_at).getTime() <= now.getTime()
  ) {
    return 'expired';
  }
  return link?.status;
}

export function getPendingTestResponses(links, formCode) {
  return (links || [])
    .filter(link => (
      link.form_code === formCode
      && effectiveTestResponseStatus(link) === 'submitted'
    ))
    .sort((left, right) => (
      new Date(left.responded_at || left.created_at || 0)
      - new Date(right.responded_at || right.created_at || 0)
    ));
}

export function applyRespondentIdentity(responses, link) {
  const respondentName = link.respondent_name || responses?.respondent_name || '';
  return {
    ...(responses || {}),
    respondent_type: link.respondent_type,
    respondent_name: respondentName,
    relationship: link.relationship || '',
  };
}

export function createPublicTestDefinition(definition, {
  requireRespondentName = false,
} = {}) {
  const publicSections = definition.sections
    .map(section => ({
      ...section,
      fields: section.fields.filter(field => (
        field.public !== false
        && (
          !IDENTITY_FIELD_IDS.has(field.id)
          || (requireRespondentName && field.id === 'respondent_name')
        )
      )).map(field => (
        requireRespondentName && field.id === 'respondent_name'
          ? { ...field, required: true, label: field.label || 'Seu nome' }
          : field
      )),
    }))
    .filter(section => section.fields.length > 0);

  const hasRespondentNameField = publicSections.some(section => (
    section.fields.some(field => field.id === 'respondent_name')
  ));

  if (requireRespondentName && !hasRespondentNameField) {
    publicSections.unshift({
      id: 'respondent_identity',
      title: 'Identificação',
      fields: [{
        id: 'respondent_name',
        type: 'text',
        label: 'Seu nome',
        required: true,
        span: 12,
      }],
    });
  }

  return {
    ...definition,
    sections: publicSections,
  };
}
