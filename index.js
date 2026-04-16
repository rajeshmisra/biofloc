const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Serve index.html from the 'public' folder
app.use(express.static('public'));

// Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Required for Render Postgres
});

// --- 📡 SENSOR DATA (For ESP8266 #1) ---

// Receive sensor logs
app.post('/log', async (req, res) => {
  const { temp, moisture } = req.body;
  try {
    await pool.query(
      'INSERT INTO sensor_logs (temperature, soil_moisture) VALUES ($1, $2)',
      [temp, moisture]
    );
    console.log(`Sensor Update: Temp ${temp}, Moisture ${moisture}`);
    res.status(201).json({ status: "logged" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get sensor history for the Webpage Chart
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

// --- 🕹️ CONTROL COMMANDS (For ESP8266 #2 & Webpage) ---

// Webpage calls this to update the DB when you click ON/OFF
app.post('/toggle-device', async (req, res) => {
  const { device, status } = req.body; // status: true or false
  try {
    await pool.query(
      'UPDATE device_status SET is_on = $1 WHERE device_name = $2',
      [status, device]
    );
    console.log(`Control Change: ${device} is now ${status}`);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ESP8266 #2 calls this to check if it should turn relays ON/OFF
app.get('/device-commands', async (req, res) => {
  try {
    const result = await pool.query('SELECT device_name, is_on FROM device_status');
    res.json(result.rows); // Returns array like [{"device_name":"fan","is_on":true}, ...]
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Polyhouse Backend Active on Port ${PORT}`));
