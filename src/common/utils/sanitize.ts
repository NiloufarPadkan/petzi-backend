export function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]*>/g, '');
}
