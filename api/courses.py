from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func
import logging
import time
from datetime import datetime, timedelta
import qrcode
import base64
from io import BytesIO
from datetime import datetime, timedelta
import qrcode
import base64
from io import BytesIO

courses_bp = Blueprint('courses', __name__)

# Import models
from models import db, Course, Registration, Student, User, Parent, Class, Enrollment

logger = logging.getLogger(__name__)

@courses_bp.route('', methods=['GET'])
def get_courses():
    """Get all active courses with available seats and pricing information"""
    category_filter = request.args.get('category')
    pricing_type_filter = request.args.get('pricing_type')  # 'session' or 'monthly'
    level_filter = request.args.get('level')  # 'primary', 'middle', 'high', 'preschool'
    grade_filter = request.args.get('grade')  # specific grade like 'primary_1', 'middle_2', etc.
    subject_filter = request.args.get('subject')  # subject name
    search_query = request.args.get('search')  # search in course name/description

    query = Course.query.filter_by(is_active=True)

    if category_filter:
        query = query.filter_by(category=category_filter)

    if pricing_type_filter:
        query = query.filter_by(pricing_type=pricing_type_filter)

    # Handle level-based filtering
    if level_filter:
        if level_filter == 'primary':
            query = query.filter(Course.name.contains('ابتدائي'))
        elif level_filter == 'middle':
            query = query.filter(Course.name.contains('متوسط'))
        elif level_filter == 'high':
            query = query.filter(Course.name.contains('ثانوي'))
        elif level_filter == 'preschool':
            query = query.filter(
                (Course.name.contains('روضة')) |
                (Course.name.contains('تمهيدي')) |
                (Course.name.contains('تحضيري'))
            )

    # Handle specific grade filtering
    if grade_filter:
        if grade_filter == 'preschool_3_4':
            query = query.filter(Course.name.contains('تمهيدي') & Course.name.contains('3/4'))
        elif grade_filter == 'preschool_4_5':
            query = query.filter(Course.name.contains('تمهيدي') & Course.name.contains('4/5'))
        elif grade_filter == 'preschool_5_6':
            query = query.filter(Course.name.contains('تحضيري') & Course.name.contains('5/6'))
        elif grade_filter == 'preschool_year2':
            query = query.filter(Course.name.contains('روضة') & Course.name.contains('الثانية'))
        elif grade_filter == 'primary_1':
            query = query.filter(Course.name.contains('ابتدائي') & Course.name.contains('الأولى'))
        elif grade_filter == 'primary_2':
            query = query.filter(Course.name.contains('ابتدائي') & Course.name.contains('الثانية'))
        elif grade_filter == 'primary_3':
            query = query.filter(Course.name.contains('ابتدائي') & Course.name.contains('الثالثة'))
        elif grade_filter == 'primary_4':
            query = query.filter(Course.name.contains('ابتدائي') & Course.name.contains('الرابعة'))
        elif grade_filter == 'primary_5':
            query = query.filter(Course.name.contains('ابتدائي') & Course.name.contains('الخامسة'))
        elif grade_filter == 'middle_1':
            query = query.filter(Course.name.contains('متوسط') & Course.name.contains('الأولى'))
        elif grade_filter == 'middle_2':
            query = query.filter(Course.name.contains('متوسط') & Course.name.contains('الثانية'))
        elif grade_filter == 'middle_3':
            query = query.filter(Course.name.contains('متوسط') & Course.name.contains('الثالثة'))
        elif grade_filter == 'middle_4':
            query = query.filter(Course.name.contains('متوسط') & Course.name.contains('الرابعة'))
        elif grade_filter == 'high_1':
            query = query.filter(Course.name.contains('ثانوي') & Course.name.contains('الأولى'))
        elif grade_filter == 'high_2':
            query = query.filter(Course.name.contains('ثانوي') & Course.name.contains('الثانية'))
        elif grade_filter == 'high_3':
            query = query.filter(Course.name.contains('ثانوي') & Course.name.contains('الثالثة'))

    # Handle subject filtering
    if subject_filter:
        query = query.filter(Course.name.contains(subject_filter))

    # Handle search query
    if search_query:
        search_filter = f"%{search_query}%"
        query = query.filter(
            (Course.name.ilike(search_filter)) |
            (Course.description.ilike(search_filter)) |
            (Course.name_en.ilike(search_filter)) |
            (Course.name_ar.ilike(search_filter)) |
            (Course.description_en.ilike(search_filter)) |
            (Course.description_ar.ilike(search_filter))
        )

    courses = query.all()

    courses_data = []
    for course in courses:
        # Build pricing information
        pricing_info = {
            'pricing_type': course.pricing_type,
            'currency': 'DA',  # Algerian Dinar
        }

        if course.pricing_type == 'session':
            pricing_info.update({
                'session_price': float(course.session_price) if course.session_price else float(course.price),
                'session_duration_hours': course.session_duration,
                'display_price': f"{float(course.session_price) if course.session_price else float(course.price)} DA/session ({course.session_duration}h)"
            })
        elif course.pricing_type == 'monthly':
            pricing_info.update({
                'monthly_price': float(course.monthly_price) if course.monthly_price else float(course.price),
                'display_price': f"{float(course.monthly_price) if course.monthly_price else float(course.price)} DA/month"
            })

        courses_data.append({
            'id': course.id,
            'name': course.name,
            'name_en': course.name_en,
            'name_ar': course.name_ar,
            'description': course.description,
            'description_en': course.description_en,
            'description_ar': course.description_ar,
            'price': float(course.price),  # Keep for backward compatibility
            'pricing_info': pricing_info,
            'total_seats': course.max_students,
            'available_seats': course.max_students,  # Will be calculated properly later
            'category': course.category,
            'is_active': course.is_active,
            'image_url': course.image_url,
            'session_duration_hours': course.session_duration,
            'created_at': course.created_at.isoformat() if course.created_at else None
        })

    return jsonify({'courses': courses_data}), 200

@courses_bp.route('/<int:course_id>', methods=['GET'])
def get_course(course_id):
    """Get specific course details"""
    course = Course.query.get(course_id)

    if not course or not course.is_active:
        return jsonify({'error': 'Course not found'}), 404

    # Count current registrations
    registration_count = Registration.query.filter_by(
        course_id=course.id,
        status='approved'
    ).count()

    available_seats = max(0, course.max_students - registration_count)

    # Build pricing information
    pricing_info = {
        'pricing_type': course.pricing_type,
        'currency': 'DA',  # Algerian Dinar
    }

    if course.pricing_type == 'session':
        pricing_info.update({
            'session_price': float(course.session_price) if course.session_price else float(course.price),
            'session_duration_hours': course.session_duration,
            'display_price': f"{float(course.session_price) if course.session_price else float(course.price)} DA/session ({course.session_duration}h)"
        })
    elif course.pricing_type == 'monthly':
        pricing_info.update({
            'monthly_price': float(course.monthly_price) if course.monthly_price else float(course.price),
            'display_price': f"{float(course.monthly_price) if course.monthly_price else float(course.price)} DA/month"
        })

    return jsonify({
        'course': {
            'id': course.id,
            'name': course.name,
            'name_en': course.name_en,
            'name_ar': course.name_ar,
            'description': course.description,
            'description_en': course.description_en,
            'description_ar': course.description_ar,
            'price': float(course.price),  # Keep for backward compatibility
            'pricing_info': pricing_info,
            'max_students': course.max_students,
            'available_seats': available_seats,
            'category': course.category,
            'is_active': course.is_active,
            'image_url': course.image_url,
            'session_duration_hours': course.session_duration,
            'created_at': course.created_at.isoformat() if course.created_at else None
        }
    }), 200

@courses_bp.route('/filters', methods=['GET'])
def get_course_filters():
    """Get available course filters and categories"""
    # Get unique categories
    categories = db.session.query(Course.category).filter(Course.is_active == True).distinct().all()
    categories = [cat[0] for cat in categories]

    # Get pricing types
    pricing_types = ['session', 'monthly']

    # Define detailed educational levels with specific grades
    levels = [
        {
            'id': 'preschool',
            'name': 'روضة وتمهيدي',
            'name_en': 'Preschool & Preparatory',
            'grades': [
                {'id': 'preschool_3_4', 'name': 'تمهيدي 3/4 سنوات'},
                {'id': 'preschool_4_5', 'name': 'تمهيدي 4/5 سنوات'},
                {'id': 'preschool_5_6', 'name': 'تحضيري 5/6 سنوات'},
                {'id': 'preschool_year2', 'name': 'روضة السنة الثانية'}
            ]
        },
        {
            'id': 'primary',
            'name': 'ابتدائي',
            'name_en': 'Primary School',
            'grades': [
                {'id': 'primary_1', 'name': 'السنة الأولى'},
                {'id': 'primary_2', 'name': 'السنة الثانية'},
                {'id': 'primary_3', 'name': 'السنة الثالثة'},
                {'id': 'primary_4', 'name': 'السنة الرابعة'},
                {'id': 'primary_5', 'name': 'السنة الخامسة'}
            ]
        },
        {
            'id': 'middle',
            'name': 'متوسط',
            'name_en': 'Middle School',
            'grades': [
                {'id': 'middle_1', 'name': 'السنة الأولى'},
                {'id': 'middle_2', 'name': 'السنة الثانية'},
                {'id': 'middle_3', 'name': 'السنة الثالثة'},
                {'id': 'middle_4', 'name': 'السنة الرابعة'}
            ]
        },
        {
            'id': 'high',
            'name': 'ثانوي',
            'name_en': 'High School',
            'grades': [
                {'id': 'high_1', 'name': 'السنة الأولى'},
                {'id': 'high_2', 'name': 'السنة الثانية'},
                {'id': 'high_3', 'name': 'السنة الثالثة'}
            ]
        }
    ]

    # Get subjects for each level
    subjects = {
        'preschool': ['تمهيدي', 'تحضيري', 'روضة'],
        'primary': ['رياضيات', 'عربية', 'فرنسية', 'إنجليزية', 'تحسين الخط والكتابة'],
        'middle': ['رياضيات', 'فيزياء', 'علوم', 'عربية', 'فرنسية', 'إنجليزية'],
        'high': ['رياضيات', 'فيزياء', 'علوم', 'عربية', 'فرنسية', 'إنجليزية', 'تسيير واقتصاد', 'فلسفة']
    }

    # Get price ranges
    price_ranges = {
        'session': {
            'min': 400.00,
            'max': 400.00,
            'currency': 'DA'
        },
        'monthly': {
            'min': 1500.00,
            'max': 7500.00,
            'currency': 'DA'
        }
    }

    return jsonify({
        'filters': {
            'categories': categories,
            'pricing_types': pricing_types,
            'levels': levels,
            'subjects': subjects,
            'price_ranges': price_ranges,
            'currency': 'DA'
        }
    }), 200

@courses_bp.route('/register', methods=['POST'])
@jwt_required()
def register_for_course():
    """Register a student for a course"""
    user_id = get_jwt_identity()
    data = request.get_json()

    if 'course_id' not in data or 'student_id' not in data:
        return jsonify({'error': 'Course ID and Student ID are required'}), 400

    course_id = data['course_id']
    student_id = data['student_id']

    # Verify course exists and is active
    course = Course.query.get(course_id)
    if not course or not course.is_active:
        return jsonify({'error': 'Course not found or inactive'}), 404

    # Handle direct student registration (when user is the student)
    if student_id == user_id:
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Get parent record for this user
        parent = Parent.query.filter_by(user_id=user_id).first()
        if not parent:
            return jsonify({'error': 'Parent record not found'}), 404

        # Check if student record exists for this parent, create if not
        student = Student.query.filter_by(parent_id=parent.id).first()
        if not student:
            # Create a student record for the parent
            from datetime import date
            student = Student(
                parent_id=parent.id,
                name=user.full_name,
                date_of_birth=date.today()  # Default DOB, can be updated later
            )
            db.session.add(student)
            db.session.commit()

        # Use the actual student ID
        actual_student_id = student.id

        # Check if already registered
        existing_registration = Registration.query.filter_by(
            user_id=user_id,
            parent_id=parent.id,
            course_id=course_id,
            student_id=actual_student_id
        ).first()

        if existing_registration:
            return jsonify({'error': 'Already registered for this course'}), 409

        # Check available seats
        registration_count = Registration.query.filter_by(
            course_id=course_id,
            status='approved'
        ).count()

        if registration_count >= course.max_students:
            return jsonify({'error': 'No available seats for this course'}), 409

        # Create registration for the user as student
        registration = Registration(
            user_id=user_id,
            parent_id=parent.id,
            course_id=course_id,
            student_id=actual_student_id,
            status='pending'
        )

        db.session.add(registration)
        db.session.commit()

        return jsonify({
            'message': 'Registration request submitted successfully',
            'registration_id': registration.id
        }), 201

    # Original logic for parent registering a separate student
    # Verify student belongs to user
    parent = Parent.query.filter_by(user_id=user_id).first()
    if not parent:
        return jsonify({'error': 'Parent record not found'}), 404
        
    student = Student.query.filter_by(id=student_id, parent_id=parent.id).first()
    if not student:
        return jsonify({'error': 'Student not found or does not belong to you'}), 404

    # Check if already registered
    existing_registration = Registration.query.filter_by(
        user_id=user_id,
        parent_id=parent.id,
        course_id=course_id,
        student_id=student_id
    ).first()

    if existing_registration:
        return jsonify({'error': 'Already registered for this course'}), 409

    # Check available seats
    registration_count = Registration.query.filter_by(
        course_id=course_id,
        status='approved'
    ).count()

    if registration_count >= course.max_students:
        return jsonify({'error': 'No available seats for this course'}), 409

    # Create registration
    registration = Registration(
        user_id=user_id,
        parent_id=parent.id,
        course_id=course_id,
        student_id=student_id,
        status='pending'
    )

    db.session.add(registration)
    db.session.commit()

    return jsonify({
        'message': 'Registration request submitted successfully',
        'registration_id': registration.id
    }), 201

@courses_bp.route('/my-registrations', methods=['GET'])
@jwt_required()
def get_my_registrations():
    """Get user's registration requests"""
    user_id = get_jwt_identity()
    
    # Get parent record for client users
    parent = Parent.query.filter_by(user_id=user_id).first()
    if not parent:
        return jsonify({'registrations': []}), 200
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            registrations = Registration.query.filter_by(parent_id=parent.id).all()
            break  # Success, exit retry loop
        except Exception as e:
            if attempt == max_retries - 1:  # Last attempt
                logger.error(f"Database error after {max_retries} attempts: {e}")
                return jsonify({
                    'error': 'Database temporarily unavailable', 
                    'message': 'Please try again in a few moments'
                }), 503
            logger.warning(f"Database attempt {attempt + 1} failed: {e}")
            time.sleep(1)  # Wait 1 second before retry

    registrations_data = []
    for reg in registrations:
        course = Course.query.get(reg.course_id)
        if not course:
            continue
            
        # Handle case where student_id equals user_id (user registering themselves)
        if reg.student_id == user_id:
            # Use user information instead of student record
            user = User.query.get(user_id)
            student_info = {
                'id': user.id,
                'name': user.full_name
            }
        else:
            # Get student information from students table
            student = Student.query.get(reg.student_id)
            if student:
                student_info = {
                    'id': student.id,
                    'name': student.name
                }
            else:
                # Fallback if student record not found
                student_info = {
                    'id': reg.student_id,
                    'name': 'Unknown Student'
                }

        registrations_data.append({
            'id': reg.id,
            'course': {
                'id': course.id,
                'name': course.name,
                'description': course.description,
                'price': float(course.price),
                'category': course.category,
                'image_url': course.image_url
            },
            'student': student_info,
            'status': reg.status,
            'notes': reg.notes,
            'created_at': reg.created_at.isoformat()
        })

    return jsonify({'registrations': registrations_data}), 200

@courses_bp.route('/payment-info', methods=['GET'])
@jwt_required()
def get_payment_info():
    """Get user's payment information"""
    user_id = get_jwt_identity()

    # Get user's approved registrations
    approved_registrations = Registration.query.filter_by(
        user_id=user_id,
        status='approved'
    ).all()

    if not approved_registrations:
        return jsonify({
            'total_paid': 0,
            'amount_due': 0,
            'next_payment_due': None,
            'last_payment_date': None
        }), 200

    # Calculate total paid (sum of course prices for approved registrations)
    total_paid = sum(float(reg.course.price) for reg in approved_registrations)

    next_payment_due = (datetime.now() + timedelta(days=30)).isoformat()
    amount_due = total_paid * 0.1  # Assume 10% of total as next payment

    return jsonify({
        'total_paid': total_paid,
        'amount_due': amount_due,
        'next_payment_due': next_payment_due,
        'last_payment_date': datetime.now().isoformat()
    }), 200

# Admin routes
@courses_bp.route('', methods=['POST'])
@jwt_required()
def create_course():
    """Create a new course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()

    required_fields = ['name', 'price', 'max_students']
    for field in required_fields:
        if field not in data:
            return jsonify({'error': f'{field} is required'}), 400

    course = Course(
        name=data['name'],
        description=data.get('description', ''),
        price=data['price'],
        max_students=data['max_students']
    )

    db.session.add(course)
    db.session.flush()  # Get the course ID before committing

    # Create a default section for the course
    default_section = Class(
        course_id=course.id,
        name=f"{course.name} - Section 1",
        day_of_week=1,  # Monday by default
        start_time="09:00:00",
        end_time="10:30:00",
        max_students=data['max_students'],  # Use course max_students as default
        is_active=True
    )

    db.session.add(default_section)
    db.session.commit()

    return jsonify({
        'message': 'Course created successfully with default section',
        'course_id': course.id,
        'section_id': default_section.id
    }), 201

@courses_bp.route('/<int:course_id>', methods=['PUT'])
@jwt_required()
def update_course(course_id):
    """Update course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    data = request.get_json()

    if 'name' in data:
        course.name = data['name']
    if 'description' in data:
        course.description = data['description']
    if 'price' in data:
        course.price = data['price']
    if 'max_students' in data:
        course.max_students = data['max_students']
    if 'is_active' in data:
        course.is_active = data['is_active']

    db.session.commit()

    return jsonify({'message': 'Course updated successfully'}), 200

@courses_bp.route('/<int:course_id>', methods=['DELETE'])
@jwt_required()
def delete_course(course_id):
    """Delete course (Admin only)"""
    user_id = get_jwt_identity()
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    course = Course.query.get(course_id)
    if not course:
        return jsonify({'error': 'Course not found'}), 404

    # Check if course has active registrations
    active_registrations = Registration.query.filter_by(
        course_id=course_id,
        status='approved'
    ).count()

    if active_registrations > 0:
        return jsonify({'error': 'Cannot delete course with active registrations'}), 409

    db.session.delete(course)
    db.session.commit()

    return jsonify({'message': 'Course deleted successfully'}), 200

@courses_bp.route('/categories', methods=['GET'])
def get_categories():
    """Get all available course categories"""
    categories = db.session.query(Course.category).filter(Course.is_active == True).distinct().all()
    
    category_list = [cat[0] for cat in categories if cat[0]]
    
    return jsonify({'categories': category_list}), 200

# Course Sections Endpoints
@courses_bp.route('/<int:course_id>/sections', methods=['GET'])
def get_course_sections(course_id):
    """Get all sections for a specific course"""
    course = Course.query.get_or_404(course_id)

    # Optimized query: Get sections with enrollment counts in a single query
    sections_query = db.session.query(
        Class,
        func.count(Enrollment.id).label('enrollment_count')
    ).outerjoin(
        Enrollment,
        (Enrollment.class_id == Class.id) & (Enrollment.is_active == True)
    ).filter(
        Class.course_id == course_id
    ).group_by(Class.id).all()

    sections_data = []
    for section, enrollment_count in sections_query:
        sections_data.append({
            'id': section.id,
            'course_id': section.course_id,
            'section_name': section.name,
            'schedule': section.schedule,
            'day_of_week': section.day_of_week,
            'start_time': section.start_time.strftime('%H:%M') if section.start_time else None,
            'end_time': section.end_time.strftime('%H:%M') if section.end_time else None,
            'max_students': section.max_students,
            'current_students': enrollment_count,
            'available_seats': max(0, section.max_students - enrollment_count),
            'is_active': section.is_active,
            'qr_code_data': section.qr_code_data,
            'qr_code_expires': section.qr_code_expires.isoformat() if section.qr_code_expires else None
        })

    return jsonify({'sections': sections_data}), 200

@courses_bp.route('/<int:course_id>/sections', methods=['POST'])
@jwt_required()
def create_course_section(course_id):
    """Create a new section for a course (Admin only)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    
    course = Course.query.get_or_404(course_id)
    
    data = request.get_json()
    
    new_section = Class(
        course_id=course_id,
        name=data.get('section_name', f"{course.name} - New Section"),
        day_of_week=data.get('day_of_week', 1),
        start_time=data.get('start_time', '09:00:00'),
        end_time=data.get('end_time', '10:30:00'),
        max_students=data.get('max_students', 30),
        is_active=data.get('is_active', True)
    )
    
    db.session.add(new_section)
    db.session.commit()
    
    return jsonify({
        'message': 'Course section created successfully',
        'section': {
            'id': new_section.id,
            'course_id': new_section.course_id,
            'section_name': new_section.name,
            'schedule': new_section.schedule,
            'day_of_week': new_section.day_of_week,
            'start_time': new_section.start_time.strftime('%H:%M') if new_section.start_time else None,
            'end_time': new_section.end_time.strftime('%H:%M') if new_section.end_time else None,
            'max_students': new_section.max_students,
            'current_students': new_section.current_students,
            'is_active': new_section.is_active,
            'qr_code_data': new_section.qr_code_data,
            'qr_code_expires': new_section.qr_code_expires.isoformat() if new_section.qr_code_expires else None
        }
    }), 201

@courses_bp.route('/sections/<int:section_id>', methods=['PUT'])
@jwt_required()
def update_course_section(section_id):
    """Update a course section (Admin only)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    
    section = Class.query.get_or_404(section_id)
    
    data = request.get_json()
    
    # Handle section_name -> name mapping
    if 'section_name' in data:
        section.name = data['section_name']
    
    # Handle schedule string parsing
    if 'schedule' in data:
        if data['schedule'] == 'TBD':
            # Set to sentinel values for TBD schedules
            section.day_of_week = -1  # Use -1 to indicate TBD
            section.start_time = datetime.strptime('00:00', '%H:%M').time()
            section.end_time = datetime.strptime('00:00', '%H:%M').time()
        else:
            schedule_parts = data['schedule'].split(' ')
            if len(schedule_parts) >= 2:
                day_name = schedule_parts[0]
                time_range = schedule_parts[1]
                
                # Map day name to day_of_week integer
                days_map = {
                    'Monday': 0, 'Tuesday': 1, 'Wednesday': 2, 'Thursday': 3,
                    'Friday': 4, 'Saturday': 5, 'Sunday': 6,
                    'Mon': 0, 'Tue': 1, 'Wed': 2, 'Thu': 3,
                    'Fri': 4, 'Sat': 5, 'Sun': 6
                }
                
                if day_name in days_map:
                    section.day_of_week = days_map[day_name]
                
                # Parse time range
                if '-' in time_range:
                    start_time_str, end_time_str = time_range.split('-')
                    try:
                        section.start_time = datetime.strptime(start_time_str, '%H:%M').time()
                        section.end_time = datetime.strptime(end_time_str, '%H:%M').time()
                    except ValueError:
                        pass  # Keep existing times if parsing fails
    
    # Handle direct field updates
    if 'day_of_week' in data:
        section.day_of_week = data['day_of_week']
    if 'start_time' in data:
        if isinstance(data['start_time'], str):
            try:
                section.start_time = datetime.strptime(data['start_time'], '%H:%M').time()
            except ValueError:
                pass
        else:
            section.start_time = data['start_time']
    if 'end_time' in data:
        if isinstance(data['end_time'], str):
            try:
                section.end_time = datetime.strptime(data['end_time'], '%H:%M').time()
            except ValueError:
                pass
        else:
            section.end_time = data['end_time']
    if 'max_students' in data:
        section.max_students = data['max_students']
    if 'is_active' in data:
        section.is_active = data['is_active']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Course section updated successfully',
        'section': {
            'id': section.id,
            'course_id': section.course_id,
            'section_name': section.name,
            'schedule': section.schedule,
            'start_date': None,  # Classes don't have start/end dates like courses
            'end_date': None,
            'max_students': section.max_students,
            'current_students': section.current_students,
            'is_active': section.is_active,
            'created_at': section.created_at.isoformat() if section.created_at else None
        }
    }), 200

@courses_bp.route('/sections/<int:section_id>', methods=['DELETE'])
@jwt_required()
def delete_course_section(section_id):
    """Delete a course section (Admin only)"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    
    section = Class.query.get_or_404(section_id)
    
    # Check if there are enrollments in this section
    enrollments = Enrollment.query.filter_by(class_id=section_id).count()
    if enrollments > 0:
        return jsonify({'message': 'Cannot delete section with active enrollments'}), 400
    
    db.session.delete(section)
    db.session.commit()
    
    return jsonify({'message': 'Course section deleted successfully'}), 200

@courses_bp.route('/sections/<int:section_id>/enroll', methods=['POST'])
@jwt_required()
def enroll_in_section(section_id):
    """Enroll user in a course section"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    section = Class.query.get_or_404(section_id)
    
    # Check if section is active
    if not section.is_active:
        return jsonify({'message': 'Section is not active'}), 400
    
    # Check if section is full
    enrollment_count = Enrollment.query.filter_by(class_id=section_id, is_active=True).count()
    if enrollment_count >= section.max_students:
        return jsonify({'message': 'Section is full'}), 400
    
    # Check if user is already enrolled in this section
    existing_enrollment = Enrollment.query.filter_by(
        student_id=current_user_id, 
        class_id=section_id,
        is_active=True
    ).first()
    
    if existing_enrollment:
        return jsonify({'message': 'Already enrolled in this section'}), 400
    
    # Check if user is already enrolled in another section of the same course
    course_sections = Class.query.filter_by(course_id=section.course_id).all()
    section_ids = [s.id for s in course_sections]
    
    existing_course_enrollment = Enrollment.query.filter(
        Enrollment.student_id == current_user_id,
        Enrollment.class_id.in_(section_ids),
        Enrollment.is_active == True
    ).first()
    
    if existing_course_enrollment:
        return jsonify({'message': 'Already enrolled in another section of this course'}), 400
    
    # Create enrollment
    enrollment = Enrollment(
        student_id=current_user_id,
        class_id=section_id,
        enrollment_date=datetime.utcnow(),
        is_active=True
    )
    
    # Note: current_students is a property that calculates count dynamically
    # No need to manually update it
    
    db.session.add(enrollment)
    db.session.commit()
    
    return jsonify({
        'message': 'Successfully enrolled in section',
        'enrollment': {
            'id': enrollment.id,
            'student_id': enrollment.student_id,
            'class_id': enrollment.class_id,
            'enrollment_date': enrollment.enrollment_date.isoformat()
        }
    }), 201

@courses_bp.route('/sections/<int:section_id>/unenroll', methods=['DELETE'])
@jwt_required()
def unenroll_from_section(section_id):
    """Unenroll user from a course section"""
    current_user_id = get_jwt_identity()
    
    enrollment = Enrollment.query.filter_by(
        student_id=current_user_id, 
        class_id=section_id,
        is_active=True
    ).first_or_404()
    
    section = Class.query.get(section_id)
    
    # Update section student count is handled by the available_seats property
    # No need to manually decrement current_students
    
    enrollment.is_active = False
    db.session.commit()
    
    return jsonify({'message': 'Successfully unenrolled from section'}), 200

@courses_bp.route('/my-enrollments', methods=['GET'])
@jwt_required()
def get_user_enrollments():
    """Get user's course section enrollments"""
    current_user_id = get_jwt_identity()
    
    # Get enrollments through student relationship - find students that belong to parents of this user
    enrollments = Enrollment.query.join(Student).join(Parent).filter(Parent.user_id == current_user_id, Enrollment.is_active == True).all()
    
    enrollments_data = []
    for enrollment in enrollments:
        section = enrollment.class_
        course = section.course
        
        enrollments_data.append({
            'enrollment_id': enrollment.id,
            'section': {
                'id': section.id,
                'course_id': section.course_id,
                'section_name': section.name,
                'schedule': section.schedule,
                'start_date': section.start_date.isoformat() if section.start_date else None,
                'end_date': section.end_date.isoformat() if section.end_date else None,
                'is_active': section.is_active
            },
            'course': {
                'id': course.id,
                'name': course.name,
                'description': course.description,
                'category': course.category,
                'price': course.price,
                'currency': course.currency
            },
            'enrollment_date': enrollment.enrollment_date.isoformat()
        })
    
    return jsonify({'enrollments': enrollments_data}), 200

@courses_bp.route('/<int:course_id>/generate-qr', methods=['POST'])
@jwt_required()
def generate_course_qr(course_id):
    """Generate QR code for course attendance"""
    current_user_id = get_jwt_identity()
    user = User.query.get(current_user_id)
    
    if not user or user.role != 'admin':
        return jsonify({'message': 'Admin access required'}), 403
    
    course = Course.query.get_or_404(course_id)
    
    # Generate QR code data
    qr_data = f"COURSE:{course.id}|NAME:{course.name}|TIMESTAMP:{datetime.utcnow().isoformat()}"
    
    # Create QR code
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    
    # Create QR code image
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Convert to base64
    buffered = BytesIO()
    img.save(buffered, format="PNG")
    qr_code_base64 = base64.b64encode(buffered.getvalue()).decode()
    
    # Update course with QR code data and expiration
    course.qr_code_data = qr_code_base64
    course.qr_code_expires = datetime.utcnow() + timedelta(hours=24)  # QR valid for 24 hours
    
    db.session.commit()
    
    return jsonify({
        'message': 'QR code generated successfully',
        'qr_code_data': qr_code_base64,
        'expires_at': course.qr_code_expires.isoformat()
    }), 200
