import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
app.enable("trust proxy");
app.use(express.json());
app.use(cors());

const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@mongo:${process.env.MONGO_PORT}/?authSource=admin`
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Database connection failed:", error.message);
    process.exit(1); // Exit on failure
  }
};

const formatDecimal = (value, decimals = 2) => {

  const decimalValue = value.toFixed(2)
 
  return  decimalValue  // Ensure rounding and conversion to number
};

const validateProductInput = (name, amount, price) => {
  if (!name || typeof name !== "string" || name.length > 50) return false; // Allow longer names
  if (amount <= 0 || !Number.isInteger(amount)) return false;
  if (price !== undefined && price <= 0) return false;
  return true;
};

connectDB().then(() => {
  const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    stock: { type: Number, default: 0 },
    sales: { type: Number, default: 0.0 },
  });

  const Inventory = mongoose.model("inventory", inventorySchema);

  // Add stock
  app.post("/v1/stocks", async (req, res) => {
    const { name, amount = 1 } = req.body;

    if (!validateProductInput(name, amount)) {
      return res.status(400).json({ message: "ERROR" });
    }

    try {
      let product = await Inventory.findOne({ name });

      if (product) {
        product.stock += amount;
      } else {
        product = new Inventory({ name, stock: amount });
      }

      await product.save();
      res.status(200).json({ name: product.name, amount: product.stock });
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  // Get stocks
  app.get("/v1/stocks/:name?", async (req, res) => {
    const { name } = req.params;

    try {
      if (name) {
        const product = await Inventory.findOne({ name });
        if (!product) {
          return res.status(404).json({ message: "Product not found" });
        }
        return res.status(200).json({ [name]: product.stock });
      }

      const allStocks = await Inventory.find({});
      const result = {};

      allStocks.forEach((product) => {
        if (product.stock > 0) {
          result[product.name] = product.stock;
        }
      });

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  // Add sales
  app.post("/v1/sales", async (req, res) => {
    const { name, amount = 1, price } = req.body;

    if (!validateProductInput(name, amount, price)) {
      return res.status(400).json({ message: "ERROR" });
    }

    try {
      const product = await Inventory.findOne({ name });
      if (!product || product.stock < amount) {
        return res.status(400).json({ message: "ERROR" });
      }

      product.stock -= amount;
      product.sales += price ? (amount*price) : 0;

      await product.save();

      res.status(200).json({ name, amount, ...(price && { price }) });
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  // Get total sales
  app.get("/v1/sales", async (req, res) => {
    try {
      const products = await Inventory.find();
      const totalSales = products.reduce((sum, p) => sum + p.sales, 0.0);

      res.status(200).json({ sales: formatDecimal(totalSales, 2) });
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  // Delete all stocks
  app.delete("/v1/stocks", async (req, res) => {
    try {
      await Inventory.deleteMany({});
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  // Root endpoint
  app.get("/", (req, res) => {
    res.status(200).json({ message: "OK" });
  });

  app.listen(4000, () => {
    console.log("Server listening on port 4000");
  });
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("Database connection closed.");
  process.exit(0);
});




