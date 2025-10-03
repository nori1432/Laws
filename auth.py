from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import secrets

auth_bp = Blueprint('auth', __name__)

# Import models and utilities
from models import db, User, Parent, Student, Enrollment, SectionEnrollment, validate_phone, validate_email
from utils import send_verification_email, hash_password, verify_password, generate_verification_token, generate_parent_mobile_credentials, generate_student_mobile_credentials
from imgbb_uploader import upload_profile_picture

def auto_generate_mobile_credentials_if_eligible(student_id):
    """
    Automatically generate mobile credentials for student and parent if conditions are met:
    - Student has at least one approved (non-pending) enrollment
    - Student has complete parent information (full_name, phone, email not null)
    - Credentials don't already exist
    
    Returns: dict with generation status and credentials (if generated)
    """
    try:
        student = Student.query.get(student_id)
        if not student:
            return {'generated': False, 'reason': 'Student not found'}
        
        # Check if student already has mobile credentials
        if student.mobile_username and student.mobile_password_hash:
            return {'generated': False, 'reason': 'Student credentials already exist'}
        
        # Check for at least one approved enrollment
        approved_enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            status='approved',
            is_active=True
        ).first()
        
        if not approved_enrollment:
            return {'generated': False, 'reason': 'No approved enrollment found'}
        
        # Check parent info completeness
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        if not parent:
            return {'generated': False, 'reason': 'No parent found'}
        
        if not all([parent.full_name, parent.phone, parent.email]):
            return {'generated': False, 'reason': 'Parent information incomplete'}
        
        result = {
            'generated': False,
            'student_credentials': None,
            'parent_credentials': None
        }
        
        # Generate student credentials if needed
        if not student.mobile_username and student.name:
            student_password = generate_student_mobile_credentials(student.name)
            student.mobile_password_hash = hash_password(student_password)
            student.mobile_password_plain = student_password
            student.mobile_app_enabled = True
            result['student_credentials'] = {
                'password': student_password
            }
            result['generated'] = True
            print(f"✅ [AUTO_GEN] Generated student credentials for student {student_id}")
        
        # Generate parent credentials if needed
        if not parent.mobile_username:
            parent_password = generate_parent_mobile_credentials(parent.full_name)
            parent.mobile_password_hash = hash_password(parent_password)
            parent.mobile_password_plain = parent_password
            parent.mobile_app_enabled = True
            result['parent_credentials'] = {
                'password': parent_password
            }
            result['generated'] = True
            print(f"✅ [AUTO_GEN] Generated parent credentials for parent {parent.id}")
        
        if result['generated']:
            db.session.commit()
            print(f"✅ [AUTO_GEN] Successfully generated mobile credentials for student {student_id}")
        
        return result
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ [AUTO_GEN] Error generating credentials: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'generated': False, 'reason': f'Error: {str(e)}'}

@auth_bp.route('/register', methods=['POST'])
def register():
    """Register a new user (email optional, no verification required)"""
    data = request.get_json()

    # Validate required fields (email is now optional)
    required_fields = ['password', 'full_name', 'phone', 'parent_phone', 'student_name', 'gender', 'date_of_birth']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'error': f'{field} is required'}), 400

    # Validate gender
    if data['gender'] not in ['male', 'female']:
        return jsonify({'error': 'Gender must be either male or female'}), 400

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
    parent_phone = data['parent_phone'].strip()

    # Validate phone formats
    if not validate_phone(phone):
        return jsonify({'error': 'Invalid student phone format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400
        
    if not validate_phone(parent_phone):
        return jsonify({'error': 'Invalid parent phone format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400

    # Create user (representing the student)
    user = User(
        email=email,
        password_hash=hash_password(data['password']),
        full_name=data['student_name'].strip(),  # Use student's name as the main user name
        phone=phone,
        gender=data['gender'],  # Store student gender in users table
        email_verified=True  # Mark as verified since no verification needed
    )

    db.session.add(user)
    db.session.flush()  # Get user ID

    # Create parent record using the provided parent information
    parent = Parent(
        user_id=user.id,  # Parent shares the same user account as student
        full_name=data['full_name'].strip(),
        phone=parent_phone,  # Use parent's phone number
        email=email  # Can be None
    )
    db.session.add(parent)
    db.session.flush()  # Get parent ID

    # Create student linked to the user
    try:
        dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

    student = Student(
        parent_id=parent.id,
        user_id=user.id,  # Link student directly to user
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

@auth_bp.route('/complete-profile', methods=['POST'])
@jwt_required()
def complete_profile1():
    """Complete missing profile information after login"""
    data = request.get_json()
    user_id = get_jwt_identity()
    
    try:
        # Get user and student record
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        student = Student.query.filter_by(user_id=user_id).first()
        if not student:
            return jsonify({'error': 'Student record not found'}), 404

        # Update student phone if provided
        if 'student_phone' in data and data['student_phone']:
            if not validate_phone(data['student_phone']):
                return jsonify({'error': 'Invalid student phone format'}), 400
            user.phone = data['student_phone']

        # Update date of birth if provided
        if 'date_of_birth' in data and data['date_of_birth']:
            try:
                dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
                student.date_of_birth = dob
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400

        # Handle parent information
        if 'parent_name' in data or 'parent_phone' in data:
            parent = Parent.query.filter_by(user_id=user_id).first()
            
            if not parent:
                # Create new parent record
                if 'parent_name' not in data or not data['parent_name']:
                    return jsonify({'error': 'Parent name is required'}), 400
                if 'parent_phone' not in data or not data['parent_phone']:
                    return jsonify({'error': 'Parent phone is required'}), 400
                    
                if not validate_phone(data['parent_phone']):
                    return jsonify({'error': 'Invalid parent phone format'}), 400
                
                parent = Parent(
                    user_id=user_id,
                    full_name=data['parent_name'].strip(),
                    phone=data['parent_phone'],
                    email=user.email
                )
                db.session.add(parent)
                db.session.flush()  # Get parent ID
                
                # Update student parent_id
                student.parent_id = parent.id
                
            else:
                # Update existing parent
                if 'parent_name' in data and data['parent_name']:
                    parent.full_name = data['parent_name'].strip()
                if 'parent_phone' in data and data['parent_phone']:
                    if not validate_phone(data['parent_phone']):
                        return jsonify({'error': 'Invalid parent phone format'}), 400
                    parent.phone = data['parent_phone']

        db.session.commit()
        
        return jsonify({'message': 'Profile completed successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': 'Failed to complete profile'}), 500


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
    print("Web login attempt received")
    data = request.get_json()
    print(f"Login data: {data}")

    if ('email' not in data or not data['email']) and ('phone' not in data or not data['phone']):
        print("Missing email or phone")
        return jsonify({'error': 'Email or phone number is required'}), 400

    if 'password' not in data:
        print("Missing password")
        return jsonify({'error': 'Password is required'}), 400

    user = None

    # Try to find user by email first
    if 'email' in data and data['email']:
        email = data['email'].lower().strip()
        print(f"Attempting login with email: {email}")
        user = User.query.filter_by(email=email).first()
        print(f"User found by email: {user is not None}")
        if user:
            print(f"User ID: {user.id}, Full name: {user.full_name}")

    # If not found by email, try by phone
    if not user and 'phone' in data and data['phone']:
        phone = data['phone'].strip()
        print(f"Attempting login with phone: {phone}")
        user = User.query.filter_by(phone=phone).first()
        print(f"User found by phone: {user is not None}")
        if user:
            print(f"User ID: {user.id}, Full name: {user.full_name}")

    if not user:
        print("No user found")
        return jsonify({'error': 'Invalid credentials. Please complete your profile setup first or use the barcode login.'}), 401
        
    if not verify_password(user.password_hash, data['password']):
        print("Password verification failed")
        return jsonify({'error': 'Invalid credentials'}), 401

    print("Login successful")
    # Skip email verification check since it's no longer required
    # Create access token
    access_token = create_access_token(identity=str(user.id))

    # Get parent and students data for client users
    parent = None
    students = []
    student_records = []
    
    if user.role == 'user':
        parent = Parent.query.filter_by(user_id=user.id).first()
        if parent:
            student_records = parent.students
            students = [{
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'mobile_username': student.mobile_username,
                'mobile_password': student.mobile_password_plain,
                'mobile_app_enabled': student.mobile_app_enabled
            } for student in student_records]
    
    # Check if profile is incomplete
    profile_incomplete = False
    if user.role == 'user':
        # Check required user fields (phone, full_name are essential, email is optional)
        if not user.full_name or not user.phone:
            profile_incomplete = True
            print(f"⚠️ User {user.id} missing essential info - name: {bool(user.full_name)}, phone: {bool(user.phone)}")
        # Check if parent exists at all
        if not parent:
            profile_incomplete = True
            print(f"⚠️ User {user.id} has NO parent record")
        # Check parent info if parent exists
        elif not parent.full_name or not parent.phone:
            profile_incomplete = True
            print(f"⚠️ Parent for user {user.id} missing essential info - name: {bool(parent.full_name)}, phone: {bool(parent.phone)}")
        # Check student info (date_of_birth is essential)
        if student_records:
            for student in student_records:
                if not student.name or not student.date_of_birth:
                    profile_incomplete = True
                    print(f"⚠️ Student {student.id} missing essential info - name: {bool(student.name)}, birth_date: {bool(student.date_of_birth)}")
                    break

    return jsonify({
        'access_token': access_token,
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'gender': user.gender,
            'role': user.role,
            'email_verified': user.email_verified,
            'profile_picture_url': user.profile_picture_url,
            'profile_incomplete': profile_incomplete,
            'mobile_username': parent.mobile_username if parent else None,
            'mobile_password': parent.mobile_password_plain if parent else None,
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
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Get associated students for client users
    students = []
    parent = None
    student_records = []
    if user.role == 'user':
        parent = Parent.query.filter_by(user_id=user.id).first()
        if parent:
            student_records = parent.students
            students = [{
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'mobile_username': student.mobile_username,
                'mobile_password': student.mobile_password_plain,  # Return unhashed password
                'mobile_app_enabled': student.mobile_app_enabled
            } for student in student_records]

    # Check if profile is incomplete (same logic as login endpoint)
    profile_incomplete = False
    if user.role == 'user':
        # Check required user fields
        if not user.full_name or not user.phone:
            profile_incomplete = True
            print(f"⚠️ [/me] User {user.id} missing essential info - name: {bool(user.full_name)}, phone: {bool(user.phone)}")
        # Check if parent exists at all
        if not parent:
            profile_incomplete = True
            print(f"⚠️ [/me] User {user.id} has NO parent record")
        # Check parent info if parent exists
        elif not parent.full_name or not parent.phone:
            profile_incomplete = True
            print(f"⚠️ [/me] Parent for user {user.id} missing essential info - name: {bool(parent.full_name)}, phone: {bool(parent.phone)}")
        # Check student info (date_of_birth is essential)
        if student_records:
            for student in student_records:
                if not student.name or not student.date_of_birth:
                    profile_incomplete = True
                    print(f"⚠️ [/me] Student {student.id} missing essential info - name: {bool(student.name)}, birth_date: {bool(student.date_of_birth)}")
                    break

    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'role': user.role,
            'email_verified': user.email_verified,
            'profile_incomplete': profile_incomplete,
            'mobile_username': parent.mobile_username if parent else None,
            'mobile_password': parent.mobile_password_plain if parent else None,  # Return unhashed password
            'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
            'students': students,
            'parent_info': {
                'full_name': parent.full_name if parent else None,
                'email': parent.email if parent else None,
                'phone': parent.phone if parent else None
            } if parent else None,
            'created_at': user.created_at.isoformat() if user.created_at else None
        }
    }), 200

@auth_bp.route('/me/profile', methods=['PUT'])
@jwt_required()
def update_profile():
    """Update user profile"""
    user_id = int(get_jwt_identity())
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
    if 'email' in data:
        email = data['email'].strip().lower()
        if not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        # Check if email is already taken by another user
        existing_user = User.query.filter_by(email=email).first()
        if existing_user and existing_user.id != user_id:
            return jsonify({'error': 'Email already exists'}), 400
        user.email = email

    db.session.commit()

    return jsonify({'message': 'Profile updated successfully'}), 200

@auth_bp.route('/me/profile/students', methods=['GET'])
@jwt_required()
def get_my_students():
    """Get all students for the current user (their enrollments)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # For parent users, get their students' enrollments
    # For student users, get their own enrollments
    if user.role == 'user':
        # This is a parent user, get their students
        parent = Parent.query.filter_by(user_id=user_id).first()
        if parent:
            students = parent.students
        else:
            students = []
    else:
        # This might be a student user, find the student record
        student = Student.query.filter_by(user_id=user_id).first()
        students = [student] if student else []

    enrollments_data = []
    for student in students:
        if student:
            enrollments = Enrollment.query.filter_by(student_id=student.id).all()
            for enrollment in enrollments:
                enrollments_data.append({
                    'id': enrollment.id,
                    'student_name': enrollment.student.name if enrollment.student else 'Unknown',
                    'course_name': enrollment.class_.course.name if enrollment.class_ and enrollment.class_.course else 'Unknown',
                    'section_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
                    'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                    'payment_type': enrollment.payment_type,
                    'monthly_sessions_attended': enrollment.monthly_sessions_attended,
                    'monthly_payment_status': enrollment.monthly_payment_status,
                    'is_active': enrollment.is_active
                })

    return jsonify({
        'enrollments': enrollments_data,
        'total_enrollments': len(enrollments_data),
        'active_enrollments': len([e for e in enrollments_data if e['is_active']])
    }), 200

@auth_bp.route('/me/profile/students/<int:student_id>', methods=['PUT'])
@jwt_required()
def update_student_profile(student_id):
    """Update a specific student's profile (parent only)"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Find parent associated with this user
    parent = Parent.query.filter_by(user_id=user_id).first()
    if not parent:
        return jsonify({'error': 'Parent profile not found'}), 404

    # Find the student and verify it belongs to this parent
    student = Student.query.filter_by(id=student_id, parent_id=parent.id).first()
    if not student:
        return jsonify({'error': 'Student not found or access denied'}), 404

    data = request.get_json()

    # Update student fields
    if 'name' in data:
        student.name = data['name'].strip()
    if 'email' in data:
        email = data['email'].strip().lower() if data['email'] else None
        if email and not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        # Store student's personal email in contact_info JSON field
        if student.contact_info is None:
            student.contact_info = {}
        student.contact_info['email'] = email
    if 'phone' in data:
        phone = data['phone'].strip() if data['phone'] else None
        if phone and not validate_phone(phone):
            return jsonify({'error': 'Invalid phone number format'}), 400
        # Store student's personal phone in contact_info JSON field
        if student.contact_info is None:
            student.contact_info = {}
        student.contact_info['phone'] = phone
    if 'date_of_birth' in data:
        if data['date_of_birth']:
            try:
                dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
                student.date_of_birth = dob
            except ValueError:
                return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
        else:
            student.date_of_birth = None

    db.session.commit()

    return jsonify({
        'message': 'Student profile updated successfully',
        'student': {
            'id': student.id,
            'name': student.name,
            'email': student.contact_info.get('email') if student.contact_info else None,
            'phone': student.contact_info.get('phone') if student.contact_info else None,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
        }
    }), 200

@auth_bp.route('/me/profile/parent', methods=['GET'])
@jwt_required()
def get_parent_profile():
    """Get parent profile information"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Find parent associated with this user
    parent = Parent.query.filter_by(user_id=user_id).first()
    
    # If no direct parent association, check if user is a student and find their parent
    if not parent:
        student = Student.query.filter_by(user_id=user_id).first()
        if student and student.parent:
            parent = student.parent

    if not parent:
        return jsonify({'error': 'Parent profile not found'}), 404

    return jsonify({
        'id': parent.id,
        'full_name': parent.full_name,
        'email': parent.email,
        'phone': parent.phone,
        'created_at': parent.created_at.isoformat() if parent.created_at else None
    }), 200

@auth_bp.route('/me/profile/parent', methods=['PUT'])
@jwt_required()
def update_parent_profile():
    """Update parent profile information"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Find parent associated with this user
    parent = Parent.query.filter_by(user_id=user_id).first()
    
    # If no direct parent association, check if user is a student and find their parent
    if not parent:
        student = Student.query.filter_by(user_id=user_id).first()
        if student and student.parent:
            parent = student.parent

    if not parent:
        return jsonify({'error': 'Parent profile not found'}), 404

    data = request.get_json()

    # Update parent fields
    if 'full_name' in data:
        parent.full_name = data['full_name'].strip()
    if 'email' in data:
        email = data['email'].strip().lower() if data['email'] else None
        if email and not validate_email(email):
            return jsonify({'error': 'Invalid email format'}), 400
        parent.email = email
    if 'phone' in data:
        phone = data['phone'].strip() if data['phone'] else None
        if phone and not validate_phone(phone):
            return jsonify({'error': 'Invalid phone number format'}), 400
        parent.phone = phone

    db.session.commit()

    return jsonify({
        'message': 'Parent profile updated successfully',
        'parent': {
            'id': parent.id,
            'full_name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone
        }
    }), 200

@auth_bp.route('/me/profile/students/<int:student_id>/birthday', methods=['PUT'])
@jwt_required()
def update_student_birthday(student_id):
    """Update a specific student's birthday"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Find parent associated with this user
    parent = Parent.query.filter_by(user_id=user_id).first()
    if not parent:
        return jsonify({'error': 'Parent profile not found'}), 404

    # Find the student and verify it belongs to this parent
    student = Student.query.filter_by(id=student_id, parent_id=parent.id).first()
    if not student:
        return jsonify({'error': 'Student not found or access denied'}), 404

    data = request.get_json()

    # Update student birthday
    if 'date_of_birth' in data:
        try:
            dob = datetime.strptime(data['date_of_birth'], '%Y-%m-%d').date()
            student.date_of_birth = dob
            db.session.commit()
            
            return jsonify({
                'message': 'Birthday updated successfully',
                'student': {
                    'id': student.id,
                    'name': student.name,
                    'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
                }
            }), 200
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
    else:
        return jsonify({'error': 'date_of_birth is required'}), 400


@auth_bp.route('/generate-mobile-credentials', methods=['POST'])
@jwt_required()
def generate_mobile_credentials_for_user():
    """Generate mobile credentials for students with approved enrollments and complete parent data"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Find parent associated with this user
        parent = Parent.query.filter_by(user_id=user_id).first()
        if not parent:
            return jsonify({'error': 'Parent profile not found'}), 404

        credentials_generated = False
        generated_for = []

        # Check if parent needs credentials
        if not parent.mobile_username or not parent.mobile_password_hash:
            # Verify parent has complete data
            if parent.full_name and parent.phone and parent.email:
                parent_password = generate_parent_mobile_credentials(parent.full_name)
                parent.mobile_password_hash = hash_password(parent_password)
                parent.mobile_password_plain = parent_password
                parent.mobile_app_enabled = True
                credentials_generated = True
                generated_for.append(f'Parent ({parent.full_name})')

        # Check each student
        for student in parent.students:
            # Skip if student already has credentials
            if student.mobile_username and student.mobile_password_hash:
                continue

            # Check if student has approved enrollment
            approved_enrollment = SectionEnrollment.query.filter_by(
                student_id=student.id,
                enrollment_status='approved'
            ).first()

            # Generate credentials if:
            # 1. Student has approved enrollment
            # 2. Parent data is complete
            # 3. Student has birthday set
            if (approved_enrollment and 
                parent.full_name and parent.phone and parent.email and
                student.date_of_birth):
                
                student_password = generate_student_mobile_credentials(student.name)
                student.mobile_password_hash = hash_password(student_password)
                student.mobile_password_plain = student_password
                student.mobile_app_enabled = True
                credentials_generated = True
                generated_for.append(f'Student ({student.name})')

        if credentials_generated:
            db.session.commit()
            return jsonify({
                'credentials_generated': True,
                'message': f'Mobile credentials generated for: {", ".join(generated_for)}',
                'generated_for': generated_for
            }), 200
        else:
            return jsonify({
                'credentials_generated': False,
                'message': 'No credentials needed or requirements not met'
            }), 200

    except Exception as e:
        print(f"❌ [GENERATE_CREDENTIALS] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        db.session.rollback()
        return jsonify({'error': f'Failed to generate credentials: {str(e)}'}), 500


@auth_bp.route('/me/profile/complete', methods=['GET'])
@jwt_required()
def get_complete_profile():
    """Get complete profile information including user, parent, and all students"""
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user:
        return jsonify({'error': 'User not found'}), 404

    # Find parent associated with this user
    parent = Parent.query.filter_by(user_id=user_id).first()

    profile_data = {
        'user': {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone': user.phone,
            'role': user.role,
            'email_verified': user.email_verified,
            'created_at': user.created_at.isoformat() if user.created_at else None
        },
        'parent': None,
        'students': []
    }

    if parent:
        profile_data['parent'] = {
            'id': parent.id,
            'full_name': parent.full_name,
            'email': parent.email,
            'phone': parent.phone,
            'mobile_username': parent.mobile_username,
            'mobile_app_enabled': parent.mobile_app_enabled
        }

        # Get all students for this parent
        students = Student.query.filter_by(parent_id=parent.id).all()
        for student in students:
            profile_data['students'].append({
                'id': student.id,
                'name': student.name,
                'email': student.contact_info.get('email') if student.contact_info else None,
                'phone': student.contact_info.get('phone') if student.contact_info else None,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled,
                'created_at': student.created_at.isoformat() if student.created_at else None
            })

    return jsonify(profile_data), 200

@auth_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_password():
    """Change user password"""
    user_id = int(get_jwt_identity())
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

@auth_bp.route('/validate-barcode', methods=['POST'])
def validate_barcode():
    """Validate student barcode and return student info
    
    This endpoint ONLY validates the barcode exists in the system.
    It doesn't check for phone numbers or existing users.
    User will set up phone/password in the next step.
    """
    data = request.get_json()

    if 'barcode' not in data or not data['barcode']:
        return jsonify({'error': 'Barcode is required'}), 400

    barcode = data['barcode'].strip()

    # ✅ FIND STUDENT BY BARCODE ONLY
    student = Student.query.filter_by(barcode=barcode).first()

    if not student:
        print(f"❌ [VALIDATE_BARCODE] Invalid barcode: {barcode}")
        return jsonify({'error': 'Invalid barcode'}), 404

    print(f"✅ [VALIDATE_BARCODE] Barcode validated for student {student.id}: {student.name or 'Unknown'}")
    
    # Get parent information (if exists)
    parent = Parent.query.get(student.parent_id) if student.parent_id else None

    # Return student information (no token needed - we find by barcode only)
    student_info = {
        'id': student.id,
        'name': student.name,
        'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
        'parent_name': parent.full_name if parent else None,
        'parent_email': parent.email if parent else None,
        'parent_phone': parent.phone if parent else None,
        'qr_setup_complete': student.qr_setup_complete
    }

    return jsonify({'student': student_info}), 200

@auth_bp.route('/barcode-setup-login', methods=['POST'])
def barcode_setup_login():
    """Complete barcode setup with phone and password (one-time setup after barcode scan)
    
    KEY POINT: User is setting up their phone/password for the FIRST TIME via barcode.
    We find them by BARCODE only, not by phone (phone doesn't exist in DB yet).
    """
    try:
        data = request.get_json()

        required_fields = ['barcode', 'phone', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        barcode = data['barcode'].strip()
        phone = data['phone'].strip()
        password = data['password']

        # Validate phone format
        if not validate_phone(phone):
            return jsonify({'error': 'Invalid phone number format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400

        # Validate password length
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # ✅ FIND STUDENT BY BARCODE ONLY (not by phone - phone doesn't exist yet!)
        student = Student.query.filter_by(barcode=barcode).first()

        if not student:
            print(f"❌ [BARCODE_SETUP] Student not found with barcode: {barcode}")
            return jsonify({'error': 'Invalid barcode'}), 404

        print(f"🔍 [BARCODE_SETUP] Found student by barcode: {student.name or 'Unknown'} (ID: {student.id})")

        # ✅ The STUDENT is the barcode holder! Use student.id to find/update the User record
        # Student ID and User ID should be the SAME for barcode holders
        user = User.query.get(student.id)
        
        if not user:
            print(f"❌ [BARCODE_SETUP] User {student.id} not found in database!")
            return jsonify({'error': 'User account not found. Please contact support.'}), 404
        
        print(f"✅ [BARCODE_SETUP] Found user account for barcode holder (ID: {user.id})")
        
        # Check if phone is already taken by another user
        existing_user_with_phone = User.query.filter_by(phone=phone).first()
        if existing_user_with_phone and existing_user_with_phone.id != user.id:
            print(f"⚠️ [BARCODE_SETUP] Phone {phone} already used by user {existing_user_with_phone.id}")
            return jsonify({'error': 'This phone number is already registered. Please use a different phone number.'}), 409
        
        # Get or create parent
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        
        if not parent:
            print(f"⚠️ [BARCODE_SETUP] No parent found, creating minimal parent record...")
            parent = Parent(mobile_app_enabled=False)
            db.session.add(parent)
            db.session.flush()
            student.parent_id = parent.id
            print(f"✅ [BARCODE_SETUP] Created parent (ID: {parent.id})")
        
        # ✅ UPDATE existing user ONLY with phone and password
        print(f"🔄 [BARCODE_SETUP] Updating existing user {user.id} with phone {phone} and new password...")
        user.phone = phone
        user.password_hash = hash_password(password)
        user.barcode_setup_completed = True
        
        # Ensure user is linked to parent
        if parent.user_id != user.id:
            parent.user_id = user.id

        # Mark QR setup as complete
        student.qr_setup_complete = True

        db.session.commit()
        print(f"✅ [BARCODE_SETUP] Setup completed successfully for user {user.id}, phone: {phone}")

        # Create access token
        access_token = create_access_token(identity=str(user.id))

        # Prepare response
        students_data = [{
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'mobile_username': student.mobile_username,
            'mobile_password': student.mobile_password_plain,
            'mobile_app_enabled': student.mobile_app_enabled
        }]

        return jsonify({
            'access_token': access_token,
            'message': 'Setup completed successfully. You can now login with your phone and password.',
            'user': {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'phone': user.phone,
                'gender': user.gender,
                'role': user.role,
                'email_verified': user.email_verified,
                'profile_picture_url': user.profile_picture_url,
                'profile_incomplete': True,  # Always true after barcode setup
                'mobile_username': parent.mobile_username if parent else None,
                'mobile_password': parent.mobile_password_plain if parent else None,
                'mobile_app_enabled': parent.mobile_app_enabled if parent else False,
                'students': students_data,
                'parent_info': {
                    'full_name': parent.full_name if parent else None,
                    'phone': parent.phone if parent else None,
                    'email': parent.email if parent else None
                }
            }
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"❌ [BARCODE_SETUP] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Failed to complete setup'}), 500


@auth_bp.route('/barcode-login', methods=['POST'])
def barcode_login():
    """Complete barcode login with phone and password setup"""
    try:
        data = request.get_json()

        required_fields = ['barcode', 'phone', 'password']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        barcode = data['barcode'].strip()
        phone = data['phone'].strip()
        password = data['password']

        # Validate phone format
        if not validate_phone(phone):
            return jsonify({'error': 'Invalid phone number format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400

        # Validate password length
        if len(password) < 6:
            return jsonify({'error': 'Password must be at least 6 characters'}), 400

        # Find student by barcode
        student = Student.query.filter_by(barcode=barcode).first()

        if not student:
            print(f"❌ [BARCODE_LOGIN] Student not found with barcode: {barcode}")
            return jsonify({'error': 'Invalid barcode'}), 404

        print(f"🔍 [BARCODE_LOGIN] Found student: {student.name or 'Unknown'} (ID: {student.id}), barcode: {barcode}, parent_id: {student.parent_id}")

        # Get parent - create minimal parent if doesn't exist
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        parent_needs_info = False

        if not parent:
            print(f"⚠️ [BARCODE_LOGIN] No parent found for student {student.id}, creating minimal parent record...")
            parent_needs_info = True
            
            # Create minimal parent record (will be completed later)
            parent = Parent(
                mobile_app_enabled=False
            )
            db.session.add(parent)
            db.session.flush()
            student.parent_id = parent.id
            print(f"✅ [BARCODE_LOGIN] Created minimal parent (ID: {parent.id}) for student {student.id}")
        else:
            # Check if existing parent needs info
            if not parent.full_name or not parent.phone or not parent.email:
                parent_needs_info = True
                print(f"⚠️ [BARCODE_LOGIN] Existing parent {parent.id} has incomplete info")

        print(f"🔍 [BARCODE_LOGIN] Starting login for student: {student.name or 'Unknown'}, parent: {parent.full_name or 'Not set'}, phone: {phone}, parent_needs_info: {parent_needs_info}")

        # ✅ FIND EXISTING USER - Always use the student's existing user account if it exists
        user = None
        
        # Priority 1: Use student's existing user account (MAIN ACCOUNT)
        if student.user_id:
            user = User.query.get(student.user_id)
            if user:
                print(f"🔍 [BARCODE_LOGIN] Found student's existing user account (ID: {user.id})")
        
        # Priority 2: Use parent's user account if student doesn't have one
        if not user and parent.user_id:
            user = User.query.get(parent.user_id)
            if user:
                print(f"🔍 [BARCODE_LOGIN] Found parent's existing user account (ID: {user.id})")
        
        # Priority 3: Find user by parent's email if both student and parent don't have user_id
        if not user and parent.email:
            user = User.query.filter_by(email=parent.email).first()
            if user:
                print(f"🔍 [BARCODE_LOGIN] Found user by parent email (ID: {user.id})")
        
        # Priority 4: Create new user if no existing user found (for students without parent setup)
        user_is_new = False
        if not user:
            if parent_needs_info:
                print(f"🆕 [BARCODE_LOGIN] Creating new user account for student {student.id} (parent info needed)")
                user = User(
                    password_hash=hash_password(password),
                    phone=phone,
                    email_verified=False,
                    role='user'
                )
                db.session.add(user)
                db.session.flush()
                user_is_new = True
                print(f"✅ [BARCODE_LOGIN] Created new user account (ID: {user.id})")
            else:
                print(f"❌ [BARCODE_LOGIN] ERROR: No existing user found for student {student.id}")
                return jsonify({'error': 'Student account not properly initialized. Please contact administrator.'}), 500
        
        # ✅ UPDATE EXISTING USER - Overwrite phone and password (only if not newly created)
        if not user_is_new:
            # Check for phone conflicts with other users
            phone_conflict_user = User.query.filter_by(phone=phone).first()
            if phone_conflict_user and phone_conflict_user.id != user.id:
                print(f"⚠️ [BARCODE_LOGIN] Phone {phone} is assigned to user {phone_conflict_user.id}, clearing it...")
                phone_conflict_user.phone = None  # Clear the conflicting phone
                db.session.flush()
            
            # Update the user's phone and password
            user.phone = phone
            user.password_hash = hash_password(password)
            print(f"✅ [BARCODE_LOGIN] Updated user account (ID: {user.id}) - phone: {phone}, password: updated")
        else:
            print(f"✅ [BARCODE_LOGIN] New user account (ID: {user.id}) - phone: {phone}, password: set")
        
        # Link user to parent and student (ensure consistency)
        parent.user_id = user.id
        student.user_id = user.id

        # Mark QR setup as complete
        student.qr_setup_complete = True

        # ✅ GENERATE MOBILE CREDENTIALS ONLY IF PARENT INFO IS COMPLETE
        parent_username = parent.mobile_username
        parent_password_plain = parent.mobile_password_plain
        student_username = student.mobile_username
        student_password_plain = student.mobile_password_plain
        
        # Only generate parent credentials if parent has complete info (name, phone, email)
        if parent.full_name and parent.phone and parent.email and not parent.mobile_username:
            from utils import generate_parent_mobile_credentials
            parent_password_plain = generate_parent_mobile_credentials(parent.full_name)
            parent.mobile_password_hash = hash_password(parent_password_plain)
            parent.mobile_password_plain = parent_password_plain
            parent.mobile_app_enabled = True
            print(f"✅ [BARCODE_LOGIN] Generated parent mobile credentials")
        elif not parent.full_name or not parent.phone or not parent.email:
            print(f"⚠️ [BARCODE_LOGIN] Skipping parent mobile credentials - incomplete parent info")
        
        # Only generate student credentials if student has complete info (name, date_of_birth)
        if student.name and student.date_of_birth and not student.mobile_username:
            from utils import generate_student_mobile_credentials
            student_password_plain = generate_student_mobile_credentials(student.name)
            student.mobile_password_hash = hash_password(student_password_plain)
            student.mobile_password_plain = student_password_plain
            student.mobile_app_enabled = True
            print(f"✅ [BARCODE_LOGIN] Generated student mobile credentials")
        elif not student.name or not student.date_of_birth:
            print(f"⚠️ [BARCODE_LOGIN] Skipping student mobile credentials - incomplete student info")

        # Commit all changes
        db.session.commit()
        print(f"✅ [BARCODE_LOGIN] Successfully committed all changes for user {user.id}")
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ [BARCODE_LOGIN] Error during barcode login: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Login failed: {str(e)}'}), 500

    # Create access token
    access_token = create_access_token(identity=str(user.id))

    # Return user data and token (with profile_incomplete flag)
    # Check essential fields: phone, full_name, parent name/phone, student birth_date (email is optional)
    profile_incomplete = not all([
        user.full_name,
        user.phone,
        parent.full_name,
        parent.phone,
        student.name,
        student.date_of_birth
    ])
    
    if profile_incomplete:
        print(f"⚠️ [BARCODE_LOGIN] Profile incomplete for user {user.id}: "
              f"user_name={bool(user.full_name)}, user_phone={bool(user.phone)}, "
              f"parent_name={bool(parent.full_name)}, parent_phone={bool(parent.phone)}, "
              f"student_name={bool(student.name)}, student_birth={bool(student.date_of_birth)}")
    
    user_data = {
        'id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'phone': user.phone,
        'gender': user.gender,
        'role': user.role,
        'email_verified': user.email_verified,
        'profile_incomplete': profile_incomplete,
        'mobile_username': parent.mobile_username,
        'mobile_app_enabled': parent.mobile_app_enabled,
        'parent_info': {
            'id': parent.id,
            'full_name': parent.full_name,
            'phone': parent.phone,
            'email': parent.email
        },
        'students': [{
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'mobile_username': student.mobile_username,
            'mobile_app_enabled': student.mobile_app_enabled
        }]
    }

    print(f"✅ [BARCODE_LOGIN] Successfully logged in user {user.id}, profile_incomplete: {profile_incomplete}, parent_needs_info: {parent_needs_info}")

    # Build response with mobile credentials only if they exist
    response_data = {
        'access_token': access_token,
        'user': user_data,
        'parent_needs_info': parent_needs_info  # Flag to show parent info modal
    }
    
    # Only include mobile credentials if they were generated
    mobile_credentials = {}
    if parent_username and parent_password_plain:
        mobile_credentials['parent'] = {
            'username': parent_username,
            'password': parent_password_plain
        }
    if student_username and student_password_plain:
        mobile_credentials['student'] = {
            'username': student_username,
            'password': student_password_plain
        }
    
    if mobile_credentials:
        response_data['mobile_credentials'] = mobile_credentials

    return jsonify(response_data), 200


@auth_bp.route('/complete-parent-info', methods=['POST'])
@jwt_required()
def complete_parent_info():
    """Complete parent information after barcode login"""
    try:
        data = request.get_json()
        current_user_id = int(get_jwt_identity())
        
        # Validate required fields
        required_fields = ['parent_name', 'parent_phone', 'parent_email']
        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400
        
        parent_name = data['parent_name'].strip()
        parent_phone = data['parent_phone'].strip()
        parent_email = data['parent_email'].lower().strip()
        
        # Validate phone format
        if not validate_phone(parent_phone):
            return jsonify({'error': 'Invalid phone format. Must be 05xxxxxxxx, 06xxxxxxxx, or 07xxxxxxxx'}), 400
        
        # Validate email format
        if not validate_email(parent_email):
            return jsonify({'error': 'Invalid email format'}), 400
        
        # Get user
        user = User.query.get(current_user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get student
        student = Student.query.filter_by(user_id=current_user_id).first()
        if not student:
            return jsonify({'error': 'Student record not found'}), 404
        
        # Get or update parent
        parent = Parent.query.get(student.parent_id) if student.parent_id else None
        
        if not parent:
            print(f"❌ [COMPLETE_PARENT_INFO] No parent found for student {student.id}")
            return jsonify({'error': 'Parent record not found'}), 404
        
        # Check if email is already used by another user
        existing_email_user = User.query.filter_by(email=parent_email).first()
        if existing_email_user and existing_email_user.id != current_user_id:
            return jsonify({'error': 'Email already in use by another account'}), 409
        
        # Update parent information
        parent.full_name = parent_name
        parent.phone = parent_phone
        parent.email = parent_email
        parent.user_id = current_user_id
        
        # Update user information
        user.email = parent_email
        user.email_verified = True  # Consider email verified after parent info completion
        
        # Generate parent mobile credentials now that we have complete info
        parent_password_plain = parent.mobile_password_plain
        
        if not parent.mobile_username:
            from utils import generate_parent_mobile_credentials
            parent_password_plain = generate_parent_mobile_credentials(parent_name)
            parent.mobile_password_hash = hash_password(parent_password_plain)
            parent.mobile_password_plain = parent_password_plain
            parent.mobile_app_enabled = True
            print(f"✅ [COMPLETE_PARENT_INFO] Generated parent mobile credentials")
        
        db.session.commit()
        print(f"✅ [COMPLETE_PARENT_INFO] Successfully updated parent info for user {current_user_id}")
        
        # Auto-generate mobile credentials if student is eligible
        credentials_result = auto_generate_mobile_credentials_if_eligible(student.id)
        
        # Return updated parent info and mobile credentials
        response = {
            'message': 'Parent information completed successfully',
            'parent': {
                'id': parent.id,
                'full_name': parent.full_name,
                'phone': parent.phone,
                'email': parent.email,
                'mobile_app_enabled': parent.mobile_app_enabled
            }
        }
        
        # Include mobile credentials if they were just generated by complete_parent_info
        if parent_password_plain:
            response['parent_credentials'] = {
                'password': parent_password_plain
            }
        
        # Include auto-generated credentials if eligible
        if credentials_result.get('generated'):
            response['mobile_credentials_generated'] = True
            if credentials_result.get('student_credentials'):
                response['student_credentials'] = credentials_result['student_credentials']
            if credentials_result.get('parent_credentials') and not parent_password_plain:
                response['parent_credentials'] = credentials_result['parent_credentials']
        
        return jsonify(response), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ [COMPLETE_PARENT_INFO] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to complete parent information: {str(e)}'}), 500


@auth_bp.route('/upload-profile-picture', methods=['POST'])
@jwt_required()
def upload_user_profile_picture():
    """Upload profile picture for the authenticated user"""
    try:
        # Get user identity from JWT token
        try:
            user_id = int(get_jwt_identity())
        except (ValueError, TypeError):
            return jsonify({'error': 'Invalid user identity in token'}), 401
            
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Check if a file was uploaded
        if 'profile_picture' not in request.files:
            return jsonify({'error': 'No profile picture file provided'}), 400
        
        file = request.files['profile_picture']
        
        # Check if file was actually selected
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Validate file type
        allowed_extensions = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'}
        if '.' not in file.filename or file.filename.rsplit('.', 1)[1].lower() not in allowed_extensions:
            return jsonify({'error': 'Invalid file type. Allowed types: PNG, JPG, JPEG, GIF, WebP, BMP'}), 400
        
        # Read file data
        file_data = file.read()
        
        # Validate file size (max 10MB for profile pictures)
        max_size = 10 * 1024 * 1024  # 10MB
        if len(file_data) > max_size:
            return jsonify({'error': 'File too large. Maximum size is 10MB'}), 400
        
        # Upload to ImgBB
        upload_result = upload_profile_picture(file_data, user_id)
        
        if not upload_result:
            return jsonify({'error': 'Failed to upload image to hosting service'}), 500
        
        # Update user's profile picture URL in database
        user.profile_picture_url = upload_result['url']
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Profile picture uploaded successfully',
            'profile_picture_url': upload_result['url'],
            'thumb_url': upload_result['thumb'],
            'medium_url': upload_result['medium']
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to upload profile picture: {str(e)}'}), 500


@auth_bp.route('/remove-profile-picture', methods=['DELETE'])
@jwt_required()
def remove_user_profile_picture():
    """Remove profile picture for the authenticated user"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Remove profile picture URL from database
        user.profile_picture_url = None
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Profile picture removed successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to remove profile picture: {str(e)}'}), 500


@auth_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_user_profile():
    """Get current user's profile information including profile picture and student details"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get student information if exists
        student = Student.query.filter_by(user_id=user_id).first()
        student_data = None
        if student:
            student_data = {
                'id': student.id,
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'barcode': student.barcode,
                'mobile_app_enabled': student.mobile_app_enabled
            }
        
        # Get parent information if exists
        parent = Parent.query.filter_by(user_id=user_id).first()
        parent_data = None
        if parent:
            parent_data = {
                'id': parent.id,
                'full_name': parent.full_name,
                'phone': parent.phone,
                'email': parent.email,
                'mobile_app_enabled': parent.mobile_app_enabled
            }
        
        return jsonify({
            'success': True,
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'gender': user.gender,
                'role': user.role,
                'profile_picture_url': user.profile_picture_url,
                'email_verified': user.email_verified,
                'created_at': user.created_at.isoformat() if user.created_at else None
            },
            'student': student_data,
            'parent': parent_data
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Failed to get user profile: {str(e)}'}), 500


@auth_bp.route('/profile-status', methods=['GET'])
@jwt_required()
def get_profile_status():
    """Quick check if profile is complete (for frontend routing)"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Quick check for required fields
        parent = Parent.query.filter_by(user_id=user_id).first()
        student = Student.query.filter_by(user_id=user_id).first()
        
        profile_incomplete = False
        
        # Check user fields
        if not all([user.full_name, user.email, user.phone, user.gender]):
            profile_incomplete = True
        # Check parent fields
        elif parent and not all([parent.full_name, parent.phone, parent.email]):
            profile_incomplete = True
        # Check student fields
        elif student and not all([student.name, student.date_of_birth]):
            profile_incomplete = True
        
        return jsonify({
            'profile_complete': not profile_incomplete,
            'profile_incomplete': profile_incomplete
        }), 200
        
    except Exception as e:
        print(f"❌ [PROFILE_STATUS] Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@auth_bp.route('/profile/check-completion', methods=['GET'])
@jwt_required()
def check_profile_completion():
    """Check if user profile is complete and return missing fields"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get parent and student records
        parent = Parent.query.filter_by(user_id=user_id).first()
        student = Student.query.filter_by(user_id=user_id).first()
        
        missing_fields = []
        
        # Check user fields
        if not user.full_name:
            missing_fields.append('user_full_name')
        if not user.email:
            missing_fields.append('user_email')
        if not user.phone:
            missing_fields.append('user_phone')
        if not user.gender:
            missing_fields.append('user_gender')
        
        # Check parent fields
        if parent:
            if not parent.full_name:
                missing_fields.append('parent_full_name')
            if not parent.phone:
                missing_fields.append('parent_phone')
            if not parent.email:
                missing_fields.append('parent_email')
        else:
            missing_fields.extend(['parent_full_name', 'parent_phone', 'parent_email'])
        
        # Check student fields
        if student:
            if not student.name:
                missing_fields.append('student_name')
            if not student.date_of_birth:
                missing_fields.append('student_date_of_birth')
        else:
            missing_fields.extend(['student_name', 'student_date_of_birth'])
        
        profile_complete = len(missing_fields) == 0
        
        return jsonify({
            'profile_complete': profile_complete,
            'missing_fields': missing_fields,
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'gender': user.gender
            },
            'parent': {
                'id': parent.id if parent else None,
                'full_name': parent.full_name if parent else None,
                'phone': parent.phone if parent else None,
                'email': parent.email if parent else None
            } if parent else None,
            'student': {
                'id': student.id if student else None,
                'name': student.name if student else None,
                'date_of_birth': student.date_of_birth.isoformat() if student and student.date_of_birth else None
            } if student else None
        }), 200
        
    except Exception as e:
        print(f"❌ [PROFILE_CHECK] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to check profile completion: {str(e)}'}), 500


@auth_bp.route('/profile/complete', methods=['POST'])
@jwt_required()
def complete_profile():
    """Update user, parent, and student information to complete profile"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        # Update user information
        if 'user_full_name' in data and data['user_full_name']:
            user.full_name = data['user_full_name'].strip()
        if 'user_email' in data and data['user_email']:
            # Check if email already exists for another user
            existing_user = User.query.filter_by(email=data['user_email']).first()
            if existing_user and existing_user.id != user_id:
                return jsonify({'error': 'Email already in use by another account'}), 400
            user.email = data['user_email'].strip()
            user.email_verified = True
        if 'user_phone' in data and data['user_phone']:
            # Validate phone format
            if not validate_phone(data['user_phone']):
                return jsonify({'error': 'Invalid phone number format'}), 400
            user.phone = data['user_phone'].strip()
        if 'user_gender' in data and data['user_gender'] in ['male', 'female']:
            user.gender = data['user_gender']
        
        # Update or CREATE parent information (parent is separate from student/user)
        parent = Parent.query.filter_by(user_id=user_id).first()
        
        # Create parent if doesn't exist and parent data is provided
        if not parent and ('parent_full_name' in data or 'parent_phone' in data or 'parent_email' in data):
            print(f"🆕 [PROFILE_COMPLETE] Creating new parent for user {user_id}")
            parent = Parent(user_id=user_id, mobile_app_enabled=False)
            db.session.add(parent)
            db.session.flush()
        
        # Update parent fields if parent exists or was just created
        if parent:
            if 'parent_full_name' in data and data['parent_full_name']:
                parent.full_name = data['parent_full_name'].strip()
            if 'parent_phone' in data and data['parent_phone']:
                if not validate_phone(data['parent_phone']):
                    return jsonify({'error': 'Invalid parent phone number format'}), 400
                parent.phone = data['parent_phone'].strip()
            if 'parent_email' in data and data['parent_email']:
                parent.email = data['parent_email'].strip()
            print(f"✅ [PROFILE_COMPLETE] Parent {parent.id} updated successfully")
        
        # Update student information (student is linked to user - user IS the student)
        # Student table stores additional info, but user_id should match user.id
        student = Student.query.get(user_id)  # Student ID = User ID for barcode holders
        
        if student:
            # Student name should match user full_name
            if 'user_full_name' in data and data['user_full_name']:
                student.name = data['user_full_name'].strip()
            
            if 'student_date_of_birth' in data and data['student_date_of_birth']:
                from datetime import datetime
                try:
                    # Parse date (format: YYYY-MM-DD)
                    student.date_of_birth = datetime.strptime(data['student_date_of_birth'], '%Y-%m-%d').date()
                except ValueError:
                    return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD'}), 400
            
            # Link parent to student if parent was created
            if parent and student.parent_id != parent.id:
                student.parent_id = parent.id
            
            print(f"✅ [PROFILE_COMPLETE] Student {student.id} updated successfully")
        
        db.session.commit()
        print(f"✅ [PROFILE_COMPLETE] User {user_id} profile updated successfully")
        
        # Check if profile is now complete (email is optional)
        missing_fields = []
        if not user.full_name:
            missing_fields.append('user_full_name')
        # Email is optional - removed from required fields
        if not user.phone:
            missing_fields.append('user_phone')
        if not user.gender:
            missing_fields.append('user_gender')
        if parent:
            if not parent.full_name:
                missing_fields.append('parent_full_name')
            if not parent.phone:
                missing_fields.append('parent_phone')
            # Parent email is optional - removed from required fields
        if student:
            if not student.name:
                missing_fields.append('student_name')
            if not student.date_of_birth:
                missing_fields.append('student_date_of_birth')
        
        # Auto-generate mobile credentials if eligible
        credentials_result = None
        if student and len(missing_fields) == 0:
            credentials_result = auto_generate_mobile_credentials_if_eligible(student.id)
            if credentials_result.get('generated'):
                print(f"✅ [PROFILE_COMPLETE] Auto-generated mobile credentials for student {student.id}")
        
        response_data = {
            'success': True,
            'profile_complete': len(missing_fields) == 0,
            'missing_fields': missing_fields,
            'user': {
                'id': user.id,
                'full_name': user.full_name,
                'email': user.email,
                'phone': user.phone,
                'gender': user.gender,
                'email_verified': user.email_verified
            },
            'parent': {
                'id': parent.id if parent else None,
                'full_name': parent.full_name if parent else None,
                'phone': parent.phone if parent else None,
                'email': parent.email if parent else None,
                'mobile_app_enabled': parent.mobile_app_enabled if parent else False
            } if parent else None,
            'student': {
                'id': student.id if student else None,
                'name': student.name if student else None,
                'date_of_birth': student.date_of_birth.isoformat() if student and student.date_of_birth else None,
                'mobile_app_enabled': student.mobile_app_enabled if student else False
            } if student else None
        }
        
        # Include mobile credentials if they were just generated
        if credentials_result and credentials_result.get('generated'):
            response_data['mobile_credentials_generated'] = True
            if credentials_result.get('student_credentials'):
                response_data['student_credentials'] = credentials_result['student_credentials']
            if credentials_result.get('parent_credentials'):
                response_data['parent_credentials'] = credentials_result['parent_credentials']
        
        return jsonify(response_data), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ [PROFILE_COMPLETE] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to complete profile: {str(e)}'}), 500


@auth_bp.route('/mobile-credentials/check-eligibility', methods=['GET'])
@jwt_required()
def check_mobile_credentials_eligibility():
    """Check if current user's student is eligible for auto-generated mobile credentials"""
    try:
        user_id = int(get_jwt_identity())
        user = User.query.get(user_id)
        
        if not user:
            return jsonify({
                'eligible': False,
                'reason': 'User not found'
            }), 404
        
        students = Student.query.filter_by(user_id=user_id).all()
        
        if not students:
            return jsonify({
                'eligible': False,
                'reason': 'No student record found for this user'
            }), 200
        
        # Get parent credentials from Parent table (BOTH phone and password from Parent table)
        parent_record = None
        parent_credentials = None
        if students and students[0].parent_id:
            parent_record = Parent.query.get(students[0].parent_id)
            if parent_record and parent_record.mobile_password_plain:
                parent_credentials = {
                    'phone': parent_record.phone,  # Phone from Parent table
                    'password': parent_record.mobile_password_plain  # Password from Parent table
                }
        
        # Check eligibility for each student
        result = {
            'parent': {
                'phone': parent_record.phone if parent_record else user.phone,  # Phone from Parent table, fallback to User
                'has_credentials': parent_record.mobile_password_plain is not None if parent_record else False,
                'credentials': parent_credentials
            },
            'students': []
        }
        
        for student in students:
            # Check eligibility conditions
            student_eligibility = {
                'student_id': student.id,
                'student_name': student.name,
                'eligible': False,
                'conditions': {},
                'missing_requirements': [],
                'reason': None
            }
            
            # Condition 1: Student has approved enrollment
            approved_enrollment = Enrollment.query.filter_by(
                student_id=student.id,
                status='approved',
                is_active=True
            ).first()
            student_eligibility['conditions']['has_approved_enrollment'] = approved_enrollment is not None
            if not approved_enrollment:
                student_eligibility['missing_requirements'].append('approved_enrollment')
            
            # Condition 2: Parent info is complete
            parent = Parent.query.get(student.parent_id) if student.parent_id else None
            parent_info_complete = parent and all([parent.full_name, parent.phone, parent.email])
            student_eligibility['conditions']['parent_info_complete'] = parent_info_complete
            if not parent_info_complete:
                student_eligibility['missing_requirements'].append('parent_info')
            
            # Condition 3: Student has birth date
            student_eligibility['conditions']['has_birth_date'] = student.date_of_birth is not None
            if not student.date_of_birth:
                student_eligibility['missing_requirements'].append('birth_date')
            
            # Condition 4: Student has name
            student_eligibility['conditions']['student_has_name'] = student.name is not None
            if not student.name:
                student_eligibility['missing_requirements'].append('student_name')
            
            # Condition 5: Student credentials exist (from Student table)
            credentials_exist = student.mobile_password_plain is not None
            student_eligibility['conditions']['credentials_already_exist'] = credentials_exist
            student_eligibility['has_credentials'] = credentials_exist
            
            if credentials_exist:
                student_eligibility['credentials'] = {
                    'phone': user.phone,  # Phone from User table (Student table has no phone field)
                    'password': student.mobile_password_plain  # Password from Student table
                }
            
            # Determine overall eligibility
            if credentials_exist:
                student_eligibility['eligible'] = True
                student_eligibility['reason'] = 'Mobile credentials already exist'
            elif len(student_eligibility['missing_requirements']) == 0:
                student_eligibility['eligible'] = True
                student_eligibility['reason'] = 'Student is eligible for mobile credentials'
            else:
                student_eligibility['eligible'] = False
                student_eligibility['reason'] = 'Requirements not met'
            
            result['students'].append(student_eligibility)
        
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ [CHECK_ELIGIBILITY] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to check eligibility: {str(e)}'}), 500


@auth_bp.route('/mobile-credentials/generate', methods=['POST'])
@jwt_required()
def generate_mobile_credentials_manual():
    """Manually trigger mobile credentials generation for current user's student"""
    try:
        user_id = int(get_jwt_identity())
        student = Student.query.filter_by(user_id=user_id).first()
        
        if not student:
            return jsonify({'error': 'No student record found for this user'}), 404
        
        # Attempt to generate credentials
        result = auto_generate_mobile_credentials_if_eligible(student.id)
        
        if result.get('generated'):
            response = {
                'success': True,
                'message': 'Mobile credentials generated successfully'
            }
            
            if result.get('student_credentials'):
                response['student_credentials'] = result['student_credentials']
            
            if result.get('parent_credentials'):
                response['parent_credentials'] = result['parent_credentials']
            
            return jsonify(response), 200
        else:
            return jsonify({
                'success': False,
                'message': 'Could not generate mobile credentials',
                'reason': result.get('reason', 'Unknown reason')
            }), 400
        
    except Exception as e:
        print(f"❌ [GENERATE_CREDENTIALS] Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Failed to generate credentials: {str(e)}'}), 500

