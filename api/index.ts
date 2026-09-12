import app, { checkDbConnection } from '../server/index.js';

let isInitialized = false;

export default async function handler(req: any, res: any) {
  if (!isInitialized) {
    await checkDbConnection();
    isInitialized = true;
  }
  return app(req, res);
}
