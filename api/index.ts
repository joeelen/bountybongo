import app, { checkDbConnection } from '../server/index.js';

let isInitialized = false;

export default async function handler(req: any, res: any) {
  const vercelPath = req.headers['x-matched-path'] || req.headers['x-now-route-matches'];
  if (vercelPath && typeof vercelPath === 'string' && vercelPath.startsWith('/api')) {
    req.url = vercelPath;
  }
  if (!isInitialized) {
    await checkDbConnection();
    isInitialized = true;
  }
  return app(req, res);
}
