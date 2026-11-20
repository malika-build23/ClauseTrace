import { app } from "./app.js";
import { prisma } from "./db.js";
import { assertAuthConfigured } from "./lib/auth.js";
import { failInterruptedRuns } from "./lib/extraction-runner.js";

assertAuthConfigured(); // refuse to start without a strong JWT_SECRET

// Runs are in-process; any left "running" by a previous process cannot finish.
failInterruptedRuns()
  .then((n) => n > 0 && console.log(`Marked ${n} interrupted extraction run(s) as failed`))
  .catch((err) => console.error("Could not clean up extraction runs", err));

const port = Number(process.env.PORT ?? 4000);
const server = app.listen(port, () => {
  console.log(`ClauseTrace backend listening on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
