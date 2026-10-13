const express = require('express');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Khởi tạo connection pool tới PostgreSQL Database Service
const pool = new Pool({
  host: process.env.DB_HOST || 'database',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'secretpassword123',
  database: process.env.DB_NAME || 'appdb',
});

app.get('/', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT NOW() as current_time');
    res.json({
      status: 'success',
      message: 'Hello from Docker Compose v2 Multi-service Stack!',
      database: {
        status: 'Connected',
        host: process.env.DB_HOST,
        db_name: process.env.DB_NAME,
        server_time: dbRes.rows[0].current_time
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to connect to database',
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`Backend service listening on port ${PORT}`);
});
