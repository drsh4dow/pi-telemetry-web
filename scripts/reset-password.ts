import { appDatabase } from "../src/lib/database";

const email = process.env.ADMIN_EMAIL;

if (!email) {
	console.error("Set ADMIN_EMAIL to the admin account email to reset setup.");
	process.exit(1);
}

appDatabase.client.exec("BEGIN");
try {
	const user = appDatabase.client
		.query("SELECT id FROM user WHERE email = ?")
		.get(email) as { id: string } | null;
	if (!user) {
		throw new Error(`No admin user found for ${email}`);
	}
	appDatabase.client
		.query("DELETE FROM session WHERE user_id = ?")
		.run(user.id);
	appDatabase.client
		.query("DELETE FROM account WHERE user_id = ?")
		.run(user.id);
	appDatabase.client.query("DELETE FROM user WHERE id = ?").run(user.id);
	appDatabase.client.exec("COMMIT");
	console.info(
		"Admin account removed. Open the app to create a new admin user. Telemetry data was preserved.",
	);
} catch (error) {
	appDatabase.client.exec("ROLLBACK");
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
} finally {
	appDatabase.client.close();
}
