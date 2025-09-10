#!/usr/bin/env python3
"""
Vercel entry point - Minimal handler to avoid all class inspection issues
"""

import json
import os
import sys

# Minimal response function that avoids any class-related imports
def handler(request):
    """Ultra-minimal Vercel handler - no imports, no classes, no WSGI"""
    try:
        # Extract path safely
        if hasattr(request, 'method'):
            method = str(request.method)
            path = str(getattr(request, 'path', '/'))
        elif isinstance(request, dict):
            method = str(request.get('httpMethod', request.get('method', 'GET')))
            path = str(request.get('path', request.get('rawPath', '/')))
        else:
            method = 'GET'
            path = '/'

        # Handle basic endpoints with hardcoded responses
        if '/api/test' in path:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
                },
                'body': '{"message": "Vercel API test endpoint working!", "status": "success", "method": "' + method + '", "path": "' + path + '"}'
            }

        elif '/api/health' in path:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': '{"status": "healthy", "message": "API health check passed", "service": "Laws of Success Academy API"}'
            }

        elif path == '/' or '/api' in path:
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': '{"message": "Laws of Success Academy API", "status": "healthy", "version": "1.0.0"}'
            }

        # For complex endpoints, use delayed import to avoid class inspection
        else:
            return handle_complex_endpoint(path, method, request)

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': '{"error": "Handler Error", "message": "' + str(e).replace('"', '\\"') + '"}'
        }

def handle_complex_endpoint(path, method, request):
    """Handle complex endpoints with delayed Flask import"""
    try:
        # Only import Flask when absolutely necessary
        sys.path.insert(0, os.path.dirname(__file__))
        
        # Import app creation function (not the app itself)
        from app import create_app
        
        # Create fresh app instance
        flask_app = create_app()
        
        # Create minimal WSGI environ
        environ = {
            'REQUEST_METHOD': method,
            'PATH_INFO': path,
            'QUERY_STRING': '',
            'CONTENT_TYPE': 'application/json',
            'CONTENT_LENGTH': '0',
            'SERVER_NAME': 'localhost',
            'SERVER_PORT': '443',
            'wsgi.version': (1, 0),
            'wsgi.url_scheme': 'https',
            'wsgi.input': None,
            'wsgi.errors': None,
            'wsgi.multithread': False,
            'wsgi.multiprocess': False,
            'wsgi.run_once': True
        }
        
        # Response capture
        response_data = {'status': '200 OK', 'headers': [], 'body': b''}
        
        def start_response(status, headers):
            response_data['status'] = status
            response_data['headers'] = headers
        
        # Call Flask app
        with flask_app.app_context():
            result = flask_app.wsgi_app(environ, start_response)
            if result:
                response_data['body'] = b''.join(result)
        
        # Convert to Vercel response
        status_code = int(response_data['status'].split(' ')[0])
        headers = dict(response_data['headers'])
        body = response_data['body'].decode('utf-8') if response_data['body'] else '{}'
        
        return {
            'statusCode': status_code,
            'headers': headers,
            'body': body
        }
        
    except Exception as flask_error:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': '{"error": "Flask Error", "message": "' + str(flask_error).replace('"', '\\"') + '"}'
        }

# Simple function for WSGI compatibility - NO CLASSES AT ALL
def application(environ, start_response):
    """Minimal WSGI function"""
    try:
        path = environ.get('PATH_INFO', '/')
        method = environ.get('REQUEST_METHOD', 'GET')
        
        # Create mock request
        mock_request = {'path': path, 'method': method}
        
        # Call handler
        response = handler(mock_request)
        
        # Return WSGI response
        status = str(response['statusCode']) + ' OK'
        headers = list(response.get('headers', {}).items())
        
        start_response(status, headers)
        return [response['body'].encode('utf-8')]
        
    except Exception as e:
        start_response('500 Internal Server Error', [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ])
        return [b'{"error": "WSGI Error"}']

# Export for Vercel - NO CLASS REFERENCES
app = application

# For testing
if __name__ == '__main__':
    test_request = {'path': '/api/test', 'method': 'GET'}
    result = handler(test_request)
    print("Test result:", result)
