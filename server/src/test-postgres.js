import { testDbConnection } from './config/db.postgres.js';

testDbConnection()
  .then(() => {
    console.log('Prueba completada');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error conectando a PostgreSQL:', error);
    process.exit(1);
  });