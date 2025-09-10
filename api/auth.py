from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets

auth_bp = Blueprint('auth', __name__)

# Import models and utilities
from models import db, User, Parent, Student, validate_phone, validate_email
from utils import send_verification_email, hash_password, verify_password, generate_verification_token

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user (email optional, no verification required)"""
    data = request.get_json()

    # Validate required fields (email is now optional)
    required_fields = ['password', 'full_name', 'phone', 'student_name', 'date_of_birth']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'error': f'{field} is required'}), 400

    # Handle optional email
    email = None
    if 'email' in data and data['email']:
        email = data['email'].lower().strip()
        # Validate email format if provided
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        # Check if email already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'error': 'Email already registered'}), 409

    phone = data['phone'].strip()

    # Validate phone format
    if not validate_phone(phone):
        return jsonify({'error': 'Invalid phone number format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400

    # Create user (email can be None) - Use student's name as the main user identifier
    user = User(
        email=email,
        password_hash=hash_password(data['password']),
        full_name=data['student_name'].strip(),  # Use student's name as the main user name
        phone=phone,
        email_verified=True  # Mark as verified since no verification needed
    )

    db.session.add(user)
    db.session.flush()  # Get user ID

    # Create parent record for client users
    parent = Parent(
        user_id=user.id,
        full_name=data['full_name'].strip(),
        phone=phone,
        email=email  # Can be None
    )
    db.session.add(parent)
    db.session.flush()  # Get parent ID

    # Create student
    try:
        dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    student = Student(
        parent_id=parent.id,
        name=data['student_name'].strip(),
        date_of_birth=dob
    )

    db.session.add(student)
    db.session.commit()

    # Skip email verification - user is immediately active
    return jsonify({
        'message': 'Registration successful. You can now log in to your account.',
        'user_id': user.id
    }), 201

@auth_bp.route('/verify-email', methods=['POST'])
def verify_email():
    """Verify user email with token"""
    data = request.get_json()

    if 'token' not in data:
        return jsonify({'error': 'Verification token is required'}), 400

    user = User.query.filter_by(email_verification_token=data['token']).first()

    if not user:
        return jsonify({'error': 'Invalid or expired verification token'}), 400

    user.email_verified = True
    user.email_verification_token = None
    db.session.commit()

    return jsonify({'message': 'Email verified successfully'}), 200

@auth_bp.route('/login', methods=['POST'])
def login():
    """Authenticate user and return JWT token (supports email or phone login)"""
    data = request.get_json()

    if ('email' not in data or not data['email']) and ('phone' not in data or not data['phone']):
        return jsonify({'error': 'Email or phone number is required'}), 400

    if 'password' not in data:
        return jsonify({'error': 'Password is required'}), 400

    user = None

    # Try to find user by email first
    if 'email' in data and data['email']:
        email = data['email'].lower().strip()
        user = User.query.filter_by(email=email).first()

    # If not found by email, try by phone
    if not user and 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        user = User.query.filter_by(phone=phone).first()

    if not user or not verify_password(user.password_hash, data['password']):
        return jsonify({'error': 'Invalid credentials'}), 401

    # Skip email verification check since it's no longer required
    # Create access token
    access_token = create_access_token(identity=user.id)

    # Get parent and students data for client users
    parent = None
    students = []
    if user.role == 'user':
        parent = Parent.query.filter_by(user_id=user.id).first()
        if parent:
            students = [{
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled
            } for student in parent.students]

    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'role': user.role,
            'email_verified': user.email_verified,
            'mobile_username': parent.mobile_username if parent else None,
            'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
            'students': students,
            'parent_info': {
                'full_name': parent.full_name if parent else None,
                'phone': parent.phone if parent else None,
                'email': parent.email if parent else None
            } if parent else None
        }
    }), 200

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Send password reset email"""
    data = request.get_json()

    if 'email' not in data:
        return jsonify({'error': 'Email is required'}), 400

    email = data['email'].lower().strip()
    user = User.query.filter_by(email=email).first()

    if not user:
        # Don't reveal if email exists or not for security
        return jsonify({'message': 'If the email exists, a password reset link has been sent'}), 200

    # Generate reset token
    reset_token = secrets.token_urlsafe(32)
    user.password_reset_token = reset_token
    user.password_reset_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()

    # Send reset email (implement this in utils.py)
    # send_password_reset_email(user.email, reset_token)

    return jsonify({'message': 'If the email exists, a password reset link has been sent'}), 200

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password with token"""
    data = request.get_json()

    required_fields = ['token', 'new_password']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    user = User.query.filter_by(password_reset_token=data['token']).first()

    if not user or user.password_reset_expires < datetime.utcnow():
        return jsonify({'error': 'Invalid or expired reset token'}), 400

    user.password_hash = hash_password(data['new_password'])
    user.password_reset_token = None
    user.password_reset_expires = None
    db.session.commit()

    return jsonify({'message': 'Password reset successfully'}), 200

@auth_bp.route('/me', methods=['GET'])
@jwt_required()
def get_current_user():
    """Get current authenticated user with associated students"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get associated students for client users
    students = []
    parent = None
    if user.role == 'user':
        parent = Parent.query.filter_by(user_id=user.id).first()
        if parent:
            students = [{
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled
            } for student in parent.students]

    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'role': user.role,
            'email_verified': user.email_verified,
            'mobile_username': parent.mobile_username if parent else None,
            'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
            'students': students,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }
    }), 200

@auth_bp.route('/me/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    # Update allowed fields
    if 'full_name' in data:
        user.full_name = data['full_name'].strip()
    if 'phone' in data:
        phone = data['phone'].strip()
        if not validate_phone(phone):
            return jsonify({'error': 'Invalid phone number format'}), 400
        user.phone = phone

    db.session.commit()

    return jsonify({'message': 'Profile updated successfully'}), 200

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    data = request.get_json()

    if 'current_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Current password and new password are required'}), 400

    if not verify_password(user.password_hash, data['current_password']):
        return jsonify({'error': 'Current password is incorrect'}), 401

    user.password_hash = hash_password(data['new_password'])
    db.session.commit()

    return jsonify({'message': 'Password changed successfully'}), 200
