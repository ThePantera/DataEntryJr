import { Transform } from 'class-transformer';

/** Parses "true"/"false"/"1"/"0" query strings into booleans (other values stay invalid). */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === 'true' || value === '1' || value === true) return true;
    if (value === 'false' || value === '0' || value === false) return false;
    return value;
  });
