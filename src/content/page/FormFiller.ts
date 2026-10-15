import type { FillAction } from '../../shared/types';
import { findField, type FormControl } from './fieldId';

export interface FormFiller {
  /** Applies the action; throws if the field no longer exists or the value is invalid. */
  apply(action: FillAction): void;
}

/**
 * Sets values through the native prototype setters and dispatches input/change events,
 * so frameworks that track controlled inputs (React, Vue, Angular) pick up the change.
 */
export class DomFormFiller implements FormFiller {
  constructor(private readonly root: ParentNode = document) {}

  apply(action: FillAction): void {
    const el = findField(this.root, action.fieldId);
    if (!el) throw new Error(`Field ${action.fieldId} not found on the page.`);

    if (el instanceof HTMLInputElement && (el.type === 'checkbox' || el.type === 'radio')) {
      const shouldCheck = action.value.trim().toLowerCase() === 'true';
      if (el.checked !== shouldCheck) el.click();
      return;
    }

    const value = el instanceof HTMLSelectElement ? this.resolveOption(el, action.value) : action.value;
    this.setNativeValue(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  private resolveOption(select: HTMLSelectElement, value: string): string {
    const wanted = value.trim().toLowerCase();
    const option = Array.from(select.options).find(
      (o) => o.value.toLowerCase() === wanted || o.text.trim().toLowerCase() === wanted,
    );
    if (!option) throw new Error(`Option "${value}" not found in field.`);
    return option.value;
  }

  private setNativeValue(el: FormControl, value: string): void {
    const proto = Object.getPrototypeOf(el) as object;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
  }
}
