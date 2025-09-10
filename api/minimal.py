#!/usr/bin/env python3
"""
Minimal Vercel entry point - absolute fallback
"""

import json

def app(environ, start_response):
    """Minimal WSGI application"""
    path = environ.get('PATH_INFO', '/')
    
    if 'test' in path:
        response = json.dumps({
            'message': 'Minimal API test working!',
            'status': 'success',
            'path': path
        })
    elif 'health' in path:
        response = json.dumps({
            'status': 'healthy',
            'message': 'Minimal health check'
        })
    else:
        response = json.dumps({
            'message': 'Laws of Success Academy API - Minimal Mode',
            'status': 'healthy',
            'available_endpoints': ['/api/test', '/api/health']
        })
    
    start_response('200 OK', [
        ('Content-Type', 'application/json'),
        ('Access-Control-Allow-Origin', '*'),
        ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
        ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    ])
    
    return [response.encode('utf-8')]

# Export for Vercel
application = app
