const express = require('express');
const cors = require('cors');
const { initializeConnections } = require('./src/config/database');
const searchRoutes = require('./src/routes/searchRoutes');

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;

app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    credentials: true,
    methods: ['*'],
    allowedHeaders: ['*']
}));

app.use('/', searchRoutes);

app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'NLP Search Platform',
        version: process.env.npm_package_version || '1.0.0'
    });
});

app.get('/', (req, res) => {
    res.json({
        message: 'NLP Search Platform API',
        endpoints: {
            search: 'POST /search',
            health: 'GET /health',
            debug: 'GET /debug/elasticsearch'
        },
        documentation: 'See README.md and DEPLOYMENT_GUIDE.md'
    });
});

async function startServer() {
    await initializeConnections();
    
    app.listen(PORT, 'localhost', () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);
