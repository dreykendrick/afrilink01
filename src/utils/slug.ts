export const slugify = (value: string): string => {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

export const getProductSlug = (title: string, id?: string): string => {
  const base = slugify(title);
  if (!id) return base;
  return `${base}-${id.slice(0, 6)}`;
};
