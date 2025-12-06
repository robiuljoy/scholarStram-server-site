const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const Stripe = require("stripe");
const admin = require("firebase-admin");

const app = express();
const port = process.env.PORT || 3000;
const stripe = Stripe(process.env.STRIPE_SECRET || "");

// MIDDLE WEAR
app.use(express.json());
app.use(cors());

// MONGODB CONNECTION
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.hl8gbtt.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// COLLECTIONS IT WILL ASSIGN VALUES AFTER MONGODB CONNECTION
let userCollection;
let scholarshipsCollection;
let applicationsCollection;
let reviewsCollection;

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("scholar_stream_db");

    // MADE THE CONNECTIONS
    userCollection = db.collection("users");
    scholarshipsCollection = db.collection("scholarships");
    applicationsCollection = db.collection("applications");
    reviewsCollection = db.collection("reviews");

    // API'S

    app.get("/", (req, res) => {
      res.send("Api Working Fine");
    });

    // USER API START

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        if (!user?.email)
          return res.status(400).send({ message: "Email required" });

        user.role = user.role || "Student";
        user.createdAt = user.createdAt || new Date().toISOString();

        const exists = await userCollection.findOne({ email: user.email });
        if (exists)
          return res.send({
            acknowledged: true,
            message: "User already exists",
          });
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // GET USERS (ADMIN ONLY)
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const { role } = req.query;
        const query = {};
        if (role && role !== "All") query.role = role;
        const users = await userCollection
          .find(query)
          .sort({ createdAt: -1 })
          .toArray();
        res.send(users);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // Get A SINGLE USERS
    app.get("/users/:email/role", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await userCollection.findOne({ email });
        res.send({ role: user?.role || "Student" });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // PROMOTE (ADMIN ONLY)
    app.patch("/users/role/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const { role } = req.body;
        if (!role) return res.status(400).send({ message: "Role is required" });
        const result = await userCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // DELETE A USER (ADMIN ONLY)
    app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await userCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // USER API END
    // ---------------
    // ---------------

    // ---------- SCHOLARSHIPS API START----------
    // CREATE SCHOLARSHIPS (ONLY ADMIN)
    app.post("/scholarships", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const data = req.body;

        if (!data.scholarshipName || !data.universityName) {
          return res.status(400).send({
            message: "scholarshipName and universityName are required",
          });
        }

        data.scholarshipPostDate =
          data.scholarshipPostDate || new Date().toISOString();

        const result = await scholarshipsCollection.insertOne(data);
        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // ------------SCHOLARSHIPS API END----------

    // LIST SCHOLARSHIPS WITH SEARCH, FILTER, SORT, PAGINATION START
    app.get("/scholarships", async (req, res) => {
      try {
        const {
          search,
          country,
          category,
          sort,
          page = 1,
          limit = 12,
        } = req.query;

        const query = {};
        if (search) {
          query.$or = [
            { scholarshipName: { $regex: search, $options: "i" } },
            { universityName: { $regex: search, $options: "i" } },
            { degree: { $regex: search, $options: "i" } },
          ];
        }
        if (country) query.universityCountry = country;
        if (category) query.scholarshipCategory = category;

        const sortObj = {};
        if (sort === "fee_asc") sortObj.applicationFees = 1;
        if (sort === "fee_desc") sortObj.applicationFees = -1;
        if (sort === "date_desc") sortObj.scholarshipPostDate = -1;

        const skip = (Number(page) - 1) * Number(limit);

        const cursor = scholarshipsCollection
          .find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(Number(limit));
        const results = await cursor.toArray();
        const total = await scholarshipsCollection.countDocuments(query);

        res.send({ total, page: Number(page), limit: Number(limit), results });
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Server error" });
      }
    });

    // -------------------------
    // LIST SCHOLARSHIPS WITH SEARCH, FILTER, SORT, PAGINATION END
    // --------------------------

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
