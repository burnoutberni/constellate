import 'dotenv/config';
import { app } from '../src/server.js';

console.log('Registered Routes:');
console.log('------------------');

app.routes.forEach((route) => {
    console.log(`${route.method} ${route.path} -> ${route.handler.name || 'anonymous'}`);
});

console.log('------------------');
console.log(`Total: ${app.routes.length} routes`);
