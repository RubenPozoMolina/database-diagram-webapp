import express from "express";
import cors from "cors";
import { testConnectionRouter } from "./routes/test-connection";
import { readSchemaRouter } from "./routes/read-schema";
import { applySchemaRouter } from "./routes/apply-schema";
import { errorHandler } from "./middleware/error-handler";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use("/api/test-connection", testConnectionRouter);
app.use("/api/read-schema", readSchemaRouter);
app.use("/api/apply-schema", applySchemaRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on port ${PORT}`);
});

export default app;
export { errorHandler };
