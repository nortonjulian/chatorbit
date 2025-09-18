import hpp from 'hpp';

export function hppGuard() {
  // Allow certain params to be repeated if you use arrays in querystring; otherwise empty.
  return hpp({ whitelist: [] });
}
