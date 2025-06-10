const express = require('express');
const app = express();

app.get('/data', (req, res) => {
    const now = new Date();
    res.json({ data: now.toLocaleString() });
});

app.get('/sobre', (req, res) => {
    res.send('Bem-vindo ao MEU Server! Esta é a página sobre.');
});

app.get('/', (req, res) => {
    res.send('Hello, MEU Server is running!');
});

app.listen(3000, () => {
    console.log('MEU Server is listening on http://localhost:3000');
});