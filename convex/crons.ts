import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Check all active websites every 2 hours
crons.interval(
  "check active websites",
  { minutes: 120 },
  internal.monitoring.checkActiveWebsites
);

export default crons;