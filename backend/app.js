import express, { urlencoded } from 'express'
import 'dotenv/config'
import cookieParser from 'cookie-parser';
import cors from 'cors'
import morgan from 'morgan';
import passport from './src/configs/passport/passport.config.js';
import router from './src/routes/routes.js';
import { responseMiddleware } from './src/middlewares/response.middleware.js';
import { localeMiddleware } from './src/middlewares/locale.middleware.js';
import { ErrorMiddlware } from './src/middlewares/error.middleware.js';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import helmet from 'helmet';
import logger, { morganStream } from './logs/logger.js';
import hpp from 'hpp';
import i18n from './src/utils/i18n.util.js';

const app = express();

// Helmet for security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }, 
     directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  })
);

app.use(express.json());

// HTTP request logging via morgan → winston
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev', { stream: morganStream }));


app.use(urlencoded({extended: true}));
app.use(cookieParser());

// API Rate limitting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again after 15 minutes"
});
app.use(limiter);

// Slow down repeated requests before hard-blocking
const speedLimiter = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 50,
    delayMs: (hits) => hits * 100,
});
app.use(speedLimiter);

// Cross origin
const frontendURLs = [
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://127.0.0.1:5500'
];

const corsOptions = {
    origin: (origin, callback) => {
        if (!origin || frontendURLs.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    methods: ['GET', 'POST', 'DELETE', 'PUT', 'PATCH', 'OPTIONS'],
    credentials: true,
};

app.use(cors(corsOptions));
app.options('/{*any}', cors(corsOptions));

// configure the hpp middleware to prevent HTTP Parameter Pollution
app.use(hpp());

// Initialize i18n
app.use(i18n.init);

// Locale detection middleware
app.use(localeMiddleware);

// Initialize passport
app.use(passport.initialize());

// Response Middleware for res.respond()
app.use(responseMiddleware);

// Router 
app.use(router);

// 404 handler
app.use((req, res) => {
    res.respond(404, "Route not found. Please check the URL and try again.");
});

// Error Middelware
app.use(ErrorMiddlware);

export default appgit 