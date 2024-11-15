require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jsonServer = require('json-server');
const fs = require('fs');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3001;

// Initialize db.json if it doesn't exist
const initializeDb = () => {
  const dbPath = './db.json';
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ shoes: [], orders: [] }));
  }
};

initializeDb();

app.use(cors({
  origin: [
    'http://localhost:5173',    // Local development
    'http://localhost:3000',    // Alternative local port
    'https://matexshoes.vercel.app', // Your future frontend URL
    'https://matexshoesapi.vercel.app' // Your future backend URL
  ],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Your existing transporter.verify and app.post('/api/place-order') code here...

app.post('/api/place-order', async (req, res) => {
  try {
    console.log('Received order request:', req.body);
    const { orderDetails, soldProducts } = req.body;
    
    if (!orderDetails || !soldProducts) {
      return res.status(400).json({ 
        success: false, 
        message: 'Missing required data' 
      });
    }

    // Send email first
    try {
      console.log('Attempting to send email...');

// In server.js
const mailOptions = {
  from: process.env.EMAIL_USER,
  to: 'maryamashfaq1828@gmail.com',
  subject: 'New Order Received - MATex Shoes',
  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #2dd4bf;">New Order Received!</h1>
      
      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Customer Details</h2>
        <p><strong>Name:</strong> ${orderDetails.name}</p>
        <p><strong>Email:</strong> ${orderDetails.email}</p>
        <p><strong>Phone:</strong> ${orderDetails.phone}</p>
        <p><strong>Address:</strong> ${orderDetails.address}</p>
        <p><strong>City:</strong> ${orderDetails.city}</p>
        <p><strong>Additional Notes:</strong> ${orderDetails.notes || 'None'}</p>
      </div>

      <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h2>Ordered Items</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #e5e7eb;">
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Shoe ID</th>
              <th style="padding: 12px; text-align: left; border-bottom: 2px solid #cbd5e1;">Name</th>
              <th style="padding: 12px; text-align: right; border-bottom: 2px solid #cbd5e1;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${orderDetails.items.map(item => `
              <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="padding: 12px;">${item.id}</td>
                <td style="padding: 12px;">${item.name}</td>
                <td style="padding: 12px; text-align: right;">Rs. ${item.price}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <h2>Order Summary</h2>
        <p><strong>Total Amount:</strong> Rs. ${orderDetails.total}</p>
        <p><strong>Payment Method:</strong> ${orderDetails.paymentMethod}</p>
      </div>
  `
};

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info);

    } catch (emailError) {
      console.error('Email error:', emailError);
      // Continue with order processing even if email fails
    }

    // Then update database
    const dbPath = './db.json';
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    
    db.shoes = db.shoes.map(shoe => ({
      ...shoe,
      isSoldOut: soldProducts.includes(shoe.id) ? true : shoe.isSoldOut
    }));

    if (!db.orders) {
      db.orders = [];
    }

    const newOrder = {
      id: Date.now(),
      orderDate: new Date().toISOString(),
      ...orderDetails
    };

    db.orders.push(newOrder);

    // Save updated database
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    res.json({ 
      success: true, 
      message: 'Order placed successfully',
      orderId: newOrder.id
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error processing order',
      error: error.message
    });
  }
});

// JSON Server setup - This should come AFTER your custom routes
const router = jsonServer.router('./db.json');
app.use('/api', router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? 'An unexpected error occurred' : err.message
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server is running on port ${port}`);
});

