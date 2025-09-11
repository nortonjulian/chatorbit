export const Handlers = {
  requestHandler: () => (_req, _res, next) => next(),
  tracingHandler: () => (_req, _res, next) => next(),
  errorHandler: () => (err, _req, _res, next) => next(err),
};
export const init = () => {};
export const captureException = () => {};
export const captureMessage = () => {};
export default { Handlers, init, captureException, captureMessage };
