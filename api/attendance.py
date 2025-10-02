from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity, get_jwt
from models import db, User, Student, Parent, Attendance, Class, Enrollment, Course
from utils import generate_barcode, generate_barcode_image, mark_attendance_with_barcode
from datetime import datetime
import json
import logging

attendance_bp = Blueprint('attendance', __name__)

logger = logging.getLogger(__name__)

@attendance_bp.route('/generate-barcode', methods=['POST'])
@jwt_required()
def generate_user_barcode():
    """Generate barcode for a user"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({'error': 'User ID required'}), 400

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Generate barcode if not exists
        if not user.barcode:
            user.barcode = generate_barcode()
            db.session.commit()

        # Generate barcode image
        barcode_image = generate_barcode_image(user.barcode)

        return jsonify({
            'success': True,
            'barcode': user.barcode,
            'barcode_image': barcode_image,
            'user_name': user.full_name
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in generate_user_barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/user-barcode/<int:user_id>', methods=['GET'])
@jwt_required()
def get_user_barcode(user_id):
    """Get barcode for a user"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        user = User.query.get(user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Generate barcode if not exists
        if not user.barcode:
            user.barcode = generate_barcode()
            db.session.commit()

        barcode_image = generate_barcode_image(user.barcode)

        return jsonify({
            'barcode': user.barcode,
            'barcode_image': barcode_image,
            'user_name': user.full_name
        })

    except Exception as e:
        logger.error(f"Error in get_user_barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/student-barcode/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_barcode(student_id):
    """Get barcode for a student"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        user_type = claims.get('user_type')

        logger.debug(f"get_student_barcode called for student_id={student_id}, current_user_id={current_user_id}, user_type={user_type}")

        # Allow admin or the student themselves to access the barcode
        if user_type == 'admin':
            # Admin can access any student's barcode
            pass
        elif user_type == 'student':
            # Student can only access their own barcode
            if str(current_user_id) != str(student_id):
                return jsonify({'error': 'Access denied. Students can only view their own barcode.'}), 403
        else:
            return jsonify({'error': 'Unauthorized access'}), 403

        logger.debug(f"Fetching student with id={student_id}")
        student = Student.query.get(student_id)
        if not student:
            logger.debug(f"Student not found for id={student_id}")
            return jsonify({'error': 'Student not found'}), 404

        logger.debug(f"Student found: {student.name}, parent_id={student.parent_id}")

        # Check parent relationship
        if student.parent_id:
            logger.debug(f"Student has parent_id={student.parent_id}")
            parent = Parent.query.get(student.parent_id)
            if parent:
                logger.debug(f"Parent found: {parent.full_name}, user_id={parent.user_id}")
                if parent.user:
                    logger.debug(f"Parent user found: {parent.user.full_name}")
                else:
                    logger.debug(f"Parent user not found for user_id={parent.user_id}")
            else:
                logger.debug(f"Parent not found for parent_id={student.parent_id}")
        else:
            logger.debug("Student has no parent_id")

        # Generate barcode if not exists
        if not student.barcode:
            logger.debug("Student has no barcode, generating...")
            # Use parent's barcode if available
            if student.parent and student.parent.user and student.parent.user.barcode:
                student.barcode = student.parent.user.barcode
                logger.debug(f"Using parent's barcode: {student.barcode}")
            else:
                student.barcode = generate_barcode()
                logger.debug(f"Generated new barcode: {student.barcode}")
            db.session.commit()
            logger.debug("Barcode committed to database")

        logger.debug(f"Generating barcode image for: {student.barcode}")
        barcode_image = generate_barcode_image(student.barcode)

        logger.debug("Returning barcode data")
        return jsonify({
            'barcode': student.barcode,
            'barcode_image': barcode_image,
            'student_name': student.name,
            'parent_name': student.parent.user.full_name if student.parent and student.parent.user else None
        })

    except Exception as e:
        logger.error(f"Exception in get_student_barcode: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/scan-barcode', methods=['POST'])
@jwt_required()
def scan_barcode():
    """Scan barcode and mark attendance"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        barcode = data.get('barcode')
        scan_time_str = data.get('scan_time')

        if not barcode:
            return jsonify({'error': 'Barcode required'}), 400

        # Parse scan time or use current time
        if scan_time_str:
            try:
                scan_time = datetime.fromisoformat(scan_time_str.replace('Z', '+00:00'))
            except:
                scan_time = datetime.utcnow()
        else:
            scan_time = datetime.utcnow()

        # Mark attendance
        success, result = mark_attendance_with_barcode(barcode, current_user_id, scan_time)

        if success:
            return jsonify({
                'success': True,
                'message': 'Attendance marked successfully',
                'data': result
            })
        else:
            return jsonify({
                'success': False,
                'error': result
            }), 400

    except Exception as e:
        logger.error(f"Error in scan_barcode: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/attendance-records', methods=['GET'])
@jwt_required()
def get_attendance_records():
    """Get attendance records for admin dashboard"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        # Get query parameters
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 50))
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        student_id = request.args.get('student_id')
        class_id = request.args.get('class_id')

        # Build query
        query = Attendance.query

        if date_from:
            query = query.filter(Attendance.attendance_date >= datetime.fromisoformat(date_from).date())
        if date_to:
            query = query.filter(Attendance.attendance_date <= datetime.fromisoformat(date_to).date())
        if student_id:
            query = query.filter(Attendance.student_id == student_id)
        if class_id:
            query = query.filter(Attendance.class_id == class_id)

        # Get paginated results
        attendances = query.order_by(Attendance.marked_at.desc()).paginate(page=page, per_page=per_page)

        records = []
        for attendance in attendances.items:
            student = attendance.student
            class_obj = attendance.class_

            records.append({
                'id': attendance.id,
                'student_name': student.name if student else 'Unknown',
                'course_name': class_obj.course.name if class_obj and class_obj.course else 'Unknown',
                'class_name': class_obj.name if class_obj else 'Unknown',
                'attendance_date': attendance.attendance_date.isoformat(),
                'status': attendance.status,
                'marked_by': attendance.marked_by,
                'marked_at': attendance.marked_at.isoformat() if attendance.marked_at else None,
                'scan_time': attendance.qr_scan_time.isoformat() if attendance.qr_scan_time else None
            })

        return jsonify({
            'records': records,
            'pagination': {
                'page': page,
                'per_page': per_page,
                'total': attendances.total,
                'pages': attendances.pages
            }
        })

    except Exception as e:
        logger.error(f"Error in get_attendance_records: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/stats', methods=['GET'])
@jwt_required()
def get_attendance_stats():
    """Get attendance statistics"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        # Get today's attendance
        today = datetime.utcnow().date()
        today_attendance = Attendance.query.filter_by(attendance_date=today).all()

        # Calculate stats
        total_scans = len(today_attendance)
        present_count = len([a for a in today_attendance if a.status == 'present'])
        late_count = len([a for a in today_attendance if a.status == 'late'])
        absent_count = len([a for a in today_attendance if a.status == 'absent'])

        # Get recent scans (last 10)
        recent_scans = Attendance.query.filter_by(attendance_date=today)\
            .order_by(Attendance.marked_at.desc())\
            .limit(10)\
            .all()

        recent_scan_data = []
        for scan in recent_scans:
            student = scan.student
            class_obj = scan.class_
            recent_scan_data.append({
                'student_name': student.name if student else 'Unknown',
                'course_name': class_obj.course.name if class_obj and class_obj.course else 'Unknown',
                'class_name': class_obj.name if class_obj else 'Unknown',
                'status': scan.status,
                'scan_time': scan.qr_scan_time.strftime('%H:%M') if scan.qr_scan_time else None,
                'marked_at': scan.marked_at.strftime('%H:%M') if scan.marked_at else None
            })

        return jsonify({
            'today_stats': {
                'total_scans': total_scans,
                'present': present_count,
                'late': late_count,
                'absent': absent_count
            },
            'recent_scans': recent_scan_data
        })

    except Exception as e:
        logger.error(f"Error in get_attendance_stats: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/scan-attendance', methods=['POST'])
@jwt_required()
def scan_attendance():
    """Scan barcode and mark attendance with 30-minute window"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        barcode = data.get('barcode')
        class_id = data.get('class_id')
        scan_time_str = data.get('scan_time')

        if not barcode or not class_id:
            return jsonify({'error': 'Barcode and class ID required'}), 400

        # Parse scan time or use current time
        if scan_time_str:
            try:
                scan_time = datetime.fromisoformat(scan_time_str.replace('Z', '+00:00'))
            except:
                scan_time = datetime.utcnow()
        else:
            scan_time = datetime.utcnow()

        # Find the class
        class_obj = Class.query.get(class_id)
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404

        # Check if scan is within 30-minute window of class time
        from datetime import timedelta
        class_start = datetime.combine(scan_time.date(), class_obj.start_time)
        class_end = datetime.combine(scan_time.date(), class_obj.end_time)

        # Allow scanning 30 minutes before class starts and 30 minutes after class ends
        scan_window_start = class_start - timedelta(minutes=30)
        scan_window_end = class_end + timedelta(minutes=30)

        if not (scan_window_start <= scan_time <= scan_window_end):
            return jsonify({
                'success': False,
                'error': 'Scan outside of 30-minute attendance window',
                'class_time': f'{class_obj.start_time.strftime("%H:%M")} - {class_obj.end_time.strftime("%H:%M")}',
                'scan_window': f'{scan_window_start.strftime("%H:%M")} - {scan_window_end.strftime("%H:%M")}'
            }), 400

        # Find student by barcode
        student = Student.query.filter_by(barcode=barcode).first()
        if not student:
            return jsonify({'error': 'Student not found with this barcode'}), 404

        # Check if student is enrolled in this class
        enrollment = Enrollment.query.filter_by(
            student_id=student.id,
            class_id=class_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this class'}), 400

        # Check if attendance already exists for today
        today = scan_time.date()
        existing_attendance = Attendance.query.filter_by(
            student_id=student.id,
            class_id=class_id,
            attendance_date=today
        ).first()

        if existing_attendance:
            if existing_attendance.qr_code_scanned:  # Using this field for barcode scan tracking
                return jsonify({
                    'success': False,
                    'error': 'Attendance already marked for today',
                    'scan_time': existing_attendance.qr_scan_time.isoformat() if existing_attendance.qr_scan_time else None
                }), 400
            else:
                # Update existing attendance with barcode scan
                existing_attendance.qr_code_scanned = True
                existing_attendance.qr_scan_time = scan_time
                existing_attendance.marked_by = current_user_id
                existing_attendance.marked_at = scan_time
                db.session.commit()

                # Update enrollment session counter for monthly payments
                if enrollment.payment_type == 'monthly':
                    enrollment.monthly_sessions_attended += 1
                    db.session.commit()

                return jsonify({
                    'success': True,
                    'message': 'Barcode attendance marked successfully',
                    'student_name': student.name,
                    'scan_time': scan_time.isoformat(),
                    'sessions_attended': enrollment.monthly_sessions_attended if enrollment.payment_type == 'monthly' else None
                })

        # Create new attendance record
        attendance = Attendance(
            student_id=student.id,
            class_id=class_id,
            attendance_date=today,
            status='present',
            marked_by=current_user_id,
            marked_at=scan_time,
            qr_code_scanned=True,  # Using this field for barcode scan tracking
            qr_scan_time=scan_time
        )

        db.session.add(attendance)

        # Update enrollment session counter for monthly payments
        if enrollment.payment_type == 'monthly':
            enrollment.monthly_sessions_attended += 1

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'Barcode attendance marked successfully',
            'student_name': student.name,
            'scan_time': scan_time.isoformat(),
            'sessions_attended': enrollment.monthly_sessions_attended if enrollment.payment_type == 'monthly' else None
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in scan_attendance: {str(e)}")
        return jsonify({'error': str(e)}), 500

        # Check if scan is within 30-minute window of class time
        from datetime import timedelta
        class_start = datetime.combine(scan_time.date(), class_obj.start_time)
        class_end = datetime.combine(scan_time.date(), class_obj.end_time)

        # Allow scanning 30 minutes before class starts and 30 minutes after class ends
        scan_window_start = class_start - timedelta(minutes=30)
        scan_window_end = class_end + timedelta(minutes=30)

        if not (scan_window_start <= scan_time <= scan_window_end):
            return jsonify({
                'success': False,
                'error': 'Scan outside of 30-minute attendance window',
                'class_time': f'{class_obj.start_time.strftime("%H:%M")} - {class_obj.end_time.strftime("%H:%M")}',
                'scan_window': f'{scan_window_start.strftime("%H:%M")} - {scan_window_end.strftime("%H:%M")}'
            }), 400

        # Parse QR data - expecting format: "student:{student_id}:class:{class_id}"
        try:
            qr_parts = qr_data.split(':')
            if len(qr_parts) >= 4 and qr_parts[0] == 'student' and qr_parts[2] == 'class':
                student_id = int(qr_parts[1])
                qr_class_id = int(qr_parts[3])
            else:
                return jsonify({'error': 'Invalid QR code format'}), 400
        except (ValueError, IndexError):
            return jsonify({'error': 'Invalid QR code data'}), 400

        # Verify QR code matches the class being scanned
        if qr_class_id != class_id:
            return jsonify({'error': 'QR code does not match this class'}), 400

        # Find the student
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Check if student is enrolled in this class
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this class'}), 400

        # Check if attendance already exists for today
        today = scan_time.date()
        existing_attendance = Attendance.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            attendance_date=today
        ).first()

        if existing_attendance:
            if existing_attendance.qr_code_scanned:
                return jsonify({
                    'success': False,
                    'error': 'Attendance already marked for today',
                    'scan_time': existing_attendance.qr_scan_time.isoformat() if existing_attendance.qr_scan_time else None
                }), 400
            else:
                # Update existing attendance with QR scan
                existing_attendance.qr_code_scanned = True
                existing_attendance.qr_scan_time = scan_time
                existing_attendance.marked_by = current_user_id
                existing_attendance.marked_at = scan_time
                db.session.commit()

                # Update enrollment session counter for monthly payments
                if enrollment.payment_type == 'monthly':
                    enrollment.monthly_sessions_attended += 1
                    db.session.commit()

                return jsonify({
                    'success': True,
                    'message': 'QR attendance marked successfully',
                    'student_name': student.name,
                    'scan_time': scan_time.isoformat(),
                    'sessions_attended': enrollment.monthly_sessions_attended if enrollment.payment_type == 'monthly' else None
                })

        # Create new attendance record
        attendance = Attendance(
            student_id=student_id,
            class_id=class_id,
            attendance_date=today,
            status='present',
            marked_by=current_user_id,
            marked_at=scan_time,
            qr_code_scanned=True,
            qr_scan_time=scan_time
        )

        db.session.add(attendance)

        # Update enrollment session counter for monthly payments
        if enrollment.payment_type == 'monthly':
            enrollment.monthly_sessions_attended += 1

        db.session.commit()

        return jsonify({
            'success': True,
            'message': 'QR attendance marked successfully',
            'student_name': student.name,
            'scan_time': scan_time.isoformat(),
            'sessions_attended': enrollment.monthly_sessions_attended if enrollment.payment_type == 'monthly' else None
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in scan_attendance with QR: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/generate-qr/<int:class_id>', methods=['GET'])
@jwt_required()
def generate_class_qr(class_id):
    """Generate QR code data for a class"""
    try:
        current_user_id = get_jwt_identity()
        current_user = User.query.get(current_user_id)

        if not current_user or current_user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        class_obj = Class.query.get(class_id)
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404

        # Generate QR data in format: student:{student_id}:class:{class_id}
        # This will be embedded in individual student QR codes
        qr_data = f"class:{class_id}"

        # Set QR code expiration (24 hours from now)
        from datetime import timedelta
        expires_at = datetime.utcnow() + timedelta(hours=24)

        # Update class with QR data
        class_obj.qr_code_data = qr_data
        class_obj.qr_code_expires = expires_at
        db.session.commit()

        return jsonify({
            'success': True,
            'qr_data': qr_data,
            'class_name': class_obj.name,
            'course_name': class_obj.course.name if class_obj.course else 'Unknown',
            'expires_at': expires_at.isoformat(),
            'schedule': class_obj.schedule
        })

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in generate_class_qr: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/student-qr/<int:student_id>/<int:class_id>', methods=['GET'])
@jwt_required()
def get_student_class_qr(student_id, class_id):
    """Get QR code data for a specific student and class"""
    try:
        current_user_id = get_jwt_identity()
        claims = get_jwt()
        user_type = claims.get('user_type')

        # Allow admin or the student themselves to access the QR
        if user_type == 'admin':
            pass  # Admin can access any student's QR
        elif user_type == 'student':
            if str(current_user_id) != str(student_id):
                return jsonify({'error': 'Access denied. Students can only view their own QR code.'}), 403
        else:
            return jsonify({'error': 'Unauthorized access'}), 403

        # Verify student exists
        student = Student.query.get(student_id)
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Verify class exists
        class_obj = Class.query.get(class_id)
        if not class_obj:
            return jsonify({'error': 'Class not found'}), 404

        # Verify enrollment
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            class_id=class_id,
            is_active=True
        ).first()

        if not enrollment:
            return jsonify({'error': 'Student not enrolled in this class'}), 400

        # Generate QR data
        qr_data = f"student:{student_id}:class:{class_id}"

        return jsonify({
            'success': True,
            'qr_data': qr_data,
            'student_name': student.name,
            'class_name': class_obj.name,
            'course_name': class_obj.course.name if class_obj.course else 'Unknown',
            'enrollment_type': enrollment.payment_type,
            'schedule': class_obj.schedule
        })

    except Exception as e:
        logger.error(f"Error in get_student_class_qr: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/student/<int:student_id>', methods=['GET'])
@jwt_required()
def get_student_attendance(student_id):
    """Get attendance records for a specific student"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)

        # Check if user can access this student's data
        can_access = False
        if current_user.role == 'admin':
            can_access = True
        elif current_user.role == 'student':
            student = Student.query.filter_by(user_id=current_user_id).first()
            if student and student.id == student_id:
                can_access = True
        elif current_user.role == 'parent':
            parent = Parent.query.filter_by(user_id=current_user_id).first()
            if parent:
                # Check if this student belongs to this parent
                student = Student.query.filter_by(id=student_id, parent_id=parent.id).first()
                if student:
                    can_access = True

        if not can_access:
            return jsonify({'error': 'Access denied'}), 403

        # Get attendance records
        from sqlalchemy import desc
        attendance_records = db.session.query(
            Attendance,
            Class.name.label('class_name'),
            Class.course_id,
            Course.name.label('course_name'),
            Course.course_type.label('payment_type')
        ).join(
            Class, Attendance.class_id == Class.id
        ).join(
            Course, Class.course_id == Course.id
        ).filter(
            Attendance.student_id == student_id
        ).order_by(desc(Attendance.attendance_date)).all()

        # Format results
        attendance_data = []
        for attendance, class_name, course_id, course_name, payment_type in attendance_records:
            attendance_data.append({
                'id': attendance.id,
                'student_id': attendance.student_id,
                'class_id': attendance.class_id,
                'class_name': class_name,
                'course_name': course_name,
                'payment_type': payment_type or 'session',
                'status': attendance.status,
                'attendance_date': attendance.attendance_date.isoformat(),
                'marked_at': attendance.marked_at.isoformat(),
                'marked_by': attendance.marked_by
            })

        # Get student info
        student = Student.query.get(student_id)
        student_info = {
            'id': student.id,
            'name': student.name,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
        } if student else None

        return jsonify({
            'student': student_info,
            'attendance': attendance_data,
            'total_records': len(attendance_data)
        }), 200

    except Exception as e:
        logger.error(f"Error in get_student_attendance: {str(e)}")
        return jsonify({'error': str(e)}), 500

@attendance_bp.route('/parent/<int:parent_user_id>', methods=['GET'])
@jwt_required()
def get_parent_children_attendance(parent_user_id):
    """Get attendance records for all children of a parent"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)

        # Check access permissions
        if current_user.role not in ['admin', 'parent'] or (current_user.role == 'parent' and current_user_id != parent_user_id):
            return jsonify({'error': 'Access denied'}), 403

        # Get parent
        parent = Parent.query.filter_by(user_id=parent_user_id).first()
        if not parent:
            return jsonify({'error': 'Parent not found'}), 404

        # Get all children of this parent
        children = Student.query.filter_by(parent_id=parent.id).all()
        
        all_attendance_data = []
        children_info = []

        for child in children:
            # Get attendance records for this child
            from sqlalchemy import desc
            attendance_records = db.session.query(
                Attendance,
                Class.name.label('class_name'),
                Class.course_id,
                Course.name.label('course_name'),
                Course.pricing_type.label('payment_type')
            ).join(
                Class, Attendance.class_id == Class.id
            ).join(
                Course, Class.course_id == Course.id
            ).filter(
                Attendance.student_id == child.id
            ).order_by(desc(Attendance.attendance_date)).all()

            # Format child's attendance data
            child_attendance = []
            for attendance, class_name, course_id, course_name, payment_type in attendance_records:
                child_attendance.append({
                    'id': attendance.id,
                    'student_id': attendance.student_id,
                    'student_name': child.name,
                    'class_id': attendance.class_id,
                    'class_name': class_name,
                    'course_name': course_name,
                    'payment_type': payment_type or 'session',
                    'status': attendance.status,
                    'attendance_date': attendance.attendance_date.isoformat(),
                    'marked_at': attendance.marked_at.isoformat(),
                    'marked_by': attendance.marked_by
                })

            all_attendance_data.extend(child_attendance)
            
            children_info.append({
                'id': child.id,
                'name': child.name,
                'date_of_birth': child.date_of_birth.isoformat() if child.date_of_birth else None,
                'attendance_count': len(child_attendance)
            })

        # Sort all attendance by date (most recent first)
        all_attendance_data.sort(key=lambda x: x['attendance_date'], reverse=True)

        return jsonify({
            'parent': {
                'id': parent.id,
                'user_id': parent.user_id,
                'full_name': parent.full_name
            },
            'children': children_info,
            'attendance': all_attendance_data,
            'total_records': len(all_attendance_data)
        }), 200

    except Exception as e:
        logger.error(f"Error in get_parent_children_attendance: {str(e)}")
        return jsonify({'error': str(e)}), 500


@attendance_bp.route('/indebted-users', methods=['GET'])
@jwt_required()
def get_indebted_users():
    """Get users with outstanding debt (Admin only)"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        # Get all enrollments with debt
        indebted_enrollments = Enrollment.query.filter(
            Enrollment.total_debt > 0,
            Enrollment.is_active == True
        ).all()

        indebted_users = []
        for enrollment in indebted_enrollments:
            student = enrollment.student
            course = enrollment.class_.course if enrollment.class_ else None

            if student and course:
                indebted_users.append({
                    'id': student.id,
                    'name': student.name,
                    'enrollment_id': enrollment.id,
                    'course_name': course.name,
                    'section_name': enrollment.class_.name if enrollment.class_ else 'Unknown',
                    'total_debt': float(enrollment.total_debt),
                    'debt_sessions': enrollment.debt_sessions or 0,
                    'payment_type': enrollment.payment_type,
                    'monthly_sessions_attended': enrollment.monthly_sessions_attended or 0,
                    'monthly_payment_status': enrollment.monthly_payment_status
                })

        # Sort by debt amount (highest first)
        indebted_users.sort(key=lambda x: x['total_debt'], reverse=True)

        return jsonify(indebted_users), 200

    except Exception as e:
        logger.error(f"Error fetching indebted users: {str(e)}")
        return jsonify({'error': 'Failed to fetch indebted users'}), 500


@attendance_bp.route('/confirm-payment', methods=['POST'])
@jwt_required()
def confirm_payment():
    """Confirm payment for attendance and update enrollment status"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user:
            return jsonify({'error': 'User not found'}), 404

        # Only admins can confirm payments
        if user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        attendance_id = data.get('attendance_id')
        amount = data.get('amount', 0)
        payment_method = data.get('payment_method', 'cash')

        if not attendance_id:
            return jsonify({'error': 'Attendance ID is required'}), 400

        # Get the attendance record
        attendance = Attendance.query.get_or_404(attendance_id)

        # Get the enrollment for this student and class
        enrollment = Enrollment.query.filter_by(
            student_id=attendance.student_id,
            class_id=attendance.class_id
        ).first()

        if not enrollment:
            return jsonify({'error': 'Enrollment not found'}), 404

        # Update attendance with payment information
        attendance.payment_status = 'paid'
        attendance.payment_amount = amount
        attendance.payment_date = datetime.utcnow()
        attendance.payment_method = payment_method

        # Update enrollment based on payment type
        if enrollment.payment_type == 'session':
            # For session payments, reduce debt if any
            if enrollment.total_debt and enrollment.total_debt > 0:
                enrollment.total_debt = max(0, enrollment.total_debt - amount)
                enrollment.debt_sessions = max(0, enrollment.debt_sessions - 1)

        elif enrollment.payment_type == 'monthly':
            # For monthly payments, mark as paid and reset session count
            enrollment.monthly_payment_status = 'paid'
            enrollment.monthly_sessions_attended = 0
            enrollment.last_payment_date = datetime.utcnow()

            # Clear any debt for this enrollment
            enrollment.total_debt = 0
            enrollment.debt_sessions = 0

        # Commit changes
        db.session.commit()

        # Send payment confirmation notification
        try:
            from push_notifications import PushNotificationService
            student = Student.query.get(attendance.student_id)
            course = enrollment.class_.course

            if student and course:
                # Send notification to student
                PushNotificationService.send_push_notification(
                    user_id=student.user_id,
                    title="💳 Payment Confirmed",
                    message=f"Your payment of {amount} DA for {course.name} has been confirmed.",
                    notification_type="payment",
                    extra_data={
                        "payment_amount": amount,
                        "course_name": course.name,
                        "payment_type": enrollment.payment_type
                    }
                )

                # Send notification to parent if different from student
                if student.parent and student.parent.user_id != student.user_id:
                    PushNotificationService.send_push_notification(
                        user_id=student.parent.user_id,
                        title=f"💳 {student.name} - Payment Confirmed",
                        message=f"Payment of {amount} DA for {course.name} has been confirmed.",
                        notification_type="payment",
                        extra_data={
                            "student_name": student.name,
                            "payment_amount": amount,
                            "course_name": course.name,
                            "payment_type": enrollment.payment_type
                        }
                    )
        except Exception as e:
            logger.warning(f"Failed to send payment notification: {str(e)}")

        return jsonify({
            'message': 'Payment confirmed successfully',
            'attendance_id': attendance_id,
            'amount': amount,
            'payment_method': payment_method,
            'enrollment_updated': True
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error confirming payment: {str(e)}")
        return jsonify({'error': 'Failed to confirm payment'}), 500


@attendance_bp.route('/clear-debt', methods=['POST'])
@jwt_required()
def clear_debt():
    """Clear debt for a user"""
    try:
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)

        if not user or user.role != 'admin':
            return jsonify({'error': 'Admin access required'}), 403

        data = request.get_json()
        user_id = data.get('user_id')
        amount = data.get('amount', 0)

        if not user_id or amount <= 0:
            return jsonify({'error': 'Valid user ID and amount are required'}), 400

        # Find student by user_id
        student = Student.query.filter_by(user_id=user_id).first()
        if not student:
            return jsonify({'error': 'Student not found'}), 404

        # Get all active enrollments for this student with debt
        enrollments_with_debt = Enrollment.query.filter(
            Enrollment.student_id == student.id,
            Enrollment.total_debt > 0,
            Enrollment.is_active == True
        ).all()

        if not enrollments_with_debt:
            return jsonify({'error': 'No debt found for this user'}), 404

        total_cleared = 0
        remaining_amount = amount

        # Clear debt from enrollments (prioritize by amount)
        for enrollment in sorted(enrollments_with_debt, key=lambda e: e.total_debt, reverse=True):
            if remaining_amount <= 0:
                break

            debt_to_clear = min(remaining_amount, enrollment.total_debt)
            enrollment.total_debt -= debt_to_clear

            # Reduce debt sessions proportionally
            if enrollment.debt_sessions and enrollment.debt_sessions > 0:
                sessions_to_reduce = min(
                    enrollment.debt_sessions,
                    max(1, int(debt_to_clear / (enrollment.class_.course.price if enrollment.class_ and enrollment.class_.course else 1)))
                )
                enrollment.debt_sessions -= sessions_to_reduce

            total_cleared += debt_to_clear
            remaining_amount -= debt_to_clear

        # Commit changes
        db.session.commit()

        # Send notification
        try:
            from push_notifications import PushNotificationService
            course_names = [e.class_.course.name for e in enrollments_with_debt if e.class_ and e.class_.course]

            PushNotificationService.send_push_notification(
                user_id=user_id,
                title="💰 Debt Cleared",
                message=f"Your debt of {total_cleared} DA has been cleared for {', '.join(course_names[:2])}{'...' if len(course_names) > 2 else ''}.",
                notification_type="payment",
                extra_data={
                    "cleared_amount": total_cleared,
                    "remaining_debt": sum(e.total_debt for e in enrollments_with_debt)
                }
            )

            # Notify parent if different
            if student.parent and student.parent.user_id != user_id:
                PushNotificationService.send_push_notification(
                    user_id=student.parent.user_id,
                    title=f"💰 {student.name} - Debt Cleared",
                    message=f"Debt of {total_cleared} DA has been cleared for {student.name}.",
                    notification_type="payment",
                    extra_data={
                        "student_name": student.name,
                        "cleared_amount": total_cleared
                    }
                )
        except Exception as e:
            logger.warning(f"Failed to send debt cleared notification: {str(e)}")

        return jsonify({
            'message': 'Debt cleared successfully',
            'cleared_amount': total_cleared,
            'remaining_amount': remaining_amount
        }), 200

    except Exception as e:
        db.session.rollback()
        logger.error(f"Error clearing debt: {str(e)}")
        return jsonify({'error': 'Failed to clear debt'}), 500


@attendance_bp.route('/my-attendance', methods=['GET'])
@jwt_required()
def get_my_attendance():
    """Get attendance records for the current logged-in user"""
    try:
        current_user_id = int(get_jwt_identity())
        current_user = User.query.get(current_user_id)

        if not current_user:
            return jsonify({'error': 'User not found'}), 404

        # Find the student record associated with this user
        student = Student.query.filter_by(user_id=current_user_id).first()
        
        if not student:
            # If no direct student record, return empty data
            return jsonify({
                'attendance': [],
                'total_records': 0,
                'student': None
            }), 200

        # Get attendance records for this student
        from sqlalchemy import desc
        attendance_records = db.session.query(
            Attendance,
            Class.name.label('class_name'),
            Class.course_id,
            Course.name.label('course_name'),
            Course.course_type.label('payment_type'),
            Course.price.label('course_price')
        ).join(
            Class, Attendance.class_id == Class.id
        ).join(
            Course, Class.course_id == Course.id
        ).filter(
            Attendance.student_id == student.id
        ).order_by(desc(Attendance.attendance_date)).all()

        # Format results with enhanced data
        attendance_data = []
        for attendance, class_name, course_id, course_name, payment_type, course_price in attendance_records:
            attendance_data.append({
                'id': attendance.id,
                'student_id': attendance.student_id,
                'class_id': attendance.class_id,
                'class_name': class_name,
                'course_name': course_name,
                'payment_type': payment_type or 'session',
                'course_price': float(course_price) if course_price else 0,
                'status': attendance.status,
                'payment_status': attendance.payment_status or 'unpaid',
                'payment_amount': float(attendance.payment_amount) if attendance.payment_amount else None,
                'attendance_date': attendance.attendance_date.isoformat(),
                'marked_at': attendance.marked_at.isoformat() if attendance.marked_at else None,
                'marked_by': attendance.marked_by
            })

        # Get student info with debt information
        student_info = {
            'id': student.id,
            'name': student.name,
            'total_debt': float(student.total_debt) if student.total_debt else 0,
            'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None
        }

        return jsonify({
            'attendance': attendance_data,
            'total_records': len(attendance_data),
            'student': student_info
        }), 200

    except Exception as e:
        logger.error(f"Error in get_my_attendance: {str(e)}")
        return jsonify({'error': str(e)}), 500