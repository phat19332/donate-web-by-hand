const http = require('http');

const data = JSON.stringify({
    name: 'Victor Final',
    amount: 50000,
    message: 'Testing Final Implementation'
});

const options = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/admin/add-donation',
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length,
        'x-admin-key': 'DLG_REACTOR_2024'
    }
};

const req = http.request(options, (res) => {
    let body = '';
    res.on('data', (chunk) => body += chunk);
    res.on('end', () => {
        console.log('STATUS:', res.statusCode);
        console.log('BODY:', body);
    });
});

req.on('error', (e) => {
    console.error('ERROR:', e.message);
});

req.write(data);
req.end();
