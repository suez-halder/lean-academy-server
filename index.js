const express = require('express')
const app = express()
const cors = require('cors')
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 3000
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

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

// validate jwt
const verifyJWT = (req, res, next) =>{
  const authorization = req.headers.authorization;
  if(!authorization){
    return res.status(401).send({error: true, message: 'Unauthorized Access'})
  }
  // console.log(authorization);
  const token = authorization.split(' ')[1]
  // console.log(token);
  // token verify
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded)=>{
    if(err){
      return res.status(401).send({error: true, message: 'Unauthorized Access'})
    }
    req.decoded = decoded
    next()
  })

}





async function run() {
  try {
    const usersCollection = client.db('leanAcademyDb').collection('users')
    const classesCollection = client.db('leanAcademyDb').collection('classes')
    const selectedCollection = client.db('leanAcademyDb').collection('selected')

    // generate client secret
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      // console.log(price);
      if (price) {
        const amount = parseFloat(price) * 100
        const paymentIntent = await stripe.paymentIntents.create({
          amount: amount,
          currency: 'usd',
          payment_method_types: ['card']
        })
        res.send({ clientSecret: paymentIntent.client_secret })
      }
    })

     // generate jwt token
     app.post('/jwt', (req, res)=>{
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '7d'})
      // console.log(token);
      res.send({token})
      
      
    })

    // ----------- users related apis --------
    // get all users
    app.get('/users', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    })

    // get all instructors
    app.get('/users/instructors', async (req, res) => {
      const query = { role: 'instructor' };
      const result = await usersCollection.find(query).toArray();
      res.send(result);
    })




    // // verify role
    app.get('/users/role/:email', verifyJWT, async (req, res) => {
      const decodedEmail = req.decoded.email;
      const email = req.params.email;
      const query = { email: email };
      if(email !== decodedEmail){
        return res.status(403).send({error: true, message: 'Forbidden Access'})
      }
      
      
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
      // local server work properly, but vercel deploy shows cors error
      res.setHeader('Access-Control-Allow-Origin', '*') // Allow requests from any origin (replace '*' with the specific origin if needed)
      res.setHeader('Access-Control-Allow-Methods', 'PATCH'); // Allow the PUT method
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow the 'Content-Type' header
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )
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
    app.get('/classes', async (req, res) => {
      const result = await classesCollection.find().toArray()
      res.send(result)
    })

    // app.get('/class/:id', async(req, res)=>{
    //   const id = req.params.id;
    //   const query = {_id: new ObjectId(id)}
    //   const result = await classesCollection.findOne(query)
    //   res.send(result)
    // })





    // get classes for specific email/user
    app.get('/classes/:email', async (req, res) => {
      const email = req.params.email;

      if (!email) {
        return res.status(400).send({ error: 'Invalid email' });
      }

      const query = { email: email };
      const result = await classesCollection.find(query).toArray();

      if (result.length === 0) {
        return res.status(404).send({ error: 'No classes found for this email' });
      }

      res.send(result);
    });


    // add a class
    app.post('/classes', async (req, res) => {
      const allClasses = req.body;
      const result = await classesCollection.insertOne(allClasses)
      res.send(result)
    })

    // update status of a class
    app.patch('/classes/:id', async (req, res) => {
      // local server work properly, but vercel deploy shows cors error
      res.setHeader('Access-Control-Allow-Origin', '*') // Allow requests from any origin (replace '*' with the specific origin if needed)
      res.setHeader('Access-Control-Allow-Methods', 'PATCH'); // Allow the PUT method
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow the 'Content-Type' header
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )
      const id = req.params.id;
      // console.log(id);
      const newStatus = req.body.status;
      // console.log(newStatus);
      const query = { _id: new ObjectId(id) }
      const updateDoc = {
        $set: {
          status: newStatus,
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // decrease seat if select button is clicked on Classes page
    app.patch('/classes/seats/:id', async (req, res) => {
      // local server work properly, but vercel deploy shows cors error
      res.setHeader('Access-Control-Allow-Origin', '*') // Allow requests from any origin (replace '*' with the specific origin if needed)
      res.setHeader('Access-Control-Allow-Methods', 'PATCH'); // Allow the PUT method
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow the 'Content-Type' header
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) }

      const updateDoc = {
        $inc: {
          seats: -1,
        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // // increase seat if delete button is clicked on selectedClasses
    // app.patch('/classes/increaseSeats/:id', async (req, res) => {
    //   const id = req.params.id;
    //   const query = { _id: new ObjectId(id) };
    //   // console.log(id, query)
    //   const updateDoc = {
    //     $inc: {
    //       seats: 1,
    //     },
    //   };
    //   // console.log(updateDoc);
    //   const result = await classesCollection.updateOne(query, updateDoc);
    //   // console.log(result);
    //   res.send(result);
    // });

    // edit a single class
    app.patch('/classes/edit/:id', async (req, res) => {
      // local server work properly, but vercel deploy shows cors error
      res.setHeader('Access-Control-Allow-Origin', '*') // Allow requests from any origin (replace '*' with the specific origin if needed)
      res.setHeader('Access-Control-Allow-Methods', 'PATCH'); // Allow the PUT method
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow the 'Content-Type' header
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )
      const id = req.params.id;
      // console.log(id);
      const query = { _id: new ObjectId(id) }

      const updateDoc = {
        $set: {
          seats: seats,
          price: price,

        },
      };
      const result = await classesCollection.updateOne(query, updateDoc);
      res.send(result);
    });


    // edit a class in db
    app.put('/classes/:id', async (req, res) => {
      // local server work properly, but vercel deploy shows cors error
      res.setHeader('Access-Control-Allow-Origin', '*') // Allow requests from any origin (replace '*' with the specific origin if needed)
      res.setHeader('Access-Control-Allow-Methods', 'PUT'); // Allow the PUT method
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Allow the 'Content-Type' header
      res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
      )
      const { className, image, seats, price } = req.body;
      // console.log(seats, price)

      const filter = { _id: new ObjectId(req.params.id) }
      const options = { upsert: true }
      const updateDoc = {
        $set: {
          className,
          image,
          seats,
          price,
        }
      };
      const result = await classesCollection.updateOne(filter, updateDoc, options)
      res.send(result)
    });



    // ----------- selected related apis --------
    // get all selected class
    app.get('/selected', async (req, res) => {
      const result = await selectedCollection.find().toArray()
      res.send(result)
    })

    // get top 6 popular classes based on enrollment
    app.get('/selected/popular', async (req, res) => {
      const result = await selectedCollection.aggregate([
        {
          $match: {
            transactionId: { $exists: true }
          }
        },
        {
          $group: {
            _id: "$className",
            count: { $sum: 1 },
            image: { $first: "$image" },
            price: { $first: "$price" }
          }
        },
        {
          $sort: {
            count: -1
          }
        },
        {
          $limit: 6
        }
      ]).toArray();

      res.send(result)
    });

    // get enrolled class by instructors email
    app.get('/selected/paid/:email', async (req, res) => {
      const email = req.params.email;
      try {
        const result = await selectedCollection.find({ email: email, transactionId: { $exists: true } }).toArray();
        res.send(result);
      } catch (err) {
        console.log(err);
        res.status(500).send('Error occurred while fetching data');
      }
    });



    // get a single class for a user
    app.get('/selected/:email', async (req, res) => {
      const email = req.params.email;

      if (!email) {
        return res.status(400).send({ error: 'Invalid email' });
      }

      const query = { studentEmail: email };
      const result = await selectedCollection.find(query).toArray();

      // if (result.length === 0) {
      //   return res.status(404).send({ error: 'No classes found for this email' });
      // }

      res.send(result);
    })





    // select a class
    app.post('/selected', async (req, res) => {
      const selectedClasses = req.body;
      const result = await selectedCollection.insertOne(selectedClasses)
      res.send(result)
    })

    // // update transaction id to selected class
    // app.patch('/selected/:id', async (req, res) => {
    //   const { id } = req.params; // get id from parameters
    //   const { transactionId } = req.body; // get transactionId from request body

    //   try {
    //     const result = await selectedCollection.updateOne(
    //       { _id: new ObjectId(id) }, // filter: match the document with the given id
    //       { $set: { transactionId: transactionId } } // update: set the transactionId
    //     );

    //     if (result.matchedCount > 0) {
    //       res.send({ message: 'Successfully updated transactionId' });
    //     } else {
    //       res.status(404).send({ message: 'No document found with that id' });
    //     }
    //   } catch (error) {
    //     res.status(500).send({ error: error.toString() });
    //   }
    // });




    app.delete('/selected/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const result = await selectedCollection.deleteOne(query)
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
