const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/login',
  method: 'POST',
  headers: { 'Content-Type': 'application/json' }
}, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => {
    try {
      const data = JSON.parse(body);
      const token = data.ztg_token || data.tempToken;
      console.log("Token response:", data);
      
      if (!token) {
        console.log("No token acquired. Exiting.");
        return;
      }
      
      const getReq = http.request({
        hostname: 'localhost',
        port: 5000,
        path: '/api/files/my-files',
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + token }
      }, getRes => {
        let getBody = '';
        getRes.on('data', d => getBody += d);
        getRes.on('end', () => console.log("Files response:", getRes.statusCode, getBody));
      });
      getReq.end();
    } catch (e) {
      console.error("Failed to parse login:", body);
    }
  });
});
req.write(JSON.stringify({ email: 'it.staff1@ztg.com', password: 'password123' }));
req.end();
