#!/usr/bin/env python3
"""
Vercel entry point for Laws of Success Academy API
This file imports and exports the Flask app for Vercel deployment
"""

import os
import sys
import logging

# Configure basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set PYTHONPATH for proper module resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
sys.path.insert(0, current_dir)
sys.path.insert(0, parent_dir)

# Set environment variable for better module resolution
os.environ['PYTHONPATH'] = f"{current_dir}:{parent_dir}:{os.environ.get('PYTHONPATH', '')}"

def create_application():
    """Create and return the Flask application"""
    try:
        # Import the Flask app from app.py in the same directory
        logger.info("Attempting to import Flask app from app.py")
        from app import get_app

        # Create the app instance
        app = get_app()
        logger.info("Successfully created Flask app")

        # Ensure it's a proper WSGI application
        if not hasattr(app, 'wsgi_app'):
            logger.warning("App doesn't have wsgi_app attribute, wrapping it")
            from werkzeug.middleware.dispatcher import DispatcherMiddleware
            app.wsgi_app = app.wsgi_app

        return app

    except ImportError as import_error:
        logger.error(f"Import error: {import_error}")
        return create_fallback_app()
    except Exception as e:
        logger.error(f"Unexpected error creating app: {e}")
        return create_fallback_app()

def create_fallback_app():
    """Create a minimal fallback Flask app"""
    from flask import Flask, jsonify

    app = Flask(__name__)

    @app.route('/')
    def fallback_home():
        return jsonify({
            'message': 'Laws of Success Academy API (Fallback Mode)',
            'status': 'limited',
            'note': 'Main application modules could not be loaded'
        })

    @app.route('/api/test')
    def fallback_test():
        return jsonify({
            'message': 'API test endpoint (fallback)',
            'status': 'working',
            'mode': 'fallback'
        })

    @app.route('/api/health')
    def fallback_health():
        return jsonify({
            'status': 'limited',
            'message': 'Health check (fallback mode)',
            'mode': 'fallback'
        })

    @app.route('/api/<path:path>')
    def fallback_api(path):
        return jsonify({
            'error': 'API temporarily unavailable',
            'message': f'Endpoint /{path} not available in fallback mode',
            'status': 503
        }), 503

    logger.warning("Using fallback Flask app")
    return app

# Create the app instance
app = create_application()

# Export for Vercel - ensure it's a proper WSGI application
application = app

# Also export as a function for Vercel compatibility
def handler(environ, start_response):
    """WSGI handler function for Vercel"""
    return application(environ, start_response)

# For Vercel compatibility - create a simple WSGI wrapper
class WSGIApp:
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        return self.wsgi_app(environ, start_response)

# Export wrapped app for maximum compatibility
wsgi_app = WSGIApp(app)

# For debugging
if __name__ == '__main__':
    app.run(debug=True, port=5000)
