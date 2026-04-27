import { appDatabase, migrateDatabase } from "../src/lib/database";

migrateDatabase(appDatabase.client);
console.info("Database migrated.");
appDatabase.client.close();
