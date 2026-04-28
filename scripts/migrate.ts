import { appDatabase, appReady, migrateDatabase } from "../src/lib/database";

await appReady;
await migrateDatabase(appDatabase.client);
console.info("Database migrated.");
appDatabase.client.close();
