const jsonServer = require('json-server');
const server = jsonServer.create();
const router = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();
const jwt = require('jsonwebtoken');

const SECRET_KEY = 'your-secret-key';

server.use(middlewares);
server.use(jsonServer.bodyParser);

// Login endpoint
server.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = router.db.get('users').find({ email, password }).value();

  if (user) {
    const token = jwt.sign({ id: user.id, email: user.email }, SECRET_KEY);
    res.json({
      status: 'success',
      data: {
        token,
        data: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      }
    });
  } else {
    res.status(400).json({ message: 'Invalid email or password' });
  }
});

// Register endpoint
server.post('/register', (req, res) => {
  const { email, password, name } = req.body;
  
  // Check if user already exists
  const existingUser = router.db.get('users').find({ email }).value();
  if (existingUser) {
    return res.status(400).json({ message: 'User already exists' });
  }

  // Create new user
  const id = router.db.get('users').value().length + 1;
  const newUser = { id, email, password, name };
  
  router.db.get('users').push(newUser).write();
  
  const token = jwt.sign({ id: newUser.id, email: newUser.email }, SECRET_KEY);
  
  res.status(201).json({
    status: 'success',
    data: {
      token,
      data: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    }
  });
});

server.use(router);

server.listen(3001, () => {
  console.log('JSON Server is running on port 3001');
}); 