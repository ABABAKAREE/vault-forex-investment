const errorHandler = (error, _req, res, _next) => {
  console.error(error);
  const status = Number(error?.status) || 500;
  const message = error?.code === 'PAYMENT_PROVIDER_ERROR'
    ? error.message
    : 'Internal server error';
  res.status(status).json({ ok: false, message });
};

module.exports = { errorHandler };
