// Läs in .env (om den finns) innan något annat läser process.env.
// Importeras först av allt i index.ts. Nodes inbyggda loader – ingen dependency.
try {
  process.loadEnvFile();
} catch {
  // Ingen .env-fil – kör vidare med befintliga miljövariabler.
}
