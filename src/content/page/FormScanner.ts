import type { FormField } from '../../shared/types';
import { FIELD_ID_ATTR, type FormControl } from './fieldId';

const EXCLUDED_INPUT_TYPES = new Set(['hidden', 'password', 'file', 'submit', 'button', 'reset', 'image']);

export interface FormScanner {
  scan(): FormField[];
}

/** Collects visible, editable form controls and tags each one with a stable id. */
export class DomFormScanner implements FormScanner {
  private nextId = 1;

  constructor(private readonly root: Document = document) {}

  scan(): FormField[] {
    const controls = this.root.querySelectorAll<FormControl>('input, textarea, select');
    return Array.from(controls).filter((el) => this.isEligible(el)).map((el) => this.describe(el));
  }

  private isEligible(el: FormControl): boolean {
    if (el.disabled) return false;
    if (el instanceof HTMLInputElement && EXCLUDED_INPUT_TYPES.has(el.type)) return false;
    if ((el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && el.readOnly) return false;
    if (el.closest('[hidden], [aria-hidden="true"]')) return false;
    const style = this.root.defaultView?.getComputedStyle(el);
    return style?.display !== 'none' && style?.visibility !== 'hidden';
  }

  private describe(el: FormControl): FormField {
    let id = el.getAttribute(FIELD_ID_ATTR);
    if (!id) {
      id = `f${this.nextId++}`;
      el.setAttribute(FIELD_ID_ATTR, id);
    }

    const field: FormField = {
      id,
      tag: el.tagName.toLowerCase() as FormField['tag'],
      type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
      name: el.name,
      label: this.labelOf(el),
      placeholder: 'placeholder' in el ? el.placeholder : '',
      value: el.value,
      required: el.required,
    };

    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      field.checked = el.checked;
    }
    if (el instanceof HTMLSelectElement) {
      field.options = Array.from(el.options).map((o) => ({ value: o.value, label: o.text.trim() }));
    }
    return field;
  }

  private labelOf(el: FormControl): string {
    const fromLabels = Array.from(el.labels ?? [])
      .map((l) => l.textContent?.trim() ?? '')
      .filter(Boolean)
      .join(' ');
    if (fromLabels) return fromLabels;

    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel.trim();

    const labelledBy = el.getAttribute('aria-labelledby');
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((ref) => this.root.getElementById(ref)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (text) return text;
    }

    return el.title.trim();
  }
}
