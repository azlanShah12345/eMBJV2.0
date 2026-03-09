import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('Server is reachable!'));
app.listen(3000, '0.0.0.0', () => console.log('Listening on 3000'));
