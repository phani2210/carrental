const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Database setup
const dbPath = path.join(__dirname, 'data', 'carrental.db');
const db = new sqlite3.Database(dbPath);

// Initialize database tables
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    available BOOLEAN DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS rentals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    car_id INTEGER NOT NULL,
    customer_name TEXT NOT NULL,
    rental_date TEXT NOT NULL,
    return_date TEXT,
    FOREIGN KEY (car_id) REFERENCES cars (id)
  )`);
});

// Routes

// Get all cars
app.get('/cars', (req, res) => {
  db.all('SELECT * FROM cars', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ cars: rows });
  });
});

// Add a new car
app.post('/cars', (req, res) => {
  const { make, model, year } = req.body;
  if (!make || !model || !year) {
    return res.status(400).json({ error: 'Make, model, and year are required' });
  }
  db.run('INSERT INTO cars (make, model, year) VALUES (?, ?, ?)', [make, model, year], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ id: this.lastID, message: 'Car added successfully' });
  });
});

// Rent a car
app.post('/rentals', (req, res) => {
  const { car_id, customer_name, rental_date } = req.body;
  if (!car_id || !customer_name || !rental_date) {
    return res.status(400).json({ error: 'Car ID, customer name, and rental date are required' });
  }
  // Check if car is available
  db.get('SELECT available FROM cars WHERE id = ?', [car_id], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row || !row.available) {
      return res.status(400).json({ error: 'Car is not available' });
    }
    // Mark car as unavailable and create rental
    db.run('UPDATE cars SET available = 0 WHERE id = ?', [car_id]);
    db.run('INSERT INTO rentals (car_id, customer_name, rental_date) VALUES (?, ?, ?)', [car_id, customer_name, rental_date], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Car rented successfully' });
    });
  });
});

// Return a car
app.put('/rentals/:id/return', (req, res) => {
  const rentalId = req.params.id;
  const { return_date } = req.body;
  if (!return_date) {
    return res.status(400).json({ error: 'Return date is required' });
  }
  // Update rental and mark car as available
  db.run('UPDATE rentals SET return_date = ? WHERE id = ?', [return_date, rentalId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Rental not found' });
    }
    // Get car_id from rental
    db.get('SELECT car_id FROM rentals WHERE id = ?', [rentalId], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      db.run('UPDATE cars SET available = 1 WHERE id = ?', [row.car_id]);
      res.json({ message: 'Car returned successfully' });
    });
  });
});

// Get all rentals
app.get('/rentals', (req, res) => {
  db.all('SELECT * FROM rentals', [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ rentals: rows });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
