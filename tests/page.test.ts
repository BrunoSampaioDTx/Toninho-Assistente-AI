import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomFormFiller } from '../src/content/page/FormFiller';
import { DomFormScanner } from '../src/content/page/FormScanner';

beforeEach(() => {
  document.body.innerHTML = `
    <form>
      <label for="name">Full name</label><input id="name" name="name" required />
      <input name="email" type="email" aria-label="Email address" />
      <input name="secret" type="password" />
      <input name="token" type="hidden" />
      <input name="ro" readonly />
      <div hidden><input name="invisible" /></div>
      <textarea name="notes" placeholder="Notes"></textarea>
      <select name="country" aria-label="Country">
        <option value="">--</option>
        <option value="pt">Portugal</option>
        <option value="es">Spain</option>
      </select>
      <label><input type="checkbox" name="terms" /> I accept</label>
    </form>`;
});

describe('DomFormScanner', () => {
  it('returns only visible editable fields with resolved labels', () => {
    const fields = new DomFormScanner().scan();

    expect(fields.map((f) => f.name)).toEqual(['name', 'email', 'notes', 'country', 'terms']);
    expect(fields.map((f) => f.label)).toEqual(['Full name', 'Email address', '', 'Country', 'I accept']);
    expect(fields[0].required).toBe(true);
    expect(fields[3].options).toEqual([
      { value: '', label: '--' },
      { value: 'pt', label: 'Portugal' },
      { value: 'es', label: 'Spain' },
    ]);
    expect(fields[4].checked).toBe(false);
  });

  it('keeps ids stable across scans', () => {
    const scanner = new DomFormScanner();
    expect(scanner.scan().map((f) => f.id)).toEqual(scanner.scan().map((f) => f.id));
  });
});

describe('DomFormFiller', () => {
  const idOf = (name: string) => new DomFormScanner().scan().find((f) => f.name === name)!.id;

  it('sets text value and dispatches input and change events', () => {
    const id = idOf('name');
    const input = document.querySelector<HTMLInputElement>('[name=name]')!;
    const onInput = vi.fn();
    const onChange = vi.fn();
    input.addEventListener('input', onInput);
    input.addEventListener('change', onChange);

    new DomFormFiller().apply({ type: 'fill', fieldId: id, value: 'Ana Silva' });

    expect(input.value).toBe('Ana Silva');
    expect(onInput).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenCalledOnce();
  });

  it('selects option by label or value', () => {
    const id = idOf('country');
    const select = document.querySelector<HTMLSelectElement>('[name=country]')!;
    const filler = new DomFormFiller();

    filler.apply({ type: 'fill', fieldId: id, value: 'Spain' });
    expect(select.value).toBe('es');
    filler.apply({ type: 'fill', fieldId: id, value: 'pt' });
    expect(select.value).toBe('pt');
  });

  it('rejects unknown select options', () => {
    const id = idOf('country');
    expect(() => new DomFormFiller().apply({ type: 'fill', fieldId: id, value: 'France' })).toThrow(/not found/);
  });

  it('toggles checkboxes', () => {
    const id = idOf('terms');
    const box = document.querySelector<HTMLInputElement>('[name=terms]')!;
    const filler = new DomFormFiller();

    filler.apply({ type: 'fill', fieldId: id, value: 'true' });
    expect(box.checked).toBe(true);
    filler.apply({ type: 'fill', fieldId: id, value: 'true' });
    expect(box.checked).toBe(true);
    filler.apply({ type: 'fill', fieldId: id, value: 'false' });
    expect(box.checked).toBe(false);
  });

  it('throws when field is missing', () => {
    expect(() => new DomFormFiller().apply({ type: 'fill', fieldId: 'nope', value: 'x' })).toThrow(/not found/);
  });
});
