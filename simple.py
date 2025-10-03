"""
Ultra-minimal Vercel entry point to avoid any class inspection issues
"""

def app(environ, start_response):
    """Ultra-minimal WSGI app - no imports, no classes"""
    
    path = environ.get('PATH_INFO', '/')
    method = environ.get('REQUEST_METHOD', 'GET')
    
    # Handle test endpoint
    if 'test' in path:
        body = '{"message": "API test working!", "status": "success", "path": "' + path + '"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*'),
            ('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'),
            ('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        ]
    
    # Handle health endpoint  
    elif 'health' in path:
        body = '{"status": "healthy", "message": "API health check", "service": "Laws of Success Academy"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Handle courses filters specifically
    elif 'courses' in path and 'filters' in path:
        body = '{"filters": {"levels": ["Beginner", "Intermediate", "Advanced"], "categories": ["Business", "Technology", "Personal Development"]}, "status": "success"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Handle other courses endpoints
    elif 'courses' in path:
        body = '{"courses": [], "message": "Courses endpoint working", "status": "success"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Handle auth endpoints
    elif 'auth' in path:
        body = '{"message": "Authentication endpoint", "status": "available"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Handle admin endpoints
    elif 'admin' in path:
        body = '{"message": "Admin endpoint", "status": "available"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Handle mobile endpoints
    elif 'mobile' in path:
        body = '{"message": "Mobile endpoint", "status": "available"}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    # Default response
    else:
        body = '{"message": "Laws of Success Academy API", "status": "healthy", "version": "1.0.0", "endpoints": ["/api/test", "/api/health", "/api/courses"]}'
        status = '200 OK'
        headers = [
            ('Content-Type', 'application/json'),
            ('Access-Control-Allow-Origin', '*')
        ]
    
    start_response(status, headers)
    return [body.encode('utf-8')]

# Export for Vercel
application = app
