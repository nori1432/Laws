from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import re

db = SQLAlchemy()

# Phone number validation regex
PHONE_REGEX = r'^0(5|6|7)\d{8}$'

# Database Models
class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=True)
    password_hash = db.Column(db.String(255), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    role = db.Column(db.Enum('user', 'admin'), default='user')
    email_verified = db.Column(db.Boolean, default=False)
    email_verification_token = db.Column(db.String(255))
    password_reset_token = db.Column(db.String(255))
    password_reset_expires = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    parents = db.relationship('Parent', backref='user', lazy=True)
    registrations = db.relationship('Registration', backref='user', lazy=True)

class Parent(db.Model):
    __tablename__ = 'parents'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    full_name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    email = db.Column(db.String(120), nullable=True)
    mobile_username = db.Column(db.String(50), unique=True)
    mobile_password_hash = db.Column(db.String(255))
    mobile_app_enabled = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    students = db.relationship('Student', backref='parent', lazy=True)
    registrations = db.relationship('Registration', backref='parent', lazy=True)

class Student(db.Model):
    __tablename__ = 'students'

    id = db.Column(db.Integer, primary_key=True)
    parent_id = db.Column(db.Integer, db.ForeignKey('parents.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    date_of_birth = db.Column(db.Date, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Mobile app credentials for student
    mobile_username = db.Column(db.String(50), unique=True)
    mobile_password_hash = db.Column(db.String(255))
    mobile_app_enabled = db.Column(db.Boolean, default=False)

    # Relationships
    enrollments = db.relationship('Enrollment', backref='student', lazy=True)
    attendances = db.relationship('Attendance', backref='student', lazy=True)

class Course(db.Model):
    __tablename__ = 'courses'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    name_ar = db.Column(db.String(200))  # Arabic name
    name_en = db.Column(db.String(200))  # English name
    description = db.Column(db.Text)
    description_ar = db.Column(db.Text)  # Arabic description
    description_en = db.Column(db.Text)  # English description
    price = db.Column(db.Numeric(10, 2), nullable=False)  # Main price field (session or monthly based on pricing_type)
    max_students = db.Column(db.Integer, nullable=False)
    category = db.Column(db.String(50), nullable=False, default='General')  # Primary School, Middle School, High School, Preschool
    image_url = db.Column(db.String(500))  # URL to course image on imgbb
    is_active = db.Column(db.Boolean, default=True)
    qr_code_data = db.Column(db.Text)  # Base64 encoded QR code image
    qr_code_expires = db.Column(db.DateTime)  # When the QR code expires
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # New pricing fields for Algerian Dinar (DA) pricing
    pricing_type = db.Column(db.Enum('session', 'monthly'), default='session')  # session = per session, monthly = monthly fee
    session_duration = db.Column(db.Integer)  # Duration in hours (2, 4, etc.)
    monthly_price = db.Column(db.Numeric(10, 2))  # Monthly price in DA (for monthly pricing)
    session_price = db.Column(db.Numeric(10, 2))  # Per session price in DA (for session pricing)

    # Relationships
    registrations = db.relationship('Registration', backref='course', lazy=True)
    classes = db.relationship('Class', backref='course', lazy=True)

    def get_name(self, language='en'):
        """Get course name in specified language"""
        if language == 'ar' and self.name_ar:
            return self.name_ar
        elif language == 'en' and self.name_en:
            return self.name_en
        return self.name  # Fallback to default name

    def get_description(self, language='en'):
        """Get course description in specified language"""
        if language == 'ar' and self.description_ar:
            return self.description_ar
        elif language == 'en' and self.description_en:
            return self.description_en
        return self.description  # Fallback to default description

    @property
    def total_seats(self):
        """Calculate total seats from all active sections"""
        return sum(cls.max_students for cls in self.classes if cls.is_active)

    @property
    def available_seats(self):
        """Calculate available seats from all active sections"""
        total_seats = self.total_seats
        if total_seats == 0:
            return self.max_students  # Fallback to course max_students if no sections

        # Count current registrations across all sections
        registration_count = 0
        for cls in self.classes:
            if cls.is_active:
                registration_count += Enrollment.query.filter_by(
                    class_id=cls.id,
                    is_active=True
                ).count()

        return max(0, total_seats - registration_count)

class Gallery(db.Model):
    __tablename__ = 'gallery'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text)
    image_url = db.Column(db.String(500), nullable=False)  # URL to image on imgbb
    category = db.Column(db.String(50), nullable=False)  # Classroom, Activities, Facilities, Events
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Registration(db.Model):
    __tablename__ = 'registrations'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('parents.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    status = db.Column(db.Enum('pending', 'approved', 'rejected'), default='pending')
    payment_status = db.Column(db.Enum('unpaid', 'paid', 'partial'), default='unpaid')
    payment_date = db.Column(db.DateTime)
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    payments = db.relationship('Payment', backref='registration', lazy=True)

class Class(db.Model):
    __tablename__ = 'classes'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    name = db.Column(db.String(200), nullable=False)
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    max_students = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # QR Code for attendance
    qr_code_data = db.Column(db.String(255))  # Unique identifier for QR code
    qr_code_expires = db.Column(db.DateTime)  # When QR code expires

    # Relationships
    enrollments = db.relationship('Enrollment', backref='class_', lazy=True)
    attendances = db.relationship('Attendance', backref='class_', lazy=True)

    @property
    def schedule(self):
        """Generate schedule string from day_of_week, start_time, end_time"""
        if self.day_of_week is not None and self.day_of_week != -1 and self.start_time and self.end_time:
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            day_name = days[self.day_of_week] if 0 <= self.day_of_week < len(days) else 'Unknown'
            start_str = self.start_time.strftime('%H:%M') if self.start_time else '00:00'
            end_str = self.end_time.strftime('%H:%M') if self.end_time else '00:00'
            return f"{day_name} {start_str}-{end_str}"
        return 'TBD'

    @property
    def current_students(self):
        """Get current number of active enrollments"""
        return Enrollment.query.filter_by(class_id=self.id, is_active=True).count()

    @property
    def section_name(self):
        """Alias for name to match frontend expectations"""
        return self.name

class Enrollment(db.Model):
    __tablename__ = 'enrollments'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class Attendance(db.Model):
    __tablename__ = 'attendances'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    class_id = db.Column(db.Integer, db.ForeignKey('classes.id'), nullable=False)
    attendance_date = db.Column(db.Date, nullable=False)
    status = db.Column(db.Enum('present', 'absent', 'late'), default='present')
    marked_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    marked_at = db.Column(db.DateTime, default=datetime.utcnow)

    # QR Code attendance tracking
    qr_code_scanned = db.Column(db.Boolean, default=False)
    qr_scan_time = db.Column(db.DateTime)
    device_info = db.Column(db.String(255))  # Mobile device information

class Payment(db.Model):
    __tablename__ = 'payments'

    id = db.Column(db.Integer, primary_key=True)
    registration_id = db.Column(db.Integer, db.ForeignKey('registrations.id'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    due_date = db.Column(db.Date, nullable=False)
    paid_date = db.Column(db.Date)
    status = db.Column(db.Enum('pending', 'paid', 'overdue'), default='pending')
    payment_method = db.Column(db.String(50))
    transaction_id = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class AuditLog(db.Model):
    __tablename__ = 'audit_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    action = db.Column(db.String(100), nullable=False)
    resource_type = db.Column(db.String(50), nullable=False)
    resource_id = db.Column(db.Integer)
    details = db.Column(db.Text)
    ip_address = db.Column(db.String(45))
    user_agent = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class Notification(db.Model):
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    type = db.Column(db.Enum('info', 'warning', 'success', 'error'), default='info')
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='notifications', lazy=True)

class CourseSection(db.Model):
    __tablename__ = 'course_sections'

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    section_name = db.Column(db.String(100), nullable=False)  # e.g., "Section 1", "Section 2"
    day_of_week = db.Column(db.Integer, nullable=False)  # 0=Monday, 6=Sunday
    start_time = db.Column(db.Time, nullable=False)
    end_time = db.Column(db.Time, nullable=False)
    max_students = db.Column(db.Integer, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships
    course = db.relationship('Course', backref='sections', lazy=True)
    enrollments = db.relationship('SectionEnrollment', backref='section', lazy=True)

class SectionEnrollment(db.Model):
    __tablename__ = 'section_enrollments'

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('students.id'), nullable=False)
    section_id = db.Column(db.Integer, db.ForeignKey('course_sections.id'), nullable=False)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)

class UserSettings(db.Model):
    __tablename__ = 'user_settings'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    
    # Notification preferences
    email_notifications = db.Column(db.Boolean, default=True)
    sms_notifications = db.Column(db.Boolean, default=False)
    push_notifications = db.Column(db.Boolean, default=True)
    
    # Privacy settings
    profile_visibility = db.Column(db.Enum('public', 'private'), default='public')
    
    # Language and display
    language = db.Column(db.String(10), default='en')
    timezone = db.Column(db.String(50), default='UTC')
    
    # Course preferences
    favorite_categories = db.Column(db.Text)  # JSON string of category preferences
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = db.relationship('User', backref='settings', lazy=True)

# Add to_dict methods to models for serialization
def user_to_dict(user, exclude_password=True):
    """Convert User model to dictionary"""
    data = {
        'id': user.id,
        'email': user.email,
        'full_name': user.full_name,
        'phone': user.phone,
        'role': user.role,
        'email_verified': user.email_verified,
        'created_at': user.created_at.isoformat() if user.created_at else None
    }
    if not exclude_password:
        data['password_hash'] = user.password_hash
    return data

def student_to_dict(student):
    """Convert Student model to dictionary"""
    return {
        'id': student.id,
        'parent_id': student.parent_id,
        'name': student.name,
        'date_of_birth': student.date_of_birth.isoformat() if student.date_of_birth else None,
        'mobile_username': student.mobile_username,
        'mobile_app_enabled': student.mobile_app_enabled,
        'created_at': student.created_at.isoformat() if student.created_at else None
    }

def course_to_dict(course):
    """Convert Course model to dictionary"""
    return {
        'id': course.id,
        'name': course.name,
        'description': course.description,
        'price': float(course.price) if course.price else 0,
        'max_students': course.max_students,
        'category': course.category,
        'image_url': course.image_url,
        'is_active': course.is_active,
        'created_at': course.created_at.isoformat() if course.created_at else None,
        'updated_at': course.updated_at.isoformat() if course.updated_at else None
    }

def registration_to_dict(registration):
    """Convert Registration model to dictionary"""
    return {
        'id': registration.id,
        'user_id': registration.user_id,
        'course_id': registration.course_id,
        'student_id': registration.student_id,
        'status': registration.status,
        'notes': registration.notes,
        'created_at': registration.created_at.isoformat() if registration.created_at else None,
        'updated_at': registration.updated_at.isoformat() if registration.updated_at else None
    }

def class_to_dict(class_obj):
    """Convert Class model to dictionary"""
    return {
        'id': class_obj.id,
        'course_id': class_obj.course_id,
        'name': class_obj.name,
        'day_of_week': class_obj.day_of_week,
        'start_time': class_obj.start_time.strftime('%H:%M') if class_obj.start_time else None,
        'end_time': class_obj.end_time.strftime('%H:%M') if class_obj.end_time else None,
        'max_students': class_obj.max_students,
        'is_active': class_obj.is_active,
        'qr_code_data': class_obj.qr_code_data,
        'qr_code_expires': class_obj.qr_code_expires.isoformat() if class_obj.qr_code_expires else None,
        'created_at': class_obj.created_at.isoformat() if class_obj.created_at else None
    }

def enrollment_to_dict(enrollment):
    """Convert Enrollment model to dictionary"""
    return {
        'id': enrollment.id,
        'student_id': enrollment.student_id,
        'class_id': enrollment.class_id,
        'enrollment_date': enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
        'is_active': enrollment.is_active
    }

def attendance_to_dict(attendance):
    """Convert Attendance model to dictionary"""
    return {
        'id': attendance.id,
        'student_id': attendance.student_id,
        'class_id': attendance.class_id,
        'attendance_date': attendance.attendance_date.isoformat() if attendance.attendance_date else None,
        'status': attendance.status,
        'marked_by': attendance.marked_by,
        'marked_at': attendance.marked_at.isoformat() if attendance.marked_at else None,
        'qr_code_scanned': attendance.qr_code_scanned,
        'qr_scan_time': attendance.qr_scan_time.isoformat() if attendance.qr_scan_time else None,
        'device_info': attendance.device_info
    }

def payment_to_dict(payment):
    """Convert Payment model to dictionary"""
    return {
        'id': payment.id,
        'registration_id': payment.registration_id,
        'amount': float(payment.amount) if payment.amount else 0,
        'due_date': payment.due_date.isoformat() if payment.due_date else None,
        'paid_date': payment.paid_date.isoformat() if payment.paid_date else None,
        'status': payment.status,
        'payment_method': payment.payment_method,
        'transaction_id': payment.transaction_id,
        'created_at': payment.created_at.isoformat() if payment.created_at else None
    }

def notification_to_dict(notification):
    """Convert Notification model to dictionary"""
    return {
        'id': notification.id,
        'user_id': notification.user_id,
        'title': notification.title,
        'message': notification.message,
        'type': notification.type,
        'is_read': notification.is_read,
        'created_at': notification.created_at.isoformat() if notification.created_at else None
    }

def gallery_to_dict(gallery):
    """Convert Gallery model to dictionary"""
    return {
        'id': gallery.id,
        'title': gallery.title,
        'description': gallery.description,
        'image_url': gallery.image_url,
        'category': gallery.category,
        'is_active': gallery.is_active,
        'created_at': gallery.created_at.isoformat() if gallery.created_at else None,
        'updated_at': gallery.updated_at.isoformat() if gallery.updated_at else None
    }

def notification_to_dict(notification):
    """Convert Notification model to dictionary"""
    return {
        'id': notification.id,
        'user_id': notification.user_id,
        'title': notification.title,
        'message': notification.message,
        'type': notification.type,
        'is_read': notification.is_read,
        'created_at': notification.created_at.isoformat() if notification.created_at else None
    }

def course_section_to_dict(section):
    """Convert CourseSection model to dictionary"""
    return {
        'id': section.id,
        'course_id': section.course_id,
        'section_name': section.section_name,
        'day_of_week': section.day_of_week,
        'start_time': section.start_time.strftime('%H:%M') if section.start_time else None,
        'end_time': section.end_time.strftime('%H:%M') if section.end_time else None,
        'max_students': section.max_students,
        'is_active': section.is_active,
        'created_at': section.created_at.isoformat() if section.created_at else None
    }

def user_settings_to_dict(settings):
    """Convert UserSettings model to dictionary"""
    return {
        'id': settings.id,
        'user_id': settings.user_id,
        'email_notifications': settings.email_notifications,
        'sms_notifications': settings.sms_notifications,
        'push_notifications': settings.push_notifications,
        'profile_visibility': settings.profile_visibility,
        'language': settings.language,
        'timezone': settings.timezone,
        'favorite_categories': settings.favorite_categories,
        'created_at': settings.created_at.isoformat() if settings.created_at else None,
        'updated_at': settings.updated_at.isoformat() if settings.updated_at else None
    }

# Validation functions
def validate_phone(phone):
    return re.match(PHONE_REGEX, phone) is not None

def validate_email(email):
    return re.match(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$', email) is not None
