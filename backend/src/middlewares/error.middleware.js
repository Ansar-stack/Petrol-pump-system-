import multer from "multer";
import logger from "../../logs/logger.js";

export const ErrorMiddlware = async (err, req, res, next) => {
  let message = err.message;

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large. Maximum allowed size is 5MB.";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Only image files are allowed.";
    }
    return res.respond(400, message);
  }

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} - ${statusCode} - ${err.stack || err.message}`);
  }

  return res.respond(statusCode, message);
};
