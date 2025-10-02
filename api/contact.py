from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from models import db, User, ContactMessage
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import os
from datetime import datetime

contact_bp = Blueprint('contact', __name__)

@contact_bp.route('/', methods=['POST', 'OPTIONS'])
def submit_contact():
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
    """Handle contact form submission"""
    try:
        data = request.get_json()

        # Check if user is authenticated
        try:
            user_id = int(get_jwt_identity())
            user = User.query.get(user_id)
            authenticated = True
        except:
            authenticated = False
            user = None

        required_fields = ['subject', 'message']
        if authenticated:
            # For authenticated users, we already have user info
            pass
        else:
            # For anonymous users, require name and email
            required_fields.extend(['name', 'email'])
            if 'name' not in data or 'email' not in data:
                return jsonify({'error': 'name and email are required for anonymous submissions'}), 400

        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'{field} is required'}), 400

        # Create contact message
        if authenticated:
            contact_message = ContactMessage(
                user_id=user_id,
                subject=data['subject'],
                message=data['message']
            )
        else:
            # For anonymous, we can't store user_id, but we can store name/email in the message
            contact_message = ContactMessage(
                user_id=None,  # Anonymous
                subject=data['subject'],
                message=f"From: {data['name']} ({data['email']})\n\n{data['message']}"
            )

        db.session.add(contact_message)
        db.session.commit()

        # Send email notification to admin (optional)
        try:
            if authenticated:
                send_contact_notification_email(contact_message, user)
            else:
                # For anonymous, create a mock user object
                class MockUser:
                    def __init__(self, name, email):
                        self.full_name = name
                        self.email = email
                mock_user = MockUser(data['name'], data['email'])
                send_contact_notification_email(contact_message, mock_user)
        except Exception as e:
            print(f"Email notification failed: {e}")

        return jsonify({
            'message': 'Message sent successfully! We will get back to you soon.',
            'id': contact_message.id
        }), 200

    except Exception as e:
        print(f"Contact submission error: {e}")
        return jsonify({'error': 'Failed to send message'}), 500

@contact_bp.route('/messages', methods=['GET', 'OPTIONS'])
@jwt_required()
def get_contact_messages():
    """Get all contact messages (Admin only)"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    # Get query parameters
    status_filter = request.args.get('status', 'all')
    limit = int(request.args.get('limit', 50))

    query = ContactMessage.query
    if status_filter != 'all':
        query = query.filter_by(status=status_filter)
    
    messages = query.order_by(ContactMessage.created_at.desc()).limit(limit).all()

    messages_data = []
    for msg in messages:
        messages_data.append({
            'id': msg.id,
            'user_id': msg.user_id,
            'user_name': msg.user.full_name if msg.user else 'Anonymous',
            'user_email': msg.user.email if msg.user else 'N/A',
            'subject': msg.subject,
            'message': msg.message,
            'status': 'unread' if msg.status == 'open' else msg.status,
            'admin_response': msg.admin_response,
            'admin_response_at': msg.admin_response_at.isoformat() if msg.admin_response_at else None,
            'created_at': msg.created_at.isoformat(),
            'updated_at': msg.updated_at.isoformat() if msg.updated_at else None
        })

    return jsonify({'messages': messages_data}), 200

@contact_bp.route('/my-messages', methods=['GET', 'OPTIONS'])
@jwt_required(optional=True)
def get_my_messages():
    """Get user's own contact messages"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
    user_id = int(get_jwt_identity())
    
    messages = ContactMessage.query.filter_by(user_id=user_id).order_by(ContactMessage.created_at.desc()).all()

    messages_data = []
    for msg in messages:
        messages_data.append({
            'id': msg.id,
            'subject': msg.subject,
            'message': msg.message,
            'status': msg.status,
            'admin_response': msg.admin_response,
            'admin_response_at': msg.admin_response_at.isoformat() if msg.admin_response_at else None,
            'created_at': msg.created_at.isoformat(),
            'updated_at': msg.updated_at.isoformat() if msg.updated_at else None
        })

    return jsonify({'messages': messages_data}), 200

@contact_bp.route('/messages/<int:message_id>', methods=['PUT', 'OPTIONS'])
@jwt_required(optional=True)
def update_message_status(message_id):
    """Update message status (Admin only)"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
        
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if not user or user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    new_status = data.get('status')

    # Map frontend status to backend status
    status_mapping = {
        'unread': 'open',
        'open': 'open',
        'responded': 'responded',
        'closed': 'closed'
    }

    if new_status not in status_mapping:
        return jsonify({'error': 'Invalid status'}), 400

    db_status = status_mapping[new_status]

    message = ContactMessage.query.get(message_id)
    if not message:
        return jsonify({'error': 'Message not found'}), 404

    message.status = db_status
    db.session.commit()

    return jsonify({'message': 'Status updated successfully'}), 200

@contact_bp.route('/messages/<int:message_id>/respond', methods=['POST', 'OPTIONS'])
@jwt_required(optional=True)
def respond_to_message(message_id):
    """Admin respond to a contact message"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    data = request.get_json()
    response_text = data.get('response')
    
    if not response_text:
        return jsonify({'error': 'Response text is required'}), 400

    message = ContactMessage.query.get(message_id)
    if not message:
        return jsonify({'error': 'Message not found'}), 404

    message.admin_response = response_text
    message.admin_response_at = datetime.utcnow()
    message.status = 'responded'
    db.session.commit()

    # Send email notification to user
    try:
        send_admin_response_email(message, user)
    except Exception as e:
        print(f"Email notification failed: {e}")

    return jsonify({'message': 'Response sent successfully'}), 200

@contact_bp.route('/messages/<int:message_id>', methods=['DELETE', 'OPTIONS'])
@jwt_required(optional=True)
def delete_message(message_id):
    """Delete a contact message (Admin only)"""
    if request.method == 'OPTIONS':
        return jsonify({'message': 'CORS preflight'}), 200
    user_id = int(get_jwt_identity())
    user = User.query.get(user_id)

    if user.role != 'admin':
        return jsonify({'error': 'Admin access required'}), 403

    message = ContactMessage.query.get(message_id)
    if not message:
        return jsonify({'error': 'Message not found'}), 404

    db.session.delete(message)
    db.session.commit()

    return jsonify({'message': 'Message deleted successfully'}), 200

def send_contact_notification_email(contact_message, user):
    """Send email notification to admin about new contact message"""
    try:
        # Email configuration
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_username = os.environ.get('SMTP_USERNAME')
        smtp_password = os.environ.get('SMTP_PASSWORD')

        if not all([smtp_username, smtp_password]):
            return  # Skip if email not configured

        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = smtp_username  # Send to admin
        msg['Subject'] = f"New Contact Form Message: {contact_message.subject}"

        body = f"""
New contact form submission:

From: {user.full_name} ({user.email})
Subject: {contact_message.subject}

Message:
{contact_message.message}

---
This is an automated notification from the Laws of Success Academy contact form.
"""

        msg.attach(MIMEText(body, 'plain'))

        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)
        server.quit()

    except Exception as e:
        print(f"Failed to send contact notification email: {e}")

def send_admin_response_email(message, admin_user):
    """Send email notification to user about admin response"""
    try:
        # Email configuration
        smtp_server = os.environ.get('SMTP_SERVER', 'smtp.gmail.com')
        smtp_port = int(os.environ.get('SMTP_PORT', 587))
        smtp_username = os.environ.get('SMTP_USERNAME')
        smtp_password = os.environ.get('SMTP_PASSWORD')

        if not all([smtp_username, smtp_password]):
            return  # Skip if email not configured

        # Create message
        msg = MIMEMultipart()
        msg['From'] = smtp_username
        msg['To'] = message.user.email
        msg['Subject'] = f"Response to your message: {message.subject}"

        body = f"""
Dear {message.user.full_name},

We have responded to your message regarding "{message.subject}".

Your original message:
{message.message}

Admin Response:
{message.admin_response}

---
Best regards,
Laws of Success Academy
"""

        msg.attach(MIMEText(body, 'plain'))

        # Send email
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(smtp_username, smtp_password)
        server.send_message(msg)
        server.quit()

    except Exception as e:
        print(f"Failed to send admin response email: {e}")
