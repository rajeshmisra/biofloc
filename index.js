const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 1. Serve the UI from the 'public' folder
app.use(express.static('public'));

// 2. Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render Postgres
});

// --- 🛠️ AUTO-DATABASE SETUP (Runs on Startup) ---
async function setupDatabase() {
  try {
    // Create Sensor Logs Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sensor_logs (
        id SERIAL PRIMARY KEY,
        temperature REAL,
        soil_moisture REAL,
        recorded_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create Device Status Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_status (
        device_name VARCHAR(50) PRIMARY KEY,
        is_on BOOLEAN DEFAULT FALSE
      );
    `);

    // Insert Initial Device States
    await pool.query(`
      INSERT INTO device_status (device_name, is_on) 
      VALUES ('fan', false), ('pump', false)
      ON CONFLICT (device_name) DO NOTHING;
    `);

    console.log("✅ Database Tables Verified/Created");
  } catch (err) {
    console.error("❌ Database Setup Error:", err);
  }
}
setupDatabase();

// --- 📡 SENSOR ROUTES (For ESP8266 #1) ---

// Save data from ESP8266
app.post('/log', async (req, res) => {
  const { temp, moisture } = req.body;
  try {
    await pool.query(
      'INSERT INTO sensor_logs (temperature, soil_moisture) VALUES ($1, $2)',
      [temp, moisture]
    );
    res.status(201).json({ status: "success" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get history for Web Chart
app.get('/history', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT temperature, soil_moisture, recorded_at FROM sensor_logs ORDER BY recorded_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 🕹️ CONTROL ROUTES (For ESP8266 #2 & Webpage) ---

// Toggle Fan/Pump from Webpage
app.post('/toggle-device', async (req, res) => {
  const { device, status } = req.body;
  try {
    await pool.query(
      'UPDATE device_status SET is_on = $1 WHERE device_name = $2',
      [status, device]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get commands for ESP8266 Actuator
app.get('/device-commands', async (req, res) => {
  try {
    const result = await pool.query('SELECT device_name, is_on FROM device_status');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 🚀 START SERVER ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Polyhouse Backend Server Running on Port ${PORT}`);
});
