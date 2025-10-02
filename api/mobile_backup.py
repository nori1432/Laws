from flask import Blueprint, request, jsonify
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity, get_jwt
from werkzeug.security import check_password_hash
from datetime import datetime, timedelta
import secrets

mobile_bp = Blueprint('mobile', __name__)

# Import models and utilities
from models import db, User, Parent, Student, Class, Enrollment, Attendance, Registration, course_to_dict, class_to_dict, attendance_to_dict, student_to_dict
from utils import hash_password, verify_password, generate_qr_code, generate_parent_mobile_credentials, generate_student_mobile_credentials

@mobile_bp.route('/login', methods=['POST', 'OPTIONS'])
def mobile_login():
    """Mobile app login for both parents and students using different authentication methods"""
    
    # Handle preflight OPTIONS request
    if request.method == 'OPTIONS':
        print("Handling OPTIONS preflight request for mobile login")
        response = jsonify({'status': 'preflight ok'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'POST,OPTIONS')
        return response
    
    print("Mobile login attempt received")
    data = request.get_json()
    print(f"Login data: {data}")

    if 'phone' not in data or 'password' not in data:
        print("Missing phone or password")
        return jsonify({'error': 'Phone number and password are required'}), 400

    phone = data['phone'].strip()
    password = data['password']
    user_type = data.get('user_type', 'auto')  # 'student', 'parent', or 'auto'
    print(f"Attempting login for phone: {phone}, user_type: {user_type}")

    # STUDENT LOGIN: Check students table by user's phone
    if user_type in ['student', 'auto']:
        # Find user by phone first
        user = User.query.filter_by(phone=phone).first()
        if user:
            # Then find student linked to this user
            student = Student.query.filter_by(user_id=user.id, mobile_app_enabled=True).first()
            print(f"Student found by user phone: {student is not None}")
            
            if student and student.mobile_password_hash:
                print("Checking student password against hash")
                if verify_password(student.mobile_password_hash, password):
                    print("Student login successful")
                    # Create JWT token with user_type
                    access_token = create_access_token(
                        identity=str(student.id),
                        additional_claims={'user_type': 'student'}
                    )
                    
                    return jsonify({
                        'access_token': access_token,
                        'user': {
                            'id': student.id,
                            'student_id': student.id,  # Add student_id for barcode access
                            'name': student.name,
                            'email': user.email if user else None,
                            'type': 'student',
                            'mobile_username': student.mobile_username,
                            'mobile_app_enabled': student.mobile_app_enabled,
                            'parent_id': student.parent_id
                        },
                        'message': 'Student login successful'
                    }), 200
                else:
                    print("Student password incorrect")
            else:
                print("Student not found or mobile app not enabled")

    # PARENT LOGIN: Check parents table
    if user_type in ['parent', 'auto']:
        parent = Parent.query.filter_by(phone=phone, mobile_app_enabled=True).first()
        print(f"Parent found by phone: {parent is not None}")
        
        if parent and parent.mobile_password_hash:
            print("Checking parent password against hash")
            if verify_password(parent.mobile_password_hash, password):
                print("Parent login successful")
                # Create JWT token with user_type
                access_token = create_access_token(
                    identity=str(parent.id),
                    additional_claims={'user_type': 'parent'}
                )
                
                # Get parent's students for the response
                students = []
                for student in parent.students:
                    students.append({
                        'id': student.id,
                        'name': student.name,
                        'mobile_username': student.mobile_username,
                        'mobile_app_enabled': student.mobile_app_enabled
                    })
                
                return jsonify({
                    'access_token': access_token,
                    'user': {
                        'id': parent.id,
                        'name': parent.full_name,
                        'email': parent.email,
                        'phone': parent.phone,
                        'type': 'parent',
                        'mobile_username': parent.mobile_username,
                        'mobile_app_enabled': parent.mobile_app_enabled,
                        'students': students
                    },
                    'message': 'Parent login successful'
                }), 200
            else:
                print("Parent password incorrect")
        else:
            print("Parent not found or mobile app not enabled")

    print("Login failed for all user types")
    return jsonify({'error': 'Invalid credentials or mobile app access not enabled'}), 401

@mobile_bp.route('/profile', methods=['GET'])
@jwt_required()
def get_profile():
    """Get user profile information"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type == 'parent':
        parent = Parent.query.get(user_id)
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        students = []
        for student in parent.students:
            students.append({
                'id': student.id,
                'name': student.name,
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled
            })

        return jsonify({
            'user': {
                'id': parent.id,
                'name': parent.full_name,
                'email': parent.email,
                'phone': parent.phone,
                'type': 'parent',
                'mobile_username': parent.mobile_username,
                'mobile_app_enabled': parent.mobile_app_enabled,
                'students': students
            }
        }), 200

    elif user_type == 'student':
        student = Student.query.get(user_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        user = User.query.get(student.user_id) if student.user_id else None

        return jsonify({
            'user': {
                'id': student.id,
                'student_id': student.id,  # Add student_id for barcode access
                'name': student.name,
                'email': user.email if user else None,
                'type': 'student',
                'mobile_username': student.mobile_username,
                'mobile_app_enabled': student.mobile_app_enabled,
                'parent_id': student.parent_id
            }
        }), 200

    return jsonify({'error': 'Invalid user type'}), 400

@mobile_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def mobile_dashboard():
    """Get comprehensive dashboard data for mobile users matching website functionality"""
    from enhanced_mobile_dashboard import get_enhanced_mobile_dashboard
    return get_enhanced_mobile_dashboard()

                'attendance_rate': 0
            }

            for enrollment in enrollments:
                class_info = Class.query.get(enrollment.class_id)
                course_info = class_info.course if class_info else None

                enrollment_payment_info = None
                if class_info and course_info:
                    # Enhanced payment logic - no reminders for monthly until 4 sessions done
                    if course_info.course_type == 'monthly':
                        # Count both attendances and absences for monthly courses
                        total_sessions = Attendance.query.filter(
                            Attendance.student_id == student.id,
                            Attendance.class_id == class_info.id
                        ).count()
                        
                        # Calculate countdown until payment due (after 4 attendances/absences)
                        sessions_until_payment = max(0, 4 - total_sessions)
                        completed_cycles = total_sessions // 4
                        current_cycle_progress = total_sessions % 4

                        # Calculate cycle price
                        if course_info.pricing_type == 'monthly':
                            cycle_price = course_info.monthly_price or course_info.price or 0
                        else:
                            session_price = course_info.session_price or course_info.price or 0
                            cycle_price = session_price * 4

                        # Calculate debt - only for completed cycles that aren't paid
                        cycles_paid = 0
                        if enrollment.monthly_payment_status == 'paid':
                            cycles_paid = max(completed_cycles - 1, 0)  # Last cycle paid
                        
                        unpaid_cycles = max(0, completed_cycles - cycles_paid)
                        debt_amount = unpaid_cycles * cycle_price
                        
                        enrollment_payment_info = {
                            'type': 'monthly',
                            'debt_amount': debt_amount,
                            'countdown': sessions_until_payment,
                            'progress': f"{current_cycle_progress}/4",
                            'completed_cycles': completed_cycles,
                            'status': 'clear' if debt_amount == 0 else 'debt'
                        }
                        
                    else:  # session-based
                        # Session-based: show debt for unpaid attended sessions only
                        attended_sessions_query = Attendance.query.filter(
                            Attendance.student_id == student.id,
                            Attendance.class_id == class_info.id,
                            Attendance.status == 'present'
                        )
                        attended_sessions = attended_sessions_query.count()
                        
                        # Count sessions marked as paid by admin (would require payment_status field)
                        # For now, assume all sessions are unpaid until admin marks them paid
                        paid_sessions = 0  
                        
                        if course_info.pricing_type == 'session':
                            session_price = course_info.session_price or course_info.price or 0
                        else:
                            monthly_price = course_info.monthly_price or course_info.price or 0
                            session_price = monthly_price / 4
                        
                        unpaid_sessions = attended_sessions - paid_sessions
                        debt_amount = unpaid_sessions * session_price
                        
                        enrollment_payment_info = {
                            'type': 'session',
                            'debt_amount': debt_amount,
                            'unpaid_sessions': unpaid_sessions,
                            'total_attended': attended_sessions,
                            'status': 'clear' if debt_amount == 0 else 'debt'
                        }

                    # Update student payment summary
                    if enrollment_payment_info:
                        student_payment_summary['total_debt'] += enrollment_payment_info['debt_amount']
                        if enrollment_payment_info['status'] == 'debt':
                            student_payment_summary['courses_with_debt'] += 1
                        else:
                            student_payment_summary['courses_clear'] += 1

                    enrollment_data.append({
                        'id': enrollment.id,
                        'class_name': class_info.name,
                        'course_name': course_info.name,
                        'day_of_week': class_info.day_of_week,
                        'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                        'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                        'payment_info': enrollment_payment_info
                    })

            # Get better attendance overview - last 10 sessions
            recent_attendance = Attendance.query.filter_by(student_id=student.id)\
                .order_by(Attendance.attendance_date.desc())\
                .limit(10)\
                .all()

            attendance_data = []
            for att in recent_attendance:
                class_info = Class.query.get(att.class_id)
                attendance_data.append({
                    'date': att.attendance_date.isoformat(),
                    'class_name': class_info.name if class_info else 'Unknown',
                    'status': att.status,
                    'qr_code_scanned': att.qr_code_scanned
                })
                
                student_attendance_summary['total_sessions'] += 1
                if att.status == 'present':
                    student_attendance_summary['present_sessions'] += 1
                else:
                    student_attendance_summary['absent_sessions'] += 1

            if student_attendance_summary['total_sessions'] > 0:
                student_attendance_summary['attendance_rate'] = round(
                    (student_attendance_summary['present_sessions'] / student_attendance_summary['total_sessions']) * 100, 1
                )

            # Update overall summary
            overall_summary['total_debt'] += student_payment_summary['total_debt']
            overall_summary['total_enrollments'] += len(enrollment_data)
            if student_payment_summary['total_debt'] > 0:
                overall_summary['students_with_debt'] += 1
            else:
                overall_summary['students_clear'] += 1

            students_data.append({
                'id': student.id,
                'name': student.name,
                'enrollments': enrollment_data,
                'recent_attendance': attendance_data,
                'payment_summary': student_payment_summary,
                'attendance_summary': student_attendance_summary
            })

        # Calculate overall attendance rate
        if overall_summary['total_enrollments'] > 0:
            total_sessions = sum(s['attendance_summary']['total_sessions'] for s in students_data)
            total_present = sum(s['attendance_summary']['present_sessions'] for s in students_data)
            if total_sessions > 0:
                overall_summary['overall_attendance_rate'] = round((total_present / total_sessions) * 100, 1)

        return jsonify({
            'type': 'parent',
            'user': {
                'id': parent.id,
                'name': parent.full_name,
                'email': parent.email,
                'type': 'parent'
            },
            'students': students_data,
            'overall_summary': overall_summary
        }), 200

    elif user_type == 'student':
        # Student dashboard with enhanced payment and attendance overview
        student = Student.query.get(user_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Get student's enrollments
        enrollments = Enrollment.query.filter_by(student_id=student.id, is_active=True).all()
        enrollment_data = []
        payment_summary = {
            'total_debt': 0,
            'courses_with_debt': 0,
            'courses_clear': 0,
            'monthly_courses': 0,
            'session_courses': 0
        }

        for enrollment in enrollments:
            class_info = Class.query.get(enrollment.class_id)
            course_info = class_info.course if class_info else None

            enrollment_payment_info = None
            if class_info and course_info:
                # Enhanced payment logic for individual student
                if course_info.course_type == 'monthly':
                    # Monthly course - countdown logic after 4 attendances/absences
                    total_sessions = Attendance.query.filter(
                        Attendance.student_id == student.id,
                        Attendance.class_id == class_info.id
                    ).count()
                    
                    sessions_until_payment = max(0, 4 - total_sessions)
                    completed_cycles = total_sessions // 4
                    current_cycle_progress = total_sessions % 4

                    # Calculate cycle price
                    if course_info.pricing_type == 'monthly':
                        cycle_price = course_info.monthly_price or course_info.price or 0
                    else:
                        session_price = course_info.session_price or course_info.price or 0
                        cycle_price = session_price * 4

                    # Calculate debt - only for completed cycles that aren't paid
                    cycles_paid = 0
                    if enrollment.monthly_payment_status == 'paid':
                        cycles_paid = max(completed_cycles - 1, 0)  # Last cycle paid
                    
                    unpaid_cycles = max(0, completed_cycles - cycles_paid)
                    debt_amount = unpaid_cycles * cycle_price
                    
                    enrollment_payment_info = {
                        'type': 'monthly',
                        'debt_amount': debt_amount,
                        'countdown': sessions_until_payment,
                        'progress': f"{current_cycle_progress}/4",
                        'completed_cycles': completed_cycles,
                        'status': 'clear' if debt_amount == 0 else 'debt'
                    }
                    payment_summary['monthly_courses'] += 1
                    
                else:  # session-based
                    # Session-based: show debt for unpaid attended sessions
                    attended_sessions_query = Attendance.query.filter(
                        Attendance.student_id == student.id,
                        Attendance.class_id == class_info.id,
                        Attendance.status == 'present'
                    )
                    attended_sessions = attended_sessions_query.count()
                    
                    # Count paid sessions (would require payment_status field)
                    paid_sessions = 0  
                    
                    if course_info.pricing_type == 'session':
                        session_price = course_info.session_price or course_info.price or 0
                    else:
                        monthly_price = course_info.monthly_price or course_info.price or 0
                        session_price = monthly_price / 4
                    
                    unpaid_sessions = attended_sessions - paid_sessions
                    debt_amount = unpaid_sessions * session_price
                    
                    enrollment_payment_info = {
                        'type': 'session',
                        'debt_amount': debt_amount,
                        'unpaid_sessions': unpaid_sessions,
                        'total_attended': attended_sessions,
                        'status': 'clear' if debt_amount == 0 else 'debt'
                    }
                    payment_summary['session_courses'] += 1

                # Update payment summary
                if enrollment_payment_info:
                    payment_summary['total_debt'] += enrollment_payment_info['debt_amount']
                    if enrollment_payment_info['status'] == 'debt':
                        payment_summary['courses_with_debt'] += 1
                    else:
                        payment_summary['courses_clear'] += 1

                enrollment_data.append({
                    'id': enrollment.id,
                    'class_name': class_info.name,
                    'course_name': course_info.name,
                    'day_of_week': class_info.day_of_week,
                    'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                    'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                    'qr_code_data': class_info.qr_code_data,
                    'payment_info': enrollment_payment_info
                })

        # Get enhanced attendance overview - last 15 sessions
        recent_attendance = Attendance.query.filter_by(student_id=student.id)\
            .order_by(Attendance.attendance_date.desc())\
            .limit(15)\
            .all()

        attendance_data = []
        attendance_summary = {
            'total_sessions': 0,
            'present_sessions': 0,
            'absent_sessions': 0,
            'late_sessions': 0,
            'attendance_rate': 0
        }

        for att in recent_attendance:
            class_info = Class.query.get(att.class_id)
            attendance_data.append({
                'date': att.attendance_date.isoformat(),
                'class_name': class_info.name if class_info else 'Unknown',
                'status': att.status,
                'qr_code_scanned': att.qr_code_scanned
            })
            
            attendance_summary['total_sessions'] += 1
            if att.status == 'present':
                attendance_summary['present_sessions'] += 1
            elif att.status == 'absent':
                attendance_summary['absent_sessions'] += 1
            elif att.status == 'late':
                attendance_summary['late_sessions'] += 1

        if attendance_summary['total_sessions'] > 0:
            attendance_summary['attendance_rate'] = round(
                (attendance_summary['present_sessions'] / attendance_summary['total_sessions']) * 100, 1
            )

        return jsonify({
            'type': 'student',
            'user': {
                'id': student.id,
                'student_id': student.id,  # Add student_id for barcode access
                'name': student.name,
                'type': 'student',
                'parent_id': student.parent_id
            },
            'enrollments': enrollment_data,
            'recent_attendance': attendance_data,
            'payment_summary': payment_summary,
            'attendance_summary': attendance_summary
        }), 200

    return jsonify({'error': 'Invalid user type'}), 400

# Continue with the rest of the mobile.py functions...

@mobile_bp.route('/payments', methods=['GET'])
@jwt_required()
def get_payments():
    """Get payment information for mobile users with improved logic"""
    try:
        user_id = int(get_jwt_identity())
        claims = get_jwt()
        user_type = claims.get('user_type')

        print(f"Payments request - user_id: {user_id}, user_type: {user_type}")

        if user_type == 'parent':
            # Get payments for all parent's students
            parent = Parent.query.get(user_id)
            if not parent:
                return jsonify({'error': 'Parent not found'}), 404

            students = parent.students
            student_ids = [s.id for s in students]
            print(f"Parent has {len(students)} students: {student_ids}")

            # Get all enrollments for parent's students
            enrollments = Enrollment.query.filter(
                Enrollment.student_id.in_(student_ids),
                Enrollment.is_active == True
            ).all()
            print(f"Found {len(enrollments)} enrollments")

        elif user_type == 'student':
            # Get payments for student
            enrollments = Enrollment.query.filter_by(
                student_id=user_id,
                is_active=True
            ).all()
            print(f"Found {len(enrollments)} enrollments for student")
        else:
            return jsonify({'error': 'Invalid user type'}), 400

        payments_data = []
        for enrollment in enrollments:
            try:
                course = enrollment.class_.course if enrollment.class_ else None
                student = enrollment.student

                if not course or not student:
                    print(f"Skipping enrollment {enrollment.id} - missing course or student")
                    continue

                print(f"Processing enrollment {enrollment.id} for student {student.name}, course {course.name}")

                # Enhanced payment logic based on enrollment type
                if course.course_type == 'monthly':
                    # Monthly payment logic - countdown until 4 sessions attended/absent
                    total_sessions = Attendance.query.filter(
                        Attendance.student_id == enrollment.student_id,
                        Attendance.class_id == enrollment.class_id
                    ).count()
                    
                    sessions_until_payment = max(0, 4 - total_sessions)
                    completed_cycles = total_sessions // 4
                    current_cycle_progress = total_sessions % 4

                    # Calculate cycle price
                    if course.pricing_type == 'monthly':
                        cycle_price = course.monthly_price or course.price or 0
                    else:
                        session_price = course.session_price or course.price or 0
                        cycle_price = session_price * 4

                    # Calculate debt - only for completed cycles that aren't paid
                    cycles_paid = 0
                    if enrollment.monthly_payment_status == 'paid':
                        cycles_paid = max(completed_cycles - 1, 0)  # Last cycle paid
                    
                    unpaid_cycles = max(0, completed_cycles - cycles_paid)
                    debt_amount = unpaid_cycles * cycle_price

                    # Determine status: 'clear' if no debt, 'debt' if money owed
                    payment_status = 'clear' if debt_amount == 0 else 'debt'

                    payment_info = {
                        'id': enrollment.id,
                        'enrollment_id': enrollment.id,
                        'student_name': student.name,
                        'course_name': course.name,
                        'section_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
                        'amount': float(debt_amount),
                        'status': payment_status,
                        'payment_type': 'monthly',
                        'total_sessions': total_sessions,
                        'sessions_until_payment': sessions_until_payment,
                        'current_cycle_progress': current_cycle_progress,
                        'completed_cycles': completed_cycles,
                        'unpaid_cycles': unpaid_cycles,
                        'progress_display': f"{current_cycle_progress}/4",
                        'countdown_display': f"{sessions_until_payment} sessions until payment due" if sessions_until_payment > 0 else "Payment cycle complete",
                        'cycle_price': float(cycle_price),
                        'registration_payment_required': enrollment.registration_payment_status != 'paid'
                    }

                    print(f"Monthly payment: {total_sessions} total sessions, {completed_cycles} complete cycles, debt: {debt_amount}, status: {payment_status}")

                else:  # session-based payment - show debt for attended sessions
                    # Get ALL attendance records for this enrollment to calculate total debt
                    attended_sessions = Attendance.query.filter(
                        Attendance.student_id == enrollment.student_id,
                        Attendance.class_id == enrollment.class_id,
                        Attendance.status == 'present'
                    ).count()

                    # For session-based payments, all attended sessions create debt until paid by admin
                    paid_sessions = 0  # Would need payment_status field in Attendance model

                    # Calculate session price
                    if course.pricing_type == 'session':
                        session_price = course.session_price or course.price or 0
                    else:
                        # Convert monthly to session price
                        monthly_price = course.monthly_price or course.price or 0
                        session_price = monthly_price / 4

                    unpaid_sessions = attended_sessions - paid_sessions
                    debt_amount = unpaid_sessions * session_price

                    # Status: 'clear' if no debt, 'debt' if money owed
                    payment_status = 'clear' if debt_amount == 0 else 'debt'

                    payment_info = {
                        'id': enrollment.id,
                        'enrollment_id': enrollment.id,
                        'student_name': student.name,
                        'course_name': course.name,
                        'section_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
                        'amount': float(debt_amount),
                        'status': payment_status,
                        'payment_type': 'session',
                        'attended_sessions': attended_sessions,
                        'paid_sessions': paid_sessions,
                        'unpaid_sessions': unpaid_sessions,
                        'session_price': float(session_price),
                        'registration_payment_required': enrollment.registration_payment_status != 'paid'
                    }

                    print(f"Session payment: {attended_sessions} attended sessions, {paid_sessions} paid, debt: {debt_amount}, status: {payment_status}")

                # Include registration payment info if needed
                if enrollment.registration_payment_status != 'paid':
                    # Add registration payment info
                    reg_payment_info = payment_info.copy()
                    reg_payment_info.update({
                        'id': f"reg_{enrollment.id}",
                        'payment_type': 'registration',
                        'amount': float(course.price or 0),  # Use course price for registration
                        'status': enrollment.registration_payment_status,
                        'description': 'Registration Fee'
                    })
                    payments_data.append(reg_payment_info)
                    print(f"Added registration payment: {reg_payment_info}")

                # Only include payments that have amounts due or show status
                payments_data.append(payment_info)
                print(f"Added payment: {payment_info}")

            except Exception as e:
                print(f"Error processing enrollment {enrollment.id}: {e}")
                continue

        print(f"Returning {len(payments_data)} payments")
        return jsonify({'payments': payments_data}), 200

    except Exception as e:
        print(f"Error in get_payments: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': 'Internal server error', 'details': str(e)}), 500

@mobile_bp.route('/schedule', methods=['GET'])
@jwt_required()
def get_schedule():
    """Get class schedule for mobile users"""
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')

    if user_type == 'parent':
        # Get schedule for all parent's students
        parent = Parent.query.get(user_id)
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        student_ids = [s.id for s in parent.students]
        enrollments = Enrollment.query.filter(
            Enrollment.student_id.in_(student_ids),
            Enrollment.is_active == True
        ).all()

    elif user_type == 'student':
        # Get schedule for student
        enrollments = Enrollment.query.filter_by(
            student_id=user_id,
            is_active=True
        ).all()
    else:
        return jsonify({'error': 'Invalid user type'}), 400

    schedule_data = []
    for enrollment in enrollments:
        class_info = Class.query.get(enrollment.class_id)
        course_info = class_info.course if class_info else None
        student = Student.query.get(enrollment.student_id)

        if class_info and course_info:
            # Format day of week properly
            day_names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
            day_name = day_names[class_info.day_of_week] if class_info.day_of_week is not None and 0 <= class_info.day_of_week < 7 else 'Unknown'

            schedule_data.append({
                'enrollment_id': enrollment.id,
                'student_name': student.name if student else 'Unknown',
                'class_name': class_info.name,
                'course_name': course_info.name,
                'day_of_week': class_info.day_of_week,
                'day_name': day_name,
                'start_time': class_info.start_time.strftime('%H:%M') if class_info.start_time else None,
                'end_time': class_info.end_time.strftime('%H:%M') if class_info.end_time else None,
                'is_active': class_info.is_active
            })

    return jsonify({'schedule': schedule_data}), 200

@mobile_bp.route('/change-password', methods=['POST'])
@jwt_required()
def change_mobile_password():
    """Change mobile app password"""
    data = request.get_json()
    user_id = int(get_jwt_identity())
    claims = get_jwt()
    user_type = claims.get('user_type')

    if 'current_password' not in data or 'new_password' not in data:
        return jsonify({'error': 'Current password and new password are required'}), 400

    if user_type == 'parent':
        parent = Parent.query.get(user_id)
        if not parent or not verify_password(parent.mobile_password_hash, data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401

        parent.mobile_password_hash = hash_password(data['new_password'])
        db.session.commit()

    elif user_type == 'student':
        student = Student.query.get(user_id)
        if not student or not verify_password(student.mobile_password_hash, data['current_password']):
            return jsonify({'error': 'Current password is incorrect'}), 401

        student.mobile_password_hash = hash_password(data['new_password'])
        db.session.commit()
    else:
        return jsonify({'error': 'Invalid user type'}), 400

    return jsonify({'message': 'Password changed successfully'}), 200

@mobile_bp.route('/register-push-token', methods=['POST'])
@jwt_required()
def register_push_token():
    """Register push notification token for mobile device"""
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        user_id = data.get('user_id')
        push_token = data.get('push_token')
        platform = data.get('platform', 'mobile')
        
        if not push_token:
            return jsonify({'error': 'Push token is required'}), 400
        
        # Security check: users can only register tokens for themselves
        # unless they are admin
        current_user = User.query.get(current_user_id)
        if current_user.role != 'admin' and current_user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        # Update user's push token
        from push_notifications import PushNotificationService
        success = PushNotificationService.register_push_token(
            user_id=user_id or current_user_id,
            push_token=push_token,
            platform=platform
        )
        
        if success:
            return jsonify({
                'message': 'Push token registered successfully',
                'token_registered': True
            }), 200
        else:
            return jsonify({'error': 'Failed to register push token'}), 500
            
    except Exception as e:
        print(f"Error registering push token: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@mobile_bp.route('/user-courses/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_courses(user_id):
    """Get courses for a user (for notification scheduling)"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)
        
        # Security check: users can only access their own courses unless admin
        if current_user.role != 'admin' and current_user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        courses = []
        
        if user.role == 'student':
            # Get student's enrolled courses
            student = Student.query.filter_by(user_id=user_id).first()
            if student:
                enrollments = Enrollment.query.filter_by(student_id=student.id).all()
                for enrollment in enrollments:
                    if enrollment.section:
                        course_data = course_to_dict(enrollment.section.course)
                        course_data['section'] = {
                            'id': enrollment.section.id,
                            'name': enrollment.section.name,
                            'schedule': enrollment.section.schedule
                        }
                        courses.append(course_data)
        
        elif user.role == 'parent':
            # Get parent's children's courses
            parent = Parent.query.filter_by(user_id=user_id).first()
            if parent:
                students = Student.query.filter_by(parent_id=parent.id).all()
                for student in students:
                    enrollments = Enrollment.query.filter_by(student_id=student.id).all()
                    for enrollment in enrollments:
                        if enrollment.section:
                            course_data = course_to_dict(enrollment.section.course)
                            course_data['section'] = {
                                'id': enrollment.section.id,
                                'name': enrollment.section.name,
                                'schedule': enrollment.section.schedule
                            }
                            course_data['student_name'] = student.name
                            courses.append(course_data)
        
        return jsonify({
            'courses': courses,
            'user_id': user_id,
            'user_role': user.role
        }), 200
        
    except Exception as e:
        print(f"Error getting user courses: {e}")
        return jsonify({'error': 'Internal server error'}), 500