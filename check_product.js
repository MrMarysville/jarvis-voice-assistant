import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { lineItems } from "./drizzle/schema.ts";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

const products = await db.select().from(lineItems).limit(5);
console.log("Products in database:");
console.log(JSON.stringify(products, null, 2));

await connection.end();
