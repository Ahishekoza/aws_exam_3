import express from "express";
const app = express();
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

app.enable("trust proxy");
app.use(express.json());
app.use(cors());

const connectDB = async () => {
  try {
    await mongoose.connect(
      `mongodb://${process.env.MONGO_INITDB_ROOT_USERNAME}:${process.env.MONGO_INITDB_ROOT_PASSWORD}@mongo:${process.env.MONGO_PORT}/?authSource=admin`
    );
  } catch (error) {
    console.log(error);
  }
};

connectDB().then(() => {
  const inventorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    stock: { type: Number, default: 0 },
    sales: { type: Number, default: 0 },
  });

  const Inventory = mongoose.model("inventory", inventorySchema);

  app.post("/v1/stocks", async (req, res) => {
    const { name, amount = 1 } = req.body;

    if (!name || typeof name !== "string" || name.length > 8) {
      return res.status(400).json({ message: "ERROR" });
    }

    if (
      typeof amount !== "number" ||
      amount <= 0 ||
      !Number.isInteger(amount)
    ) {
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

  app.get("/v1/stocks/:name?", async (req, res) => {
    const { name } = req.params;

    try {
      if (name) {
        const product = await Inventory.findOne({ name });
        res.status(200).json({ [name]: product ? product.stock : 0 }); // Use 'stock'
      } else {
        const allStocks = await Inventory.find({});
        const result = {};
        allStocks.forEach((product) => {
          if (product.stock > 0) {
            // Use 'stock'
            result[product.name] = product.stock;
          }
        });
        res.status(200).json(result);
      }
    } catch (error) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  app.post("/v1/sales", async (req, res) => {
    const { name, amount = 1, price } = req.body;

    if (
      !name ||
      typeof name !== "string" ||
      name.length > 8 ||
      !/^[a-zA-Z]+$/.test(name) ||
      amount <= 0 ||
      !Number.isInteger(amount) ||
      (price && price <= 0)
    ) {
      return res.status(400).json({ message: "ERROR" });
    }

    try {
      const product = await Inventory.findOne({ name });
      if (!product || product.stock < amount) {
        return res.status(400).json({ message: "ERROR" });
      }

      product.stock -= amount;
      product.sales += price ? amount * price : 0;
      await product.save();

      res.json({ name, amount, price });
    } catch (err) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  app.get("/v1/sales", async (req, res) => {
    try {
      const products = await Inventory.find();
      const totalSales = products.reduce((sum, p) => sum + p.sales, 0);
      const formattedSales = totalSales.toFixed(1); // Ensures one decimal place
      res.json({ sales: formattedSales }); // Send as a string
    } catch (err) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  app.delete("/v1/stocks", async (req, res) => {
    try {
      await Inventory.deleteMany({});
      res.status(204).send();
    } catch (err) {
      res.status(500).json({ message: "ERROR" });
    }
  });

  app.get("/", (req, res) => {
    res.status(200).json({ message: "OK" });
  });

  app.listen(4000, () => {
    console.log("Server listening on port 4000");
  });
});
