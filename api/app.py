import os
import logging
import time
from datetime import timedelta
from flask import Flask, request, jsonify, g
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity
from flask_mail import Mail
from flask_cors import CORS
# from werkzeug.middleware.proxy_fix import ProxyFix  # Commented out for Vercel compatibility

# Import models and database
from models import db

# Import blueprints
from auth import auth_bp
from courses import courses_bp
from admin import admin_bp
from mobile import mobile_bp
from contact import contact_bp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class Config:
    """Application configuration class"""

    # Flask
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'

    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'mysql+pymysql://avnadmin:AVNS_KUiCMFzJ3QHxBt_jkJW@mysql-31a284a2-s7304690-462f.i.aivencloud.com:27671/defaultdb'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 3,  # Further reduced pool size
        'max_overflow': 5,  # Further reduced max overflow
        'connect_args': {
            'connect_timeout': 30,  # Increased timeout to 30 seconds
            'read_timeout': 30,
            'write_timeout': 30,
            'autocommit': True,
        },
        'pool_timeout': 30,  # Connection pool timeout
        'pool_pre_ping': True,  # Test connections before using them
    }

    # JWT
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY') or 'jwt-dev-secret-change-in-production'
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=1)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=30)

    # Email
    MAIL_SERVER = os.environ.get('MAIL_SERVER') or 'smtp.gmail.com'
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'True').lower() == 'true'
    MAIL_USE_SSL = os.environ.get('MAIL_USE_SSL', 'False').lower() == 'true'
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME') or 'ghre9t@gmail.com'
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD') or 'dunc uxxp rlqs xwnu'
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER') or 'ghre9t@gmail.com'

    # Frontend
    FRONTEND_URL = os.environ.get('FRONTEND_URL') or 'http://localhost:5173'

    # CORS
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', 'http://localhost:5173,http://localhost:3000,http://localhost:8081,http://localhost:19000,http://localhost:19001,http://localhost:19002,http://localhost:19003,http://localhost:19004,http://localhost:19005,http://localhost:19006,https://laws-of-success.vercel.app,https://laws-of-success-*.vercel.app').split(',')

    # Rate Limiting
    RATELIMIT_STORAGE_URI = os.environ.get('REDIS_URL') or 'memory://'

    # File Upload
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    # Security
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'False').lower() == 'true'
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'

# Global instances for use in blueprints and utilities
jwt = None
mail = None

def register_jwt_error_handlers(jwt_manager):
    """Register JWT error handlers"""
    @jwt_manager.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        logger.warning("Expired JWT token used")
        return jsonify({
            'error': 'Token Expired',
            'message': 'Your session has expired. Please login again.'
        }), 401

    @jwt_manager.invalid_token_loader
    def invalid_token_callback(error):
        logger.warning(f"Invalid JWT token: {error}")
        return jsonify({
            'error': 'Invalid Token',
            'message': 'Invalid authentication token'
        }), 401

    @jwt_manager.unauthorized_loader
    def unauthorized_callback(error):
        logger.warning(f"Unauthorized access: {error}")
        return jsonify({
            'error': 'Authorization Required',
            'message': 'Authentication token is required'
        }), 401

def create_app(config_class=Config):
    """Application factory pattern"""
    app = Flask(__name__)

    # Load configuration
    app.config.from_object(config_class)

    # Initialize extensions
    try:
        db.init_app(app)
        global jwt, mail
        jwt = JWTManager(app)
        mail = Mail(app)
        
        # Attach mail to app instance for use in utils
        app.mail = mail

        # Register JWT error handlers
        register_jwt_error_handlers(jwt)

        # Configure CORS
        CORS(app, resources={
            r"/api/*": {
                "origins": app.config['CORS_ORIGINS'],
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
                "expose_headers": ["Content-Range", "X-Total-Count"],
                "supports_credentials": True
            }
        })

        # Register blueprints with error handling
        try:
            app.register_blueprint(auth_bp, url_prefix='/api/auth')
            app.register_blueprint(courses_bp, url_prefix='/api/courses')
            app.register_blueprint(admin_bp, url_prefix='/api/admin')
            app.register_blueprint(mobile_bp, url_prefix='/api/mobile')
            app.register_blueprint(contact_bp, url_prefix='/api/contact')
        except Exception as blueprint_error:
            logger.warning(f"Blueprint registration failed: {blueprint_error}")

        # Register error handlers
        register_error_handlers(app)

        # Register request handlers
        register_request_handlers(app)

        # Create database tables only if not in serverless environment
        if not os.environ.get('VERCEL'):
            try:
                with app.app_context():
                    db.create_all()
                    logger.info("Database tables created/verified")
            except Exception as db_error:
                logger.warning(f"Database initialization failed: {db_error}")

        # Register routes
        register_routes(app)

        logger.info("Flask application initialized successfully")
        
    except Exception as init_error:
        logger.error(f"Flask app initialization error: {init_error}")
        # Create minimal app if full initialization fails
        register_routes(app)
    
    return app

def register_error_handlers(app):
    """Register global error handlers"""

    @app.errorhandler(400)
    def bad_request(error):
        logger.warning(f"Bad Request: {error}")
        return jsonify({
            'error': 'Bad Request',
            'message': str(error)
        }), 400

    @app.errorhandler(401)
    def unauthorized(error):
        logger.warning(f"Unauthorized: {error}")
        return jsonify({
            'error': 'Unauthorized',
            'message': 'Authentication required'
        }), 401

    @app.errorhandler(403)
    def forbidden(error):
        logger.warning(f"Forbidden: {error}")
        return jsonify({
            'error': 'Forbidden',
            'message': 'Access denied'
        }), 403

    @app.errorhandler(404)
    def not_found(error):
        logger.warning(f"Not Found: {error}")
        return jsonify({
            'error': 'Not Found',
            'message': 'Resource not found'
        }), 404

    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        logger.warning(f"Rate limit exceeded: {error}")
        return jsonify({
            'error': 'Rate Limit Exceeded',
            'message': 'Too many requests. Please try again later.'
        }), 429

    @app.errorhandler(500)
    def internal_server_error(error):
        logger.error(f"Internal Server Error: {error}", exc_info=True)
        return jsonify({
            'error': 'Internal Server Error',
            'message': 'An unexpected error occurred'
        }), 500

def register_request_handlers(app):
    """Register request/response handlers"""

    @app.before_request
    def before_request():
        """Log incoming requests"""
        g.start_time = time.time()
        logger.info(f"Request: {request.method} {request.path} from {request.remote_addr}")

    @app.after_request
    def after_request(response):
        """Log response details"""
        if hasattr(g, 'start_time'):
            duration = time.time() - g.start_time
            logger.info(f"Response: {response.status_code} in {duration:.4f}s")
        return response

def register_routes(app):
    """Register application routes"""

    @app.route('/')
    def hello():
        """Health check endpoint"""
        return jsonify({
            'message': 'Laws of Success Academy API',
            'status': 'healthy',
            'version': '1.0.0',
            'timestamp': time.time()
        })

    @app.route('/api/test')
    def test_endpoint():
        """Simple test endpoint for Vercel deployment"""
        return jsonify({
            'message': 'Vercel API test endpoint',
            'status': 'working',
            'timestamp': time.time()
        })

    @app.route('/api/health')
    def health_check():
        """Detailed health check"""
        try:
            # Test database connection
            db.session.execute(db.text('SELECT 1'))
            db_status = 'healthy'
        except Exception as e:
            db_status = f'unhealthy: {str(e)}'

        return jsonify({
            'status': 'healthy' if db_status == 'healthy' else 'unhealthy',
            'database': db_status,
            'timestamp': time.time()
        }), 200 if db_status == 'healthy' else 503

    @app.route('/api/contact', methods=['POST'])
    # @limiter.limit("5 per minute")  # Commented out - requires flask-limiter
    def contact():
        """Handle contact form submissions with rate limiting"""
        try:
            data = request.get_json()

            # Validate required fields
            required_fields = ['name', 'email', 'subject', 'message']
            for field in required_fields:
                if field not in data or not data[field].strip():
                    return jsonify({
                        'error': 'Validation Error',
                        'message': f'{field} is required and cannot be empty'
                    }), 400

            # Sanitize input
            name = data['name'].strip()[:100]
            email = data['email'].strip()[:120]
            subject = data['subject'].strip()[:200]
            message = data['message'].strip()[:1000]

            # Log contact form submission
            logger.info(f"Contact form submission from {email}: {subject}")

            # Here you could save to database or send email
            # For now, just return success
            return jsonify({
                'message': 'Thank you for your message. We will get back to you soon!',
                'success': True
            }), 200

        except Exception as e:
            logger.error(f"Contact form error: {e}")
            return jsonify({
                'error': 'Internal Server Error',
                'message': 'Failed to process contact form'
            }), 500

# Create the application instance
app = None

def get_app():
    """Get or create Flask app instance"""
    global app
    if app is None:
        app = create_app()
    return app

if __name__ == '__main__':
    # Development server configuration
    app_instance = get_app()
    app_instance.run(
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=app_instance.config['DEBUG'],
        threaded=True,
        use_reloader=app_instance.config['DEBUG']
    )
