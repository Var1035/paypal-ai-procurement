import { app } from "./app.js";
import { env, getServicesConnectivityStatus } from "./config/env.js";

const PORT = env.PORT;

app.listen(PORT, () => {
  console.log(`[AgentMarket API] Server listening on http://localhost:${PORT}`);
  console.log(`[AgentMarket API] Environment: ${env.NODE_ENV}`);
  
  const services = getServicesConnectivityStatus();
  console.log("[AgentMarket API] Service Connectivity Status:");
  Object.entries(services).forEach(([svc, info]) => {
    console.log(`  - ${svc.padEnd(10)}: [${info.configured ? "CONFIGURED" : "PENDING"}] ${info.details}`);
  });
});
