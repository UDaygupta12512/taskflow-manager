const app = require('./app');
const { port } = require('./config');

app.listen(port, () => {
  console.log(`TaskFlow API running on http://localhost:${port}`);
  console.log(`Docs: http://localhost:${port}/api`);
});
