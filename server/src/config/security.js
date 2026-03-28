import { env } from './env.js';

export const securityConfig = {
  sessionHours: env.authSessionHours,
};

export default securityConfig;
