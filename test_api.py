import requests

# Test the API endpoints
base_url = "http://127.0.0.1:5000"

try:
    # Test root endpoint
    response = requests.get(f"{base_url}/")
    print(f"Root endpoint: {response.status_code}")
    print(f"Response: {response.json()}")

    # Test API test endpoint
    response = requests.get(f"{base_url}/api/test")
    print(f"\nAPI test endpoint: {response.status_code}")
    print(f"Response: {response.json()}")

    # Test health endpoint
    response = requests.get(f"{base_url}/api/health")
    print(f"\nHealth endpoint: {response.status_code}")
    print(f"Response: {response.json()}")

except Exception as e:
    print(f"Error testing endpoints: {e}")
