require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function runMigrations() {
    const client = await pool.connect();
    
    try {
        // Get all migration files
        const migrationsDir = __dirname;
        const files = fs.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        
        console.log(`Found ${files.length} migration(s)`);
        
        for (const file of files) {
            console.log(`Running: ${file}`);
            const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
            await client.query(sql);
            console.log(`Completed: ${file}`);
        }
        
        console.log('All migrations completed successfully');
    } catch (err) {
        console.error('Migration failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

runMigrations();
