export const FIELD_ID_ATTR = 'data-lfa-id';

export type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

export function findField(root: ParentNode, id: string): FormControl | null {
  return root.querySelector<FormControl>(`[${FIELD_ID_ATTR}="${CSS.escape(id)}"]`);
}
