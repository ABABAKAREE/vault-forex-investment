const { migrate } = require('./migrate');
const pool = require('./pool');

(async () => {
  try {
    await migrate();
    console.log('Database migration completed successfully.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    await pool.end();
    process.exit(1);
  }
})();
