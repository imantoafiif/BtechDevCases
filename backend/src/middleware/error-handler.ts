import { ErrorRequestHandler, RequestHandler } from "express";

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({ status: 404, error: "Not Found" });
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  error;
  res.status(500).json({ status: 500, error: "Internal Server Error" });
};
