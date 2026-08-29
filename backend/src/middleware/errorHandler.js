function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    message: statusCode < 500 && err.message ? err.message : "Internal server error",
  });
}

module.exports = errorHandler;
