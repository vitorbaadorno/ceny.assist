const normalized = (value) =>
  typeof value === "string"
    ? value.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase()
    : value;
export function measureExtraction(actual, expected) {
  let correct = 0,
    predicted = 0,
    present = 0,
    correctPresent = 0;
  const fields = [];
  for (const [path, reference] of Object.entries(expected)) {
    const value = path.split(".").reduce((current, key) => current?.[key], actual) ?? null;
    const equal = Array.isArray(reference)
      ? Array.isArray(value) &&
        JSON.stringify([...new Set(value.map(normalized))].sort()) ===
          JSON.stringify([...new Set(reference.map(normalized))].sort())
      : normalized(value) === normalized(reference);
    const hasReference = reference !== null && (!Array.isArray(reference) || reference.length > 0);
    const hasPrediction = value !== null && (!Array.isArray(value) || value.length > 0);
    if (equal) correct++;
    if (hasPrediction) predicted++;
    if (hasReference) present++;
    if (equal && hasReference && hasPrediction) correctPresent++;
    fields.push({ field: path, correct: equal }); // Reports do not repeat PII or source text.
  }
  return {
    evaluated_fields: fields.length,
    correct_fields: correct,
    exact_accuracy: fields.length ? correct / fields.length : null,
    precision: predicted ? correctPresent / predicted : null,
    recall: present ? correctPresent / present : null,
    fields,
  };
}
