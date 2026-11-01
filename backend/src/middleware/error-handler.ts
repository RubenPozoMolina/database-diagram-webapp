import { RequestHandler } from "express";

export const errorHandler: RequestHandler = (err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  res.status(500).json({ error: "Internal server error", message: err.message });
};
