export const validate =
  (schema, where = 'body') =>
  (req, res, next) => {
    const result = schema.safeParse(req[where]);
    if (!result.success) {
      return res.status(422).json({ error: 'ValidationError', details: result.error.flatten() });
    }
    req[where] = result.data;
    next();
  };
