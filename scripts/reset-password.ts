import { appDatabase, appReady, dbGet } from "../src/lib/database";

const email = process.env.ADMIN_EMAIL;

if (!email) {
	console.error("Set ADMIN_EMAIL to the admin account email to reset setup.");
	process.exit(1);
}

await appReady;

try {
	const user = await dbGet<{ id: string }>(
		appDatabase.client,
		"SELECT id FROM user WHERE email = ?",
		[email],
	);
	if (!user) {
		throw new Error(`No admin user found for ${email}`);
	}
	await appDatabase.client.batch(
		[
			{ sql: "DELETE FROM session WHERE user_id = ?", args: [user.id] },
			{ sql: "DELETE FROM account WHERE user_id = ?", args: [user.id] },
			{ sql: "DELETE FROM user WHERE id = ?", args: [user.id] },
		],
		"write",
	);
	console.info(
		"Admin account removed. Open the app to create a new admin user. Telemetry data was preserved.",
	);
} catch (error) {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
} finally {
	appDatabase.client.close();
}
