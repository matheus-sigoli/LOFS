const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export const ehUuid = (v: string) => UUID.test(v);
export const ehSlug = (v: string) => v.length <= 120 && SLUG.test(v);
