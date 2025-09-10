import os
import secrets
from datetime import datetime, timedelta
from flask import current_app
from flask_mail import Message
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import qrcode
from PIL import Image
import io
import base64

# Remove the circular import - we'll import mail lazily in functions

def hash_password(password):
    return generate_password_hash(password)

def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)

def generate_verification_token():
    return secrets.token_urlsafe(32)

def generate_password_reset_token():
    return secrets.token_urlsafe(32)

def generate_mobile_credentials():
    """Generate username and password for mobile app access"""
    username = f"stu{secrets.token_hex(4)}"
    password = secrets.token_hex(8)
    return username, password

def generate_parent_mobile_credentials(parent_name):
    """Generate username and password for parent mobile app access"""
    # Clean the name and create username: firstname + random numbers
    clean_name = ''.join(c for c in parent_name.split()[0] if c.isalnum()).lower()
    random_suffix = str(secrets.randbelow(9000) + 1000)  # 4-digit random number
    username = f"{clean_name}{random_suffix}"
    password = secrets.token_hex(8)
    return username, password

def generate_student_mobile_credentials(student_name):
    """Generate username and password for student mobile app access"""
    # Clean the name and create username: firstname + random numbers
    clean_name = ''.join(c for c in student_name.split()[0] if c.isalnum()).lower()
    random_suffix = str(secrets.randbelow(9000) + 1000)  # 4-digit random number
    username = f"{clean_name}{random_suffix}"
    password = secrets.token_hex(8)
    return username, password

def send_email(to, subject, html_body, text_body=None):
    """Send email using Flask-Mail"""
    # Lazy import to avoid circular dependency
    try:
        from app import mail as app_mail
        msg = Message(subject, recipients=[to], html=html_body)
        if text_body:
            msg.body = text_body
        app_mail.send(msg)
    except ImportError:
        # Fallback if import fails
        print(f"Failed to send email to {to}: Mail service not available")

def generate_qr_code(data, size=200):
    """Generate QR code and return as base64 string"""
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill='black', back_color='white')
    img = img.resize((size, size), Image.Resampling.LANCZOS)

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    img_str = base64.b64encode(buffer.getvalue()).decode()
    return f"data:image/png;base64,{img_str}"

def create_email_template(title, content, button_text=None, button_url=None):
    """Create beautiful HTML email template"""
    # For email templates, it's better to use a hosted logo URL instead of base64
    # to avoid issues with email clients truncating long base64 strings
    logo_html = "<h1 style='color: white; margin: 0; font-size: 24px;'>Laws of Success Academy</h1>"

    # Try to use base64 logo, but fall back to text if it's too large
    try:
        logo_path = os.path.join(current_app.root_path, '..', '..', 'public', 'logo.png')
        if os.path.exists(logo_path) and os.path.getsize(logo_path) < 100000:  # Less than 100KB
            with open(logo_path, 'rb') as f:
                logo_data = base64.b64encode(f.read()).decode()
            logo_html = f"<img src='data:image/png;base64,{logo_data}' alt='Laws of Success Academy' class='logo' style='max-width: 150px; height: auto;' />"
    except Exception as e:
        # If logo loading fails, use text fallback
        print(f"Logo loading failed: {e}")
        pass

    template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f8fafc; }}
            .container {{ max-width: 600px; margin: 0 auto; background-color: #ffffff; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center; }}
            .logo {{ max-width: 150px; height: auto; }}
            .content {{ padding: 40px 30px; color: #334155; line-height: 1.6; }}
            .button {{ display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }}
            .footer {{ background-color: #f1f5f9; padding: 30px; text-align: center; color: #64748b; font-size: 14px; }}
            .highlight {{ background-color: #f1f5f9; padding: 20px; border-radius: 8px; margin: 20px 0; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                {logo_html}
            </div>
            <div class="content">
                <h2 style="color: #1e293b; margin-bottom: 20px;">{title}</h2>
                {content}
                {f"<a href='{button_url}' class='button'>{button_text}</a>" if button_text and button_url else ""}
            </div>
            <div class="footer">
                <p>© 2024 Laws of Success Academy. All rights reserved.</p>
                <p>For support, contact us at support@lawsofsuccess.com</p>
            </div>
        </div>
    </body>
    </html>
    """
    return template

def send_verification_email(user_email, verification_token):
    """Send email verification link"""
    verification_url = f"{current_app.config.get('FRONTEND_URL', 'http://localhost:5173')}/verify-email?token={verification_token}"

    content = """
    <p>Welcome to Laws of Success Academy!</p>
    <p>Thank you for registering with us. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
    <div class="highlight">
        <p><strong>Important:</strong> This verification link will expire in 24 hours. Please click the button below to verify your email.</p>
    </div>
    """

    html_body = create_email_template(
        "Verify Your Email - Laws of Success Academy",
        content,
        "Verify Email",
        verification_url
    )

    send_email(user_email, "Verify Your Email - Laws of Success Academy", html_body)

def send_registration_approved_email(user_email, student_name, course_name, parent_username, parent_password, student_username, student_password):
    """Send registration approval email with mobile credentials for both parent and student"""
    content = f"""
    <p>Congratulations! Your registration has been approved.</p>
    <div class="highlight">
        <h3>Registration Details:</h3>
        <p><strong>Student:</strong> {student_name}</p>
        <p><strong>Course:</strong> {course_name}</p>
    </div>
    <div class="highlight">
        <h3>Parent Mobile App Credentials:</h3>
        <p><strong>Username:</strong> {parent_username}</p>
        <p><strong>Password:</strong> {parent_password}</p>
        <p style="color: #dc2626;"><strong>Important:</strong> Please save these credentials securely. You can change your password after first login.</p>
    </div>
    <div class="highlight">
        <h3>Student Mobile App Credentials:</h3>
        <p><strong>Username:</strong> {student_username}</p>
        <p><strong>Password:</strong> {student_password}</p>
        <p style="color: #dc2626;"><strong>Important:</strong> Please save these credentials securely. You can change your password after first login.</p>
    </div>
    <p>You can now download our mobile app and log in with the credentials above to access:</p>
    <ul>
        <li>Weekly schedule and class times</li>
        <li>Real-time attendance tracking with QR codes</li>
        <li>Progress reports and grades</li>
        <li>Payment information and due dates</li>
        <li>Direct communication with teachers</li>
    </ul>
    <p><strong>For Students:</strong> Make sure to scan the QR code provided by your teacher at the beginning of each class to mark your attendance.</p>
    <p><strong>For Parents:</strong> You can monitor your child's attendance, view payment schedules, and receive notifications about important updates.</p>
    """

    html_body = create_email_template(
        "Registration Approved - Mobile App Credentials",
        content
    )

    send_email(user_email, "Registration Approved - Laws of Success Academy", html_body)

def send_payment_reminder_email(user_email, student_name, amount_due, due_date):
    """Send payment reminder email"""
    content = f"""
    <p>This is a friendly reminder about your upcoming payment.</p>
    <div class="highlight">
        <h3>Payment Details:</h3>
        <p><strong>Student:</strong> {student_name}</p>
        <p><strong>Amount Due:</strong> {amount_due} DA</p>
        <p><strong>Due Date:</strong> {due_date.strftime('%B %d, %Y')}</p>
    </div>
    <p>Please ensure payment is made before the due date to avoid any service interruptions.</p>
    """

    html_body = create_email_template(
        "Payment Reminder - Laws of Success Academy",
        content,
        "Make Payment",
        f"{current_app.config.get('FRONTEND_URL', 'http://localhost:3000')}/payments"
    )

    send_email(user_email, "Payment Reminder - Laws of Success Academy", html_body)

def send_attendance_notification_email(parent_email, student_name, class_name, attendance_date, status):
    """Send attendance notification to parent"""
    status_colors = {
        'present': '#10b981',
        'absent': '#ef4444',
        'late': '#f59e0b'
    }

    content = f"""
    <p>Here's the attendance update for your child:</p>
    <div class="highlight">
        <h3>Attendance Details:</h3>
        <p><strong>Student:</strong> {student_name}</p>
        <p><strong>Class:</strong> {class_name}</p>
        <p><strong>Date:</strong> {attendance_date.strftime('%B %d, %Y')}</p>
        <p><strong>Status:</strong> <span style="color: {status_colors.get(status, '#6b7280')}; font-weight: bold;">{status.title()}</span></p>
    </div>
    """

    if status == 'absent':
        content += "<p style='color: #dc2626;'>If you believe this is an error, please contact the administration.</p>"

    html_body = create_email_template(
        "Attendance Notification - Laws of Success Academy",
        content
    )

    send_email(parent_email, f"Attendance Update - {student_name}", html_body)

def send_manual_registration_email(user_email, student_name, course_name, parent_username, parent_password, student_username, student_password):
    """Send manual registration email with mobile credentials"""
    content = f"""
    <p>Welcome to Laws of Success Academy!</p>
    <div class="highlight">
        <h3>Registration Details:</h3>
        <p><strong>Student:</strong> {student_name}</p>
        <p><strong>Course:</strong> {course_name}</p>
        <p><em>This registration was created by our administration team.</em></p>
    </div>
    <div class="highlight">
        <h3>Parent Mobile App Credentials:</h3>
        <p><strong>Username:</strong> {parent_username}</p>
        <p><strong>Password:</strong> {parent_password}</p>
        <p style="color: #dc2626;"><strong>Important:</strong> Please save these credentials securely. You can change your password after first login.</p>
    </div>
    <div class="highlight">
        <h3>Student Mobile App Credentials:</h3>
        <p><strong>Username:</strong> {student_username}</p>
        <p><strong>Password:</strong> {student_password}</p>
        <p style="color: #dc2626;"><strong>Important:</strong> Please save these credentials securely. You can change your password after first login.</p>
    </div>
    <p>You can now download our mobile app and log in with the credentials above to access:</p>
    <ul>
        <li>Weekly schedule and class times</li>
        <li>Real-time attendance tracking with QR codes</li>
        <li>Progress reports and grades</li>
        <li>Payment information and due dates</li>
        <li>Direct communication with teachers</li>
    </ul>
    <p><strong>For Students:</strong> Make sure to scan the QR code provided by your teacher at the beginning of each class to mark your attendance.</p>
    <p><strong>For Parents:</strong> You can monitor your child's attendance, view payment schedules, and receive notifications about important updates.</p>
    <p>If you have any questions, please don't hesitate to contact our administration team.</p>
    """

    html_body = create_email_template(
        "Welcome to Laws of Success Academy - Mobile App Credentials",
        content
    )

    send_email(user_email, "Welcome to Laws of Success Academy", html_body)

def send_registration_rejected_email(user_email, student_name, course_name, rejection_reason=""):
    """Send registration rejection email"""
    content = f"""
    <p>We regret to inform you that your registration request has been reviewed and cannot be approved at this time.</p>
    <div class="highlight">
        <h3>Registration Details:</h3>
        <p><strong>Student:</strong> {student_name}</p>
        <p><strong>Course:</strong> {course_name}</p>
    </div>
    """

    if rejection_reason:
        content += f"""
    <div class="highlight">
        <h3>Reason for Rejection:</h3>
        <p>{rejection_reason}</p>
    </div>
    """

    content += """
    <p>We understand this may be disappointing, and we appreciate your interest in Laws of Success Academy.</p>
    <p>You may:</p>
    <ul>
        <li>Contact our administration team to discuss alternative options</li>
        <li>Apply for a different course that may be more suitable</li>
        <li>Reapply for this course in a future semester</li>
    </ul>
    <p>For further information or to discuss your options, please contact us at:</p>
    <p><strong>Phone:</strong> 0549322594</p>
    <p><strong>Email:</strong> info@lawsofsuccess.com</p>
    <p>We wish you the best in your educational journey.</p>
    """

    html_body = create_email_template(
        "Registration Update - Laws of Success Academy",
        content
    )

    send_email(user_email, f"Registration Update - {student_name}", html_body)
