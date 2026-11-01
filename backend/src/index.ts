import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler";
import { applySchemaRouter } from "./routes/apply-schema";
import { readSchemaRouter } from "./routes/read-schema";
import { testConnectionRouter } from "./routes/test-connection";

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
  console.log(`Backend listening on port ${PORT}`);
});

export default app;
export { errorHandler };
