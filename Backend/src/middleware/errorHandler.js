export function errorHandler(error, req, res, next) {
  const statusCode = error.statusCode || error.status || 500;
  const isClientError = statusCode >= 400 && statusCode < 500;

  if (!isClientError) {
    console.error(error);
  }

  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }

  return res.status(statusCode).json({
    message: error.message || "Internal server error"
  });
}
