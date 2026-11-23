const HIGHLIGHT_CLASS = 'cora-field-error-highlight';

export const highlightFormControl = (element: HTMLElement | null): void => {
  if (!element) return;
  element.classList.add(HIGHLIGHT_CLASS);

  const clear = () => {
    element.classList.remove(HIGHLIGHT_CLASS);
  };

  element.addEventListener('input', clear, { once: true });
  element.addEventListener('change', clear, { once: true });
  window.setTimeout(clear, 4000);
};

/**
 * Desplaza la vista hacia un campo por su `id`, lo enfoca y aplica un resaltado visual temporal.
 */
export const focusFieldById = (fieldId: string, delayMs = 60): void => {
  window.setTimeout(() => {
    const element = document.getElementById(fieldId);
    if (!element) return;

    if (typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (typeof (element as HTMLInputElement).focus === 'function') {
      (element as HTMLInputElement).focus({ preventScroll: true });
    }
    highlightFormControl(element);
  }, delayMs);
};

/**
 * Busca el primer control inválido dentro de un formulario, lo enfoca y devuelve el texto de su etiqueta.
 */
export const focusFirstInvalidControl = (
  formElement: HTMLFormElement | null
): { fieldLabel: string | null } => {
  if (!formElement) return { fieldLabel: null };

  const invalid = formElement.querySelector<HTMLElement>(
    ':invalid, .is-invalid, [aria-invalid="true"]'
  );
  if (!invalid) return { fieldLabel: null };

  if (typeof invalid.scrollIntoView === 'function') {
    invalid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  if (typeof (invalid as HTMLInputElement).focus === 'function') {
    (invalid as HTMLInputElement).focus({ preventScroll: true });
  }
  highlightFormControl(invalid);

  const fieldId = invalid.getAttribute('id');
  let labelText: string | null = null;
  if (fieldId) {
    const label = formElement.querySelector<HTMLLabelElement>(`label[for="${CSS.escape(fieldId)}"]`);
    labelText = label?.textContent?.replace('*', '').trim() ?? null;
  }
  if (!labelText) {
    const parentLabel = invalid.closest('.col-md-4, .col-md-6, .col-12, div')?.querySelector('label');
    labelText = parentLabel?.textContent?.replace('*', '').trim() ?? null;
  }

  return { fieldLabel: labelText };
};
