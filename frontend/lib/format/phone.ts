/** "+2349012345678" → "+234 901 234 5678"; other formats pass through. */
export function formatPhone(phone: string): string {
  const m = phone.match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
