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

# Add the api directory to Python path for imports
current_dir = os.path.dirname(os.path.abspath(__file__))
api_dir = os.path.join(current_dir, 'api')
sys.path.insert(0, api_dir)
sys.path.insert(0, current_dir)

# Set PYTHONPATH environment variable for better module resolution
os.environ['PYTHONPATH'] = f"{api_dir}:{current_dir}:{os.environ.get('PYTHONPATH', '')}"

def create_application():
    """Create and return the Flask application"""
    try:
        # Import the Flask app from api/app.py
        logger.info("Attempting to import Flask app from api/app.py")
        from app import get_app
        
        # Create the app instance
        app = get_app()
        logger.info("Successfully created Flask app")
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

# Export for Vercel with multiple names for compatibility
application = app
handler = app

# For debugging
if __name__ == '__main__':
    app.run(debug=True, port=5000)