const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require("express")
const jwt = require("jsonwebtoken")
const app = express()
// const Stripe = require('stripe');
// const stripe = Stripe(`${process.env.STRIPE_SK}`);
require("dotenv").config()
const stripe = require("stripe")(process.env.STRIPE_SK)
const cors = require("cors")
const port = process.env.PORT || 5000;


app.use(cors())
app.use(express.json())




app.get('/', (req, res) => {
  res.send("hello from server")
})


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jnuic7t.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully✅");

  } catch (error) {
    console.log(error.name, error.message);
  }
}
dbConnect()

app.get("/hello", (req, res) => {
  res.send("hello hello")
})

//middleware
const verifyToken = (req, res, next) => {
  // console.log("inside verify token", req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorised access" })
  }
  const token = req.headers.authorization.split(' ')[1]
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorised access" })
    }
    req.decoded = decoded
    next()
  })
}

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email }
  const user = await usersDB.findOne(query)
  const isAdmin = user?.role == 'admin'
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" })
  }
  next()
}

app.post('/jwt', (req, res) => {
  const user = req.body;
  const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '7d' })
  res.send({ token })
})


//users api

const usersDB = client.db("bistroBoss").collection("users")

app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
  const result = await usersDB.find().toArray();
  res.send(result)
})

app.get("/users/admin/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  if (email !== req.decoded.email) {
    return res.status(403).send({ message: "forbidden access" })
  }
  const query = { email: email }
  const user = await usersDB.findOne(query)
  let admin = false
  if (user) {
    admin = user?.role === 'admin'
  }
  res.send({ admin })
})



// CRUD for carts
const cartsDB = client.db("bistorBoss").collection("carts")

app.post('/carts', async (req, res) => {
  const item = req.body;
  const result = await cartsDB.insertOne(item)
  res.send(result)
})
app.get('/carts', async (req, res) => {
  const email = req.query.email;
  const query = { email }
  const result = await cartsDB.find(query).toArray()
  res.send(result)
})

app.delete("/carts/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await cartsDB.deleteOne(query)
  res.send(result)
})

// CRUD for users
app.post("/users", async (req, res) => {
  const user = req.body;
  const email = user.email;
  const query = { email }
  const existingUser = await usersDB.findOne(query)
  if (existingUser) {
    return res.send({ message: "user already existed" })
  }
  const result = await usersDB.insertOne(user)
  res.send(result)
})



app.delete("/users/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await usersDB.deleteOne(query)
  res.send(result)
})


app.patch("/users/admin/:id", verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const filter = { _id: new ObjectId(id) }
  const updatedDoc = {
    $set: {
      role: "admin"
    }
  }
  const result = await usersDB.updateOne(filter, updatedDoc)
  res.send(result)
})


//menu api
const menuDB = client.db("bistroBoss").collection("menu")

app.get("/menu", async (req, res) => {
  const result = await menuDB.find().toArray()
  res.send(result)
})

app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
  const menuInfo = req.body;
  const result = await menuDB.insertOne(menuInfo)
  res.send(result)
})

app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  const result = await menuDB.deleteOne(query)
  res.send(result)
})

app.get('/menu/:id', async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) }
  // console.log(id);
  const result = await menuDB.findOne(query)
  res.send(result)
})

app.patch('/menu/:id', async (req, res) => {
  const id = req.params.id;
  const item = req.body;
  const filter = { _id: new ObjectId(id) }
  const updatedDoc = {
    $set: {
      name: item.name,
      price: item.price,
      recipe: item.recipe,
      image: item.image,
      category: item.category
    }
  }

  const result = await menuDB.updateOne(filter, updatedDoc)
  res.send(result)

})


// stripe payment
app.post("/create-payment-intent", async (req, res) => {
  const { price } = req.body;
  const amount = parseInt(price * 100);
  // console.log({ amount });
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ['card']
  });
  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});
// app.post('/create-payment-intent', verifyToken, async (req, res) => {
//   const { price } = req.body;
//   const amount = parseFloat(price) * 100;
//   console.log("amount", amount);
//   const paymentIntent = await stripe.paymentIntents.create({
//     amount: amount,
//     currency: 'usd',
//     payment_method_types: ['card']
//   })
//   res.send({
//     clientSecret: paymentIntent.client_secret,
//   });

// })

app.listen(port, () => {
  console.log(`server is running at ${port}`);
})

