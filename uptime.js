import express from 'express';

const app = express();

app.get('/', (req, res) => res.send('Online'));

app.get("/", (request, response) => {
  console.log("GET READY");
  response.sendStatus(200);
});

const startServer = () => {
  const port = 3000;
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
};

export default startServer;
