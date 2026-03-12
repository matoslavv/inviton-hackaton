import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";

async function seed() {
  console.log("Seeding database...");

  await db.insert(users).values([
    { name: "Alice", email: "alice@example.com" },
    { name: "Bob", email: "bob@example.com" },
  ]);

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
