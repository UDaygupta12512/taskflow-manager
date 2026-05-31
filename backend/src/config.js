require('dotenv').config();

const STAGES = ['Todo', 'In Progress', 'Done'];

module.exports = {
  port: Number(process.env.PORT) || 4000,
  stages: STAGES,
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-change-in-production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
    accessExpires: process.env.ACCESS_TOKEN_EXPIRES || '15m',
    refreshExpires: process.env.REFRESH_TOKEN_EXPIRES || '7d'
  },
  corsOrigin: process.env.CORS_ORIGIN || '*'
};
