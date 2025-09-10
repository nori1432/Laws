# Laws of Success Academy API

A production-ready Flask API for the Laws of Success Academy with mobile app support, QR code attendance tracking, and comprehensive user management.

## 🚀 Features

- **User Authentication**: JWT-based authentication with role-based access control
- **Mobile App Support**: Separate credentials for parents and students
- **QR Code Attendance**: Generate and scan QR codes for class attendance
- **Payment Tracking**: Monitor course payments and due dates
- **Email Notifications**: Automated email notifications for various events
- **Admin Dashboard**: Comprehensive admin panel for managing users, courses, and attendance
- **Production Ready**: Proper error handling, logging, CORS, and security measures

## 📋 Prerequisites

- Python 3.8+
- MySQL 8.0+
- Redis (optional, for rate limiting)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd laws-of-success-api
   ```

2. **Create virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Environment configuration**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Database setup**
   ```bash
   # The application will automatically create tables on first run
   # Make sure your MySQL database is running and accessible
   ```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Flask secret key | Required |
| `DATABASE_URL` | MySQL database URL | Required |
| `JWT_SECRET_KEY` | JWT signing key | Required |
| `MAIL_SERVER` | SMTP server | smtp.gmail.com |
| `MAIL_USERNAME` | Email username | Required |
| `MAIL_PASSWORD` | Email password/app password | Required |
| `FRONTEND_URL` | Frontend application URL | http://localhost:5173 |
| `CORS_ORIGINS` | Allowed CORS origins | localhost URLs |

### Database Configuration

The application uses SQLAlchemy with connection pooling:

```python
SQLALCHEMY_ENGINE_OPTIONS = {
    'pool_pre_ping': True,
    'pool_recycle': 300,
    'pool_size': 10,
    'max_overflow': 20,
}
```

## 🚀 Running the Application

### Development

```bash
# Using Flask development server
python app.py

# Or using Python module
python -m flask run
```

### Production

```bash
# Using Gunicorn
gunicorn --bind 0.0.0.0:5000 --workers 4 app:app

# Or using Docker
docker build -t laws-academy-api .
docker run -p 5000:5000 laws-academy-api
```

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh JWT token

### Mobile Endpoints

- `POST /api/mobile/login` - Mobile app login
- `GET /api/mobile/dashboard` - Get dashboard data
- `POST /api/mobile/attendance/scan` - Scan QR code for attendance

### Admin Endpoints

- `GET /api/admin/users` - List all users
- `POST /api/admin/courses` - Create new course
- `GET /api/admin/attendance` - Get attendance reports

### Health Check

- `GET /` - Basic health check
- `GET /api/health` - Detailed health check with database status

## 🏗️ Project Structure

```
api/
├── app.py                 # Main application file
├── models.py              # Database models
├── requirements.txt       # Python dependencies
├── .env.example          # Environment variables template
├── auth.py               # Authentication blueprint
├── courses.py            # Courses blueprint
├── admin.py              # Admin blueprint
├── mobile.py             # Mobile app blueprint
└── utils.py              # Utility functions
```

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt for password security
- **CORS Protection**: Configurable CORS settings
- **Rate Limiting**: Configurable rate limiting (optional)
- **Input Validation**: Comprehensive input validation
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Proper output encoding

## 📊 Database Models

### Core Models
- **User**: Parent/guardian accounts
- **Student**: Student information
- **Course**: Available courses
- **Class**: Scheduled classes
- **Enrollment**: Student enrollments
- **Attendance**: Attendance records with QR codes
- **Payment**: Payment tracking
- **Notification**: System notifications

### Relationships
- User → Students (One-to-Many)
- Course → Classes (One-to-Many)
- Student → Enrollments (One-to-Many)
- Class → Attendances (One-to-Many)

## 🧪 Testing

```bash
# Run tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html
```

## 📝 Logging

The application uses Python's logging module with:

- File logging (`app.log`)
- Console logging
- Configurable log levels
- Request/response logging
- Error tracking

## 🚀 Deployment

### Docker Deployment

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

### Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, please contact the development team or create an issue in the repository.

## 🔄 API Versioning

The API uses URL versioning:
- Current version: v1
- Future versions will use `/api/v2/` prefix

## 📈 Monitoring

The application includes:
- Health check endpoints
- Request logging
- Error tracking
- Performance monitoring hooks

---

**Built with ❤️ for Laws of Success Academy**
