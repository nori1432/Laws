from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import check_password_hash
from datetime import datetime, timedelta
import secrets

mobile_bp = Blueprint('mobile', __name__)

# Import models and utilities
from models import (db, User, Parent, Student, Class, Enrollment, Attendance, 
                   Registration, Course, CourseSection, SectionEnrollment, Notification,
                   course_to_dict, class_to_dict, attendance_to_dict, student_to_dict)
from utils import hash_password, verify_password, generate_qr_code, generate_parent_mobile_credentials, generate_student_mobile_credentials
from sqlalchemy import func, and_
import json

@mobile_bp.route('/logout', methods=['POST', 'OPTIONS'])
@jwt_required()
def mobile_logout():
    """Mobile logout endpoint"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        # In a stateless JWT system, logout is mainly client-side
        # But we can log the logout event for analytics
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')
        
        print(f"User logged out - ID: {user_id}, Type: {user_type}")
        
        return jsonify({'message': 'Logged out successfully'}), 200
        
    except Exception as e:
        print(f"Logout error: {str(e)}")
        return jsonify({'error': 'Logout failed'}), 500


@mobile_bp.route('/update-push-token', methods=['POST', 'OPTIONS'])
@jwt_required()
def update_push_token():
    """Update user's push notification token"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        # Get current user
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')
        
        # Get request data
        data = request.get_json()
        push_token = data.get('push_token')
        platform = data.get('platform')
        device_info = data.get('device_info', {})
        
        if not push_token:
            return jsonify({'error': 'Push token is required'}), 400
        
        # Find the correct User record based on user_type
        user = None
        if user_type == 'parent':
            # For parents, find the parent record first, then get their user_id
            parent = Parent.query.get(user_id)
            if parent and parent.user_id:
                user = User.query.get(parent.user_id)
            elif parent:
                # Parent doesn't have a user record, create one or handle differently
                # For now, we'll skip push token update for parents without user records
                print(f"⚠️ Parent {parent.full_name} (ID: {parent.id}) has no associated user record - skipping push token update")
                return jsonify({'message': 'Push token update skipped - no user record found'}), 200
        elif user_type == 'student':
            # For students, use their user_id to find the User record
            student = Student.query.get(user_id)
            if student and student.user_id:
                user = User.query.get(student.user_id)
            else:
                print(f"⚠️ Student ID {user_id} has no associated user record - skipping push token update")
                return jsonify({'message': 'Push token update skipped - no user record found'}), 200
        else:
            # Fallback to direct user lookup
            user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update push token information
        user.push_token = push_token
        db.session.commit()
        
        # Create token preview for logging (first 20 characters)
        token_preview = push_token[:20] + '...' if len(push_token) > 20 else push_token
        
        print(f"✅ Push token updated for {user_type} ID {user_id}: {token_preview}")
        
        return jsonify({
            'success': True,
            'message': 'Push token updated successfully',
            'token_preview': token_preview,
            'platform': platform
        })
        
    except Exception as e:
        print(f"❌ Error updating push token: {str(e)}")
        return jsonify({'error': 'Failed to update push token'}), 500


@mobile_bp.route('/notifications', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_notifications():
    """Get all notifications for the current user"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')
        
        # Map to correct User record for notifications
        actual_user_id = None
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if parent and parent.user_id:
                actual_user_id = parent.user_id
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if student and student.user_id:
                actual_user_id = student.user_id
        else:
            actual_user_id = user_id
        
        if not actual_user_id:
            return jsonify({
                'success': True,
                'notifications': [],
                'count': 0
            })
        
        # Get all notifications for the user, ordered by newest first
        notifications = Notification.query.filter_by(user_id=actual_user_id)\
            .order_by(Notification.created_at.desc())\
            .limit(50)\
            .all()
        
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'id': notification.id,
                'title': notification.title,
                'message': notification.message,
                'type': notification.type,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'notifications': notifications_data,
            'count': len(notifications_data)
        })
        
    except Exception as e:
        print(f"❌ Error fetching notifications: {str(e)}")
        return jsonify({'error': 'Failed to fetch notifications'}), 500


@mobile_bp.route('/notifications/new', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_new_notifications():
    """Get new notifications since a specific timestamp"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')
        since = request.args.get('since')
        
        # Map to correct User record for notifications
        actual_user_id = None
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if parent and parent.user_id:
                actual_user_id = parent.user_id
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if student and student.user_id:
                actual_user_id = student.user_id
        else:
            actual_user_id = user_id
        
        if not actual_user_id:
            return jsonify({
                'success': True,
                'notifications': [],
                'count': 0
            })
        
        query = Notification.query.filter_by(user_id=actual_user_id)
        
        if since:
            try:
                since_date = datetime.fromisoformat(since.replace('Z', '+00:00'))
                query = query.filter(Notification.created_at > since_date)
            except:
                pass  # Invalid date format, ignore filter
        
        # Get new notifications, ordered by newest first
        notifications = query.order_by(Notification.created_at.desc()).limit(10).all()
        
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'id': notification.id,
                'title': notification.title,
                'message': notification.message,
                'type': notification.type,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            })
        
        return jsonify({
            'success': True,
            'notifications': notifications_data,
            'count': len(notifications_data)
        })
        
    except Exception as e:
        print(f"❌ Error fetching new notifications: {str(e)}")
        return jsonify({'error': 'Failed to fetch new notifications'}), 500


@mobile_bp.route('/notifications/<int:notification_id>/read', methods=['POST', 'OPTIONS'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark a notification as read"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    try:
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')
        
        # Map to correct User record for notifications
        actual_user_id = None
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if parent and parent.user_id:
                actual_user_id = parent.user_id
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if student and student.user_id:
                actual_user_id = student.user_id
        else:
            actual_user_id = user_id
        
        if not actual_user_id:
            return jsonify({'error': 'User not found'}), 404
        
        # Find the notification and verify it belongs to the user
        notification = Notification.query.filter_by(
            id=notification_id, 
            user_id=actual_user_id
        ).first()
        
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        # Mark as read
        notification.is_read = True
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Notification marked as read'
        })
        
    except Exception as e:
        print(f"❌ Error marking notification as read: {str(e)}")
        return jsonify({'error': 'Failed to mark notification as read'}), 500


@mobile_bp.route('/login', methods=['POST', 'OPTIONS'])
def mobile_login():
    """Mobile app login for both parents and students using PHONE NUMBER ONLY"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    print(f"🔍 [MOBILE_LOGIN] Received data: {data}")
    
    # Accept only 'phone' - NO MORE USERNAMES
    phone = data.get('phone') or data.get('identifier')
    password = data.get('password')
    user_type = data.get('user_type', 'parent')  # 'parent' or 'student'
    
    print(f"🔍 [MOBILE_LOGIN] Parsed - phone: {phone}, password: {'***' if password else None}, user_type: {user_type}")
    
    if not phone or not password:
        print(f"❌ [MOBILE_LOGIN] Missing credentials - phone: {bool(phone)}, password: {bool(password)}")
        return jsonify({'error': 'Phone number and password are required'}), 400
    
    print(f"🔑 [MOBILE_LOGIN] Login attempt for phone: {phone}, user_type: {user_type}")
    
    try:
        # Clean phone number
        clean_phone = phone.replace('+', '').replace(' ', '').replace('-', '').replace('(', '').replace(')', '')
        print(f"🔍 [MOBILE_LOGIN] Cleaned phone: {clean_phone}")
        
        if user_type == 'parent':
            # Parent login - search by PHONE ONLY
            parent = None
            print(f"🔍 [PARENT_LOGIN] Searching by phone: {clean_phone}")
            
            # Try multiple phone number variations for better matching
            phone_variations = [
                clean_phone,                    # As entered: 0555123456
                clean_phone.lstrip('0'),        # Without leading 0: 555123456
                '0' + clean_phone.lstrip('0'),  # With leading 0: 0555123456
            ]
            # If it's an international format, try local format
            if clean_phone.startswith('213'):
                phone_variations.append('0' + clean_phone[3:])  # 213555123456 -> 0555123456
            
            print(f"   🔄 Trying phone variations: {phone_variations}")
            
            # Try each variation
            for phone_var in phone_variations:
                parent = Parent.query.filter_by(phone=phone_var).first()
                if parent:
                    print(f"   ✓ Found parent with phone: {phone_var}")
                    break
            
            if not parent:
                print(f"   ✗ No parent found with any phone variation")
            
            if parent:
                print(f"✓ [PARENT_LOGIN] Found parent: {parent.full_name}, mobile_app_enabled: {parent.mobile_app_enabled}")
                
            if parent and parent.mobile_app_enabled:
                print(f"Checking password for parent: {parent.full_name}")
                print(f"Parent has mobile_password_hash: {bool(parent.mobile_password_hash)}")
                print(f"Parent has mobile_password_plain: {bool(parent.mobile_password_plain)}")
                
                # Check both hashed and plain password for backward compatibility
                password_valid = False
                if parent.mobile_password_hash:
                    password_valid = check_password_hash(parent.mobile_password_hash, password)
                    print(f"Hashed password check: {password_valid}")
                
                if not password_valid and parent.mobile_password_plain:
                    password_valid = (password == parent.mobile_password_plain)
                    print(f"Plain password check: {password_valid}")
                
                if password_valid:
                    # Create JWT token with user_type claim
                    additional_claims = {
                        'user_type': 'parent',
                        'full_name': parent.full_name
                    }
                    
                    access_token = create_access_token(
                        identity=str(parent.id),
                        additional_claims=additional_claims,
                        expires_delta=timedelta(days=30)
                    )
                    
                    print(f"✅ Parent login successful for: {parent.full_name}")
                    
                    return jsonify({
                        'access_token': access_token,
                        'user_type': 'parent',
                        'user_id': parent.id,
                        'full_name': parent.full_name,
                        'phone': parent.phone,
                        'students_count': len(parent.students) if parent.students else 0,
                        'login_time': datetime.utcnow().isoformat()
                    }), 200
                else:
                    print(f"❌ Password validation failed for parent: {parent.full_name}")
            
            # Check if parent exists but needs setup
            if parent and not parent.mobile_app_enabled:
                return jsonify({
                    'error': 'Mobile app access not enabled for this parent. Please contact admin.',
                    'needs_setup': True,
                    'user_type': 'parent'
                }), 403
            elif parent and parent.mobile_app_enabled and not (parent.mobile_password_hash or parent.mobile_password_plain):
                return jsonify({
                    'error': 'Mobile password not set up. Please use first-time login to set up your password.',
                    'needs_password_setup': True,
                    'user_type': 'parent'
                }), 403
        
        elif user_type == 'student':
            # Student login - search by PHONE ONLY via users table
            student = None
            print(f"🔍 [STUDENT_LOGIN] Searching by phone: {clean_phone}")
            
            # Try multiple phone number variations for better matching
            phone_variations = [
                clean_phone,                    # As entered: 0555123456
                clean_phone.lstrip('0'),        # Without leading 0: 555123456
                '0' + clean_phone.lstrip('0'),  # With leading 0: 0555123456
            ]
            # If it's an international format, try local format
            if clean_phone.startswith('213'):
                phone_variations.append('0' + clean_phone[3:])  # 213555123456 -> 0555123456
            
            print(f"   🔄 Trying phone variations: {phone_variations}")
            
            # Find users with any of these phone variations (phone is in USERS table)
            users_with_phone = []
            for phone_var in phone_variations:
                found_users = User.query.filter_by(phone=phone_var).all()
                if found_users:
                    print(f"   ✓ Found {len(found_users)} users with phone: {phone_var}")
                    users_with_phone.extend(found_users)
                    break  # Found match, no need to try other variations
            
            if not users_with_phone:
                print(f"   ✗ No users found with any phone variation")
            else:
                print(f"🔍 [STUDENT_LOGIN] Total users found: {len(users_with_phone)}")
            
            # Check each user to see if they have a student record
            for user in users_with_phone:
                print(f"   📌 Checking user ID {user.id}: {user.full_name}, phone: {user.phone}")
                # Find student associated with this user
                potential_student = Student.query.filter_by(user_id=user.id).first()
                if potential_student:
                    print(f"      ✓ Found student ID {potential_student.id}: {potential_student.name}")
                    print(f"      ✓ mobile_app_enabled: {potential_student.mobile_app_enabled}")
                    print(f"      ✓ has credentials: {bool(potential_student.mobile_password_hash or potential_student.mobile_password_plain)}")
                    # Take the first student found, even if not enabled (we'll check that next)
                    if not student:
                        student = potential_student
                    # But prefer enabled students
                    if potential_student.mobile_app_enabled:
                        student = potential_student
                        break
                else:
                    print(f"      ✗ No student record found for user_id: {user.id}")
            
            if student:
                print(f"✓ [STUDENT_LOGIN] Found student: {student.name}, mobile_app_enabled: {student.mobile_app_enabled}")
            else:
                print(f"✗ [STUDENT_LOGIN] No student found for phone: {clean_phone}")
                
            if student and student.mobile_app_enabled:
                print(f"Checking password for student: {student.name}")
                print(f"Student has mobile_password_hash: {bool(student.mobile_password_hash)}")
                print(f"Student has mobile_password_plain: {bool(student.mobile_password_plain)}")
                
                password_valid = False
                if student.mobile_password_hash:
                    password_valid = check_password_hash(student.mobile_password_hash, password)
                    print(f"Hashed password check: {password_valid}")
                
                if not password_valid and student.mobile_password_plain:
                    password_valid = (password == student.mobile_password_plain)
                    print(f"Plain password check: {password_valid}")
                
                if password_valid:
                    additional_claims = {
                        'user_type': 'student',
                        'full_name': student.name
                    }
                    
                    access_token = create_access_token(
                        identity=str(student.id),
                        additional_claims=additional_claims,
                        expires_delta=timedelta(days=30)
                    )
                    
                    print(f"✅ Student login successful for: {student.name}")
                    
                    # Get student's phone from user record
                    student_user = User.query.filter_by(id=student.user_id).first()
                    student_phone = student_user.phone if student_user else None
                    
                    return jsonify({
                        'access_token': access_token,
                        'user_type': 'student',
                        'user_id': student.id,
                        'full_name': student.name,
                        'phone': student_phone,
                        'parent_id': student.parent_id,
                        'login_time': datetime.utcnow().isoformat()
                    }), 200
                else:
                    print(f"❌ Password validation failed for student: {student.name}")
            
            # Check if student exists but needs setup
            if student and not student.mobile_app_enabled:
                return jsonify({
                    'error': 'Mobile app access not enabled for this student. Please contact admin.',
                    'needs_setup': True,
                    'user_type': 'student'
                }), 403
            elif student and student.mobile_app_enabled and not (student.mobile_password_hash or student.mobile_password_plain):
                return jsonify({
                    'error': 'Mobile password not set up. Please use first-time login to set up your password.',
                    'needs_password_setup': True,
                    'user_type': 'student'
                }), 403
        
        print(f"❌ [MOBILE_LOGIN] Login failed for phone: {clean_phone}, user_type: {user_type}")
        print(f"❌ [MOBILE_LOGIN] Summary:")
        print(f"   - Phone: {clean_phone}")
        print(f"   - User Type: {user_type}")
        if user_type == 'parent':
            print(f"   - Parent found: {parent is not None if 'parent' in locals() else 'Variable not set'}")
            if 'parent' in locals() and parent:
                print(f"   - Parent mobile_app_enabled: {parent.mobile_app_enabled}")
                print(f"   - Parent has credentials: {bool(parent.mobile_password_hash or parent.mobile_password_plain)}")
        else:
            print(f"   - Student found: {student is not None if 'student' in locals() else 'Variable not set'}")
            if 'student' in locals() and student:
                print(f"   - Student mobile_app_enabled: {student.mobile_app_enabled}")
                print(f"   - Student has credentials: {bool(student.mobile_password_hash or student.mobile_password_plain)}")
        
    except Exception as e:
        print(f"❌ [MOBILE_LOGIN] Exception occurred: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Login failed'}), 500
    
    print(f"❌ [MOBILE_LOGIN] Reached end without successful login")
    return jsonify({'error': 'Invalid credentials or user not found'}), 401


@mobile_bp.route('/first-time-login', methods=['POST', 'OPTIONS'])
def first_time_login():
    """First-time login to check if user exists and needs password setup"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    if not data or 'phone' not in data:
        return jsonify({'error': 'Phone number is required'}), 400
    
    phone = data['phone']
    
    print(f"First-time login attempt for phone: {phone}")
    
    try:
        # Check if parent exists with this phone
        parent = Parent.query.filter_by(phone=phone).first()
        if parent:
            # Check if mobile password is already set
            has_password = bool(parent.mobile_password_hash or parent.mobile_password_plain)
            
            return jsonify({
                'user_found': True,
                'user_type': 'parent',
                'user_id': parent.id,
                'full_name': parent.full_name,
                'has_mobile_password': has_password,
                'mobile_app_enabled': parent.mobile_app_enabled
            }), 200
        
        # Check if student exists with this phone through users table
        users_with_phone = User.query.filter_by(phone=phone).all()
        students = []
        for user in users_with_phone:
            student = Student.query.filter_by(user_id=user.id).first()
            if student:
                students.append(student)
        
        for student in students:
            if hasattr(student, 'mobile_app_enabled'):
                has_password = bool(
                    (hasattr(student, 'mobile_password_hash') and student.mobile_password_hash) or
                    (hasattr(student, 'mobile_password_plain') and student.mobile_password_plain)
                )
                
                return jsonify({
                    'user_found': True,
                    'user_type': 'student',
                    'user_id': student.id,
                    'full_name': student.name,
                    'has_mobile_password': has_password,
                    'mobile_app_enabled': getattr(student, 'mobile_app_enabled', False),
                    'parent_id': student.parent_id
                }), 200
        
        print(f"No user found for phone: {phone}")
        return jsonify({
            'user_found': False,
            'error': 'No user found with this phone number or mobile access not enabled'
        }), 404
        
    except Exception as e:
        print(f"First-time login error: {str(e)}")
        return jsonify({'error': 'Failed to process first-time login'}), 500


@mobile_bp.route('/setup-mobile-password', methods=['POST', 'OPTIONS'])
def setup_mobile_password():
    """Setup mobile password for first-time users"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    required_fields = ['phone', 'password', 'user_type', 'user_id']
    if not data or not all(field in data for field in required_fields):
        return jsonify({'error': 'Phone, password, user_type, and user_id are required'}), 400
    
    phone = data['phone']
    password = data['password']
    user_type = data['user_type']
    user_id = data['user_id']
    
    print(f"Setup mobile password for {user_type} - ID: {user_id}, Phone: {phone}")
    
    try:
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent or parent.phone != phone:
                return jsonify({'error': 'Parent not found or phone mismatch'}), 404
            
            # Hash and store the password
            from werkzeug.security import generate_password_hash
            parent.mobile_password_hash = generate_password_hash(password)
            parent.mobile_password_plain = None  # Clear plain password if exists
            parent.mobile_app_enabled = True
            
            # Commit changes
            db.session.commit()
            
            # Create JWT token
            additional_claims = {
                'user_type': 'parent',
                'full_name': parent.full_name
            }
            
            access_token = create_access_token(
                identity=str(parent.id),
                additional_claims=additional_claims,
                expires_delta=timedelta(days=30)
            )
            
            return jsonify({
                'access_token': access_token,
                'user': {
                    'id': parent.id,
                    'type': 'parent',
                    'full_name': parent.full_name,
                    'mobile_app_enabled': parent.mobile_app_enabled
                },
                'message': 'Mobile password setup successful'
            }), 200
            
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student or (hasattr(student, 'phone') and student.phone != phone):
                return jsonify({'error': 'Student not found or phone mismatch'}), 404
            
            # Hash and store the password
            from werkzeug.security import generate_password_hash
            if hasattr(student, 'mobile_password_hash'):
                student.mobile_password_hash = generate_password_hash(password)
            if hasattr(student, 'mobile_password_plain'):
                student.mobile_password_plain = None  # Clear plain password if exists
            if hasattr(student, 'mobile_app_enabled'):
                student.mobile_app_enabled = True
            
            # Commit changes
            db.session.commit()
            
            # Create JWT token
            additional_claims = {
                'user_type': 'student',
                'full_name': student.name
            }
            
            access_token = create_access_token(
                identity=str(student.id),
                additional_claims=additional_claims,
                expires_delta=timedelta(days=30)
            )
            
            return jsonify({
                'access_token': access_token,
                'user': {
                    'id': student.id,
                    'type': 'student',
                    'name': student.name,
                    'parent_id': student.parent_id,
                    'mobile_app_enabled': getattr(student, 'mobile_app_enabled', True)
                },
                'message': 'Mobile password setup successful'
            }), 200
            
    except Exception as e:
        print(f"Setup password error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to setup mobile password'}), 500
    
    return jsonify({'error': 'Invalid user type'}), 400


@mobile_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get user profile information"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    try:
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            parent_user = User.query.get(parent.user_id) if parent.user_id else None
            
            return jsonify({
                'id': parent.id,
                'type': 'parent',
                'full_name': parent.full_name,
                'email': parent.email or (parent_user.email if parent_user else None),
                'phone': parent.phone,
                'mobile_app_enabled': parent.mobile_app_enabled,
                'profile_picture_url': parent_user.profile_picture_url if parent_user else None,
                'created_at': parent.created_at.isoformat() if parent.created_at else None
            })
            
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            # Get associated user data for phone and email
            user_data = None
            user = None
            if student.user_id:
                user = User.query.get(student.user_id)
                if user:
                    user_data = {
                        'phone': user.phone,
                        'email': user.email
                    }
            
            return jsonify({
                'id': student.id,
                'type': 'student',
                'name': student.name,
                'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
                'phone': user_data.get('phone') if user_data else None,
                'email': user_data.get('email') if user_data else None,
                'parent_id': student.parent_id,
                'mobile_app_enabled': getattr(student, 'mobile_app_enabled', False),
                'profile_picture_url': user.profile_picture_url if user else None,
                'created_at': student.created_at.isoformat() if student.created_at else None
            })
            
    except Exception as e:
        print(f"Profile error: {str(e)}")
        return jsonify({'error': 'Failed to get profile'}), 500
    
    return jsonify({'error': 'Invalid user type'}), 400


@mobile_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def mobile_dashboard():
    """Get comprehensive dashboard data for mobile users matching website functionality"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')

    try:
        if user_type == 'parent':
            return get_parent_dashboard(user_id)
        elif user_type == 'student':
            return get_student_dashboard(user_id)
        else:
            return jsonify({'error': 'Invalid user type'}), 400
    except Exception as e:
        print(f"Dashboard error: {str(e)}")
        return jsonify({'error': 'Failed to load dashboard'}), 500


def get_parent_dashboard(user_id):
    """Enhanced parent dashboard with comprehensive student tracking"""
    parent = Parent.query.get(user_id)
    if not parent:
        return jsonify({'error': 'Parent not found'}), 404

    # Get parent user info
    parent_user = User.query.get(parent.user_id) if parent.user_id else None
    
    students_data = []
    overall_summary = {
        'total_debt': 0,
        'total_students': 0,
        'students_with_debt': 0,
        'students_clear': 0,
        'total_enrollments': 0,
        'overall_attendance_rate': 0
    }

    for student in parent.students:
        student_info = get_comprehensive_student_data(student)
        students_data.append(student_info)
        
        # Update overall summary
        overall_summary['total_debt'] += student_info['payment_summary']['total_debt']
        overall_summary['total_enrollments'] += len(student_info['enrollments'])
        
        if student_info['payment_summary']['total_debt'] > 0:
            overall_summary['students_with_debt'] += 1
        else:
            overall_summary['students_clear'] += 1

    overall_summary['total_students'] = len(students_data)
    
    # Calculate overall attendance rate
    if students_data:
        attendance_rates = [s['attendance_summary']['attendance_rate'] 
                          for s in students_data if s['attendance_summary']['total_sessions'] > 0]
        overall_summary['overall_attendance_rate'] = round(
            sum(attendance_rates) / len(attendance_rates) if attendance_rates else 0, 1
        )

    return jsonify({
        'type': 'parent',
        'user': {
            'id': parent.id,
            'name': parent_user.full_name if parent_user else parent.full_name,
            'email': parent_user.email if parent_user else parent.email,
            'type': 'parent',
            'mobile_app_enabled': parent.mobile_app_enabled,
            'profile_picture_url': parent_user.profile_picture_url if parent_user else None
        },
        'students': students_data,
        'overall_summary': overall_summary
    }), 200


def get_student_dashboard(user_id):
    """Enhanced student dashboard with comprehensive tracking"""
    student = Student.query.get(user_id)
    if not student:
        return jsonify({'error': 'Student not found'}), 404

    # Get associated user data for profile picture
    user = User.query.get(student.user_id) if student.user_id else None

    student_data = get_comprehensive_student_data(student)
    
    return jsonify({
        'type': 'student',
        'user': {
            'id': student.id,
            'student_id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
            'type': 'student',
            'parent_id': student.parent_id,
            'profile_picture_url': user.profile_picture_url if user else None
        },
        **student_data
    }), 200


def get_comprehensive_student_data(student):
    """Get comprehensive student data with integrated attendance and payment tracking"""
    
    # Get associated user data for profile picture
    user = User.query.get(student.user_id) if student.user_id else None
    
    # Get all enrollments (including pending ones)
    enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
    section_enrollments = SectionEnrollment.query.filter_by(student_id=student.id, is_active=True).all()
    
    enrollment_data = []
    payment_summary = {
        'total_debt': float(student.total_debt) if student.total_debt else 0.0,
        'courses_with_debt': 0,
        'courses_clear': 0,
        'enrollment_debts': []
    }
    
    attendance_summary = {
        'total_sessions': 0,
        'present_sessions': 0,
        'absent_sessions': 0,
        'late_sessions': 0,
        'attendance_rate': 0
    }

    # Process regular enrollments
    for enrollment in enrollments:
        class_info = Class.query.get(enrollment.class_id)
        if not class_info or not class_info.course:
            continue
            
        course = class_info.course
        
        # Get attendance data for this enrollment
        attendance_records = Attendance.query.filter_by(
            student_id=student.id,
            class_id=class_info.id
        ).all()
        
        # Count attendance
        present_count = sum(1 for a in attendance_records if a.status == 'present')
        absent_count = sum(1 for a in attendance_records if a.status == 'absent')
        late_count = sum(1 for a in attendance_records if a.status == 'late')
        total_count = len(attendance_records)
        
        # Update overall attendance summary
        attendance_summary['total_sessions'] += total_count
        attendance_summary['present_sessions'] += present_count
        attendance_summary['absent_sessions'] += absent_count
        attendance_summary['late_sessions'] += late_count
        
        # Handle payment info based on enrollment type
        if enrollment.is_kindergarten_subscription:
            # Kindergarten subscription-based payment
            payment_info = {
                'type': 'kindergarten_subscription',
                'subscription_status': enrollment.subscription_status,
                'subscription_amount': float(enrollment.subscription_amount) if enrollment.subscription_amount else 0.0,
                'next_payment_date': enrollment.next_subscription_date.isoformat() if enrollment.next_subscription_date else None,
                'subscription_start_date': enrollment.subscription_start_date.isoformat() if enrollment.subscription_start_date else None,
                'debt_amount': 0.0,  # No debt for subscriptions
                'status': 'subscription_active' if enrollment.subscription_status == 'active' else 'subscription_pending',
                'unpaid_sessions': 0,  # Not applicable for subscriptions
                'course_price': float(enrollment.subscription_amount) if enrollment.subscription_amount else 0.0
            }
            payment_summary['courses_clear'] += 1  # Subscriptions are always "clear"
        else:
            # Regular attendance-based payment
            enrollment_debt = float(enrollment.total_debt) if enrollment.total_debt else 0.0
            unpaid_sessions = sum(1 for a in attendance_records 
                                if a.status == 'present' and getattr(a, 'payment_status', 'unpaid') == 'unpaid') if attendance_records else 0
            
            # Determine payment status
            if enrollment_debt > 0:
                payment_summary['courses_with_debt'] += 1
                payment_status = 'debt'
            else:
                payment_summary['courses_clear'] += 1
                payment_status = 'clear'
            
            # Add to enrollment debts for detailed view
            if enrollment_debt > 0:
                payment_summary['enrollment_debts'].append({
                    'course_name': course.name,
                    'debt_amount': enrollment_debt,
                    'debt_sessions': unpaid_sessions
                })
            
            payment_info = {
                'type': getattr(course, 'pricing_type', 'session') or 'session',
                'debt_amount': enrollment_debt,
                'status': payment_status,
                'unpaid_sessions': unpaid_sessions,
                'course_price': float(course.price) if course.price else 0.0
            }
        
        # Calculate attendance rate for this enrollment
        attendance_rate = 0
        if total_count > 0:
            attendance_rate = round((present_count / total_count) * 100, 1)
        
        # Build enrollment_info dictionary
        enrollment_info = {
            'id': enrollment.id,
            'course_id': course.id,
            'course_name': course.name,
            'course_category': course.category,
            'class_id': class_info.id,
            'class_name': class_info.name,
            'schedule': class_info.schedule,
            'enrollment_date': enrollment.enrollment_date.strftime('%Y-%m-%d') if enrollment.enrollment_date else None,
            'status': enrollment.status if enrollment.status else 'pending',  # status is enum: pending/approved/rejected
            'is_kindergarten': enrollment.is_kindergarten_subscription,
            'subscription_status': enrollment.subscription_status if enrollment.is_kindergarten_subscription else None,
            'next_subscription_date': enrollment.next_subscription_date.isoformat() if enrollment.is_kindergarten_subscription and enrollment.next_subscription_date else None,
            'subscription_amount': float(enrollment.subscription_amount) if enrollment.is_kindergarten_subscription and enrollment.subscription_amount else None,
            'attendance_summary': {
                'total_sessions': total_count,
                'present_sessions': present_count,
                'absent_sessions': absent_count,
                'late_sessions': late_count,
                'attendance_rate': attendance_rate
            },
            'payment_info': payment_info
        }
        
        enrollment_data.append(enrollment_info)
    
    # Process section enrollments
    for section_enrollment in section_enrollments:
        section = CourseSection.query.get(section_enrollment.section_id)
        if not section or not section.course:
            continue
            
        course = section.course
        
        # For section enrollments, we don't have class-based attendance
        # This is a simpler enrollment type
        enrollment_info = {
            'id': section_enrollment.id,
            'course_name': course.name,
            'section_name': section.name,
            'schedule': section.schedule or 'TBA',
            'enrollment_date': section_enrollment.enrollment_date.strftime('%Y-%m-%d') if section_enrollment.enrollment_date else None,
            'status': 'approved',  # Section enrollments are typically auto-approved
            'attendance_summary': {
                'total_sessions': 0,
                'present_sessions': 0,
                'absent_sessions': 0,
                'late_sessions': 0,
                'attendance_rate': 0
            },
            'payment_info': {
                'type': getattr(course, 'pricing_type', 'session') or 'session',
                'debt_amount': 0.0,
                'status': 'clear',
                'unpaid_sessions': 0,
                'course_price': float(course.price) if course.price else 0.0
            }
        }
        
        enrollment_data.append(enrollment_info)
        payment_summary['courses_clear'] += 1

    # Calculate overall attendance rate
    if attendance_summary['total_sessions'] > 0:
        attendance_summary['attendance_rate'] = round(
            (attendance_summary['present_sessions'] / attendance_summary['total_sessions']) * 100, 1
        )

    # Get recent attendance (last 10 records)
    recent_attendance_query = db.session.query(Attendance, Class, Course).join(
        Class, Attendance.class_id == Class.id
    ).join(
        Course, Class.course_id == Course.id
    ).filter(
        Attendance.student_id == student.id
    ).order_by(Attendance.attendance_date.desc()).limit(10)
    
    recent_attendance = []
    for attendance, class_info, course in recent_attendance_query:
        recent_attendance.append({
            'id': attendance.id,
            'date': attendance.attendance_date.strftime('%Y-%m-%d'),
            'class_name': class_info.name,
            'course_name': course.name,
            'status': attendance.status,
            'payment_status': getattr(attendance, 'payment_status', 'paid'),
            'marked_at': attendance.marked_at.strftime('%H:%M') if attendance.marked_at else None
        })

    return {
        'id': student.id,
        'name': student.name,
        'profile_picture_url': user.profile_picture_url if user else None,
        'enrollments': enrollment_data,
        'recent_attendance': recent_attendance,
        'payment_summary': payment_summary,
        'attendance_summary': attendance_summary
    }


@mobile_bp.route('/attendance', methods=['GET'])
@jwt_required()
def get_attendance():
    """Get comprehensive attendance data for mobile users"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    try:
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            all_attendance = []
            for student in parent.students:
                student_attendance = get_student_attendance(student)
                all_attendance.extend(student_attendance)
            
            # Sort by date descending
            all_attendance.sort(key=lambda x: x['date'], reverse=True)
            
            return jsonify({'attendance': all_attendance}), 200
            
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            attendance_data = get_student_attendance(student)
            return jsonify({'attendance': attendance_data}), 200
            
    except Exception as e:
        print(f"Attendance error: {str(e)}")
        return jsonify({'error': 'Failed to get attendance'}), 500
    
    return jsonify({'error': 'Invalid user type'}), 400


def get_student_attendance(student):
    """Get detailed attendance records for a student"""
    attendance_query = db.session.query(Attendance, Class, Course).join(
        Class, Attendance.class_id == Class.id
    ).join(
        Course, Class.course_id == Course.id
    ).filter(
        Attendance.student_id == student.id
    ).order_by(Attendance.attendance_date.desc())
    
    attendance_data = []
    for attendance, class_info, course in attendance_query:
        attendance_data.append({
            'id': attendance.id,
            'student_name': student.name,
            'date': attendance.attendance_date.strftime('%Y-%m-%d'),
            'class_name': class_info.name,
            'course_name': course.name,
            'status': attendance.status,
            'payment_status': getattr(attendance, 'payment_status', 'paid'),
            'marked_at': attendance.marked_at.strftime('%H:%M') if attendance.marked_at else None,
            'qr_code_scanned': getattr(attendance, 'qr_code_scanned', False)
        })
    
    return attendance_data


@mobile_bp.route('/schedule', methods=['GET'])
@jwt_required()
def get_schedule():
    """Get schedule data for mobile users"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    try:
        schedule_data = []
        
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            for student in parent.students:
                enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
                for enrollment in enrollments:
                    class_info = Class.query.get(enrollment.class_id)
                    if class_info and class_info.course:
                        schedule_data.append({
                            'enrollment_id': enrollment.id,
                            'student_name': student.name,
                            'class_name': class_info.name,
                            'course_name': class_info.course.name,
                            'day_of_week': class_info.day_of_week,
                            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBA',
                            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBA',
                            'is_active': enrollment.is_active,
                            'status': enrollment.status
                        })
                        
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            for enrollment in enrollments:
                class_info = Class.query.get(enrollment.class_id)
                if class_info and class_info.course:
                    schedule_data.append({
                        'enrollment_id': enrollment.id,
                        'student_name': student.name,
                        'class_name': class_info.name,
                        'course_name': class_info.course.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBA',
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBA',
                        'is_active': enrollment.is_active,
                        'status': enrollment.status
                    })
        
        return jsonify({'schedule': schedule_data}), 200
        
    except Exception as e:
        print(f"Schedule error: {str(e)}")
        return jsonify({'error': 'Failed to get schedule'}), 500


# Additional mobile endpoints can be added here as needed

@mobile_bp.route('/debug-user', methods=['POST', 'OPTIONS'])
def debug_user():
    """Debug endpoint to check user credentials setup"""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    if not data or 'phone' not in data:
        return jsonify({'error': 'Phone number is required'}), 400
    
    phone = data['phone']
    
    try:
        # Check parent
        parent = Parent.query.filter_by(phone=phone).first()
        if parent:
            return jsonify({
                'user_type': 'parent',
                'found': True,
                'full_name': parent.full_name,
                'mobile_app_enabled': parent.mobile_app_enabled,
                'has_mobile_password_hash': bool(parent.mobile_password_hash),
                'has_mobile_password_plain': bool(parent.mobile_password_plain)
            }), 200
        
        # Check students through users table
        users_with_phone = User.query.filter_by(phone=phone).all()
        students = []
        for user in users_with_phone:
            student = Student.query.filter_by(user_id=user.id).first()
            if student:
                students.append(student)
        
        if students:
            student_data = []
            for student in students:
                student_data.append({
                    'name': student.name,
                    'mobile_app_enabled': hasattr(student, 'mobile_app_enabled') and student.mobile_app_enabled,
                    'has_mobile_password_hash': hasattr(student, 'mobile_password_hash') and bool(student.mobile_password_hash),
                    'has_mobile_password_plain': hasattr(student, 'mobile_password_plain') and bool(student.mobile_password_plain)
                })
            
            return jsonify({
                'user_type': 'student',
                'found': True,
                'students': student_data
            }), 200
        
        return jsonify({'found': False}), 404
        
    except Exception as e:
        print(f"Debug error: {str(e)}")
        return jsonify({'error': f'Debug failed: {str(e)}'}), 500


@mobile_bp.route('/generate-credentials', methods=['POST', 'OPTIONS'])
def generate_credentials():
    """Generate mobile credentials for testing - REMOVE IN PRODUCTION"""
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    if not data or 'phone' not in data or 'password' not in data:
        return jsonify({'error': 'Phone number and password are required'}), 400
    
    phone = data['phone']
    password = data['password']
    
    try:
        from werkzeug.security import generate_password_hash
        
        # Check parent
        parent = Parent.query.filter_by(phone=phone).first()
        if parent:
            parent.mobile_password_hash = generate_password_hash(password)
            parent.mobile_password_plain = password
            parent.mobile_app_enabled = True
            
            db.session.commit()
            
            return jsonify({
                'message': 'Parent credentials generated successfully',
                'user_type': 'parent',
                'mobile_password': password  # Only for testing
            }), 200
        
        # Check students through users table
        users_with_phone = User.query.filter_by(phone=phone).all()
        for user in users_with_phone:
            student = Student.query.filter_by(user_id=user.id).first()
            if student:
                if hasattr(student, 'mobile_password_hash'):
                    student.mobile_password_hash = generate_password_hash(password)
                if hasattr(student, 'mobile_password_plain'):
                    student.mobile_password_plain = password
                if hasattr(student, 'mobile_app_enabled'):
                    student.mobile_app_enabled = True
                
                db.session.commit()
                
                return jsonify({
                    'message': 'Student credentials generated successfully',
                    'user_type': 'student',
                    'mobile_password': password  # Only for testing
                }), 200
        
        return jsonify({'error': 'No user found with this phone number'}), 404
        
    except Exception as e:
        db.session.rollback()
        print(f"Generate credentials error: {str(e)}")
        return jsonify({'error': f'Failed to generate credentials: {str(e)}'}), 500


@mobile_bp.route('/register-push-token', methods=['POST', 'OPTIONS'])
@jwt_required()
def register_push_token():
    """Register push notification token for mobile user"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    if not data or 'token' not in data:
        return jsonify({'error': 'Push token is required'}), 400
    
    push_token = data['token']
    
    try:
        # Find the correct User record based on user_type
        user = None
        if user_type == 'parent':
            # For parents, find the parent record first, then get their user_id
            parent = Parent.query.get(user_id)
            if parent and parent.user_id:
                user = User.query.get(parent.user_id)
            elif parent:
                # Parent doesn't have a user record, create one or handle differently
                # For now, we'll skip push token registration for parents without user records
                print(f"⚠️ Parent {parent.full_name} (ID: {parent.id}) has no associated user record - skipping push token registration")
                return jsonify({'message': 'Push token registration skipped - no user record found'}), 200
        elif user_type == 'student':
            # For students, use their user_id to find the User record
            student = Student.query.get(user_id)
            if student and student.user_id:
                user = User.query.get(student.user_id)
            else:
                print(f"⚠️ Student ID {user_id} has no associated user record - skipping push token registration")
                return jsonify({'message': 'Push token registration skipped - no user record found'}), 200
        else:
            # Fallback to direct user lookup
            user = User.query.get(user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Update push token
        user.push_token = push_token
        db.session.commit()
        
        print(f"✅ Push token registered for {user_type} {user.full_name}: {push_token[:20]}...")
        return jsonify({'message': 'Push token registered successfully'}), 200
        
    except Exception as e:
        print(f"Push token registration error: {str(e)}")
        db.session.rollback()
        return jsonify({'error': 'Failed to register push token'}), 500


@mobile_bp.route('/user-courses/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_courses(user_id):
    """Get courses for a specific user"""
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Security check - users can only access their own data
    if current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        courses_data = []
        
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            # Get courses for all students of this parent
            for student in parent.students:
                enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
                for enrollment in enrollments:
                    class_info = Class.query.get(enrollment.class_id)
                    if class_info and class_info.course:
                        course = class_info.course
                        courses_data.append({
                            'id': course.id,
                            'name': course.name,
                            'description': course.description,
                            'price': float(course.price) if course.price else 0.0,
                            'pricing_type': getattr(course, 'pricing_type', 'session'),
                            'student_name': student.name,
                            'class_name': class_info.name,
                            'day_of_week': class_info.day_of_week,
                            'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBA',
                            'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBA',
                            'enrollment_status': enrollment.status
                        })
                        
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            # Get courses for this student
            enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
            for enrollment in enrollments:
                class_info = Class.query.get(enrollment.class_id)
                if class_info and class_info.course:
                    course = class_info.course
                    courses_data.append({
                        'id': course.id,
                        'name': course.name,
                        'description': course.description,
                        'price': float(course.price) if course.price else 0.0,
                        'pricing_type': getattr(course, 'pricing_type', 'session'),
                        'student_name': student.name,
                        'class_name': class_info.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else 'TBA',
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else 'TBA',
                        'enrollment_status': enrollment.status
                    })
        
        return jsonify({
            'courses': courses_data,
            'total_courses': len(courses_data)
        }), 200
        
    except Exception as e:
        print(f"Get user courses error: {str(e)}")
        return jsonify({'error': 'Failed to get user courses'}), 500


@mobile_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    """Get payments data for mobile users"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    try:
        payments_data = []
        
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            # Get payment information for all students of this parent
            for student in parent.students:
                student_data = get_comprehensive_student_data(student)
                payments_data.append({
                    'student_name': student.name,
                    'student_id': student.id,
                    'payment_summary': student_data['payment_summary']
                })
                        
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            student_data = get_comprehensive_student_data(student)
            payments_data.append({
                'student_name': student.name,
                'student_id': student.id,
                'payment_summary': student_data['payment_summary']
            })
        
        return jsonify({'payments': payments_data}), 200
        
    except Exception as e:
        print(f"Get payments error: {str(e)}")
        return jsonify({'error': 'Failed to get payments'}), 500


@mobile_bp.route('/change-password', methods=['POST', 'OPTIONS'])
@jwt_required()
def change_password():
    """Change mobile password for authenticated user"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    if not data or 'old_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Old password and new password are required'}), 400
    
    old_password = data['old_password']
    new_password = data['new_password']
    
    try:
        from werkzeug.security import generate_password_hash
        
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404
            
            # Verify old password
            password_valid = False
            if parent.mobile_password_hash:
                password_valid = check_password_hash(parent.mobile_password_hash, old_password)
            elif parent.mobile_password_plain:
                password_valid = (old_password == parent.mobile_password_plain)
            
            if not password_valid:
                return jsonify({'error': 'Invalid old password'}), 400
            
            # Update password
            parent.mobile_password_hash = generate_password_hash(new_password)
            parent.mobile_password_plain = new_password
            db.session.commit()
            
            return jsonify({'message': 'Password changed successfully'}), 200
        
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if not student:
                return jsonify({'error': 'Student not found'}), 404
            
            # Verify old password
            password_valid = False
            if hasattr(student, 'mobile_password_hash') and student.mobile_password_hash:
                password_valid = check_password_hash(student.mobile_password_hash, old_password)
            elif hasattr(student, 'mobile_password_plain') and student.mobile_password_plain:
                password_valid = (old_password == student.mobile_password_plain)
            
            if not password_valid:
                return jsonify({'error': 'Invalid old password'}), 400
            
            # Update password
            if hasattr(student, 'mobile_password_hash'):
                student.mobile_password_hash = generate_password_hash(new_password)
            if hasattr(student, 'mobile_password_plain'):
                student.mobile_password_plain = new_password
            db.session.commit()
            
            return jsonify({'message': 'Password changed successfully'}), 200
        
        return jsonify({'error': 'Invalid user type'}), 400
        
    except Exception as e:
        db.session.rollback()
        print(f"Change password error: {str(e)}")
        return jsonify({'error': 'Failed to change password'}), 500


# Notification routes
@mobile_bp.route('/notifications/<int:user_id>', methods=['GET'])
@jwt_required()
def get_notifications(user_id):
    """Get notifications for user"""
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Security check - users can only get their own notifications, admins can get any
    if current_user_id != user_id and user_type != 'admin':
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Get notifications for the user, ordered by creation date (newest first)
        notifications = Notification.query.filter_by(user_id=user_id)\
            .order_by(Notification.created_at.desc())\
            .all()
        
        notifications_data = []
        for notification in notifications:
            notifications_data.append({
                'id': notification.id,
                # Legacy fields (for backward compatibility)
                'title': notification.title,
                'message': notification.message,
                # Bilingual fields (for language selection)
                'title_en': notification.title_en,
                'title_ar': notification.title_ar,
                'message_en': notification.message_en,
                'message_ar': notification.message_ar,
                'type': notification.type,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat()
            })
        
        return jsonify({
            'notifications': notifications_data,
            'unread_count': len([n for n in notifications if not n.is_read])
        }), 200
        
    except Exception as e:
        print(f"Error getting notifications: {e}")
        return jsonify({'error': 'Failed to get notifications'}), 500


@mobile_bp.route('/notifications/<int:notification_id>/read', methods=['PUT'])
@jwt_required()
def mark_notification_read(notification_id):
    """Mark notification as read"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Map to correct User record for notifications
    actual_user_id = None
    if user_type == 'parent':
        parent = Parent.query.get(user_id)
        if parent and parent.user_id:
            actual_user_id = parent.user_id
    elif user_type == 'student':
        student = Student.query.get(user_id)
        if student and student.user_id:
            actual_user_id = student.user_id
    else:
        actual_user_id = user_id
    
    if not actual_user_id:
        return jsonify({'error': 'User not found'}), 404
    
    try:
        # Find the notification
        notification = Notification.query.get(notification_id)
        if not notification:
            return jsonify({'error': 'Notification not found'}), 404
        
        # Security check - users can only mark their own notifications as read
        if notification.user_id != actual_user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Mark as read
        notification.is_read = True
        db.session.commit()
        
        return jsonify({'message': 'Notification marked as read'}), 200
        
    except Exception as e:
        print(f"Error marking notification as read: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to mark notification as read'}), 500


@mobile_bp.route('/admin/send-notification', methods=['POST'])
@jwt_required()
def admin_send_notification():
    """Admin endpoint to send notification to users"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Only admins can send notifications
    if user_type != 'admin':
        return jsonify({'error': 'Access denied'}), 403
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    
    if not data or 'title' not in data or 'message' not in data:
        return jsonify({'error': 'Title and message are required'}), 400
    
    title = data['title']
    message = data['message']
    notification_type = data.get('type', 'info')
    target_users = data.get('target_users', 'all')  # 'all', 'parents', 'students', or list of user_ids
    
    try:
        from push_notifications import PushNotificationService
        
        users_to_notify = []
        
        if target_users == 'all':
            # Get all users with push tokens
            users_to_notify = User.query.filter(User.push_token.isnot(None)).all()
        elif target_users == 'parents':
            # Get all parents with push tokens
            parent_users = db.session.query(User).join(Parent, User.id == Parent.user_id)\
                .filter(User.push_token.isnot(None)).all()
            users_to_notify = parent_users
        elif target_users == 'students':
            # Get all students with push tokens through their user accounts
            student_users = db.session.query(User).join(Student, User.id == Student.user_id)\
                .filter(User.push_token.isnot(None)).all()
            users_to_notify = student_users
        elif isinstance(target_users, list):
            # Specific user IDs
            users_to_notify = User.query.filter(User.id.in_(target_users), User.push_token.isnot(None)).all()
        
        sent_count = 0
        for user in users_to_notify:
            # Create notification record
            notification = Notification(
                user_id=user.id,
                title=title,
                message=message,
                type=notification_type,
                is_read=False,
                created_at=datetime.utcnow()
            )
            db.session.add(notification)
            
            # Send push notification
            PushNotificationService.send_push_notification(
                user_id=user.id,
                title=title,
                message=message,
                notification_type=notification_type
            )
            sent_count += 1
        
        db.session.commit()
        
        return jsonify({
            'message': f'Notification sent to {sent_count} users',
            'sent_count': sent_count
        }), 200
        
    except Exception as e:
        print(f"Error sending admin notification: {e}")
        db.session.rollback()
        return jsonify({'error': 'Failed to send notification'}), 500


@mobile_bp.route('/admin/notifications/recent', methods=['GET'])
@jwt_required()
def admin_get_recent_notifications():
    """Admin endpoint to get recent notifications"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Only admins can access this
    if user_type != 'admin':
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        # Get recent notifications (last 50)
        notifications = Notification.query.order_by(Notification.created_at.desc()).limit(50).all()
        
        notifications_data = []
        for notification in notifications:
            user = User.query.get(notification.user_id)
            notifications_data.append({
                'id': notification.id,
                'user_id': notification.user_id,
                'user_name': user.full_name if user else 'Unknown User',
                'title': notification.title,
                'message': notification.message,
                'type': notification.type,
                'is_read': notification.is_read,
                'created_at': notification.created_at.isoformat() if notification.created_at else None
            })
        
        return jsonify({
            'notifications': notifications_data,
            'total': len(notifications_data)
        }), 200
        
    except Exception as e:
        print(f"Error fetching recent notifications: {e}")
        return jsonify({'error': 'Failed to fetch notifications'}), 500


@mobile_bp.route('/send-course-reminder', methods=['POST', 'OPTIONS'])
@jwt_required()
def send_course_reminder():
    """Send course reminder notification"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    user_id = int(get_jwt_identity())
    
    # Placeholder implementation
    print(f"Send course reminder from user {user_id}: {data}")
    return jsonify({'message': 'Course reminder sent successfully'}), 200


@mobile_bp.route('/send-attendance-alert', methods=['POST', 'OPTIONS'])
@jwt_required()
def send_attendance_alert():
    """Send attendance alert notification"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    user_id = int(get_jwt_identity())
    
    # Placeholder implementation
    print(f"Send attendance alert from user {user_id}: {data}")
    return jsonify({'message': 'Attendance alert sent successfully'}), 200


@mobile_bp.route('/send-payment-due', methods=['POST', 'OPTIONS'])
@jwt_required()
def send_payment_due():
    """Send payment due notification"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
        return response

    data = request.get_json()
    user_id = int(get_jwt_identity())
    
    # Placeholder implementation
    print(f"Send payment due from user {user_id}: {data}")
    return jsonify({'message': 'Payment due notification sent successfully'}), 200


@mobile_bp.route('/scheduled-notifications/<int:user_id>', methods=['GET'])
@jwt_required()
def get_scheduled_notifications(user_id):
    """Get scheduled notifications for user"""
    current_user_id = int(get_jwt_identity())
    
    # Security check
    if current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    # Placeholder implementation
    return jsonify({'scheduled_notifications': []}), 200


@mobile_bp.route('/cancel-notification/<int:notification_id>', methods=['DELETE'])
@jwt_required()
def cancel_notification(notification_id):
    """Cancel a scheduled notification"""
    user_id = int(get_jwt_identity())
    
    # Placeholder implementation
    print(f"Cancel notification {notification_id} for user {user_id}")
    return jsonify({'message': 'Notification cancelled successfully'}), 200


@mobile_bp.route('/payments-due/<int:user_id>', methods=['GET'])
@jwt_required()
def get_payments_due(user_id):
    """Get payments due for user"""
    current_user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')
    
    # Security check
    if current_user_id != user_id:
        return jsonify({'error': 'Access denied'}), 403
    
    try:
        payments_due = []
        
        if user_type == 'parent':
            parent = Parent.query.get(user_id)
            if parent:
                for student in parent.students:
                    student_data = get_comprehensive_student_data(student)
                    if student_data['payment_summary']['total_debt'] > 0:
                        payments_due.append({
                            'student_name': student.name,
                            'student_id': student.id,
                            'amount_due': student_data['payment_summary']['total_debt'],
                            'enrollment_debts': student_data['payment_summary']['enrollment_debts']
                        })
        
        elif user_type == 'student':
            student = Student.query.get(user_id)
            if student:
                student_data = get_comprehensive_student_data(student)
                if student_data['payment_summary']['total_debt'] > 0:
                    payments_due.append({
                        'student_name': student.name,
                        'student_id': student.id,
                        'amount_due': student_data['payment_summary']['total_debt'],
                        'enrollment_debts': student_data['payment_summary']['enrollment_debts']
                    })
        
        return jsonify({'payments_due': payments_due}), 200
        
    except Exception as e:
        print(f"Get payments due error: {str(e)}")
        return jsonify({'error': 'Failed to get payments due'}), 500