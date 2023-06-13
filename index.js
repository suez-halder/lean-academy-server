const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const port = process.env.PORT || 3000

// middleware
const corsOptions = {
  origin: '*',
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.pufeqid.mongodb.net/?retryWrites=true&w=majority`;


const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const usersCollection = client.db('leanAcademyDb').collection('users')
    const classesCollection = client.db('leanAcademyDb').collection('classes')

    // ----------- users related apis --------
    // get all users
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // // verify role
    app.get('/users/role/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      // console.log(user);

      let result;
      if (user) {
        result = {
          isStudent: user.role === 'student',
          isInstructor: user.role === 'instructor',
          isAdmin: user.role === 'admin',
        };
      } else {
        result = { error: 'No user found with that email.' };
      }

      res.send(result);
    });

    app.patch('/users/role/:id', async (req, res) => {
      const id = req.params.id;
      const newRole = req.body.role; // role is sent in the request body
  
      // Check that newRole is either 'admin' or 'instructor'
      if (!['admin', 'instructor'].includes(newRole)) {
          return res.status(400).json({ message: 'Invalid role. Role should be either "admin" or "instructor"' });
      }
  
      const query = { _id: new ObjectId(id) };
      const updateDoc = {
          $set: {
              role: newRole,
          },
      };
      try {
          const update = await usersCollection.updateOne(query, updateDoc);
          res.json(update);
      } catch (err) {
          console.error(err);
          res.status(500).json({ message: 'Internal server error' });
      }
  });
  

    app.post('/users', async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      // console.log('existing user: ', existingUser );
      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
      // console.log(result);
    })

    // ----------- classes related apis --------

    // get all classes
    app.get('/classes', async(req, res)=>{
      const allClasses = req.body;
      const result = await classesCollection.find().toArray()
      res.send()
    })
    
    // add a class
    app.post('/classes', async(req, res)=>{
      const allClasses = req.body;
      const result = await classesCollection.insertOne(allClasses)
      res.send(result)
    })



    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Lean Academy Server is running..')
})

app.listen(port, () => {
  console.log(`Lean Academy is running on port ${port}`)
})
